import { ArrowsClockwise, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import "./App.css";
import { HomePage } from "./components/HomePage";
import { ImportPanel } from "./components/ImportPanel";
import { IssuesPanel } from "./components/IssuesPanel";
import { ModDetailsPanel } from "./components/ModDetailsPanel";
import { SearchBar } from "./components/SearchBar";
import { SettingsPage } from "./components/SettingsPage";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { createBackendApi } from "./lib/backendApi";
import { invokeTauri } from "./lib/tauriInvoke";
import { createAppStore, type AppState } from "./store/appStore";

const defaultStore = createAppStore(createBackendApi(invokeTauri));

type AppProps = {
  store?: StoreApi<AppState>;
};

export function App({ store = defaultStore }: AppProps) {
  const instances = useStore(store, (s) => s.instances);
  const selectedInstanceId = useStore(store, (s) => s.selectedInstanceId);
  const mods = useStore(store, (s) => s.mods);
  const issues = useStore(store, (s) => s.issues);
  const loadInstances = useStore(store, (s) => s.loadInstances);
  const selectInstanceAndScan = useStore(store, (s) => s.selectInstanceAndScan);
  const rescanSelected = useStore(store, (s) => s.rescanSelected);
  const toggleMod = useStore(store, (s) => s.toggleMod);
  const addCustomInstance = useStore(store, (s) => s.addCustomInstance);
  const importArchive = useStore(store, (s) => s.importArchive);

  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedMod, setSelectedMod] = useState<AppState["mods"][number] | null>(null);
  const [modNameById, setModNameById] = useState<Record<string, string>>({});
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

  const displayMods = mods.map((mod) => ({
    ...mod,
    name: modNameById[mod.id] ?? mod.name
  }));

  const effectiveSelectedMod = selectedMod
    ? {
        ...selectedMod,
        name: modNameById[selectedMod.id] ?? selectedMod.name
      }
    : null;

  const onToggle = async (mod: AppState["mods"][number]) => {
    if (!selectedInstanceId) return;
    const dryRun = await toggleMod(mod, !mod.enabled, selectedInstanceId);
    setToggleDisabledById((prev) => ({ ...prev, [mod.id]: !dryRun.canApply }));
  };

  return (
    <div className={`app-shell flex min-h-screen flex-col bg-slate-50 font-sans text-slate-950 dark:bg-[#15171c] dark:text-slate-100 ${darkMode ? "dark" : ""}`}>
      <TopBar
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode((v) => !v)}
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
            <h2 className="text-xl font-semibold">Mods ({displayMods.length})</h2>
            <div className="controls flex gap-4">
              <SearchBar value={search} onChange={setSearch} />
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-blue-400 hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-blue-300 dark:hover:bg-slate-700"
                onClick={() => void rescanSelected()}
              >
                <ArrowsClockwise size={16} weight="regular" aria-hidden="true" />
                Rescan
              </button>
            </div>
          </header>

          <HomePage
            mods={displayMods}
            search={search}
            onToggle={onToggle}
            onDetails={(mod) => setSelectedMod(mod)}
            toggleDisabledById={toggleDisabledById}
          />

          <IssuesPanel issues={issues} />
        </main>
      </div>

      {settingsOpen ? (
        <div
          className="modal-backdrop fixed inset-0 z-20 grid place-items-center bg-black/35 p-4"
          role="presentation"
          onClick={() => setSettingsOpen(false)}
        >
          <section
            className="modal grid max-h-[90vh] w-[min(860px,100%)] gap-5 overflow-auto rounded-[14px] border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"
            role="dialog"
            aria-label="settings-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-header flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">Settings</h2>
              <button
                type="button"
                aria-label="close-settings"
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-blue-400 hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-blue-300 dark:hover:bg-slate-700"
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
              onAddCustomPath={(path) => addCustomInstance(path)}
            />

            <ImportPanel onImport={(archivePath, name, slug) => importArchive(archivePath, name, slug)} />
          </section>
        </div>
      ) : null}

      {effectiveSelectedMod ? (
        <ModDetailsPanel
          mod={effectiveSelectedMod}
          onClose={() => setSelectedMod(null)}
          onRename={(modId, newName) => {
            setModNameById((prev) => ({ ...prev, [modId]: newName }));
            setSelectedMod((prev) => (prev && prev.id === modId ? { ...prev, name: newName } : prev));
          }}
        />
      ) : null}
    </div>
  );
}
