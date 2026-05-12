import type { ApiError as ApiErrorType, BackendErrorCode as BackendErrorCodeType } from "./types";

export const BackendErrorCode = {
  INVALID_PATH: "INVALID_PATH",
  NOT_FOUND: "NOT_FOUND",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  PATH_COLLISION: "PATH_COLLISION",
  EXTERNAL_LINK: "EXTERNAL_LINK",
  ARCHIVE_UNSUPPORTED: "ARCHIVE_UNSUPPORTED",
  ARCHIVE_EXTRACTION_FAILED: "ARCHIVE_EXTRACTION_FAILED",
  SOURCE_MISSING_API_KEY: "SOURCE_MISSING_API_KEY",
  SOURCE_UNAUTHORIZED: "SOURCE_UNAUTHORIZED",
  SOURCE_RATE_LIMITED: "SOURCE_RATE_LIMITED",
  SOURCE_NETWORK: "SOURCE_NETWORK",
  SOURCE_INVALID_RESPONSE: "SOURCE_INVALID_RESPONSE",
  SOURCE_PROVIDER_UNAVAILABLE: "SOURCE_PROVIDER_UNAVAILABLE",
  SOURCE_NO_USABLE_EVIDENCE: "SOURCE_NO_USABLE_EVIDENCE",
  IO_ERROR: "IO_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR"
} as const satisfies Record<string, BackendErrorCodeType>;

const KNOWN_CODES = new Set<string>(Object.values(BackendErrorCode));

export function toBackendErrorCode(input: string): BackendErrorCodeType {
  if (KNOWN_CODES.has(input)) {
    return input as BackendErrorCodeType;
  }

  return BackendErrorCode.INTERNAL_ERROR;
}

export type ApiError = ApiErrorType;
