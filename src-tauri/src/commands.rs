use std::path::PathBuf;
use std::process::{Command, Stdio};

use crate::archive_import::import_archive_to_managed;
use crate::error::{ErrorCode, ManagerError};
use crate::external_migration::{migrate_external_mod, MigrateResult};
use crate::logging::append_issue_log;
use crate::lifecycle::{list_trash_entries, restore_trashed_mod, uninstall_managed_mod, RestoreResult, TrashEntry, UninstallResult};
use crate::managed_storage::{remove_source_url, set_custom_display_name, set_source_url, ModMetadata};
use crate::mod_scan::ScannedMod;
use crate::orphan::{detect_orphan_symlinks, OrphanSymlink};
use crate::path_detection::{detect_game_instances, validate_custom_instance, GameInstance};
use serde::{Deserialize, Serialize};

use crate::runtime_env::{desktop_open_env, WAYLAND_WORKAROUND_DISABLE_ENV, WAYLAND_WORKAROUND_ENV};
use crate::runtime_paths::{managed_root, managed_mods_dir, trash_files_dir};
use crate::toggle::{apply_toggle, dry_run_toggle, ApplyResult, DryRunResult};

pub fn cmd_detect_game_instances(home: PathBuf) -> Vec<GameInstance> {
    detect_game_instances(&home)
}

pub fn cmd_validate_custom_instance(path: PathBuf) -> Result<GameInstance, ManagerError> {
    validate_custom_instance(&path)
}

pub fn cmd_scan_mods(game_mods_dir: PathBuf, managed_root: PathBuf) -> Vec<ScannedMod> {
    crate::mod_scan::scan_mods(&game_mods_dir, &managed_root)
}

pub fn cmd_import_archive(
    managed_root: PathBuf,
    archive_path: PathBuf,
    name: String,
    slug: Option<String>,
) -> Result<ModMetadata, ManagerError> {
    import_archive_to_managed(&managed_root, &archive_path, name, slug)
}

pub fn cmd_dry_run_toggle(
    managed_root: PathBuf,
    game_mods_dir: PathBuf,
    mod_id: String,
    target_enabled: bool,
) -> Result<DryRunResult, ManagerError> {
    let result = dry_run_toggle(&managed_root, &game_mods_dir, &mod_id, target_enabled)?;
    for issue in &result.issues {
        let _ = append_issue_log(&managed_root, issue);
    }
    Ok(result)
}

pub fn cmd_apply_toggle(
    managed_root: PathBuf,
    game_mods_dir: PathBuf,
    mod_id: String,
    target_enabled: bool,
) -> Result<ApplyResult, ManagerError> {
    let result = apply_toggle(&managed_root, &game_mods_dir, &mod_id, target_enabled)?;
    for issue in &result.issues {
        let _ = append_issue_log(&managed_root, issue);
    }
    Ok(result)
}

pub fn cmd_migrate_external_mod(
    managed_root: PathBuf,
    game_mods_dir: PathBuf,
    mod_id: String,
) -> Result<MigrateResult, ManagerError> {
    let result = migrate_external_mod(&managed_root, &game_mods_dir, &mod_id)?;
    for issue in &result.issues {
        let _ = append_issue_log(&managed_root, issue);
    }
    Ok(result)
}

pub fn cmd_detect_orphan_symlinks(game_mods_dir: PathBuf) -> Vec<OrphanSymlink> {
    detect_orphan_symlinks(&game_mods_dir)
}

pub fn cmd_rename_mod_display_name(
    managed_root: PathBuf,
    mod_id: String,
    display_name: String,
) -> Result<ModMetadata, ManagerError> {
    set_custom_display_name(&managed_root, &mod_id, display_name)
}

pub fn cmd_attach_source_url(
    managed_root: PathBuf,
    mod_id: String,
    source_url: String,
    provider_id: Option<String>,
    display_name: Option<String>,
    preview_url: Option<String>,
) -> Result<ModMetadata, ManagerError> {
    set_source_url(&managed_root, &mod_id, source_url, provider_id, display_name, preview_url)
}

pub fn cmd_remove_source_url(managed_root: PathBuf, mod_id: String) -> Result<ModMetadata, ManagerError> {
    remove_source_url(&managed_root, &mod_id)
}

pub fn cmd_uninstall_managed_mod(
    managed_root: PathBuf,
    game_mods_dir: PathBuf,
    mod_id: String,
) -> Result<UninstallResult, ManagerError> {
    let result = uninstall_managed_mod(&managed_root, &game_mods_dir, &trash_files_dir()?, &mod_id)?;
    for issue in &result.issues {
        let _ = append_issue_log(&managed_root, issue);
    }
    Ok(result)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeDiagnostics {
    pub managed_root: String,
    pub managed_mods_dir: String,
    pub trash_files_dir: String,
    pub wayland_workaround: Option<String>,
    pub wayland_workaround_disabled: bool,
    pub app_version: String,
    pub build_target: String,
}

pub fn cmd_list_trash_entries() -> Result<Vec<TrashEntry>, ManagerError> {
    list_trash_entries(&trash_files_dir()?)
}

pub fn cmd_runtime_diagnostics() -> Result<RuntimeDiagnostics, ManagerError> {
    Ok(RuntimeDiagnostics {
        managed_root: managed_root()?.to_string_lossy().to_string(),
        managed_mods_dir: managed_mods_dir()?.to_string_lossy().to_string(),
        trash_files_dir: trash_files_dir()?.to_string_lossy().to_string(),
        wayland_workaround: std::env::var(WAYLAND_WORKAROUND_ENV).ok(),
        wayland_workaround_disabled: std::env::var(WAYLAND_WORKAROUND_DISABLE_ENV).ok().as_deref() == Some("1"),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        build_target: format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH),
    })
}

pub fn cmd_restore_trashed_mod(
    managed_root: PathBuf,
    game_mods_dir: PathBuf,
    trash_name: String,
) -> Result<RestoreResult, ManagerError> {
    restore_trashed_mod(&managed_root, &game_mods_dir, &trash_files_dir()?, &trash_name)
}

fn validate_external_url(url: &str) -> Result<(), ManagerError> {
    let trimmed = url.trim();
    if trimmed.starts_with("https://") || trimmed.starts_with("http://") {
        return Ok(());
    }

    Err(ManagerError::new(
        ErrorCode::InvalidPath,
        "Only http(s) source URLs can be opened",
    ))
}

fn open_path(path: PathBuf) -> Result<(), ManagerError> {
    Command::new("xdg-open")
        .arg(path)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .envs(desktop_open_env())
        .spawn()
        .map(|_| ())
        .map_err(|e| ManagerError::new(ErrorCode::IoError, format!("Open folder failed: {e}")))
}

pub fn cmd_open_external_url(url: String) -> Result<(), ManagerError> {
    validate_external_url(&url)?;
    Command::new("xdg-open")
        .arg(url.trim())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .envs(desktop_open_env())
        .spawn()
        .map(|_| ())
        .map_err(|e| ManagerError::new(ErrorCode::IoError, format!("Open URL failed: {e}")))
}

pub fn cmd_open_managed_mods_folder() -> Result<(), ManagerError> {
    open_path(managed_mods_dir()?)
}

pub fn cmd_open_manager_folder() -> Result<(), ManagerError> {
    open_path(managed_root()?)
}

pub fn cmd_open_trash_folder() -> Result<(), ManagerError> {
    open_path(trash_files_dir()?)
}

#[cfg(test)]
mod tests {
    use super::{cmd_runtime_diagnostics, validate_external_url};

    #[test]
    fn runtime_diagnostics_returns_runtime_paths() {
        let tmp = tempfile::TempDir::new().expect("tmp");
        std::env::set_var("HOME", tmp.path());
        std::env::remove_var("XDG_DATA_HOME");

        let diagnostics = cmd_runtime_diagnostics().expect("diagnostics");

        assert!(diagnostics.managed_root.ends_with(".local/share/sims4-mod-manager"));
        assert!(diagnostics.managed_mods_dir.ends_with(".local/share/sims4-mod-manager/mods"));
        assert!(diagnostics.trash_files_dir.ends_with(".local/share/Trash/files"));
        assert_eq!(diagnostics.app_version, env!("CARGO_PKG_VERSION"));
        assert!(diagnostics.build_target.contains(std::env::consts::OS));
    }

    #[test]
    fn external_url_open_allows_http_urls_only() {
        assert!(validate_external_url("https://www.curseforge.com/sims4/mods/x").is_ok());
        assert!(validate_external_url("http://example.test/mod").is_ok());
        assert!(validate_external_url("file:///home/user/.bashrc").is_err());
        assert!(validate_external_url("javascript:alert(1)").is_err());
    }
}
