use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    InvalidPath,
    NotFound,
    PermissionDenied,
    PathCollision,
    ExternalLink,
    ArchiveUnsupported,
    ArchiveExtractionFailed,
    IoError,
    InternalError,
}

impl ErrorCode {
    pub fn as_str(self) -> &'static str {
        match self {
            ErrorCode::InvalidPath => "INVALID_PATH",
            ErrorCode::NotFound => "NOT_FOUND",
            ErrorCode::PermissionDenied => "PERMISSION_DENIED",
            ErrorCode::PathCollision => "PATH_COLLISION",
            ErrorCode::ExternalLink => "EXTERNAL_LINK",
            ErrorCode::ArchiveUnsupported => "ARCHIVE_UNSUPPORTED",
            ErrorCode::ArchiveExtractionFailed => "ARCHIVE_EXTRACTION_FAILED",
            ErrorCode::IoError => "IO_ERROR",
            ErrorCode::InternalError => "INTERNAL_ERROR",
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ManagerError {
    pub code: ErrorCode,
    pub message: String,
}

impl ManagerError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}
