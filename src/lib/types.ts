export type BackendErrorCode =
  | "INVALID_PATH"
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "PATH_COLLISION"
  | "EXTERNAL_LINK"
  | "ARCHIVE_UNSUPPORTED"
  | "ARCHIVE_EXTRACTION_FAILED"
  | "SOURCE_MISSING_API_KEY"
  | "SOURCE_UNAUTHORIZED"
  | "SOURCE_RATE_LIMITED"
  | "SOURCE_NETWORK"
  | "SOURCE_INVALID_RESPONSE"
  | "SOURCE_PROVIDER_UNAVAILABLE"
  | "SOURCE_NO_USABLE_EVIDENCE"
  | "IO_ERROR"
  | "INTERNAL_ERROR";

export type ApiError = {
  code: BackendErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

export type SourceEvidence = {
  kind: string;
  description: string;
  weight: number;
};

export type SourceAttachmentMetadata = {
  providerId: string;
  projectId?: number;
  fileId?: number;
  sourceUrl: string;
  title: string;
  author?: string;
  confidence?: number;
  reasons: string[];
  evidence: SourceEvidence[];
  attachedBy: string;
  attachedAt: string;
};

export type SourceMetadata = {
  displayName?: string;
  previewUrl?: string;
  sourceAttachment?: SourceAttachmentMetadata;
};

export type SourceCandidate = {
  providerId: "curseforge";
  title: string;
  sourceUrl: string;
  previewUrl?: string;
  author?: string;
  projectId?: number;
  fileId?: number;
  confidence: number;
  confidenceLevel: "high" | "medium" | "low";
  reasons: string[];
  evidence: Array<{
    kind: string;
    description: string;
    weight: number;
  }>;
};

export type Mod = {
  id: string;
  name: string;
  slug?: string;
  files: string[];
  enabled: boolean;
  preview?: string;
  sourceUrl?: string;
  sourceAttachment?: SourceAttachmentMetadata;
  source: "managed" | "external";
  groupPath?: string[];
};

export type GameInstance = {
  id: string;
  path: string;
  source: "native" | "steam" | "custom";
};

export type TrashEntry = {
  name: string;
  path: string;
  originalPath?: string;
  deletionDate?: string;
};

export type RestoreResult = {
  restoredPath: string;
};

export type RuntimeDiagnostics = {
  managedRoot: string;
  managedModsDir: string;
  trashFilesDir: string;
  waylandWorkaround?: string;
  waylandWorkaroundDisabled: boolean;
  appVersion: string;
  buildTarget: string;
};

export type Issue = {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  code?: BackendErrorCode;
  context?: Record<string, unknown>;
};

export type DryRunOp = {
  action: "create_symlink" | "remove_symlink" | "skip";
  path: string;
  reason?: string;
};

export type DryRunResult = {
  canApply: boolean;
  operations: DryRunOp[];
  issues: Issue[];
};
