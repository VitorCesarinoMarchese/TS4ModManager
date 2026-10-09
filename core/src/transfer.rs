//! Cross-device transfers retain the original in a source-filesystem holding.
use crate::{
    error::{ErrorCode, ManagerError},
    fs_scope,
};
use sha2::{Digest, Sha256};
use std::{fs, io::Read, path::Path};
pub fn fingerprint(path: &Path) -> Result<String, ManagerError> {
    let meta = fs::symlink_metadata(path).map_err(fs_scope::io_error)?;
    let mut digest = Sha256::new();
    if meta.file_type().is_symlink() {
        digest.update(b"link");
        digest.update(
            fs::read_link(path)
                .map_err(fs_scope::io_error)?
                .as_os_str()
                .as_encoded_bytes(),
        );
    } else if meta.is_file() {
        digest.update(b"file");
        let mut file = fs::File::open(path).map_err(fs_scope::io_error)?;
        let mut bytes = [0; 65536];
        loop {
            let n = file.read(&mut bytes).map_err(fs_scope::io_error)?;
            if n == 0 {
                break;
            }
            digest.update(&bytes[..n]);
        }
    } else if meta.is_dir() {
        digest.update(b"dir");
        let mut entries = fs::read_dir(path)
            .map_err(fs_scope::io_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(fs_scope::io_error)?;
        entries.sort_by_key(|e| e.file_name());
        for entry in entries {
            digest.update(entry.file_name().as_encoded_bytes());
            digest.update(fingerprint(&entry.path())?.as_bytes());
        }
    } else {
        return Err(ManagerError::new(
            ErrorCode::InvalidPath,
            "Special files cannot be transferred",
        ));
    }
    Ok(format!("{:x}", digest.finalize()))
}
pub fn copy_verified(source: &Path, destination: &Path) -> Result<(), ManagerError> {
    if fs_scope::exists(destination) {
        return Err(ManagerError::new(
            ErrorCode::PathCollision,
            "Copy destination occupied",
        ));
    }
    let before = fingerprint(source)?;
    copy_object(source, destination)?;
    if before != fingerprint(source)? || before != fingerprint(destination)? {
        return Err(ManagerError::new(
            ErrorCode::IoError,
            "Transfer verification failed; original retained",
        ));
    }
    Ok(())
}
fn copy_object(source: &Path, destination: &Path) -> Result<(), ManagerError> {
    let meta = fs::symlink_metadata(source).map_err(fs_scope::io_error)?;
    if meta.file_type().is_symlink() {
        #[cfg(unix)]
        fs_scope::Directory::open(destination.parent().unwrap())?.symlink(
            Path::new(destination.file_name().unwrap()),
            &fs::read_link(source).map_err(fs_scope::io_error)?,
        )?;
        #[cfg(not(unix))]
        return Err(ManagerError::new(
            ErrorCode::InternalError,
            "Symlink transfer is unsupported on this platform",
        ));
    } else if meta.is_dir() {
        fs_scope::create_directory(destination)?;
        for entry in fs::read_dir(source).map_err(fs_scope::io_error)? {
            let entry = entry.map_err(fs_scope::io_error)?;
            copy_object(&entry.path(), &destination.join(entry.file_name()))?;
        }
        fs::File::open(destination)
            .map_err(fs_scope::io_error)?
            .sync_all()
            .map_err(fs_scope::io_error)?;
    } else if meta.is_file() {
        let mut input = fs::File::open(source).map_err(fs_scope::io_error)?;
        let mut output = fs_scope::create_file(
            destination.parent().unwrap(),
            Path::new(destination.file_name().unwrap()),
        )?;
        std::io::copy(&mut input, &mut output).map_err(fs_scope::io_error)?;
        output.sync_all().map_err(fs_scope::io_error)?;
    } else {
        return Err(ManagerError::new(
            ErrorCode::InvalidPath,
            "Special file in transfer",
        ));
    }
    Ok(())
}
