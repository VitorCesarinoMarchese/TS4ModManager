import { FloppyDisk, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { Mod } from "../lib/types";

type ModDetailsPanelProps = {
  mod: Mod;
  onClose: () => void;
  onRename?: (modId: string, newName: string) => void;
};

export function ModDetailsPanel({ mod, onClose, onRename }: ModDetailsPanelProps) {
  const [name, setName] = useState(mod.name);
  const buttonClass =
    "inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-blue-400 hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-blue-300 dark:hover:bg-slate-700";

  useEffect(() => {
    setName(mod.name);
  }, [mod.id, mod.name]);

  return (
    <div
      className="modal-backdrop fixed inset-0 z-20 grid place-items-center bg-black/35 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal grid max-h-[90vh] w-[min(860px,100%)] gap-5 overflow-auto rounded-[14px] border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-label="mod-details"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header flex items-center justify-between gap-4">
          <h2 className="truncate text-xl font-semibold">{mod.name}</h2>
          <button type="button" aria-label="close-mod-details" className={buttonClass} onClick={onClose}>
            <X size={16} weight="regular" aria-hidden="true" />
            Close
          </button>
        </header>

        <label className="text-sm font-medium" htmlFor="edit-mod-name">
          Mod name
        </label>
        <div className="actions flex flex-wrap gap-2.5">
          <input
            id="edit-mod-name"
            aria-label="edit-mod-name"
            className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-600 dark:bg-slate-800"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            aria-label="save-mod-name"
            className={buttonClass}
            onClick={() => {
              const next = name.trim();
              if (!next) return;
              onRename?.(mod.id, next);
            }}
          >
            <FloppyDisk size={16} weight="regular" aria-hidden="true" />
            Save Name
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300">{mod.files.length} files</p>
        <ul className="m-0 grid list-none gap-2 p-0">
          {mod.files.map((file) => (
            <li
              key={file}
              className="truncate rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
              title={file}
            >
              {file}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
