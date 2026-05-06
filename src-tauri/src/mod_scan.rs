use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ModSource {
    Managed,
    External,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ScannedMod {
    pub key: String,
    pub name: String,
    pub files: Vec<String>,
    pub mod_files: Vec<String>,
    pub preview: Option<String>,
    pub source: ModSource,
    pub group_path: Vec<String>,
}

#[derive(Debug, Clone)]
struct FileEntry {
    relative: String,
    absolute: PathBuf,
    is_symlink: bool,
    symlink_target: Option<PathBuf>,
}

pub fn scan_mods(mods_dir: &Path, managed_root: &Path) -> Vec<ScannedMod> {
    let mut groups: BTreeMap<String, Vec<FileEntry>> = BTreeMap::new();
    let mut stack = vec![mods_dir.to_path_buf()];

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

            if !meta.is_file() && !meta.file_type().is_symlink() {
                continue;
            }

            let Ok(rel) = path.strip_prefix(mods_dir) else {
                continue;
            };

            let relative = rel.to_string_lossy().replace('\\', "/");
            let key = group_key(rel);
            let symlink_target = if meta.file_type().is_symlink() {
                fs::read_link(&path).ok()
            } else {
                None
            };

            groups.entry(key).or_default().push(FileEntry {
                relative,
                absolute: path,
                is_symlink: meta.file_type().is_symlink(),
                symlink_target,
            });
        }
    }

    groups
        .into_iter()
        .filter_map(|(key, mut files)| {
            files.sort_by(|a, b| a.relative.cmp(&b.relative));
            let scanned = build_scanned_mod(key, files, managed_root);
            (!scanned.mod_files.is_empty()).then_some(scanned)
        })
        .collect()
}

fn build_scanned_mod(key: String, files: Vec<FileEntry>, managed_root: &Path) -> ScannedMod {
    let preview = choose_preview(&files);
    let all_files = files.iter().map(|f| f.relative.clone()).collect::<Vec<_>>();

    let mod_files = files
        .iter()
        .filter(|f| is_mod_file(&f.relative))
        .map(|f| f.relative.clone())
        .collect::<Vec<_>>();

    let source = if files.iter().any(|f| {
        f.is_symlink
            && f
                .symlink_target
                .as_ref()
                .is_none_or(|target| !target.starts_with(managed_root))
    }) {
        ModSource::External
    } else {
        ModSource::Managed
    };

    let group_path = key.split('/').map(ToString::to_string).collect::<Vec<_>>();
    let name = group_path.last().cloned().unwrap_or_else(|| key.clone());

    ScannedMod {
        key,
        name,
        files: all_files,
        mod_files,
        preview,
        source,
        group_path,
    }
}

fn group_key(relative: &Path) -> String {
    let mut comps = relative.components();
    let Some(first) = comps.next() else {
        return "unknown".to_string();
    };

    if comps.next().is_some() {
        return first.as_os_str().to_string_lossy().to_string();
    }

    let filename = first.as_os_str().to_string_lossy().to_string();
    filename_prefix(&filename)
}

fn filename_prefix(filename: &str) -> String {
    let stem = filename.split('.').next().unwrap_or(filename);
    let mut out = String::new();

    for ch in stem.chars() {
        if matches!(ch, '_' | '-' | ' ') {
            break;
        }
        out.push(ch);
    }

    if out.is_empty() {
        stem.to_string()
    } else {
        out
    }
}

fn is_mod_file(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    lower.ends_with(".package") || lower.ends_with(".ts4script")
}

fn is_preview_candidate(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    lower.ends_with(".png")
        || lower.ends_with(".jpg")
        || lower.ends_with(".jpeg")
        || lower.contains("preview.")
        || lower.contains("cover.")
}

fn choose_preview(files: &[FileEntry]) -> Option<String> {
    files
        .iter()
        .filter(|f| is_preview_candidate(&f.relative))
        .max_by_key(|f| {
            let dims = image::image_dimensions(&f.absolute).unwrap_or((0, 0));
            let area = (dims.0 as u64) * (dims.1 as u64);
            let size = fs::metadata(&f.absolute).map(|m| m.len()).unwrap_or(0);
            (area, size)
        })
        .map(|f| f.relative.clone())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use image::{ImageBuffer, Rgba};
    use tempfile::TempDir;

    use super::{scan_mods, ModSource};

    #[test]
    fn scans_recursively_and_groups_by_folder() {
        let root = TempDir::new().expect("tmp");
        let mods = root.path().join("Mods");
        let managed = root.path().join("managed");

        fs::create_dir_all(mods.join("MyMod/sub")).expect("dirs");
        fs::create_dir_all(&managed).expect("managed");
        fs::write(mods.join("MyMod/main.package"), b"pkg").expect("file");
        fs::write(mods.join("MyMod/sub/readme.txt"), b"txt").expect("file");

        let scanned = scan_mods(&mods, &managed);
        assert_eq!(scanned.len(), 1);
        assert_eq!(scanned[0].key, "MyMod");
        assert_eq!(scanned[0].files.len(), 2);
    }

    #[test]
    fn groups_root_files_by_filename_prefix_fallback() {
        let root = TempDir::new().expect("tmp");
        let mods = root.path().join("Mods");
        let managed = root.path().join("managed");

        fs::create_dir_all(&mods).expect("mods");
        fs::create_dir_all(&managed).expect("managed");
        fs::write(mods.join("CoolMod_A.package"), b"a").expect("a");
        fs::write(mods.join("CoolMod_B.ts4script"), b"b").expect("b");

        let scanned = scan_mods(&mods, &managed);
        assert_eq!(scanned.len(), 1);
        assert_eq!(scanned[0].key, "CoolMod");
    }

    #[test]
    fn includes_assets_only_when_group_contains_mod_files() {
        let root = TempDir::new().expect("tmp");
        let mods = root.path().join("Mods");
        let managed = root.path().join("managed");

        fs::create_dir_all(mods.join("Pack")).expect("dirs");
        fs::create_dir_all(&managed).expect("managed");
        fs::write(mods.join("Pack/a.package"), b"pkg").expect("pkg");
        fs::write(mods.join("Pack/b.ts4script"), b"ts4").expect("ts4");
        fs::write(mods.join("Pack/cover.jpg"), b"jpg").expect("jpg");
        fs::write(mods.join("Pack/readme.md"), b"md").expect("md");

        let scanned = scan_mods(&mods, &managed);
        assert_eq!(scanned.len(), 1);
        assert_eq!(scanned[0].files.len(), 4);
        assert_eq!(scanned[0].mod_files.len(), 2);
    }

    #[test]
    fn excludes_files_and_folders_without_mod_files() {
        let root = TempDir::new().expect("tmp");
        let mods = root.path().join("Mods");
        let managed = root.path().join("managed");

        fs::create_dir_all(mods.join("Resource.dasdas")).expect("dirs");
        fs::create_dir_all(mods.join("RealMod")).expect("real");
        fs::create_dir_all(&managed).expect("managed");
        fs::write(mods.join("Resource.dasdas/readme.txt"), b"txt").expect("txt");
        fs::write(mods.join("orphan.txt"), b"txt").expect("orphan");
        fs::write(mods.join("RealMod/main.package"), b"pkg").expect("pkg");

        let scanned = scan_mods(&mods, &managed);
        assert_eq!(scanned.len(), 1);
        assert_eq!(scanned[0].key, "RealMod");
    }

    #[test]
    fn chooses_preview_by_biggest_resolution_then_size() {
        let root = TempDir::new().expect("tmp");
        let mods = root.path().join("Mods");
        let managed = root.path().join("managed");

        fs::create_dir_all(mods.join("Pack")).expect("dirs");
        fs::create_dir_all(&managed).expect("managed");

        let small = ImageBuffer::<Rgba<u8>, _>::from_pixel(64, 64, Rgba([1, 2, 3, 255]));
        let big = ImageBuffer::<Rgba<u8>, _>::from_pixel(256, 256, Rgba([1, 2, 3, 255]));

        fs::write(mods.join("Pack/main.package"), b"pkg").expect("pkg");
        small
            .save(mods.join("Pack/preview_small.png"))
            .expect("save small");
        big.save(mods.join("Pack/preview_big.png"))
            .expect("save big");

        let scanned = scan_mods(&mods, &managed);
        assert_eq!(scanned[0].preview.as_deref(), Some("Pack/preview_big.png"));
    }

    #[test]
    fn marks_external_when_symlink_target_outside_managed() {
        let root = TempDir::new().expect("tmp");
        let mods = root.path().join("Mods");
        let managed = root.path().join("managed");
        let external_root = root.path().join("outside");

        fs::create_dir_all(&mods).expect("mods");
        fs::create_dir_all(&managed).expect("managed");
        fs::create_dir_all(&external_root).expect("outside");
        fs::write(external_root.join("x.package"), b"pkg").expect("pkg");

        #[cfg(unix)]
        std::os::unix::fs::symlink(external_root.join("x.package"), mods.join("Ext_x.package"))
            .expect("symlink");

        let scanned = scan_mods(&mods, &managed);
        assert_eq!(scanned[0].source, ModSource::External);
    }

    #[test]
    fn marks_managed_when_symlink_target_inside_managed() {
        let root = TempDir::new().expect("tmp");
        let mods = root.path().join("Mods");
        let managed = root.path().join("managed");
        let managed_file = managed.join("mods/id/files/y.package");

        fs::create_dir_all(&mods).expect("mods");
        fs::create_dir_all(managed_file.parent().expect("parent")).expect("managed tree");
        fs::write(&managed_file, b"pkg").expect("pkg");

        #[cfg(unix)]
        std::os::unix::fs::symlink(&managed_file, mods.join("Managed_y.package")).expect("symlink");

        let scanned = scan_mods(&mods, &managed);
        assert_eq!(scanned[0].source, ModSource::Managed);
    }
}
