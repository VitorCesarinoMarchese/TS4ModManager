type InvokeFn = <T = unknown>(command: string, payload?: Record<string, unknown>) => Promise<T>;

function tauriInvoke(): InvokeFn | null {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return null;
  return (window as unknown as { __TAURI_INTERNALS__?: { invoke?: InvokeFn } }).__TAURI_INTERNALS__?.invoke ?? null;
}

export async function openExternalUrl(url: string): Promise<void> {
  const invoke = tauriInvoke();
  if (invoke) {
    await invoke("open_external_url", { url });
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
