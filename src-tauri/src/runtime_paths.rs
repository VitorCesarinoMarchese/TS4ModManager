use std::env;
use std::path::PathBuf;

use crate::error::{ErrorCode, ManagerError};

pub fn managed_root() -> Result<PathBuf, ManagerError> {
    let home = env::var("HOME").map_err(|_| {
        ManagerError::new(
            ErrorCode::InvalidPath,
            "HOME env missing for managed root resolution",
        )
    })?;

    Ok(PathBuf::from(home).join(".local/share/sims4-mod-manager"))
}

pub fn instance_root_from_id(instance_id: &str) -> Result<PathBuf, ManagerError> {
    if let Some((_, path)) = instance_id.split_once(':') {
        return Ok(PathBuf::from(path));
    }

    if instance_id.starts_with('/') {
        return Ok(PathBuf::from(instance_id));
    }

    Err(ManagerError::new(
        ErrorCode::InvalidPath,
        format!("Invalid instance id format: {instance_id}"),
    ))
}

pub fn mods_dir_from_instance_id(instance_id: &str) -> Result<PathBuf, ManagerError> {
    Ok(instance_root_from_id(instance_id)?.join("Mods"))
}

#[cfg(test)]
mod tests {
    use super::{instance_root_from_id, mods_dir_from_instance_id};

    #[test]
    fn parses_prefixed_instance_id() {
        let p = instance_root_from_id("native:/home/user/Documents/Electronic Arts/The Sims 4")
            .expect("parse");
        assert!(p.ends_with("Documents/Electronic Arts/The Sims 4"));
    }

    #[test]
    fn parses_plain_absolute_path() {
        let p = instance_root_from_id("/home/user/Documents/Electronic Arts/The Sims 4")
            .expect("parse");
        assert!(p.ends_with("Documents/Electronic Arts/The Sims 4"));
    }

    #[test]
    fn computes_mods_dir_from_instance_id() {
        let p = mods_dir_from_instance_id("custom:/home/user/Documents/Electronic Arts/The Sims 4")
            .expect("mods");
        assert!(p.ends_with("Documents/Electronic Arts/The Sims 4/Mods"));
    }
}
