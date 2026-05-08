import { ArrowsClockwise, CaretDown, FolderPlus } from "@phosphor-icons/react";
import { useState } from "react";
import { DEFAULT_THEME, parseThemeJson, serializeTheme, type AppTheme } from "../lib/theme";
import type { GameInstance } from "../lib/types";

type SettingsPageProps = {
  instances: GameInstance[];
  selectedInstanceId: string | null;
  onSelectInstance: (id: string) => void;
  onRescan: () => void;
  rescanDisabled?: boolean;
  onAddCustomPath: (path: string) => void | Promise<void>;
  theme?: AppTheme;
  onThemeChange?: (theme: AppTheme) => void;
  onThemeReset?: () => void;
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
  rescanDisabled = false,
  onAddCustomPath,
  theme = DEFAULT_THEME,
  onThemeChange,
  onThemeReset
}: SettingsPageProps) {
  const [customPath, setCustomPath] = useState("");
  const [importJson, setImportJson] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const inputClass = "h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-950 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
  const buttonClass =
    "inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-accent hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-accent dark:hover:bg-accent/10";

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
        <button type="button" className={buttonClass} disabled={rescanDisabled} onClick={onRescan}>
          <ArrowsClockwise
            className={rescanDisabled ? "animate-spin" : ""}
            size={16}
            weight="regular"
            aria-hidden="true"
          />
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

      <fieldset aria-label="theme-editor" className="grid gap-3 rounded-lg border border-slate-300 p-4 dark:border-slate-700">
        <legend className="px-1 text-lg font-semibold">Theme Editor</legend>
        <label className="grid max-w-xs gap-1 text-sm font-medium" htmlFor="theme-accent">
          Accent color
          <input
            id="theme-accent"
            type="color"
            className="h-10 w-20 cursor-pointer rounded-md border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-800"
            value={theme.colors.accent}
            onChange={(e) => onThemeChange?.({ ...theme, colors: { ...theme.colors, accent: e.target.value } })}
          />
        </label>

        <label className="grid gap-1 text-sm font-medium" htmlFor="theme-export">
          Theme JSON export
          <textarea id="theme-export" className={`${inputClass} min-h-36 font-mono text-xs`} readOnly value={serializeTheme(theme)} />
        </label>

        <label className="grid gap-1 text-sm font-medium" htmlFor="theme-import">
          Theme JSON import
          <textarea
            id="theme-import"
            className={`${inputClass} min-h-28 font-mono text-xs`}
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
          />
        </label>
        {importError ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{importError}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              const parsed = parseThemeJson(importJson);
              if (!parsed) {
                setImportError("Invalid theme JSON");
                return;
              }
              setImportError(null);
              onThemeChange?.(parsed);
            }}
          >
            Import Theme
          </button>
          <button type="button" className={buttonClass} onClick={onThemeReset}>
            Reset Theme
          </button>
        </div>
      </fieldset>
    </section>
  );
}
