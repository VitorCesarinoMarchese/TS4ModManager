import { ArrowsClockwise, CaretDown, ClipboardText, FolderPlus, Plus } from "@phosphor-icons/react";
import { useState } from "react";
import { DARK_THEME, DEFAULT_THEME, parseThemeJson, serializeTheme, type AppTheme } from "../lib/theme";
import type { GameInstance } from "../lib/types";

type SettingsPageProps = {
  instances: GameInstance[];
  selectedInstanceId: string | null;
  onSelectInstance: (id: string) => void;
  onRescan: () => void;
  rescanDisabled?: boolean;
  onAddCustomPath: (path: string) => void | Promise<void>;
  activeThemeName?: string;
  activeTheme?: AppTheme;
  customThemes?: AppTheme[];
  onSelectTheme?: (themeName: string) => void;
  onCreateTheme?: () => void;
  onThemeChange?: (theme: AppTheme) => void;
  onThemeImport?: (theme: AppTheme) => void;
  onThemeExport?: (theme: AppTheme) => void | Promise<void>;
  onThemeReset?: () => void;
};

const colorFields: Array<[keyof AppTheme["colors"], string]> = [
  ["accent", "Accent color"],
  ["background", "Background color"],
  ["surface", "Surface color"],
  ["text", "Text color"],
  ["mutedText", "Muted text color"],
  ["border", "Border color"]
];

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
  activeThemeName = "Light",
  activeTheme = DEFAULT_THEME,
  customThemes = [],
  onSelectTheme,
  onCreateTheme,
  onThemeChange,
  onThemeImport,
  onThemeExport,
  onThemeReset
}: SettingsPageProps) {
  const [customPath, setCustomPath] = useState("");
  const [importJson, setImportJson] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const inputClass = "h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-950 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
  const buttonClass =
    "inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-accent hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-accent dark:hover:bg-accent/10";
  const canEditTheme = customThemes.some((theme) => theme.name === activeThemeName);

  const updateColor = (key: keyof AppTheme["colors"], value: string) => {
    onThemeChange?.({ ...activeTheme, colors: { ...activeTheme.colors, [key]: value } });
  };

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

        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-medium" htmlFor="theme-select">
            Active theme
            <select
              id="theme-select"
              className={`${inputClass} min-w-48`}
              value={activeThemeName}
              onChange={(e) => onSelectTheme?.(e.target.value)}
            >
              <option value="Light">Light</option>
              <option value="Dark">Dark</option>
              <option value="System">System</option>
              {customThemes.map((theme) => (
                <option key={theme.name} value={theme.name}>{theme.name}</option>
              ))}
            </select>
          </label>
          <button type="button" className={buttonClass} onClick={onCreateTheme}>
            <Plus size={16} weight="regular" aria-hidden="true" />
            Create Custom Theme
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={async () => {
              await onThemeExport?.(activeTheme);
              setCopyStatus("Copied theme JSON");
            }}
          >
            <ClipboardText size={16} weight="regular" aria-hidden="true" />
            Export Theme
          </button>
        </div>
        {copyStatus ? <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{copyStatus}</p> : null}
        {!canEditTheme ? <p className="text-sm text-slate-600 dark:text-slate-300">Create or select a custom theme to edit colors.</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {colorFields.map(([key, label]) => (
            <label key={key} className="grid gap-1 text-sm font-medium" htmlFor={`theme-${key}`}>
              {label}
              <input
                id={`theme-${key}`}
                type="color"
                disabled={!canEditTheme}
                className="h-10 w-20 cursor-pointer rounded-md border border-slate-300 bg-white p-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800"
                value={activeTheme.colors[key]}
                onChange={(e) => updateColor(key, e.target.value)}
              />
            </label>
          ))}
        </div>

        <label className="grid gap-1 text-sm font-medium" htmlFor="theme-import">
          Theme JSON import
          <textarea
            id="theme-import"
            className={`${inputClass} min-h-28 font-mono text-xs`}
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder={serializeTheme(DARK_THEME)}
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
              onThemeImport?.(parsed);
            }}
          >
            Import Theme
          </button>
          <button type="button" className={buttonClass} onClick={onThemeReset}>
            Reset Themes
          </button>
        </div>
      </fieldset>
    </section>
  );
}
