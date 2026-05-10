import { ArrowsClockwise, ClipboardText, FolderOpen, FolderPlus, Plus, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { DARK_THEME, DEFAULT_THEME, parseThemeJson, serializeTheme, type AppTheme } from "../lib/theme";
import type { GameInstance } from "../lib/types";
import { ThemedSelect } from "./ThemedSelect";

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
  onOpenManagedModsFolder?: () => void | Promise<void>;
  onOpenTrashFolder?: () => void | Promise<void>;
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
  onThemeReset,
  onOpenManagedModsFolder,
  onOpenTrashFolder
}: SettingsPageProps) {
  const [customPath, setCustomPath] = useState("");
  const [importJson, setImportJson] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const inputClass = "theme-control h-9 rounded-md border !border-[var(--color-border)] !bg-[var(--color-surface)] px-3 py-1.5 !text-[var(--color-text)]";
  const buttonClass =
    "inline-flex items-center gap-2 rounded-md border !border-[var(--color-border)] bg-white px-3 py-1.5 text-sm hover:border-accent hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:hover:border-accent dark:hover:bg-accent/10";
  const canEditTheme = customThemes.some((theme) => theme.name === activeThemeName);

  const updateColor = (key: keyof AppTheme["colors"], value: string) => {
    onThemeChange?.({ ...activeTheme, colors: { ...activeTheme.colors, [key]: value } });
  };

  return (
    <section aria-label="settings-page" className="settings-page grid gap-4">
      <h2 className="text-xl font-semibold">Detected Game Paths</h2>

      <div className="form-row flex flex-wrap items-end gap-3">
        <ThemedSelect
          label="Active instance"
          value={selectedInstanceId ?? ""}
          options={instances.map((instance, index) => ({
            value: instance.id,
            label: friendlyName(instance, index),
            title: instance.path
          }))}
          onChange={onSelectInstance}
        />
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

      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={() => void onOpenManagedModsFolder?.()}>
          <FolderOpen size={16} weight="regular" aria-hidden="true" />
          Open Mod Folder
        </button>
        <button type="button" className={buttonClass} onClick={() => void onOpenTrashFolder?.()}>
          <Trash size={16} weight="regular" aria-hidden="true" />
          Open Trash Folder
        </button>
      </div>

      <fieldset aria-label="theme-editor" className="grid gap-3 rounded-lg border !border-[var(--color-border)] p-4">
        <legend className="px-1 text-lg font-semibold">Theme Editor</legend>

        <div className="flex flex-wrap items-end gap-3">
          <ThemedSelect
            label="Active theme"
            value={activeThemeName}
            options={[
              { value: "Light", label: "Light" },
              { value: "Dark", label: "Dark" },
              { value: "System", label: "System" },
              ...customThemes.map((theme) => ({ value: theme.name, label: theme.name }))
            ]}
            onChange={(value) => onSelectTheme?.(value)}
          />
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

        {canEditTheme ? (
          <label className="grid max-w-xs gap-1 text-sm font-medium" htmlFor="theme-name">
            Theme name
            <input
              id="theme-name"
              className={inputClass}
              value={activeTheme.name}
              onChange={(e) => onThemeChange?.({ ...activeTheme, name: e.target.value })}
            />
          </label>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {colorFields.map(([key, label]) => (
            <label key={key} className="grid gap-1 text-sm font-medium" htmlFor={`theme-${key}`}>
              {label}
              <input
                id={`theme-${key}`}
                type="color"
                disabled={!canEditTheme}
                className="h-10 w-20 cursor-pointer rounded-md border !border-[var(--color-border)] bg-white p-1 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800"
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
            Reset Current Theme
          </button>
        </div>
      </fieldset>
    </section>
  );
}
