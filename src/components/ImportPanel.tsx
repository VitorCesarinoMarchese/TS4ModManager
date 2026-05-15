import { Archive, UploadSimple } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

type ImportPanelProps = {
  onImport: (archivePath: string, name: string, slug?: string) => void | Promise<void>;
};

type BrowserDropFile = File & { path?: string };
type TauriDragDropPayload = { type?: string; paths?: string[] };

export function archivePathFromBrowserDrop(files?: FileList | BrowserDropFile[] | null): string | null {
  const file = files?.[0] as BrowserDropFile | undefined;
  return file?.path || file?.name || null;
}

export function archivePathFromTauriDrop(payload: TauriDragDropPayload): string | null {
  return payload.type === "drop" ? payload.paths?.[0] ?? null : null;
}

export function archiveNameFromPath(path: string): string {
  const filename = path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
  return filename.replace(/\.(zip|rar|7z)$/i, "").trim();
}

export function ImportPanel({ onImport }: ImportPanelProps) {
  const [archivePath, setArchivePath] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const inputClass = "h-9 rounded-md border !border-[var(--color-border)] bg-white px-3 py-1.5 text-slate-950 dark:bg-slate-800 dark:text-slate-100";

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void import("@tauri-apps/api/webview")
      .then(({ getCurrentWebview }) => getCurrentWebview().onDragDropEvent((event) => {
        const path = archivePathFromTauriDrop(event.payload);
        if (path) setArchivePath(path);
      }))
      .then((cleanup) => {
        if (disposed) cleanup();
        else unlisten = cleanup;
      })
      .catch(() => {});

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return (
    <section aria-label="import-panel" className="import-panel grid gap-4">
      <h2 className="text-xl font-semibold">Import</h2>

      <div className="form-grid grid grid-cols-[minmax(120px,auto)_minmax(220px,1fr)] items-center gap-3">
        <label className="text-sm font-medium" htmlFor="archive-path">
          Archive path
        </label>
        <input
          id="archive-path"
          className={inputClass}
          value={archivePath}
          onChange={(e) => setArchivePath(e.target.value)}
          placeholder="/path/mod.zip"
        />

        <label className="text-sm font-medium" htmlFor="mod-name">
          Mod name
        </label>
        <input
          id="mod-name"
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
        />

        <label className="text-sm font-medium" htmlFor="mod-slug">
          Slug (optional)
        </label>
        <input
          id="mod-slug"
          className={inputClass}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="slug"
        />
      </div>

      <div
        className="dropzone flex min-h-12 items-center gap-2 rounded-[10px] border border-dashed !border-[var(--color-border)] p-3.5 text-slate-600 dark:text-slate-300"
        aria-label="Drop archive here"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const path = archivePathFromBrowserDrop(e.dataTransfer.files);
          if (path) setArchivePath(path);
        }}
      >
        <Archive size={18} weight="regular" aria-hidden="true" />
        Drop archive here
      </div>

      <button
        type="button"
        className="inline-flex w-fit items-center gap-2 rounded-md border !border-[var(--color-border)] bg-white px-3 py-1.5 text-sm hover:border-accent hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent/40 dark:bg-slate-800 dark:hover:border-accent dark:hover:bg-accent/10"
        onClick={() => {
          const p = archivePath.trim();
          const n = name.trim() || archiveNameFromPath(p);
          if (!p || !n) return;
          void onImport(p, n, slug.trim() || undefined);
          setArchivePath("");
          setName("");
          setSlug("");
        }}
      >
        <UploadSimple size={16} weight="regular" aria-hidden="true" />
        Import Archive
      </button>
    </section>
  );
}
