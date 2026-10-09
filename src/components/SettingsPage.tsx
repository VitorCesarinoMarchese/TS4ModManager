import { ArrowsClockwise, ClipboardText, FolderOpen, FolderPlus, Plus } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { DARK_THEME, DEFAULT_THEME, parseThemeJson, serializeTheme, type AppTheme } from "../lib/theme";
import { parseSettingsTransfer, type SettingsTransfer, type TransferTheme } from "../lib/settingsTransfer";
import type { GameInstance, TrashEntry } from "../lib/types";
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
  trashEntries?: TrashEntry[];
  onExportSettings?: (includeApiKey: boolean, fallback?: TransferTheme) => void | Promise<void>;
  onImportSettings?: (settings: SettingsTransfer) => Promise<boolean>;
  onSelectTheme?: (themeName: string) => void;
  onCreateTheme?: () => void;
  onThemeChange?: (theme: AppTheme) => void;
  onThemeImport?: (theme: AppTheme) => void;
  onThemeExport?: (theme: AppTheme) => void | Promise<void>;
  onThemeReset?: () => void;
  onOpenManagedModsFolder?: () => void | Promise<void>;
  onOpenManagerFolder?: () => void | Promise<void>;
  onManageAllMods?: () => void | Promise<void>;
  onCopyDiagnostics?: () => void | Promise<void>;
  curseForgeApiKey?: string;
  onCurseForgeApiKeyChange?: (apiKey: string) => void;
  manageAllDisabled?: boolean;
  manageAllLoading?: boolean;
  onRefreshTrash?: () => void | Promise<void>;
  onRestoreTrash?: (trashName: string) => void | Promise<void>;
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
  trashEntries = [],
  onSelectTheme,
  onCreateTheme,
  onThemeChange,
  onThemeImport,
  onThemeExport,
  onThemeReset,
  onOpenManagedModsFolder,
  onOpenManagerFolder,
  onManageAllMods,
  onCopyDiagnostics,
  curseForgeApiKey = "",
  onCurseForgeApiKeyChange,
  manageAllDisabled = false,
  manageAllLoading = false,
  onRefreshTrash,
  onRestoreTrash,
  onExportSettings,
  onImportSettings
}: SettingsPageProps) {
  const fileReadGeneration = useRef(0);
  useEffect(() => () => { ++fileReadGeneration.current; }, []);
  const [includeApiKey, setIncludeApiKey] = useState(false);
  const [fallback, setFallback] = useState<TransferTheme | undefined>(undefined);
  const [settingsReview, setSettingsReview] = useState<SettingsTransfer | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsPending, setSettingsPending] = useState(false);
  const [customPath, setCustomPath] = useState("");
  const [importJson, setImportJson] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const inputClass = "theme-control h-9 rounded-md border !border-[var(--color-border)] !bg-[var(--color-surface)] px-3 py-1.5 !text-[var(--color-text)]";
  const buttonClass =
    "inline-flex items-center gap-2 rounded-md border !border-[var(--color-border)] bg-white px-3 py-1.5 text-sm hover:border-accent hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:hover:border-accent dark:hover:bg-accent/10";
  const canEditTheme = customThemes.some((theme) => theme.name === activeThemeName);
  const normalizedCustomPath = customPath.trim().replace(/\/+$/, "");
  const customPathLooksLikeModsFolder = /(^|\/)Mods$/i.test(normalizedCustomPath);
  const suggestedCustomPath = customPathLooksLikeModsFolder ? normalizedCustomPath.replace(/\/Mods$/i, "") : null;

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
            const trimmed = (suggestedCustomPath ?? customPath.trim()).trim();
            if (!trimmed) return;
            void onAddCustomPath(trimmed);
            setCustomPath("");
          }}
        >
          <FolderPlus size={16} weight="regular" aria-hidden="true" />
          Add Custom Path
        </button>
        <p className="basis-full text-sm text-slate-600 dark:text-slate-300">
          Select the <strong>The Sims 4</strong> folder that contains <code>Mods/</code>, not the <code>Mods</code> folder itself.
        </p>
        {suggestedCustomPath ? (
          <p role="status" className="basis-full text-sm text-amber-700 dark:text-amber-300">
            Looks like you selected <code>Mods</code>. The app will add <code>{suggestedCustomPath}</code> instead.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={() => void onOpenManagedModsFolder?.()}>
          <FolderOpen size={16} weight="regular" aria-hidden="true" />
          Open Mod Folder
        </button>
        <button type="button" className={buttonClass} onClick={() => void onOpenManagerFolder?.()}>
          <FolderOpen size={16} weight="regular" aria-hidden="true" />
          Open Manager Folder
        </button>
        <button type="button" className={buttonClass} disabled={manageAllDisabled || manageAllLoading} onClick={() => void onManageAllMods?.()}>
          <ArrowsClockwise className={manageAllLoading ? "animate-spin" : ""} size={16} weight="regular" aria-hidden="true" />
          {manageAllLoading ? "Managing Mods..." : "Manage All Mods"}
        </button>
        <button type="button" className={buttonClass} onClick={() => void onCopyDiagnostics?.()}>
          <ClipboardText size={16} weight="regular" aria-hidden="true" />
          Copy Diagnostics
        </button>
      </div>

      <fieldset aria-label="curseforge-settings" className="grid gap-3 rounded-lg border !border-[var(--color-border)] p-4">
        <legend className="px-1 text-lg font-semibold">CurseForge</legend>
        <label className="text-sm font-medium" htmlFor="curseforge-api-key">
          API key
        </label>
        <input
          id="curseforge-api-key"
          aria-label="CurseForge API key"
          type="password"
          className={inputClass}
          value={curseForgeApiKey}
          onChange={(e) => onCurseForgeApiKeyChange?.(e.target.value)}
          placeholder="Paste CurseForge API key"
        />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Used only for source lookup. The key is stored in app settings, not in per-mod metadata.
        </p>
      </fieldset>

      <fieldset aria-label="trash-manager" className="grid gap-3 rounded-lg border !border-[var(--color-border)] p-4">
        <legend className="px-1 text-lg font-semibold">Trash</legend>
        <button type="button" className={buttonClass} onClick={() => void onRefreshTrash?.()}>
          <ArrowsClockwise size={16} weight="regular" aria-hidden="true" />
          Refresh Trash
        </button>
        {trashEntries.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">Trash is empty.</p> : null}
        <ul className="grid list-none gap-2 p-0">
          {trashEntries.map((entry) => (
            <li key={entry.name} className="flex flex-wrap items-center justify-between gap-2 rounded-md border !border-[var(--color-border)] px-3 py-2 text-sm">
              <span className="grid min-w-0 gap-1">
                <span className="truncate font-medium" title={entry.path}>{entry.name}</span>
                {entry.originalPath ? <span className="truncate text-xs text-slate-600 dark:text-slate-300" title={entry.originalPath}>Original: {entry.originalPath}</span> : null}
                {entry.deletionDate ? <span className="text-xs text-slate-600 dark:text-slate-300">Deleted: {entry.deletionDate}</span> : null}
              </span>
              <button type="button" className={buttonClass} onClick={() => void onRestoreTrash?.(entry.name)}>
                Restore
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

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
      <section aria-label="Local settings transfer" className="grid gap-3 border-t !border-[var(--color-border)] pt-4">
        <h2 className="text-xl font-semibold">Transfer local settings</h2>
        <p className="text-sm">Export a local JSON file for the browser or native app. Custom theme colors use the separate theme export above.</p>
        {canEditTheme ? (
          <ThemedSelect label="Built-in theme for settings export" value={fallback ?? ""} options={[
            { value: "", label: "Choose a built-in theme" }, { value: "light", label: "Light" },
            { value: "dark", label: "Dark" }, { value: "system", label: "System" }
          ]} onChange={(value) => { if (value === "light" || value === "dark" || value === "system") setFallback(value); else setFallback(undefined); }} />
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeApiKey} onChange={(event) => setIncludeApiKey(event.target.checked)} />
          Include CurseForge API key in the local settings file
        </label>
        {includeApiKey ? <p className="text-sm">This file will contain your key. Keep it private on this device.</p> : null}
        <button type="button" className={buttonClass} disabled={!onExportSettings || settingsPending || (canEditTheme && !fallback)} onClick={async () => {
          setSettingsError(null);
          try { await onExportSettings?.(includeApiKey, fallback); }
          catch { setSettingsError("Settings export failed. Try again."); }
        }}>Export settings file</button>
        <label className="grid gap-2 text-sm">Import settings file
          <input type="file" accept=".json,application/json" disabled={settingsPending || !onImportSettings} onChange={(event) => {
            const request = ++fileReadGeneration.current;
            const current = () => fileReadGeneration.current === request;
            const file = event.target.files?.[0];
            event.target.value = "";
            setSettingsReview(null);
            setSettingsError(null);
            if (!file) return;
            if (file.size > 1024 * 1024) { setSettingsError("Choose a settings file smaller than 1 MiB."); return; }
            const reader = new FileReader();
            reader.onload = () => {
              if (!current()) return;
              try {
                if (typeof reader.result !== "string") throw new Error("Could not read the settings file.");
                setSettingsReview(parseSettingsTransfer(reader.result));
              } catch (error) { setSettingsError(error instanceof Error ? error.message : "Invalid settings file."); }
            };
            reader.onerror = () => { if (current()) setSettingsError("Could not read the settings file. Try again."); };
            reader.readAsText(file);
          }} />
        </label>
        {settingsError ? <p role="alert">{settingsError}</p> : null}
        {settingsReview ? <section aria-label="Review settings import" className="grid gap-2">
          <h3 className="font-semibold">Review settings import</h3>
          <p>Theme: {settingsReview.theme}</p>
          <p>These game roots replace the current instance list:</p>
          {settingsReview.gameRoots.length ? <ul>{settingsReview.gameRoots.map((root) => <li key={root} className="break-all">{root}</li>)}</ul> : <p>No game roots.</p>}
          <p className="break-all">Selected root: {settingsReview.selectedRoot ?? "First available root"}</p>
          <p>{settingsReview.curseforgeApiKey === undefined ? "API key omitted. Your existing key stays saved." : "API key included. Confirmation replaces your locally saved key."}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass} disabled={settingsPending} onClick={async () => {
              if (!onImportSettings || settingsPending) return;
              setSettingsPending(true);
              try {
                if (await onImportSettings(settingsReview)) { setSettingsReview(null); setSettingsError(null); }
                else setSettingsError("Settings import failed. Check the game roots and try again.");
              } catch { setSettingsError("Settings import failed. Your review is saved for retry."); }
              finally { setSettingsPending(false); }
            }}>{settingsPending ? "Importing settings..." : "Confirm settings import"}</button>
            <button type="button" className={buttonClass} disabled={settingsPending} onClick={() => setSettingsReview(null)}>Cancel settings import</button>
          </div>
        </section> : null}
      </section>
    </section>
  );
}
