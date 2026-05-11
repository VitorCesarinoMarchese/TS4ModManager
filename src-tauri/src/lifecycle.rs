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
pub struct TrashEntry {
    pub name: String,
    pub path: String,
    pub original_path: Option<String>,
    pub deletion_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RestoreResult {
    pub restored_path: String,
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
        for target in &installed_targets {
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

    let original_path = if !installed_targets.is_empty() {
        game_mods_dir.join(mod_id)
    } else {
        mod_root.clone()
    };
    write_trashinfo(trash_files_dir, &trashed_name, &original_path)?;

    Ok(UninstallResult {
        mod_id: mod_id.to_string(),
        trashed_path: trashed.to_string_lossy().to_string(),
        issues,
    })
}

pub fn list_trash_entries(trash_files_dir: &Path) -> Result<Vec<TrashEntry>, ManagerError> {
    if !trash_files_dir.exists() {
        return Ok(vec![]);
    }

    let mut entries = fs::read_dir(trash_files_dir)
        .map_err(|e| ManagerError::new(ErrorCode::IoError, format!("Read trash failed {}: {e}", trash_files_dir.display())))?
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            let name = path.file_name()?.to_string_lossy().to_string();
            let info = read_trashinfo(trash_files_dir, &name);
            if !is_mod_trash_entry(trash_files_dir, &name, &path, info.as_ref()) {
                return None;
            }
            Some(TrashEntry {
                name,
                path: path.to_string_lossy().to_string(),
                original_path: info.as_ref().and_then(|info| info.original_path.clone()),
                deletion_date: info.as_ref().and_then(|info| info.deletion_date.clone()),
            })
        })
        .collect::<Vec<_>>();
    entries.sort_by(|a, b| b.name.cmp(&a.name));
    Ok(entries)
}

pub fn restore_trashed_mod(
    managed_root: &Path,
    game_mods_dir: &Path,
    trash_files_dir: &Path,
    trash_name: &str,
) -> Result<RestoreResult, ManagerError> {
    if trash_name.contains('/') || trash_name.contains('\\') || trash_name == "." || trash_name == ".." {
        return Err(ManagerError::new(ErrorCode::InvalidPath, "Invalid trash entry name"));
    }

    let entry = trash_files_dir.join(trash_name);
    if !entry.exists() {
        return Err(ManagerError::new(ErrorCode::NotFound, format!("Trash entry not found: {}", entry.display())));
    }

    fs::create_dir_all(game_mods_dir).map_err(|e| {
        ManagerError::new(ErrorCode::IoError, format!("Create game Mods dir failed {}: {e}", game_mods_dir.display()))
    })?;

    let restored_path = if entry.join("metadata").is_dir() {
        let mut last = game_mods_dir.to_path_buf();
        for child in fs::read_dir(&entry).map_err(|e| ManagerError::new(ErrorCode::IoError, format!("Read trash entry failed: {e}")))?.flatten() {
            let path = child.path();
            let Some(name) = path.file_name() else { continue; };
            if name == "metadata" { continue; }
            let dst = game_mods_dir.join(name);
            if dst.exists() {
                return Err(ManagerError::new(ErrorCode::PathCollision, format!("Restore target exists: {}", dst.display())));
            }
            fs::rename(&path, &dst).map_err(|e| ManagerError::new(ErrorCode::IoError, format!("Restore failed {}: {e}", dst.display())))?;
            last = dst;
        }
        last
    } else if entry.join("meta.json").is_file() {
        let meta_raw = fs::read_to_string(entry.join("meta.json")).unwrap_or_default();
        let mod_id = serde_json::from_str::<serde_json::Value>(&meta_raw)
            .ok()
            .and_then(|value| value.get("modId").and_then(|id| id.as_str()).map(ToString::to_string))
            .unwrap_or_else(|| trash_name.rsplit_once('-').map(|(name, _)| name.to_string()).unwrap_or_else(|| trash_name.to_string()));
        let dst = managed_root.join("mods").join(mod_id);
        if dst.exists() {
            return Err(ManagerError::new(ErrorCode::PathCollision, format!("Restore target exists: {}", dst.display())));
        }
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent).map_err(|e| ManagerError::new(ErrorCode::IoError, format!("Create restore parent failed: {e}")))?;
        }
        fs::rename(&entry, &dst).map_err(|e| ManagerError::new(ErrorCode::IoError, format!("Restore failed {}: {e}", dst.display())))?;
        dst
    } else {
        let mut last = game_mods_dir.to_path_buf();
        if entry.is_dir() {
            for child in fs::read_dir(&entry).map_err(|e| ManagerError::new(ErrorCode::IoError, format!("Read trash entry failed: {e}")))?.flatten() {
                let path = child.path();
                let Some(name) = path.file_name() else { continue; };
                let dst = game_mods_dir.join(name);
                if dst.exists() {
                    return Err(ManagerError::new(ErrorCode::PathCollision, format!("Restore target exists: {}", dst.display())));
                }
                fs::rename(&path, &dst).map_err(|e| ManagerError::new(ErrorCode::IoError, format!("Restore failed {}: {e}", dst.display())))?;
                last = dst;
            }
            last
        } else {
            let dst = game_mods_dir.join(trash_name.rsplit_once('-').map(|(name, _)| name).unwrap_or(trash_name));
            if dst.exists() {
                return Err(ManagerError::new(ErrorCode::PathCollision, format!("Restore target exists: {}", dst.display())));
            }
            fs::rename(&entry, &dst).map_err(|e| ManagerError::new(ErrorCode::IoError, format!("Restore failed {}: {e}", dst.display())))?;
            dst
        }
    };

    let info = trash_files_dir
        .parent()
        .map(|root| root.join("info").join(format!("{trash_name}.trashinfo")));
    if let Some(info) = info {
        let _ = fs::remove_file(info);
    }
    let _ = fs::remove_dir(&entry);

    Ok(RestoreResult { restored_path: restored_path.to_string_lossy().to_string() })
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct TrashInfo {
    original_path: Option<String>,
    deletion_date: Option<String>,
}

fn read_trashinfo(trash_files_dir: &Path, trash_name: &str) -> Option<TrashInfo> {
    let trash_root = trash_files_dir.parent()?;
    let raw = fs::read_to_string(trash_root.join("info").join(format!("{trash_name}.trashinfo"))).ok()?;
    let mut info = TrashInfo { original_path: None, deletion_date: None };
    for line in raw.lines() {
        if let Some(path) = line.strip_prefix("Path=") {
            info.original_path = Some(path.to_string());
        } else if let Some(date) = line.strip_prefix("DeletionDate=") {
            info.deletion_date = Some(date.to_string());
        }
    }
    Some(info)
}

fn is_mod_trash_entry(_trash_files_dir: &Path, _trash_name: &str, entry_path: &Path, info: Option<&TrashInfo>) -> bool {
    if entry_contains_mod_data(entry_path) {
        return true;
    }

    info.and_then(|info| info.original_path.as_deref()).is_some_and(|path| {
        path.contains("sims4-mod-manager") || path.contains("/The Sims 4/Mods/") || path.ends_with("/The Sims 4/Mods")
    })
}

fn entry_contains_mod_data(path: &Path) -> bool {
    if path.join("meta.json").is_file() || path.join("metadata/meta.json").is_file() {
        return true;
    }

    if path.is_file() {
        return path.extension().and_then(|ext| ext.to_str()).is_some_and(is_mod_extension);
    }

    let Ok(entries) = fs::read_dir(path) else {
        return false;
    };

    entries.flatten().any(|entry| {
        let child = entry.path();
        if child.is_dir() {
            entry_contains_mod_data(&child)
        } else {
            child.extension().and_then(|ext| ext.to_str()).is_some_and(is_mod_extension)
        }
    })
}

fn is_mod_extension(ext: &str) -> bool {
    ext.eq_ignore_ascii_case("package") || ext.eq_ignore_ascii_case("ts4script")
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

    use super::{list_trash_entries, restore_trashed_mod, uninstall_managed_mod};

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
    fn list_trash_entries_filters_unrelated_user_trash() {
        let tmp = TempDir::new().expect("tmp");
        let trash_files = tmp.path().join("Trash/files");
        let trash_info = tmp.path().join("Trash/info");
        fs::create_dir_all(&trash_files).expect("trash files");
        fs::create_dir_all(&trash_info).expect("trash info");
        fs::write(trash_files.join("notes.txt"), b"notes").expect("notes");
        fs::write(trash_info.join("notes.txt.trashinfo"), "[Trash Info]\nPath=/home/me/notes.txt\n").expect("notes info");
        fs::create_dir_all(trash_files.join("LooseMod-123")).expect("mod trash");
        fs::write(trash_files.join("LooseMod-123/LooseMod.package"), b"pkg").expect("pkg");
        fs::write(trash_info.join("LooseMod-123.trashinfo"), "[Trash Info]\nPath=/home/me/Documents/Electronic Arts/The Sims 4/Mods/LooseMod\n").expect("mod info");

        let entries = list_trash_entries(&trash_files).expect("list");

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "LooseMod-123");
        assert_eq!(entries[0].original_path.as_deref(), Some("/home/me/Documents/Electronic Arts/The Sims 4/Mods/LooseMod"));
    }

    #[test]
    fn list_trash_entries_includes_original_path_and_deletion_date() {
        let tmp = TempDir::new().expect("tmp");
        let mods_dir = tmp.path().join("Game/Mods");
        fs::create_dir_all(mods_dir.join("LooseMod")).expect("installed dir");
        fs::write(mods_dir.join("LooseMod/main.package"), b"pkg").expect("pkg");
        let trash_files = tmp.path().join("Trash/files");
        let trashed = uninstall_managed_mod(tmp.path(), &mods_dir, &trash_files, "LooseMod").expect("uninstall");
        let trash_name = std::path::Path::new(&trashed.trashed_path).file_name().unwrap().to_string_lossy().to_string();

        let entries = list_trash_entries(&trash_files).expect("list");

        assert_eq!(entries[0].name, trash_name);
        assert_eq!(entries[0].original_path.as_deref(), Some(mods_dir.join("LooseMod").to_string_lossy().as_ref()));
        assert!(entries[0].deletion_date.as_deref().unwrap_or_default().contains('T'));
    }

    #[test]
    fn restore_trash_entry_moves_installed_files_back() {
        let tmp = TempDir::new().expect("tmp");
        let mods_dir = tmp.path().join("Game/Mods");
        fs::create_dir_all(mods_dir.join("LooseMod")).expect("installed dir");
        fs::write(mods_dir.join("LooseMod/main.package"), b"pkg").expect("pkg");
        let trash_files = tmp.path().join("Trash/files");
        let trashed = uninstall_managed_mod(tmp.path(), &mods_dir, &trash_files, "LooseMod").expect("uninstall");
        let trash_name = std::path::Path::new(&trashed.trashed_path).file_name().unwrap().to_string_lossy().to_string();

        let entries = list_trash_entries(&trash_files).expect("list");
        assert_eq!(entries[0].name, trash_name);
        restore_trashed_mod(tmp.path(), &mods_dir, &trash_files, &trash_name).expect("restore");

        assert!(mods_dir.join("LooseMod/main.package").exists());
        assert!(!trash_files.join(trash_name).exists());
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
