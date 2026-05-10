use std::fs;
use std::path::Path;
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
    mod_id: &str,
) -> Result<UninstallResult, ManagerError> {
    let mod_root = managed_root.join("mods").join(mod_id);
    if !mod_root.is_dir() {
        return Err(ManagerError::new(
            ErrorCode::NotFound,
            format!("Managed mod not found: {}", mod_root.display()),
        ));
    }

    if !game_mods_dir.is_dir() {
        return Err(ManagerError::new(
            ErrorCode::InvalidPath,
            format!("Game Mods dir invalid: {}", game_mods_dir.display()),
        ));
    }

    let issues = remove_manager_links(managed_root, game_mods_dir, mod_id)?;
    let trash_dir = managed_root.join("trash");
    fs::create_dir_all(&trash_dir).map_err(|e| {
        ManagerError::new(
            ErrorCode::IoError,
            format!("Trash dir create failed {}: {e}", trash_dir.display()),
        )
    })?;

    let trashed = trash_dir.join(format!("{}-{}", mod_id, unix_millis()));
    fs::rename(&mod_root, &trashed).map_err(|e| {
        ManagerError::new(
            ErrorCode::IoError,
            format!("Move to trash failed {} -> {}: {e}", mod_root.display(), trashed.display()),
        )
    })?;

    Ok(UninstallResult {
        mod_id: mod_id.to_string(),
        trashed_path: trashed.to_string_lossy().to_string(),
        issues,
    })
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

        let result = uninstall_managed_mod(tmp.path(), &mods_dir, &mod_id).expect("uninstall");

        assert!(!tmp.path().join("mods").join(&mod_id).exists());
        assert!(!mods_dir.join("a.package").exists());
        assert!(std::path::Path::new(&result.trashed_path).join("meta.json").exists());
        assert!(result.issues.is_empty());
    }

    #[test]
    fn uninstall_without_links_still_moves_to_trash() {
        let tmp = TempDir::new().expect("tmp");
        let (mod_id, mods_dir) = setup(&tmp);

        let result = uninstall_managed_mod(tmp.path(), &mods_dir, &mod_id).expect("uninstall");

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

        let result = uninstall_managed_mod(tmp.path(), &mods_dir, &mod_id).expect("uninstall");

        assert_eq!(fs::read(mods_dir.join("a.package")).expect("read"), b"user file");
        assert!(result
            .issues
            .iter()
            .any(|issue| issue.code.as_deref() == Some("EXTERNAL_LINK")));
    }

    #[test]
    fn uninstall_missing_managed_folder_fails_without_creating_trash() {
        let tmp = TempDir::new().expect("tmp");
        let mods_dir = tmp.path().join("Game/Mods");
        fs::create_dir_all(&mods_dir).expect("mods dir");

        let err = uninstall_managed_mod(tmp.path(), &mods_dir, "missing").expect_err("missing");

        assert_eq!(err.code.as_str(), "NOT_FOUND");
        assert!(!tmp.path().join("trash").exists());
    }
}
