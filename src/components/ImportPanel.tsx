import { Archive, UploadSimple } from "@phosphor-icons/react";
import { useState } from "react";

type ImportPanelProps = {
  onImport: (archivePath: string, name: string, slug?: string) => void | Promise<void>;
};

export function ImportPanel({ onImport }: ImportPanelProps) {
  const [archivePath, setArchivePath] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const inputClass = "rounded-md border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-600 dark:bg-slate-800";

  return (
    <section aria-label="import-panel" className="import-panel grid gap-4">
      <h2 className="text-xl font-semibold">Import</h2>

      <div className="form-grid grid grid-cols-[minmax(120px,auto)_minmax(220px,1fr)_minmax(100px,auto)_minmax(220px,1fr)_minmax(120px,auto)_minmax(180px,1fr)] items-center gap-3">
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
        className="dropzone flex min-h-12 items-center gap-2 rounded-[10px] border border-dashed border-slate-500 p-3.5 text-slate-600 dark:border-slate-600 dark:text-slate-300"
        aria-label="Drop archive here"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0] as File & { path?: string };
          const path = file?.path || file?.name;
          if (path) setArchivePath(path);
        }}
      >
        <Archive size={18} weight="regular" aria-hidden="true" />
        Drop archive here
      </div>

      <button
        type="button"
        className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-blue-400 hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-blue-300 dark:hover:bg-slate-700"
        onClick={() => {
          const p = archivePath.trim();
          const n = name.trim();
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
