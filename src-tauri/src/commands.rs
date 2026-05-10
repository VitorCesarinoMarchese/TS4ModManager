use std::path::PathBuf;
use std::process::Command;

use crate::archive_import::import_archive_to_managed;
use crate::error::{ErrorCode, ManagerError};
use crate::external_migration::{migrate_external_mod, MigrateResult};
use crate::logging::append_issue_log;
use crate::lifecycle::{uninstall_managed_mod, UninstallResult};
use crate::managed_storage::{remove_source_url, set_custom_display_name, set_source_url, ModMetadata};
use crate::mod_scan::ScannedMod;
use crate::orphan::{detect_orphan_symlinks, OrphanSymlink};
use crate::path_detection::{detect_game_instances, validate_custom_instance, GameInstance};
use crate::runtime_paths::{managed_mods_dir, trash_files_dir};
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
) -> Result<ModMetadata, ManagerError> {
    set_source_url(&managed_root, &mod_id, source_url, provider_id)
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
        .spawn()
        .map(|_| ())
        .map_err(|e| ManagerError::new(ErrorCode::IoError, format!("Open folder failed: {e}")))
}

pub fn cmd_open_external_url(url: String) -> Result<(), ManagerError> {
    validate_external_url(&url)?;
    Command::new("xdg-open")
        .arg(url.trim())
        .spawn()
        .map(|_| ())
        .map_err(|e| ManagerError::new(ErrorCode::IoError, format!("Open URL failed: {e}")))
}

pub fn cmd_open_managed_mods_folder() -> Result<(), ManagerError> {
    open_path(managed_mods_dir()?)
}

pub fn cmd_open_trash_folder() -> Result<(), ManagerError> {
    open_path(trash_files_dir()?)
}

#[cfg(test)]
mod tests {
    use super::validate_external_url;

    #[test]
    fn external_url_open_allows_http_urls_only() {
        assert!(validate_external_url("https://www.curseforge.com/sims4/mods/x").is_ok());
        assert!(validate_external_url("http://example.test/mod").is_ok());
        assert!(validate_external_url("file:///home/user/.bashrc").is_err());
        assert!(validate_external_url("javascript:alert(1)").is_err());
    }
}
