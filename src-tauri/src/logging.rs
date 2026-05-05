use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use chrono::Utc;

use crate::error::{ErrorCode, ManagerError};
use crate::toggle::IssueEvent;

pub fn log_file_path(managed_root: &Path) -> PathBuf {
    managed_root.join("logs").join("app.log")
}

pub fn append_issue_log(managed_root: &Path, issue: &IssueEvent) -> Result<(), ManagerError> {
    let path = log_file_path(managed_root);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            ManagerError::new(
                ErrorCode::IoError,
                format!("Create log dir failed {}: {e}", parent.display()),
            )
        })?;
    }

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| {
            ManagerError::new(
                ErrorCode::IoError,
                format!("Open log file failed {}: {e}", path.display()),
            )
        })?;

    let code = issue.code.as_deref().unwrap_or("-");
    let line = format!(
        "{} [{}] {} ({})\n",
        Utc::now().to_rfc3339(),
        issue.severity.to_uppercase(),
        issue.message,
        code
    );

    file.write_all(line.as_bytes()).map_err(|e| {
        ManagerError::new(
            ErrorCode::IoError,
            format!("Write log failed {}: {e}", path.display()),
        )
    })
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::TempDir;

    use crate::toggle::IssueEvent;

    use super::{append_issue_log, log_file_path};

    #[test]
    fn appends_issue_log_with_context() {
        let tmp = TempDir::new().expect("tmp");
        let issue = IssueEvent {
            id: "i1".to_string(),
            severity: "warning".to_string(),
            message: "Path collision".to_string(),
            code: Some("PATH_COLLISION".to_string()),
        };

        append_issue_log(tmp.path(), &issue).expect("log");
        let path = log_file_path(tmp.path());
        let raw = fs::read_to_string(path).expect("read log");

        assert!(raw.contains("[WARNING]"));
        assert!(raw.contains("Path collision"));
        assert!(raw.contains("PATH_COLLISION"));
    }
}
