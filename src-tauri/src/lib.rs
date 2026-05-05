pub mod archive_import;
pub mod commands;
pub mod error;
pub mod external_migration;
pub mod logging;
pub mod managed_storage;
pub mod mod_scan;
pub mod orphan;
pub mod path_detection;
pub mod runtime_paths;
#[cfg(feature = "tauri-app")]
pub mod tauri_commands;
pub mod toggle;

#[cfg(test)]
mod tests {
    use crate::error::{ErrorCode, ManagerError};

    #[test]
    fn known_error_codes_are_stable() {
        assert_eq!(ErrorCode::InvalidPath.as_str(), "INVALID_PATH");
        assert_eq!(ErrorCode::PathCollision.as_str(), "PATH_COLLISION");
    }

    #[test]
    fn manager_error_serializes_contract_shape() {
        let err = ManagerError::new(ErrorCode::InvalidPath, "Invalid path");
        let json = serde_json::to_value(err).expect("serialize");

        assert_eq!(json["code"], "INVALID_PATH");
        assert_eq!(json["message"], "Invalid path");
    }
}
