use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::error::{ErrorCode, ManagerError};
use crate::toggle::IssueEvent;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UninstallResult {
    pub mod_id: String,
    pub trashed_path: String,
    pub issues: Vec<IssueEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct LinkSidecar {
    version: u32,
    mod_id: String,
    links: Vec<String>,
}

pub fn uninstall_managed_mod(
    managed_root: &Path,
    game_mods_dir: &Path,
    trash_files_dir: &Path,
    mod_id: &str,
) -> Result<UninstallResult, ManagerError> {
    let mod_root = managed_root.join("mods").join(mod_id);
    let has_managed_meta = mod_root.is_dir();
    let installed_targets = installed_group_targets(game_mods_dir, mod_id)?;
    if !has_managed_meta && installed_targets.is_empty() {
        return Err(ManagerError::new(
            ErrorCode::NotFound,
            format!("Mod not found in managed storage or game Mods folder: {mod_id}"),
        ));
    }

    if !game_mods_dir.is_dir() {
        return Err(ManagerError::new(
            ErrorCode::InvalidPath,
            format!("Game Mods dir invalid: {}", game_mods_dir.display()),
        ));
    }

    let issues = if has_managed_meta {
        remove_manager_links(managed_root, game_mods_dir, mod_id)?
    } else {
        vec![]
    };
    fs::create_dir_all(trash_files_dir).map_err(|e| {
        ManagerError::new(
            ErrorCode::IoError,
            format!("Trash dir create failed {}: {e}", trash_files_dir.display()),
        )
    })?;

    let trashed_name = format!("{}-{}", mod_id, unix_millis());
    let trashed = trash_files_dir.join(&trashed_name);
    if !installed_targets.is_empty() {
        fs::create_dir_all(&trashed).map_err(|e| {
            ManagerError::new(
                ErrorCode::IoError,
                format!("Trash item dir create failed {}: {e}", trashed.display()),
            )
        })?;
        for target in installed_targets {
            let name = target
                .file_name()
                .ok_or_else(|| ManagerError::new(ErrorCode::InvalidPath, "Installed mod path has no file name"))?;
            fs::rename(&target, trashed.join(name)).map_err(|e| {
                ManagerError::new(
                    ErrorCode::IoError,
                    format!("Move installed mod to trash failed {}: {e}", target.display()),
                )
            })?;
        }
        if has_managed_meta {
            fs::rename(&mod_root, trashed.join("metadata")).map_err(|e| {
                ManagerError::new(
                    ErrorCode::IoError,
                    format!("Move metadata to trash failed {}: {e}", mod_root.display()),
                )
            })?;
        }
    } else {
        fs::rename(&mod_root, &trashed).map_err(|e| {
            ManagerError::new(
                ErrorCode::IoError,
                format!("Move to trash failed {} -> {}: {e}", mod_root.display(), trashed.display()),
            )
        })?;
    }

    write_trashinfo(trash_files_dir, &trashed_name, &mod_root)?;

    Ok(UninstallResult {
        mod_id: mod_id.to_string(),
        trashed_path: trashed.to_string_lossy().to_string(),
        issues,
    })
}

fn installed_group_targets(game_mods_dir: &Path, mod_id: &str) -> Result<Vec<PathBuf>, ManagerError> {
    let folder = game_mods_dir.join(mod_id);
    if folder.is_dir() && !is_symlink(&folder)? {
        return Ok(vec![folder]);
    }

    let mut targets = vec![];
    let entries = match fs::read_dir(game_mods_dir) {
        Ok(entries) => entries,
        Err(_) => return Ok(targets),
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(meta) = fs::symlink_metadata(&path) else {
            continue;
        };
        if meta.is_dir() || meta.file_type().is_symlink() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if filename_prefix(name) == mod_id {
            targets.push(path);
        }
    }

    Ok(targets)
}

fn is_symlink(path: &Path) -> Result<bool, ManagerError> {
    fs::symlink_metadata(path)
        .map(|meta| meta.file_type().is_symlink())
        .map_err(|e| ManagerError::new(ErrorCode::IoError, format!("symlink metadata failed {}: {e}", path.display())))
}

fn filename_prefix(filename: &str) -> &str {
    let stem = filename.split('.').next().unwrap_or(filename);
    stem.split(['_', '-', ' ']).next().unwrap_or(stem)
}

fn remove_manager_links(
    managed_root: &Path,
    game_mods_dir: &Path,
    mod_id: &str,
) -> Result<Vec<IssueEvent>, ManagerError> {
    let sidecar_path = managed_root.join("mods").join(mod_id).join("links.json");
    let raw = match fs::read_to_string(&sidecar_path) {
        Ok(raw) => raw,
        Err(_) => return Ok(vec![]),
    };

    let sidecar: LinkSidecar = serde_json::from_str(&raw).map_err(|e| {
        ManagerError::new(
            ErrorCode::InvalidPath,
            format!("Link sidecar malformed: {e}"),
        )
    })?;

    let mut issues = vec![];
    let managed_files_root = managed_root.join("mods").join(mod_id).join("files");
    for rel in sidecar.links {
        let dst = game_mods_dir.join(&rel);
        if !dst.exists() {
            continue;
        }

        let meta = fs::symlink_metadata(&dst).map_err(|e| {
            ManagerError::new(
                ErrorCode::IoError,
                format!("symlink metadata failed {}: {e}", dst.display()),
            )
        })?;

        if !meta.file_type().is_symlink() {
            issues.push(issue_for_skipped_link(&rel, "not manager symlink"));
            continue;
        }

        let target = fs::read_link(&dst).map_err(|e| {
            ManagerError::new(
                ErrorCode::IoError,
                format!("readlink failed {}: {e}", dst.display()),
            )
        })?;

        if !target.starts_with(&managed_files_root) {
            issues.push(issue_for_skipped_link(&rel, "symlink target outside managed mod"));
            continue;
        }

        fs::remove_file(&dst).map_err(|e| {
            ManagerError::new(
                ErrorCode::IoError,
                format!("Remove symlink failed {}: {e}", dst.display()),
            )
        })?;
    }

    Ok(issues)
}

fn issue_for_skipped_link(rel: &str, _reason: &str) -> IssueEvent {
    IssueEvent {
        id: format!("uninstall-skip:{rel}"),
        severity: "warning".to_string(),
        message: format!("Skipped unmanaged file during uninstall: {rel}"),
        code: Some("EXTERNAL_LINK".to_string()),
    }
}

fn write_trashinfo(trash_files_dir: &Path, trashed_name: &str, original_path: &Path) -> Result<(), ManagerError> {
    let Some(trash_root) = trash_files_dir.parent() else {
        return Ok(());
    };
    let info_dir = trash_root.join("info");
    fs::create_dir_all(&info_dir).map_err(|e| {
        ManagerError::new(
            ErrorCode::IoError,
            format!("Trash info dir create failed {}: {e}", info_dir.display()),
        )
    })?;
    let deletion_date = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S");
    let content = format!(
        "[Trash Info]\nPath={}\nDeletionDate={}\n",
        original_path.to_string_lossy(),
        deletion_date
    );
    fs::write(info_dir.join(format!("{trashed_name}.trashinfo")), content).map_err(|e| {
        ManagerError::new(
            ErrorCode::IoError,
            format!("Trash info write failed: {e}"),
        )
    })
}

fn unix_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::TempDir;

    use crate::managed_storage::{create_managed_mod, ImportRequest};
    use crate::toggle::apply_toggle;

    use super::uninstall_managed_mod;

    fn setup(tmp: &TempDir) -> (String, std::path::PathBuf) {
        let import = tmp.path().join("import/modA");
        fs::create_dir_all(&import).expect("import dir");
        fs::write(import.join("a.package"), b"AAA").expect("a");

        let meta = create_managed_mod(
            tmp.path(),
            ImportRequest {
                name: "ModA".to_string(),
                slug: None,
                source_dir: import,
            },
        )
        .expect("managed");

        let mods_dir = tmp.path().join("Game/Mods");
        fs::create_dir_all(&mods_dir).expect("mods dir");
        (meta.mod_id, mods_dir)
    }

    #[test]
    fn uninstall_moves_managed_folder_to_trash_and_removes_symlinks() {
        let tmp = TempDir::new().expect("tmp");
        let (mod_id, mods_dir) = setup(&tmp);
        apply_toggle(tmp.path(), &mods_dir, &mod_id, true).expect("enable");
        assert!(mods_dir.join("a.package").exists());

        let trash_files = tmp.path().join("Trash/files");
        let result = uninstall_managed_mod(tmp.path(), &mods_dir, &trash_files, &mod_id).expect("uninstall");

        assert!(!tmp.path().join("mods").join(&mod_id).exists());
        assert!(!mods_dir.join("a.package").exists());
        assert!(std::path::Path::new(&result.trashed_path).join("meta.json").exists());
        assert!(tmp.path().join("Trash/info").read_dir().expect("info dir").next().is_some());
        assert!(result.issues.is_empty());
    }

    #[test]
    fn uninstall_without_links_still_moves_to_trash() {
        let tmp = TempDir::new().expect("tmp");
        let (mod_id, mods_dir) = setup(&tmp);
        let trash_files = tmp.path().join("Trash/files");

        let result = uninstall_managed_mod(tmp.path(), &mods_dir, &trash_files, &mod_id).expect("uninstall");

        assert!(!tmp.path().join("mods").join(&mod_id).exists());
        assert!(std::path::Path::new(&result.trashed_path).exists());
    }

    #[test]
    fn uninstall_does_not_remove_unmanaged_file_at_link_path() {
        let tmp = TempDir::new().expect("tmp");
        let (mod_id, mods_dir) = setup(&tmp);
        apply_toggle(tmp.path(), &mods_dir, &mod_id, true).expect("enable");
        fs::remove_file(mods_dir.join("a.package")).expect("remove symlink");
        fs::write(mods_dir.join("a.package"), b"user file").expect("user file");

        let trash_files = tmp.path().join("Trash/files");
        let result = uninstall_managed_mod(tmp.path(), &mods_dir, &trash_files, &mod_id).expect("uninstall");

        assert_eq!(fs::read(mods_dir.join("a.package")).expect("read"), b"user file");
        assert!(result
            .issues
            .iter()
            .any(|issue| issue.code.as_deref() == Some("EXTERNAL_LINK")));
    }

    #[test]
    fn uninstall_existing_installed_folder_moves_real_files_not_only_metadata() {
        let tmp = TempDir::new().expect("tmp");
        let mods_dir = tmp.path().join("Game/Mods");
        fs::create_dir_all(mods_dir.join("LooseMod")).expect("installed dir");
        fs::write(mods_dir.join("LooseMod/main.package"), b"pkg").expect("pkg");
        fs::create_dir_all(tmp.path().join("mods/LooseMod")).expect("metadata dir");
        fs::write(tmp.path().join("mods/LooseMod/meta.json"), b"{}").expect("meta");
        let trash_files = tmp.path().join("Trash/files");

        let result = uninstall_managed_mod(tmp.path(), &mods_dir, &trash_files, "LooseMod").expect("uninstall");

        assert!(!mods_dir.join("LooseMod").exists());
        let trashed = std::path::Path::new(&result.trashed_path);
        assert!(trashed.join("LooseMod/main.package").exists());
        assert!(trashed.join("metadata/meta.json").exists());
    }

    #[test]
    fn uninstall_existing_root_file_group_moves_real_files() {
        let tmp = TempDir::new().expect("tmp");
        let mods_dir = tmp.path().join("Game/Mods");
        fs::create_dir_all(&mods_dir).expect("mods dir");
        fs::write(mods_dir.join("LooseMod_a.package"), b"pkg").expect("pkg");
        fs::write(mods_dir.join("LooseMod_b.ts4script"), b"script").expect("script");
        let trash_files = tmp.path().join("Trash/files");

        let result = uninstall_managed_mod(tmp.path(), &mods_dir, &trash_files, "LooseMod").expect("uninstall");

        assert!(!mods_dir.join("LooseMod_a.package").exists());
        assert!(!mods_dir.join("LooseMod_b.ts4script").exists());
        let trashed = std::path::Path::new(&result.trashed_path);
        assert!(trashed.join("LooseMod_a.package").exists());
        assert!(trashed.join("LooseMod_b.ts4script").exists());
    }

    #[test]
    fn uninstall_missing_managed_folder_fails_without_creating_trash() {
        let tmp = TempDir::new().expect("tmp");
        let mods_dir = tmp.path().join("Game/Mods");
        fs::create_dir_all(&mods_dir).expect("mods dir");

        let trash_files = tmp.path().join("Trash/files");
        let err = uninstall_managed_mod(tmp.path(), &mods_dir, &trash_files, "missing").expect_err("missing");

        assert_eq!(err.code.as_str(), "NOT_FOUND");
        assert!(!trash_files.exists());
    }
}
