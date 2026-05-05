use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{ErrorCode, ManagerError};
use crate::managed_storage::{create_managed_mod, ImportRequest};
use crate::mod_scan::{scan_mods, ModSource};
use crate::toggle::IssueEvent;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MigrateResult {
    pub managed_mod_id: String,
    pub issues: Vec<IssueEvent>,
}

pub fn migrate_external_mod(
    managed_root: &Path,
    game_mods_dir: &Path,
    external_mod_key: &str,
) -> Result<MigrateResult, ManagerError> {
    let scanned = scan_mods(game_mods_dir, managed_root);
    let external = scanned
        .into_iter()
        .find(|m| m.key == external_mod_key)
        .ok_or_else(|| {
            ManagerError::new(
                ErrorCode::NotFound,
                format!("External mod not found: {external_mod_key}"),
            )
        })?;

    if external.source != ModSource::External {
        return Err(ManagerError::new(
            ErrorCode::ExternalLink,
            format!("Mod is not external: {external_mod_key}"),
        ));
    }

    let staging = managed_root
        .join("tmp")
        .join(format!("migrate-{}", Uuid::new_v4()));
    fs::create_dir_all(&staging).map_err(|e| {
        ManagerError::new(
            ErrorCode::IoError,
            format!("Create staging dir failed {}: {e}", staging.display()),
        )
    })?;

    let copy_result = copy_external_contents(game_mods_dir, &staging, &external.files);
    if let Err(err) = copy_result {
        let _ = fs::remove_dir_all(&staging);
        return Err(err);
    }

    let imported = create_managed_mod(
        managed_root,
        ImportRequest {
            name: external.name,
            slug: None,
            source_dir: staging.clone(),
        },
    )?;

    let _ = fs::remove_dir_all(&staging);

    Ok(MigrateResult {
        managed_mod_id: imported.mod_id,
        issues: vec![IssueEvent {
            id: format!("migrated:{}", external_mod_key),
            severity: "info".to_string(),
            message: "External mod migrated to managed storage".to_string(),
            code: None,
        }],
    })
}

fn copy_external_contents(
    game_mods_dir: &Path,
    staging: &Path,
    files: &[String],
) -> Result<(), ManagerError> {
    for rel in files {
        let in_game = game_mods_dir.join(rel);
        let target = resolve_source_file(&in_game)?;
        let out = staging.join(rel);

        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                ManagerError::new(
                    ErrorCode::IoError,
                    format!("Create staging parent failed {}: {e}", parent.display()),
                )
            })?;
        }

        fs::copy(&target, &out).map_err(|e| {
            ManagerError::new(
                ErrorCode::IoError,
                format!("Copy failed {} -> {}: {e}", target.display(), out.display()),
            )
        })?;
    }

    Ok(())
}

fn resolve_source_file(path: &Path) -> Result<PathBuf, ManagerError> {
    let meta = fs::symlink_metadata(path).map_err(|e| {
        ManagerError::new(
            ErrorCode::IoError,
            format!("Metadata failed {}: {e}", path.display()),
        )
    })?;

    if meta.file_type().is_symlink() {
        let link = fs::read_link(path).map_err(|e| {
            ManagerError::new(
                ErrorCode::IoError,
                format!("Read link failed {}: {e}", path.display()),
            )
        })?;

        let resolved = if link.is_absolute() {
            link
        } else {
            path.parent().unwrap_or(path).join(link)
        };

        if !resolved.is_file() {
            return Err(ManagerError::new(
                ErrorCode::NotFound,
                format!("Link target not file: {}", resolved.display()),
            ));
        }

        return Ok(resolved);
    }

    if !meta.is_file() {
        return Err(ManagerError::new(
            ErrorCode::InvalidPath,
            format!("Not file for migration: {}", path.display()),
        ));
    }

    Ok(path.to_path_buf())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::TempDir;

    use super::migrate_external_mod;

    #[test]
    fn migrates_external_symlink_mod_to_managed_storage() {
        let tmp = TempDir::new().expect("tmp");
        let managed = tmp.path().join("managed");
        let game_mods = tmp.path().join("Game/Mods");
        let external_root = tmp.path().join("outside");

        fs::create_dir_all(&managed).expect("managed");
        fs::create_dir_all(&game_mods).expect("mods");
        fs::create_dir_all(&external_root).expect("outside");

        fs::write(external_root.join("ExtMod_main.package"), b"PKG").expect("pkg");

        #[cfg(unix)]
        std::os::unix::fs::symlink(
            external_root.join("ExtMod_main.package"),
            game_mods.join("ExtMod_main.package"),
        )
        .expect("link");

        let migrated = migrate_external_mod(&managed, &game_mods, "ExtMod").expect("migrate");

        assert!(managed
            .join("mods")
            .join(&migrated.managed_mod_id)
            .join("files/ExtMod_main.package")
            .is_file());
    }

    #[test]
    fn migration_does_not_edit_external_links_in_place() {
        let tmp = TempDir::new().expect("tmp");
        let managed = tmp.path().join("managed");
        let game_mods = tmp.path().join("Game/Mods");
        let external_root = tmp.path().join("outside");

        fs::create_dir_all(&managed).expect("managed");
        fs::create_dir_all(&game_mods).expect("mods");
        fs::create_dir_all(&external_root).expect("outside");

        let src = external_root.join("SkinPack_main.package");
        let link = game_mods.join("SkinPack_main.package");
        fs::write(&src, b"PKG").expect("pkg");

        #[cfg(unix)]
        std::os::unix::fs::symlink(&src, &link).expect("link");

        let _ = migrate_external_mod(&managed, &game_mods, "SkinPack").expect("migrate");

        let target = fs::read_link(&link).expect("still symlink");
        assert_eq!(target, src);
    }

    #[test]
    fn rejects_non_external_mod_keys() {
        let tmp = TempDir::new().expect("tmp");
        let managed = tmp.path().join("managed");
        let game_mods = tmp.path().join("Game/Mods");

        fs::create_dir_all(&managed).expect("managed");
        fs::create_dir_all(&game_mods).expect("mods");
        fs::write(game_mods.join("Local_main.package"), b"PKG").expect("pkg");

        let err = migrate_external_mod(&managed, &game_mods, "Local").expect_err("must fail");
        assert_eq!(err.code.as_str(), "EXTERNAL_LINK");
    }
}
