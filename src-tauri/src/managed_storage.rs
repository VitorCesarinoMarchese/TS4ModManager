use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{ErrorCode, ManagerError};

#[derive(Debug, Clone)]
pub struct ImportRequest {
    pub name: String,
    pub slug: Option<String>,
    pub source_dir: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModMetadata {
    pub version: u32,
    pub created_by: String,
    pub mod_id: String,
    pub name: String,
    #[serde(default)]
    pub display_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detected_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom_name: Option<String>,
    pub slug: Option<String>,
    pub files: Vec<String>,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub local_preview_path: Option<String>,
    #[serde(default)]
    pub locked_name: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

impl ModMetadata {
    pub fn effective_display_name(&self) -> &str {
        self.custom_name
            .as_deref()
            .filter(|name| !name.trim().is_empty())
            .or_else(|| self.detected_name.as_deref().filter(|name| !name.trim().is_empty()))
            .or_else(|| (!self.display_name.trim().is_empty()).then_some(self.display_name.as_str()))
            .unwrap_or(&self.name)
    }
}

pub fn create_managed_mod(managed_root: &Path, req: ImportRequest) -> Result<ModMetadata, ManagerError> {
    if !req.source_dir.is_dir() {
        return Err(ManagerError::new(
            ErrorCode::InvalidPath,
            format!("Import source dir invalid: {}", req.source_dir.display()),
        ));
    }

    let mod_id = Uuid::new_v4().to_string();
    let mod_root = managed_root.join("mods").join(&mod_id);
    let files_root = mod_root.join("files");

    fs::create_dir_all(&files_root).map_err(|e| {
        ManagerError::new(
            ErrorCode::IoError,
            format!("Failed to create managed dirs: {e}"),
        )
    })?;

    let files = copy_recursive(&req.source_dir, &files_root)?;

    let name = req.name;
    let meta = ModMetadata {
        version: 1,
        created_by: "sims4-mod-manager".to_string(),
        mod_id: mod_id.clone(),
        display_name: name.clone(),
        detected_name: Some(name.clone()),
        custom_name: None,
        name,
        slug: req.slug,
        files,
        source: "local".to_string(),
        source_url: None,
        preview_url: None,
        local_preview_path: None,
        locked_name: false,
        updated_at: None,
    };

    write_managed_mod(managed_root, &meta)?;

    Ok(meta)
}

pub fn write_managed_mod(managed_root: &Path, meta: &ModMetadata) -> Result<(), ManagerError> {
    let meta_json = serde_json::to_string_pretty(meta).map_err(|e| {
        ManagerError::new(
            ErrorCode::InternalError,
            format!("Metadata serialize failed: {e}"),
        )
    })?;

    let meta_path = managed_root.join("mods").join(&meta.mod_id).join("meta.json");
    fs::write(&meta_path, meta_json).map_err(|e| {
        ManagerError::new(
            ErrorCode::IoError,
            format!("Metadata write failed {}: {e}", meta_path.display()),
        )
    })
}

pub fn read_managed_mod(managed_root: &Path, mod_id: &str) -> Result<ModMetadata, ManagerError> {
    let meta_path = managed_root.join("mods").join(mod_id).join("meta.json");

    let content = fs::read_to_string(&meta_path).map_err(|_| {
        ManagerError::new(
            ErrorCode::NotFound,
            format!("Metadata not found: {}", meta_path.display()),
        )
    })?;

    let meta: ModMetadata = serde_json::from_str(&content).map_err(|e| {
        ManagerError::new(
            ErrorCode::InvalidPath,
            format!("Metadata malformed: {e}"),
        )
    })?;

    if meta.version != 1 {
        return Err(ManagerError::new(
            ErrorCode::InvalidPath,
            format!("Unsupported metadata version: {}", meta.version),
        ));
    }

    Ok(meta)
}

pub fn read_managed_mod_or_default(managed_root: &Path, mod_id: &str, detected_name: &str) -> ModMetadata {
    read_managed_mod(managed_root, mod_id).unwrap_or_else(|_| ModMetadata {
        version: 1,
        created_by: "sims4-mod-manager".to_string(),
        mod_id: mod_id.to_string(),
        name: detected_name.to_string(),
        display_name: detected_name.to_string(),
        detected_name: Some(detected_name.to_string()),
        custom_name: None,
        slug: None,
        files: vec![],
        source: "local".to_string(),
        source_url: None,
        preview_url: None,
        local_preview_path: None,
        locked_name: false,
        updated_at: None,
    })
}

fn copy_recursive(from: &Path, to: &Path) -> Result<Vec<String>, ManagerError> {
    let mut stack = vec![from.to_path_buf()];
    let mut collected = vec![];

    while let Some(dir) = stack.pop() {
        let entries = fs::read_dir(&dir).map_err(|e| {
            ManagerError::new(
                ErrorCode::IoError,
                format!("Read dir failed {}: {e}", dir.display()),
            )
        })?;

        for entry in entries.flatten() {
            let src = entry.path();
            let meta = fs::symlink_metadata(&src).map_err(|e| {
                ManagerError::new(ErrorCode::IoError, format!("Metadata failed {}: {e}", src.display()))
            })?;

            if meta.is_dir() {
                stack.push(src);
                continue;
            }

            if !meta.is_file() {
                continue;
            }

            let rel = src.strip_prefix(from).map_err(|e| {
                ManagerError::new(
                    ErrorCode::InternalError,
                    format!("Relative path failed {}: {e}", src.display()),
                )
            })?;

            let dst = to.join(rel);
            if let Some(parent) = dst.parent() {
                fs::create_dir_all(parent).map_err(|e| {
                    ManagerError::new(
                        ErrorCode::IoError,
                        format!("Create parent failed {}: {e}", parent.display()),
                    )
                })?;
            }

            fs::copy(&src, &dst).map_err(|e| {
                ManagerError::new(
                    ErrorCode::IoError,
                    format!("Copy failed {} -> {}: {e}", src.display(), dst.display()),
                )
            })?;

            collected.push(rel.to_string_lossy().replace('\\', "/"));
        }
    }

    collected.sort();
    Ok(collected)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::TempDir;

    use super::{create_managed_mod, read_managed_mod, read_managed_mod_or_default, write_managed_mod, ImportRequest};

    #[test]
    fn creates_managed_mod_with_uuid_directory() {
        let tmp = TempDir::new().expect("tmp");
        let src = tmp.path().join("import");
        fs::create_dir_all(&src).expect("src");
        fs::write(src.join("a.package"), b"x").expect("file");

        let meta = create_managed_mod(
            tmp.path(),
            ImportRequest {
                name: "Test".to_string(),
                slug: Some("test".to_string()),
                source_dir: src,
            },
        )
        .expect("create");

        assert_eq!(meta.mod_id.len(), 36);
        assert!(tmp
            .path()
            .join("mods")
            .join(&meta.mod_id)
            .join("files")
            .is_dir());
    }

    #[test]
    fn writes_metadata_with_version_one() {
        let tmp = TempDir::new().expect("tmp");
        let src = tmp.path().join("import");
        fs::create_dir_all(&src).expect("src");
        fs::write(src.join("a.package"), b"x").expect("file");

        let meta = create_managed_mod(
            tmp.path(),
            ImportRequest {
                name: "Test".to_string(),
                slug: None,
                source_dir: src,
            },
        )
        .expect("create");

        let meta_path = tmp.path().join("mods").join(&meta.mod_id).join("meta.json");
        let raw = fs::read_to_string(meta_path).expect("read");
        assert!(raw.contains("\"version\": 1"));
    }

    #[test]
    fn manifest_includes_non_mod_assets() {
        let tmp = TempDir::new().expect("tmp");
        let src = tmp.path().join("import");
        fs::create_dir_all(src.join("docs")).expect("src");
        fs::write(src.join("a.package"), b"x").expect("file");
        fs::write(src.join("docs/readme.txt"), b"txt").expect("file");

        let meta = create_managed_mod(
            tmp.path(),
            ImportRequest {
                name: "Assets".to_string(),
                slug: None,
                source_dir: src,
            },
        )
        .expect("create");

        assert!(meta.files.contains(&"a.package".to_string()));
        assert!(meta.files.contains(&"docs/readme.txt".to_string()));
    }

    #[test]
    fn read_validates_supported_schema_version() {
        let tmp = TempDir::new().expect("tmp");
        let base = tmp.path().join("mods/abc");
        fs::create_dir_all(&base).expect("base");
        fs::write(
            base.join("meta.json"),
            r#"{"version":1,"createdBy":"sims4-mod-manager","modId":"abc","name":"X","slug":null,"files":[],"source":"managed"}"#,
        )
        .expect("meta");

        let meta = read_managed_mod(tmp.path(), "abc").expect("read");
        assert_eq!(meta.version, 1);
    }

    #[test]
    fn reads_and_writes_extended_metadata_fields() {
        let tmp = TempDir::new().expect("tmp");
        let src = tmp.path().join("import");
        fs::create_dir_all(&src).expect("src");
        fs::write(src.join("a.package"), b"x").expect("file");

        let mut meta = create_managed_mod(
            tmp.path(),
            ImportRequest {
                name: "Detected Name".to_string(),
                slug: None,
                source_dir: src,
            },
        )
        .expect("create");

        meta.detected_name = Some("Detected Name".to_string());
        meta.custom_name = Some("Custom Name".to_string());
        meta.source_url = Some("https://example.test/mod".to_string());
        write_managed_mod(tmp.path(), &meta).expect("write");

        let read = read_managed_mod(tmp.path(), &meta.mod_id).expect("read");
        assert_eq!(read.detected_name.as_deref(), Some("Detected Name"));
        assert_eq!(read.custom_name.as_deref(), Some("Custom Name"));
        assert_eq!(read.source_url.as_deref(), Some("https://example.test/mod"));
    }

    #[test]
    fn custom_name_takes_priority_over_detected_name() {
        let tmp = TempDir::new().expect("tmp");
        let base = tmp.path().join("mods/abc");
        fs::create_dir_all(&base).expect("base");
        fs::write(
            base.join("meta.json"),
            r#"{"version":1,"createdBy":"sims4-mod-manager","modId":"abc","name":"Fallback","displayName":"Fallback","detectedName":"Detected","customName":"Custom","slug":null,"files":[],"source":"local"}"#,
        )
        .expect("meta");

        let meta = read_managed_mod(tmp.path(), "abc").expect("read");
        assert_eq!(meta.effective_display_name(), "Custom");
    }

    #[test]
    fn missing_or_invalid_metadata_can_fall_back_without_crashing() {
        let tmp = TempDir::new().expect("tmp");

        let missing = read_managed_mod_or_default(tmp.path(), "missing", "Detected");
        assert_eq!(missing.effective_display_name(), "Detected");

        let base = tmp.path().join("mods/bad");
        fs::create_dir_all(&base).expect("base");
        fs::write(base.join("meta.json"), "{not-json}").expect("bad meta");

        let malformed = read_managed_mod_or_default(tmp.path(), "bad", "Detected Bad");
        assert_eq!(malformed.effective_display_name(), "Detected Bad");
    }

    #[test]
    fn rejects_malformed_or_unsupported_metadata() {
        let tmp = TempDir::new().expect("tmp");
        let base = tmp.path().join("mods/abc");
        fs::create_dir_all(&base).expect("base");
        fs::write(base.join("meta.json"), "{not-json}").expect("meta");

        let malformed = read_managed_mod(tmp.path(), "abc").expect_err("must fail");
        assert_eq!(malformed.code.as_str(), "INVALID_PATH");

        fs::write(
            base.join("meta.json"),
            r#"{"version":2,"createdBy":"sims4-mod-manager","modId":"abc","name":"X","slug":null,"files":[],"source":"managed"}"#,
        )
        .expect("meta2");

        let unsupported = read_managed_mod(tmp.path(), "abc").expect_err("must fail");
        assert_eq!(unsupported.code.as_str(), "INVALID_PATH");
    }
}
