import { convertFileSrc } from "@tauri-apps/api/core";

export function isRemotePreview(preview: string): boolean {
  return /^(https?:|data:|blob:|asset:)/i.test(preview);
}

export function resolvePreviewSrc(preview?: string): string | undefined {
  const trimmed = preview?.trim();
  if (!trimmed) return undefined;
  if (isRemotePreview(trimmed)) return trimmed;

  const isAbsoluteLocalPath = trimmed.startsWith("/") || /^[A-Za-z]:[\\/]/.test(trimmed);
  if (!isAbsoluteLocalPath) return trimmed;

  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return trimmed;
  }

  return convertFileSrc(trimmed);
}
