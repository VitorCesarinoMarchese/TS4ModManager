use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::{ErrorCode, ManagerError};
use crate::managed_storage::read_managed_mod;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct IssueEvent {
    pub id: String,
    pub severity: String,
    pub message: String,
    pub code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DryRunOp {
    pub action: String,
    pub path: String,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DryRunResult {
    pub can_apply: bool,
    pub operations: Vec<DryRunOp>,
    pub issues: Vec<IssueEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApplyResult {
    pub applied: bool,
    pub issues: Vec<IssueEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct LinkSidecar {
    version: u32,
    mod_id: String,
    links: Vec<String>,
}

pub fn dry_run_toggle(
    managed_root: &Path,
    game_mods_dir: &Path,
    mod_id: &str,
    target_enabled: bool,
) -> Result<DryRunResult, ManagerError> {
    let mut operations = vec![];
    let mut issues = vec![];
    let mut can_apply = true;

    if !game_mods_dir.is_dir() {
        return Err(ManagerError::new(
            ErrorCode::InvalidPath,
            format!("Game Mods dir invalid: {}", game_mods_dir.display()),
        ));
    }

    if target_enabled {
        let meta = read_managed_mod(managed_root, mod_id)?;
        let existing_hashes = collect_hashes(game_mods_dir);

        for rel in meta.files {
            let src = managed_root.join("mods").join(mod_id).join("files").join(&rel);
            let dst = game_mods_dir.join(&rel);
            let rel_dst = rel_path_for_issue(&dst, game_mods_dir);

            if dst.exists() {
                can_apply = false;
                operations.push(DryRunOp {
                    action: "skip".to_string(),
                    path: rel_dst.clone(),
                    reason: Some("path collision".to_string()),
                });
                issues.push(IssueEvent {
                    id: format!("collision:{}", rel_dst),
                    severity: "error".to_string(),
                    message: format!("Path collision: {}", rel_dst),
                    code: Some("PATH_COLLISION".to_string()),
                });
                continue;
            }

            if let Ok(hash) = file_hash(&src) {
                if let Some(existing_path) = existing_hashes.get(&hash) {
                    issues.push(IssueEvent {
                        id: format!("dup:{}", rel_dst),
                        severity: "warning".to_string(),
                        message: format!(
                            "Duplicate content detected: {} == {}",
                            rel_dst,
                            existing_path.display()
                        ),
                        code: None,
                    });
                }
            }

            operations.push(DryRunOp {
                action: "create_symlink".to_string(),
                path: rel_dst,
                reason: None,
            });
        }
    } else {
        let sidecar = read_sidecar(managed_root, mod_id)?;
        for rel in sidecar.links {
            let dst = game_mods_dir.join(&rel);
            let rel_dst = rel_path_for_issue(&dst, game_mods_dir);

            if !dst.exists() {
                continue;
            }

            let meta = fs::symlink_metadata(&dst).map_err(|e| {
                ManagerError::new(
                    ErrorCode::IoError,
                    format!("symlink metadata failed {}: {e}", dst.display()),
                )
            })?;

            if !meta.file_type().is_symlink() {
                operations.push(DryRunOp {
                    action: "skip".to_string(),
                    path: rel_dst.clone(),
                    reason: Some("not manager symlink".to_string()),
                });
                issues.push(IssueEvent {
                    id: format!("ext:{}", rel_dst),
                    severity: "warning".to_string(),
                    message: format!("Not manager-owned symlink: {}", rel_dst),
                    code: Some("EXTERNAL_LINK".to_string()),
                });
                continue;
            }

            operations.push(DryRunOp {
                action: "remove_symlink".to_string(),
                path: rel_dst,
                reason: None,
            });
        }
    }

    Ok(DryRunResult {
        can_apply,
        operations,
        issues,
    })
}

pub fn apply_toggle(
    managed_root: &Path,
    game_mods_dir: &Path,
    mod_id: &str,
    target_enabled: bool,
) -> Result<ApplyResult, ManagerError> {
    let dry = dry_run_toggle(managed_root, game_mods_dir, mod_id, target_enabled)?;

    if !dry.can_apply {
        return Ok(ApplyResult {
            applied: false,
            issues: dry.issues,
        });
    }

    if target_enabled {
        let mut links = vec![];
        for op in &dry.operations {
            if op.action != "create_symlink" {
                continue;
            }

            let rel = PathBuf::from(&op.path);
            let src = managed_root.join("mods").join(mod_id).join("files").join(&rel);
            let dst = game_mods_dir.join(&rel);

            if let Some(parent) = dst.parent() {
                fs::create_dir_all(parent).map_err(|e| {
                    ManagerError::new(
                        ErrorCode::IoError,
                        format!("Create parent failed {}: {e}", parent.display()),
                    )
                })?;
            }

            create_symlink(&src, &dst)?;
            links.push(rel.to_string_lossy().replace('\\', "/"));
        }

        write_sidecar(managed_root, mod_id, links)?;
    } else {
        for op in &dry.operations {
            if op.action != "remove_symlink" {
                continue;
            }

            let dst = game_mods_dir.join(&op.path);
            let _ = fs::remove_file(&dst);
        }

        let sidecar_path = sidecar_path(managed_root, mod_id);
        let _ = fs::remove_file(sidecar_path);
    }

    Ok(ApplyResult {
        applied: true,
        issues: dry.issues,
    })
}

fn rel_path_for_issue(path: &Path, root: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn sidecar_path(managed_root: &Path, mod_id: &str) -> PathBuf {
    managed_root.join("mods").join(mod_id).join("links.json")
}

fn read_sidecar(managed_root: &Path, mod_id: &str) -> Result<LinkSidecar, ManagerError> {
    let p = sidecar_path(managed_root, mod_id);
    let raw = fs::read_to_string(&p).map_err(|_| {
        ManagerError::new(
            ErrorCode::NotFound,
            format!("Link sidecar not found: {}", p.display()),
        )
    })?;

    serde_json::from_str(&raw).map_err(|e| {
        ManagerError::new(
            ErrorCode::InvalidPath,
            format!("Link sidecar malformed: {e}"),
        )
    })
}

fn write_sidecar(managed_root: &Path, mod_id: &str, links: Vec<String>) -> Result<(), ManagerError> {
    let p = sidecar_path(managed_root, mod_id);
    let sidecar = LinkSidecar {
        version: 1,
        mod_id: mod_id.to_string(),
        links,
    };

    let raw = serde_json::to_string_pretty(&sidecar).map_err(|e| {
        ManagerError::new(
            ErrorCode::InternalError,
            format!("Serialize sidecar failed: {e}"),
        )
    })?;

    fs::write(&p, raw).map_err(|e| {
        ManagerError::new(
            ErrorCode::IoError,
            format!("Write sidecar failed {}: {e}", p.display()),
        )
    })
}

fn file_hash(path: &Path) -> Result<String, ManagerError> {
    let mut file = fs::File::open(path).map_err(|e| {
        ManagerError::new(
            ErrorCode::IoError,
            format!("Open for hash failed {}: {e}", path.display()),
        )
    })?;

    let mut hasher = Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let read = file.read(&mut buf).map_err(|e| {
            ManagerError::new(
                ErrorCode::IoError,
                format!("Read for hash failed {}: {e}", path.display()),
            )
        })?;

        if read == 0 {
            break;
        }
        hasher.update(&buf[..read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

fn collect_hashes(root: &Path) -> HashMap<String, PathBuf> {
    let mut out = HashMap::new();
    let mut stack = vec![root.to_path_buf()];

    while let Some(dir) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };

        for entry in entries.flatten() {
            let p = entry.path();
            let Ok(meta) = fs::symlink_metadata(&p) else {
                continue;
            };

            if meta.is_dir() {
                stack.push(p);
                continue;
            }
            if !meta.is_file() {
                continue;
            }

            if let Ok(hash) = file_hash(&p) {
                out.entry(hash).or_insert(p);
            }
        }
    }

    out
}

fn create_symlink(src: &Path, dst: &Path) -> Result<(), ManagerError> {
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(src, dst).map_err(|e| {
            ManagerError::new(
                ErrorCode::IoError,
                format!("symlink failed {} -> {}: {e}", src.display(), dst.display()),
            )
        })
    }

    #[cfg(not(unix))]
    {
        let _ = src;
        let _ = dst;
        Err(ManagerError::new(
            ErrorCode::InternalError,
            "symlink not supported on this platform",
        ))
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::TempDir;

    use crate::managed_storage::{create_managed_mod, ImportRequest};

    use super::{apply_toggle, dry_run_toggle};

    fn setup_managed_mod(tmp: &TempDir) -> String {
        let import = tmp.path().join("import/modA");
        fs::create_dir_all(import.join("sub")).expect("import dir");
        fs::write(import.join("a.package"), b"AAA").expect("a");
        fs::write(import.join("sub/readme.txt"), b"TXT").expect("txt");

        let meta = create_managed_mod(
            tmp.path(),
            ImportRequest {
                name: "ModA".to_string(),
                slug: Some("moda".to_string()),
                source_dir: import,
            },
        )
        .expect("managed");

        meta.mod_id
    }

    #[test]
    fn dry_run_enable_lists_symlinks_to_create() {
        let tmp = TempDir::new().expect("tmp");
        let mods_dir = tmp.path().join("Game/Mods");
        fs::create_dir_all(&mods_dir).expect("mods");
        let mod_id = setup_managed_mod(&tmp);

        let dry = dry_run_toggle(tmp.path(), &mods_dir, &mod_id, true).expect("dry");
        assert!(dry.can_apply);
        assert!(dry.operations.iter().any(|o| o.action == "create_symlink"));
    }

    #[test]
    fn dry_run_disable_lists_symlinks_to_remove() {
        let tmp = TempDir::new().expect("tmp");
        let mods_dir = tmp.path().join("Game/Mods");
        fs::create_dir_all(&mods_dir).expect("mods");
        let mod_id = setup_managed_mod(&tmp);

        let _ = apply_toggle(tmp.path(), &mods_dir, &mod_id, true).expect("enable");
        let dry = dry_run_toggle(tmp.path(), &mods_dir, &mod_id, false).expect("dry");

        assert!(dry.operations.iter().any(|o| o.action == "remove_symlink"));
    }

    #[test]
    fn apply_enable_creates_links_to_managed_only() {
        let tmp = TempDir::new().expect("tmp");
        let mods_dir = tmp.path().join("Game/Mods");
        fs::create_dir_all(&mods_dir).expect("mods");
        let mod_id = setup_managed_mod(&tmp);

        let _ = apply_toggle(tmp.path(), &mods_dir, &mod_id, true).expect("apply");

        let linked = mods_dir.join("a.package");
        let target = fs::read_link(linked).expect("readlink");
        assert!(target.starts_with(tmp.path().join("mods").join(&mod_id).join("files")));
    }

    #[test]
    fn apply_disable_removes_only_manager_owned_links() {
        let tmp = TempDir::new().expect("tmp");
        let mods_dir = tmp.path().join("Game/Mods");
        let outside = tmp.path().join("outside");
        fs::create_dir_all(&mods_dir).expect("mods");
        fs::create_dir_all(&outside).expect("outside");
        fs::write(outside.join("x.package"), b"X").expect("x");

        let mod_id = setup_managed_mod(&tmp);
        let _ = apply_toggle(tmp.path(), &mods_dir, &mod_id, true).expect("enable");

        #[cfg(unix)]
        std::os::unix::fs::symlink(outside.join("x.package"), mods_dir.join("external.package"))
            .expect("external link");

        let _ = apply_toggle(tmp.path(), &mods_dir, &mod_id, false).expect("disable");

        assert!(!mods_dir.join("a.package").exists());
        assert!(mods_dir.join("external.package").exists());
    }

    #[test]
    fn path_collision_blocks_apply_and_emits_issue() {
        let tmp = TempDir::new().expect("tmp");
        let mods_dir = tmp.path().join("Game/Mods");
        fs::create_dir_all(&mods_dir).expect("mods");
        fs::write(mods_dir.join("a.package"), b"conflict").expect("conflict");
        let mod_id = setup_managed_mod(&tmp);

        let dry = dry_run_toggle(tmp.path(), &mods_dir, &mod_id, true).expect("dry");
        assert!(!dry.can_apply);
        assert!(dry
            .issues
            .iter()
            .any(|i| i.code.as_deref() == Some("PATH_COLLISION")));
    }

    #[test]
    fn hash_duplicate_warns_but_does_not_block() {
        let tmp = TempDir::new().expect("tmp");
        let mods_dir = tmp.path().join("Game/Mods");
        fs::create_dir_all(&mods_dir).expect("mods");
        fs::write(mods_dir.join("other.package"), b"AAA").expect("dup by hash");
        let mod_id = setup_managed_mod(&tmp);

        let dry = dry_run_toggle(tmp.path(), &mods_dir, &mod_id, true).expect("dry");
        assert!(dry.can_apply);
        assert!(dry.issues.iter().any(|i| i.severity == "warning"));
    }

    #[test]
    fn disable_skips_non_symlink_entries_with_warning() {
        let tmp = TempDir::new().expect("tmp");
        let mods_dir = tmp.path().join("Game/Mods");
        fs::create_dir_all(&mods_dir).expect("mods");
        let mod_id = setup_managed_mod(&tmp);

        let _ = apply_toggle(tmp.path(), &mods_dir, &mod_id, true).expect("enable");
        fs::remove_file(mods_dir.join("a.package")).expect("remove link");
        fs::write(mods_dir.join("a.package"), b"regular file").expect("regular");

        let dry = dry_run_toggle(tmp.path(), &mods_dir, &mod_id, false).expect("dry");
        assert!(dry
            .issues
            .iter()
            .any(|i| i.code.as_deref() == Some("EXTERNAL_LINK")));
    }
}
