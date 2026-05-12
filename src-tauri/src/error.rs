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
    SourceMissingApiKey,
    SourceUnauthorized,
    SourceRateLimited,
    SourceNetwork,
    SourceInvalidResponse,
    SourceProviderUnavailable,
    SourceNoUsableEvidence,
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
            ErrorCode::SourceMissingApiKey => "SOURCE_MISSING_API_KEY",
            ErrorCode::SourceUnauthorized => "SOURCE_UNAUTHORIZED",
            ErrorCode::SourceRateLimited => "SOURCE_RATE_LIMITED",
            ErrorCode::SourceNetwork => "SOURCE_NETWORK",
            ErrorCode::SourceInvalidResponse => "SOURCE_INVALID_RESPONSE",
            ErrorCode::SourceProviderUnavailable => "SOURCE_PROVIDER_UNAVAILABLE",
            ErrorCode::SourceNoUsableEvidence => "SOURCE_NO_USABLE_EVIDENCE",
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
