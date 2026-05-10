#![cfg(feature = "tauri-app")]

use std::path::PathBuf;

use crate::commands;
use crate::error::ManagerError;
use crate::runtime_paths::{managed_root, mods_dir_from_instance_id};

#[tauri::command]
fn detect_game_instances() -> Result<Vec<crate::path_detection::GameInstance>, ManagerError> {
    let home = std::env::var("HOME").map_err(|_| {
        ManagerError::new(
            crate::error::ErrorCode::InvalidPath,
            "HOME env missing for game detection",
        )
    })?;
    Ok(commands::cmd_detect_game_instances(PathBuf::from(home)))
}

#[tauri::command]
fn validate_custom_instance(path: String) -> Result<crate::path_detection::GameInstance, ManagerError> {
    commands::cmd_validate_custom_instance(PathBuf::from(path))
}

#[tauri::command]
fn scan_mods(instance_id: String) -> Result<Vec<crate::mod_scan::ScannedMod>, ManagerError> {
    let game_mods_dir = mods_dir_from_instance_id(&instance_id)?;
    let managed_root = managed_root()?;
    Ok(commands::cmd_scan_mods(game_mods_dir, managed_root))
}

#[tauri::command]
fn import_archive(
    archive_path: String,
    name: String,
    slug: Option<String>,
) -> Result<crate::managed_storage::ModMetadata, ManagerError> {
    commands::cmd_import_archive(managed_root()?, PathBuf::from(archive_path), name, slug)
}

#[tauri::command]
fn dry_run_toggle(
    mod_id: String,
    target_enabled: bool,
    instance_id: String,
) -> Result<crate::toggle::DryRunResult, ManagerError> {
    commands::cmd_dry_run_toggle(
        managed_root()?,
        mods_dir_from_instance_id(&instance_id)?,
        mod_id,
        target_enabled,
    )
}

#[tauri::command]
fn apply_toggle(
    mod_id: String,
    target_enabled: bool,
    instance_id: String,
) -> Result<crate::toggle::ApplyResult, ManagerError> {
    commands::cmd_apply_toggle(
        managed_root()?,
        mods_dir_from_instance_id(&instance_id)?,
        mod_id,
        target_enabled,
    )
}

#[tauri::command]
fn migrate_external_mod(
    mod_id: String,
    instance_id: String,
) -> Result<crate::external_migration::MigrateResult, ManagerError> {
    commands::cmd_migrate_external_mod(managed_root()?, mods_dir_from_instance_id(&instance_id)?, mod_id)
}

#[tauri::command]
fn detect_orphan_symlinks(
    instance_id: String,
) -> Result<Vec<crate::orphan::OrphanSymlink>, ManagerError> {
    Ok(commands::cmd_detect_orphan_symlinks(mods_dir_from_instance_id(&instance_id)?))
}

#[tauri::command]
fn rename_mod_display_name(
    mod_id: String,
    display_name: String,
) -> Result<crate::managed_storage::ModMetadata, ManagerError> {
    commands::cmd_rename_mod_display_name(managed_root()?, mod_id, display_name)
}

#[tauri::command]
fn attach_source_url(
    mod_id: String,
    source_url: String,
    provider_id: Option<String>,
) -> Result<crate::managed_storage::ModMetadata, ManagerError> {
    commands::cmd_attach_source_url(managed_root()?, mod_id, source_url, provider_id)
}

#[tauri::command]
fn remove_source_url(mod_id: String) -> Result<crate::managed_storage::ModMetadata, ManagerError> {
    commands::cmd_remove_source_url(managed_root()?, mod_id)
}

#[tauri::command]
fn uninstall_managed_mod(
    mod_id: String,
    instance_id: String,
) -> Result<crate::lifecycle::UninstallResult, ManagerError> {
    commands::cmd_uninstall_managed_mod(managed_root()?, mods_dir_from_instance_id(&instance_id)?, mod_id)
}

#[tauri::command]
fn list_trash_entries() -> Result<Vec<crate::lifecycle::TrashEntry>, ManagerError> {
    commands::cmd_list_trash_entries()
}

#[tauri::command]
fn restore_trashed_mod(
    trash_name: String,
    instance_id: String,
) -> Result<crate::lifecycle::RestoreResult, ManagerError> {
    commands::cmd_restore_trashed_mod(managed_root()?, mods_dir_from_instance_id(&instance_id)?, trash_name)
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), ManagerError> {
    commands::cmd_open_external_url(url)
}

#[tauri::command]
fn open_managed_mods_folder() -> Result<(), ManagerError> {
    commands::cmd_open_managed_mods_folder()
}

#[tauri::command]
fn open_manager_folder() -> Result<(), ManagerError> {
    commands::cmd_open_manager_folder()
}

#[tauri::command]
fn open_trash_folder() -> Result<(), ManagerError> {
    commands::cmd_open_trash_folder()
}

pub fn run() {
    crate::runtime_env::configure_runtime_environment();
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            detect_game_instances,
            validate_custom_instance,
            scan_mods,
            import_archive,
            dry_run_toggle,
            apply_toggle,
            migrate_external_mod,
            detect_orphan_symlinks,
            rename_mod_display_name,
            attach_source_url,
            remove_source_url,
            uninstall_managed_mod,
            list_trash_entries,
            restore_trashed_mod,
            open_external_url,
            open_managed_mods_folder,
            open_manager_folder,
            open_trash_folder
        ])
        .run(tauri::generate_context!())
        .expect("tauri run failed");
}
