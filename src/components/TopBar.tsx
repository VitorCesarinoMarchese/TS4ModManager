import { Gear, Moon, SunDim } from "@phosphor-icons/react";

type TopBarProps = {
  onSettings?: () => void;
  darkMode?: boolean;
  onToggleTheme?: () => void;
};

export function TopBar({ onSettings, darkMode, onToggleTheme }: TopBarProps) {
  return (
    <header
      className="topbar sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
      data-tauri-drag-region
    >
      <h1 className="text-xl font-semibold">Sims 4 Mod Manager</h1>
      <div className="controls flex items-center gap-4">
        <button
          type="button"
          aria-label="toggle-theme"
          onClick={onToggleTheme}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-blue-400 hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-blue-300 dark:hover:bg-slate-700"
        >
          {darkMode ? <SunDim size={18} weight="regular" aria-hidden="true" /> : <Moon size={18} weight="regular" aria-hidden="true" />}
          {darkMode ? "Light" : "Dark"}
        </button>
        <button
          type="button"
          aria-label="open-settings"
          onClick={onSettings}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-blue-400 hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-blue-300 dark:hover:bg-slate-700"
        >
          <Gear size={18} weight="regular" aria-hidden="true" />
          Settings
        </button>
      </div>
    </header>
  );
}
