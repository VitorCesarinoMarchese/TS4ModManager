import { ArrowsClockwise, CaretDown, FolderPlus } from "@phosphor-icons/react";
import { useState } from "react";
import type { GameInstance } from "../lib/types";

type SettingsPageProps = {
  instances: GameInstance[];
  selectedInstanceId: string | null;
  onSelectInstance: (id: string) => void;
  onRescan: () => void;
  onAddCustomPath: (path: string) => void | Promise<void>;
};

function friendlyName(instance: GameInstance, index: number) {
  const base =
    instance.source === "native"
      ? "Native Instance"
      : instance.source === "steam"
        ? "Steam Instance"
        : "Custom Instance";
  return `${base} ${index + 1}`;
}

export function SettingsPage({
  instances,
  selectedInstanceId,
  onSelectInstance,
  onRescan,
  onAddCustomPath
}: SettingsPageProps) {
  const [customPath, setCustomPath] = useState("");
  const inputClass = "h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-950 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
  const buttonClass =
    "inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-blue-400 hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-blue-300 dark:hover:bg-slate-700";

  return (
    <section aria-label="settings-page" className="settings-page grid gap-4">
      <h2 className="text-xl font-semibold">Detected Game Paths</h2>

      <div className="form-row flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium" htmlFor="instance-select">
          Active instance
        </label>
        <div className="relative">
          <select
            id="instance-select"
            className={`${inputClass} appearance-none pr-9`}
            value={selectedInstanceId ?? ""}
            onChange={(e) => onSelectInstance(e.target.value)}
          >
            {instances.map((instance, index) => (
              <option key={instance.id} value={instance.id} title={instance.path}>
                {friendlyName(instance, index)}
              </option>
            ))}
          </select>
          <CaretDown
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300"
            size={14}
            weight="regular"
            aria-hidden="true"
          />
        </div>
        <button type="button" className={buttonClass} onClick={onRescan}>
          <ArrowsClockwise size={16} weight="regular" aria-hidden="true" />
          Rescan Mods
        </button>
      </div>

      <div className="form-row flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium" htmlFor="custom-path">
          Custom Sims 4 path
        </label>
        <input
          id="custom-path"
          className={inputClass}
          value={customPath}
          onChange={(e) => setCustomPath(e.target.value)}
          placeholder="/path/to/The Sims 4"
        />
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            const trimmed = customPath.trim();
            if (!trimmed) return;
            void onAddCustomPath(trimmed);
            setCustomPath("");
          }}
        >
          <FolderPlus size={16} weight="regular" aria-hidden="true" />
          Add Custom Path
        </button>
      </div>
    </section>
  );
}
