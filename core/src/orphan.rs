use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OrphanSymlink {
    pub path: PathBuf,
    pub target: PathBuf,
}

pub fn detect_orphan_symlinks(game_mods_dir: &Path) -> Vec<OrphanSymlink> {
    let mut out = vec![];
    let mut stack = vec![game_mods_dir.to_path_buf()];

    while let Some(dir) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(meta) = fs::symlink_metadata(&path) else {
                continue;
            };

            if meta.is_dir() {
                stack.push(path);
                continue;
            }

            if !meta.file_type().is_symlink() {
                continue;
            }

            let Ok(target) = fs::read_link(&path) else {
                continue;
            };

            let resolved = if target.is_absolute() {
                target.clone()
            } else {
                path.parent().unwrap_or(game_mods_dir).join(&target)
            };

            if !resolved.exists() {
                out.push(OrphanSymlink { path, target });
            }
        }
    }

    out.sort_by(|a, b| a.path.cmp(&b.path));
    out
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::TempDir;

    use super::detect_orphan_symlinks;

    #[test]
    fn finds_orphan_symlink_without_deleting_it() {
        let tmp = TempDir::new().expect("tmp");
        let mods = tmp.path().join("Mods");
        fs::create_dir_all(&mods).expect("mods");

        #[cfg(unix)]
        std::os::unix::fs::symlink(tmp.path().join("missing.package"), mods.join("dangling.package"))
            .expect("link");

        let orphans = detect_orphan_symlinks(&mods);
        assert_eq!(orphans.len(), 1);
        assert!(fs::symlink_metadata(mods.join("dangling.package")).is_ok());
    }

    #[test]
    fn ignores_valid_symlink_targets() {
        let tmp = TempDir::new().expect("tmp");
        let mods = tmp.path().join("Mods");
        let src = tmp.path().join("src");
        fs::create_dir_all(&mods).expect("mods");
        fs::create_dir_all(&src).expect("src");
        fs::write(src.join("ok.package"), b"x").expect("file");

        #[cfg(unix)]
        std::os::unix::fs::symlink(src.join("ok.package"), mods.join("ok.package")).expect("link");

        let orphans = detect_orphan_symlinks(&mods);
        assert!(orphans.is_empty());
    }
}
