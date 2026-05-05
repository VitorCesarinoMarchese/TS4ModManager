use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;

use uuid::Uuid;
use zip::read::ZipArchive;

use crate::error::{ErrorCode, ManagerError};
use crate::managed_storage::{create_managed_mod, ImportRequest, ModMetadata};

pub fn import_archive_to_managed(
    managed_root: &Path,
    archive_path: &Path,
    name: String,
    slug: Option<String>,
) -> Result<ModMetadata, ManagerError> {
    let temp_extract = managed_root
        .join("tmp")
        .join(format!("extract-{}", Uuid::new_v4()));
    fs::create_dir_all(&temp_extract).map_err(|e| {
        ManagerError::new(
            ErrorCode::IoError,
            format!("Create temp extract dir failed {}: {e}", temp_extract.display()),
        )
    })?;

    let extract_result = extract_archive(archive_path, &temp_extract);
    if let Err(err) = extract_result {
        let _ = fs::remove_dir_all(&temp_extract);
        return Err(err);
    }

    let import = create_managed_mod(
        managed_root,
        ImportRequest {
            name,
            slug,
            source_dir: temp_extract.clone(),
        },
    );

    let _ = fs::remove_dir_all(&temp_extract);
    import
}

pub fn extract_archive(archive_path: &Path, destination: &Path) -> Result<(), ManagerError> {
    let ext = archive_path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    match ext.as_str() {
        "zip" => extract_zip(archive_path, destination),
        "rar" | "7z" => extract_with_7z(archive_path, destination),
        _ => Err(ManagerError::new(
            ErrorCode::ArchiveUnsupported,
            format!("Unsupported archive extension: .{ext}"),
        )),
    }
}

fn extract_zip(archive_path: &Path, destination: &Path) -> Result<(), ManagerError> {
    let file = fs::File::open(archive_path).map_err(|e| {
        ManagerError::new(
            ErrorCode::ArchiveExtractionFailed,
            format!("Open zip failed {}: {e}", archive_path.display()),
        )
    })?;

    let mut archive = ZipArchive::new(file).map_err(|e| {
        ManagerError::new(
            ErrorCode::ArchiveExtractionFailed,
            format!("Parse zip failed {}: {e}", archive_path.display()),
        )
    })?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| {
            ManagerError::new(
                ErrorCode::ArchiveExtractionFailed,
                format!("Read zip entry failed: {e}"),
            )
        })?;

        let name = entry.name().replace('\\', "/");
        let out_path = sanitize_zip_path(destination, &name)?;

        if entry.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| {
                ManagerError::new(
                    ErrorCode::ArchiveExtractionFailed,
                    format!("Create dir failed {}: {e}", out_path.display()),
                )
            })?;
            continue;
        }

        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                ManagerError::new(
                    ErrorCode::ArchiveExtractionFailed,
                    format!("Create parent failed {}: {e}", parent.display()),
                )
            })?;
        }

        let mut out = fs::File::create(&out_path).map_err(|e| {
            ManagerError::new(
                ErrorCode::ArchiveExtractionFailed,
                format!("Create file failed {}: {e}", out_path.display()),
            )
        })?;

        let mut buf = Vec::new();
        entry.read_to_end(&mut buf).map_err(|e| {
            ManagerError::new(
                ErrorCode::ArchiveExtractionFailed,
                format!("Read entry content failed {}: {e}", name),
            )
        })?;

        out.write_all(&buf).map_err(|e| {
            ManagerError::new(
                ErrorCode::ArchiveExtractionFailed,
                format!("Write extracted content failed {}: {e}", out_path.display()),
            )
        })?;
    }

    Ok(())
}

fn extract_with_7z(archive_path: &Path, destination: &Path) -> Result<(), ManagerError> {
    let output = Command::new("7z")
        .arg("x")
        .arg("-y")
        .arg(format!("-o{}", destination.display()))
        .arg(archive_path)
        .output()
        .map_err(|e| {
            ManagerError::new(
                ErrorCode::ArchiveExtractionFailed,
                format!("7z tool unavailable: {e}"),
            )
        })?;

    if !output.status.success() {
        return Err(ManagerError::new(
            ErrorCode::ArchiveExtractionFailed,
            format!(
                "7z extraction failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ),
        ));
    }

    Ok(())
}

fn sanitize_zip_path(destination: &Path, entry_name: &str) -> Result<PathBuf, ManagerError> {
    let candidate = Path::new(entry_name);

    if candidate.is_absolute() {
        return Err(ManagerError::new(
            ErrorCode::ArchiveExtractionFailed,
            format!("Absolute path entry blocked: {entry_name}"),
        ));
    }

    if candidate
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err(ManagerError::new(
            ErrorCode::ArchiveExtractionFailed,
            format!("Path traversal entry blocked: {entry_name}"),
        ));
    }

    Ok(destination.join(candidate))
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::io::Write;

    use tempfile::TempDir;
    use zip::write::SimpleFileOptions;
    use zip::CompressionMethod;

    use super::{extract_archive, import_archive_to_managed};

    fn make_zip(path: &std::path::Path, entries: Vec<(&str, &[u8])>) {
        let file = fs::File::create(path).expect("zip create");
        let mut zip = zip::ZipWriter::new(file);
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

        for (name, content) in entries {
            zip.start_file(name, options).expect("start file");
            zip.write_all(content).expect("write file");
        }

        zip.finish().expect("finish zip");
    }

    #[test]
    fn imports_zip_happy_path_into_managed_storage() {
        let tmp = TempDir::new().expect("tmp");
        let archive = tmp.path().join("mod.zip");
        make_zip(&archive, vec![("a.package", b"AAA"), ("docs/readme.txt", b"TXT")]);

        let meta = import_archive_to_managed(
            tmp.path(),
            &archive,
            "ZipMod".to_string(),
            Some("zipmod".to_string()),
        )
        .expect("import");

        assert_eq!(meta.version, 1);
        assert!(meta.files.contains(&"a.package".to_string()));
        assert!(tmp
            .path()
            .join("mods")
            .join(&meta.mod_id)
            .join("files/a.package")
            .is_file());
    }

    #[test]
    fn unsupported_extension_returns_archive_unsupported() {
        let tmp = TempDir::new().expect("tmp");
        let archive = tmp.path().join("mod.tar");
        fs::write(&archive, b"fake").expect("write");

        let err = extract_archive(&archive, tmp.path()).expect_err("must fail");
        assert_eq!(err.code.as_str(), "ARCHIVE_UNSUPPORTED");
    }

    #[test]
    fn corrupt_zip_returns_extraction_failed() {
        let tmp = TempDir::new().expect("tmp");
        let archive = tmp.path().join("mod.zip");
        fs::write(&archive, b"not-zip").expect("write");

        let err = extract_archive(&archive, tmp.path()).expect_err("must fail");
        assert_eq!(err.code.as_str(), "ARCHIVE_EXTRACTION_FAILED");
    }

    #[test]
    fn blocks_path_traversal_entries() {
        let tmp = TempDir::new().expect("tmp");
        let archive = tmp.path().join("mod.zip");
        make_zip(&archive, vec![("../escape.package", b"x")]);

        let extract_to = tmp.path().join("extract");
        fs::create_dir_all(&extract_to).expect("extract dir");

        let err = extract_archive(&archive, &extract_to).expect_err("must fail");
        assert_eq!(err.code.as_str(), "ARCHIVE_EXTRACTION_FAILED");
    }

    #[test]
    fn extracted_files_stay_under_destination_root() {
        let tmp = TempDir::new().expect("tmp");
        let archive = tmp.path().join("mod.zip");
        make_zip(&archive, vec![("nested/a.package", b"x")]);

        let extract_to = tmp.path().join("extract");
        fs::create_dir_all(&extract_to).expect("extract dir");
        extract_archive(&archive, &extract_to).expect("extract");

        assert!(extract_to.join("nested/a.package").is_file());
        assert!(!tmp.path().join("a.package").exists());
    }

    #[test]
    fn seven_zip_extension_uses_external_extractor_or_fails_typed() {
        let tmp = TempDir::new().expect("tmp");
        let archive = tmp.path().join("mod.7z");
        fs::write(&archive, b"fake-7z").expect("write");

        let result = extract_archive(&archive, tmp.path());
        if let Err(err) = result {
            assert_eq!(err.code.as_str(), "ARCHIVE_EXTRACTION_FAILED");
        }
    }

    #[test]
    fn rar_extension_uses_external_extractor_or_fails_typed() {
        let tmp = TempDir::new().expect("tmp");
        let archive = tmp.path().join("mod.rar");
        fs::write(&archive, b"fake-rar").expect("write");

        let result = extract_archive(&archive, tmp.path());
        if let Err(err) = result {
            assert_eq!(err.code.as_str(), "ARCHIVE_EXTRACTION_FAILED");
        }
    }
}
