export type BackendErrorCode =
  | "INVALID_PATH"
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "PATH_COLLISION"
  | "EXTERNAL_LINK"
  | "ARCHIVE_UNSUPPORTED"
  | "ARCHIVE_EXTRACTION_FAILED"
  | "IO_ERROR"
  | "INTERNAL_ERROR";

export type ApiError = {
  code: BackendErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

export type SourceMetadata = {
  displayName?: string;
  previewUrl?: string;
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
