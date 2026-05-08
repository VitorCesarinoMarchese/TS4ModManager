import { ArrowsClockwise, X } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import "./App.css";
import { HomePage } from "./components/HomePage";
import { ImportPanel } from "./components/ImportPanel";
import { IssuesPanel } from "./components/IssuesPanel";
import { ModDetailsPanel } from "./components/ModDetailsPanel";
import { ModScanOverlay } from "./components/ModScanOverlay";
import { SearchBar } from "./components/SearchBar";
import { SettingsPage } from "./components/SettingsPage";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { createBackendApi } from "./lib/backendApi";
import { openExternalUrl } from "./lib/openUrl";
import { invokeTauri } from "./lib/tauriInvoke";
import { createAppStore, type AppState } from "./store/appStore";

const defaultStore = createAppStore(createBackendApi(invokeTauri));
const THEME_STORAGE_KEY = "ts4mm-theme";

function getInitialDarkMode() {
  if (typeof window === "undefined") return false;

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "dark") return true;
  if (stored === "light") return false;

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

type AppProps = {
  store?: StoreApi<AppState>;
};

export function App({ store = defaultStore }: AppProps) {
  const instances = useStore(store, (s) => s.instances);
  const selectedInstanceId = useStore(store, (s) => s.selectedInstanceId);
  const mods = useStore(store, (s) => s.mods);
  const issues = useStore(store, (s) => s.issues);
  const scanStatus = useStore(store, (s) => s.scanStatus);
  const loadInstances = useStore(store, (s) => s.loadInstances);
  const selectInstanceAndScan = useStore(store, (s) => s.selectInstanceAndScan);
  const rescanSelected = useStore(store, (s) => s.rescanSelected);
  const toggleMod = useStore(store, (s) => s.toggleMod);
  const addCustomInstance = useStore(store, (s) => s.addCustomInstance);
  const importArchive = useStore(store, (s) => s.importArchive);
  const renameModDisplayName = useStore(store, (s) => s.renameModDisplayName);
  const attachSourceUrl = useStore(store, (s) => s.attachSourceUrl);
  const removeSourceUrl = useStore(store, (s) => s.removeSourceUrl);

  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);
  const [selectedMod, setSelectedMod] = useState<AppState["mods"][number] | null>(null);
  const [dismissedIssueId, setDismissedIssueId] = useState<string | null>(null);
  const [toggleDisabledById, setToggleDisabledById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void loadInstances();
  }, [loadInstances]);

  useEffect(() => {
    if (selectedInstanceId) return;
    const first = instances[0]?.id;
    if (first) void selectInstanceAndScan(first);
  }, [instances, selectedInstanceId, selectInstanceAndScan]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, [darkMode]);

  const effectiveSelectedMod = selectedMod
    ? (mods.find((mod) => mod.id === selectedMod.id) ?? selectedMod)
    : null;

  const isScanning = scanStatus === "scanning";
  const popupIssue = [...issues]
    .reverse()
    .find((issue) => issue.severity === "error" && issue.id !== dismissedIssueId);

  const onToggle = async (mod: AppState["mods"][number]) => {
    if (!selectedInstanceId) return;
    const dryRun = await toggleMod(mod, !mod.enabled, selectedInstanceId);
    setToggleDisabledById((prev) => ({ ...prev, [mod.id]: !dryRun.canApply }));
  };

  const dangerButtonClass =
    "inline-flex items-center gap-2 rounded-md border border-red-500 bg-white px-3 py-1.5 text-sm text-red-600 hover:border-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/40 dark:border-red-500 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-red-950/30";

  const onToggleTheme = () => {
    setDarkMode((current) => {
      const next = !current;
      window.localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
      return next;
    });
  };

  return (
    <div className={`app-shell flex min-h-screen flex-col bg-slate-50 font-sans text-slate-950 dark:bg-[#15171c] dark:text-slate-100 ${darkMode ? "dark" : ""}`}>
      <TopBar
        darkMode={darkMode}
        onToggleTheme={onToggleTheme}
        onSettings={() => setSettingsOpen(true)}
      />

      <div className="layout grid grid-cols-[280px_1fr] gap-6 p-6">
        <Sidebar
          instances={instances}
          selectedInstanceId={selectedInstanceId}
          onSelectInstance={(id) => void selectInstanceAndScan(id)}
        />

        <main className="main-content grid gap-6 rounded-2xl border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <header className="main-header flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Mods ({mods.length})</h2>
            <div className="controls flex gap-4">
              <SearchBar value={search} onChange={setSearch} />
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-accent hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent/40 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-accent dark:hover:bg-accent/10"
                disabled={isScanning}
                onClick={() => void rescanSelected()}
              >
                <ArrowsClockwise
                  data-testid="rescan-icon"
                  className={isScanning ? "animate-spin" : ""}
                  size={16}
                  weight="regular"
                  aria-hidden="true"
                />
                Rescan
              </button>
            </div>
          </header>

          <div className="relative min-h-[220px]">
            <HomePage
              mods={mods}
              search={search}
              onToggle={onToggle}
              onDetails={(mod) => setSelectedMod(mod)}
              toggleDisabledById={toggleDisabledById}
            />
            {isScanning ? <ModScanOverlay /> : null}
          </div>

          <IssuesPanel issues={issues} />
        </main>
      </div>

      {settingsOpen ? (
        <motion.div
          className="modal-backdrop fixed inset-0 z-20 grid place-items-center bg-black/35 p-4"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16 }}
          onClick={() => setSettingsOpen(false)}
        >
          <motion.section
            className="modal grid w-[min(860px,calc(100vw-2rem))] gap-5 overflow-visible rounded-[14px] border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"
            role="dialog"
            aria-label="settings-modal"
            data-animated="true"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-header flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">Settings</h2>
              <button
                type="button"
                aria-label="close-settings"
                className={dangerButtonClass}
                onClick={() => setSettingsOpen(false)}
              >
                <X size={16} weight="regular" aria-hidden="true" />
                Close
              </button>
            </header>

            <SettingsPage
              instances={instances}
              selectedInstanceId={selectedInstanceId}
              onSelectInstance={(id) => void selectInstanceAndScan(id)}
              onRescan={() => {
                void rescanSelected();
              }}
              rescanDisabled={isScanning}
              onAddCustomPath={(path) => addCustomInstance(path)}
            />

            <ImportPanel onImport={(archivePath, name, slug) => importArchive(archivePath, name, slug)} />
          </motion.section>
        </motion.div>
      ) : null}

      {popupIssue ? (
        <motion.div
          className="modal-backdrop fixed inset-0 z-30 grid place-items-center bg-black/35 p-4"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16 }}
        >
          <motion.section
            role="alertdialog"
            aria-label="error-warning"
            aria-live="assertive"
            className="grid w-[min(560px,calc(100vw-2rem))] gap-4 rounded-[14px] border border-red-500 bg-white p-6 text-slate-950 shadow-xl dark:bg-slate-900 dark:text-slate-100"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <header className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">Error</h2>
              <button
                type="button"
                aria-label="dismiss-error-warning"
                className={dangerButtonClass}
                onClick={() => setDismissedIssueId(popupIssue.id)}
              >
                <X size={16} weight="regular" aria-hidden="true" />
                Close
              </button>
            </header>
            <p>{popupIssue.message}</p>
            {popupIssue.code ? <p className="text-sm text-slate-600 dark:text-slate-300">{popupIssue.code}</p> : null}
          </motion.section>
        </motion.div>
      ) : null}

      {effectiveSelectedMod ? (
        <ModDetailsPanel
          mod={effectiveSelectedMod}
          onClose={() => setSelectedMod(null)}
          onRename={async (modId, newName) => {
            const renamed = await renameModDisplayName(modId, newName);
            if (renamed) setSelectedMod(renamed);
          }}
          onAttachSourceUrl={async (modId, sourceUrl, providerId) => {
            const updated = await attachSourceUrl(modId, sourceUrl, providerId);
            if (updated) setSelectedMod(updated);
          }}
          onRemoveSourceUrl={async (modId) => {
            const updated = await removeSourceUrl(modId);
            if (updated) setSelectedMod(updated);
          }}
          onOpenSourceUrl={(sourceUrl) => void openExternalUrl(sourceUrl)}
        />
      ) : null}
    </div>
  );
}
