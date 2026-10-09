use crate::{
    error::{ErrorCode, ManagerError},
    fs_scope,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
};
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkRecord {
    pub version: u32,
    #[serde(alias = "mod_id")]
    pub mod_id: String,
    #[serde(default)]
    pub instance_root: Option<PathBuf>,
    pub links: Vec<String>,
}
pub fn record_path(root: &Path, id: &str, game: &Path) -> Result<PathBuf, ManagerError> {
    fs_scope::component(id)?;
    let canonical = fs::canonicalize(game).map_err(fs_scope::io_error)?;
    let key = format!(
        "{:x}",
        Sha256::digest(canonical.as_os_str().as_encoded_bytes())
    );
    let rel = PathBuf::from("mods")
        .join(id)
        .join("links")
        .join(format!("{key}.json"));
    fs_scope::ensure_no_symlink_parents(root, &rel)?;
    Ok(root.join(rel))
}
pub fn read(root: &Path, id: &str, game: &Path) -> Result<LinkRecord, ManagerError> {
    let p = record_path(root, id, game)?;
    let legacy = root.join("mods").join(id).join("links.json");
    let path = if fs_scope::exists(&p) { p } else { legacy };
    fs_scope::ensure_no_symlink_parents(root, path.strip_prefix(root).unwrap())?;
    if fs::symlink_metadata(&path)
        .map_err(|_| ManagerError::new(ErrorCode::NotFound, "No ownership record"))?
        .file_type()
        .is_symlink()
    {
        return Err(ManagerError::new(
            ErrorCode::InvalidPath,
            "Ownership record is a symlink",
        ));
    }
    let record: LinkRecord = serde_json::from_slice(&fs::read(&path).map_err(fs_scope::io_error)?)
        .map_err(|e| ManagerError::new(ErrorCode::InvalidPath, e.to_string()))?;
    if !matches!(record.version, 1 | 2)
        || record.mod_id != id
        || record
            .instance_root
            .as_ref()
            .is_some_and(|r| fs::canonicalize(game).ok().as_ref() != Some(r))
    {
        return Err(ManagerError::new(
            ErrorCode::InvalidPath,
            "Ownership identity mismatch",
        ));
    }
    if (record.version == 2) != record.instance_root.is_some() {
        return Err(ManagerError::new(
            ErrorCode::InvalidPath,
            "Ownership format mismatch",
        ));
    }
    let metadata = crate::managed_storage::read_managed_mod(root, id)?;
    for rel in &record.links {
        fs_scope::relative(Path::new(rel))?;
        if !metadata.files.contains(rel) {
            return Err(ManagerError::new(
                ErrorCode::InvalidPath,
                "Ownership path is absent from managed manifest",
            ));
        }
    }
    Ok(record)
}
pub fn write(root: &Path, id: &str, game: &Path, links: Vec<String>) -> Result<(), ManagerError> {
    let path = record_path(root, id, game)?;
    fs_scope::create_dir_all(&path.parent().unwrap())?;
    let record = LinkRecord {
        version: 2,
        mod_id: id.into(),
        instance_root: Some(fs::canonicalize(game).map_err(fs_scope::io_error)?),
        links,
    };
    fs_scope::atomic_write(
        &path,
        &serde_json::to_vec_pretty(&record)
            .map_err(|e| ManagerError::new(ErrorCode::InternalError, e.to_string()))?,
    )
}
pub fn target(root: &Path, id: &str, rel: &str) -> Result<PathBuf, ManagerError> {
    fs_scope::component(id)?;
    fs_scope::relative(Path::new(rel))?;
    let bundle = fs::canonicalize(root.join("mods").join(id)).map_err(fs_scope::io_error)?;
    Ok(bundle.join("files").join(rel))
}
pub fn owned(root: &Path, id: &str, game: &Path, rel: &str) -> Result<bool, ManagerError> {
    fs_scope::ensure_no_symlink_parents(game, Path::new(rel))?;
    let destination = game.join(rel);
    let expected = target(root, id, rel)?;
    match fs::read_link(&destination) {
        Ok(actual) => Ok(if actual.is_absolute() {
            fs_scope::normalize(&actual) == fs_scope::normalize(&expected)
        } else {
            fs_scope::normalize(&destination.parent().unwrap().join(actual))
                == fs_scope::normalize(&expected)
        }),
        Err(e)
            if e.kind() == std::io::ErrorKind::NotFound
                || e.kind() == std::io::ErrorKind::InvalidInput =>
        {
            Ok(false)
        }
        Err(e) => Err(fs_scope::io_error(e)),
    }
}
