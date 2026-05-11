import { createStore } from "zustand/vanilla";
import type { DryRunResult, GameInstance, Issue, Mod, RestoreResult, RuntimeDiagnostics, TrashEntry } from "../lib/types";

export type ApplyResult = {
  applied: boolean;
  issues: Issue[];
};

export type MigrateResult = {
  managedModId: string;
  issues: Issue[];
};

export type ImportResult = { modId: string };

export type UninstallResult = {
  modId: string;
  trashedPath: string;
  issues: Issue[];
};

export type ManageAllProgress = {
  completed: number;
  total: number;
  currentModName: string | null;
};

export type BackendApi = {
  detectGameInstances: () => Promise<GameInstance[]>;
  scanMods: (instanceId: string) => Promise<Mod[]>;
  detectOrphanSymlinks: (instanceId: string) => Promise<{ path: string; target: string }[]>;
  validateCustomInstance: (path: string) => Promise<GameInstance>;
  importArchive: (archivePath: string, name: string, slug?: string) => Promise<ImportResult>;
  dryRunToggle: (
    modId: string,
    targetEnabled: boolean,
    instanceId: string
  ) => Promise<DryRunResult>;
  applyToggle: (
    modId: string,
    targetEnabled: boolean,
    instanceId: string
  ) => Promise<ApplyResult>;
  migrateExternalMod: (modId: string, instanceId: string) => Promise<MigrateResult>;
  renameModDisplayName: (modId: string, displayName: string) => Promise<Mod>;
  attachSourceUrl: (modId: string, sourceUrl: string, providerId?: string) => Promise<Mod>;
  removeSourceUrl: (modId: string) => Promise<Mod>;
  uninstallManagedMod: (modId: string, instanceId: string) => Promise<UninstallResult>;
  listTrashEntries: () => Promise<TrashEntry[]>;
  restoreTrashedMod: (trashName: string, instanceId: string) => Promise<RestoreResult>;
  runtimeDiagnostics: () => Promise<RuntimeDiagnostics>;
  openManagedModsFolder: () => Promise<void>;
  openManagerFolder: () => Promise<void>;
};

/* c8 ignore start */
const defaultApi: BackendApi = {
  detectGameInstances: async () => [],
  scanMods: async () => [],
  detectOrphanSymlinks: async () => [],
  validateCustomInstance: async (path) => ({ id: `custom:${path}`, path, source: "custom" }),
  importArchive: async () => ({ modId: "" }),
  dryRunToggle: async () => ({ canApply: true, operations: [], issues: [] }),
  applyToggle: async () => ({ applied: true, issues: [] }),
  migrateExternalMod: async (modId) => ({ managedModId: modId, issues: [] }),
  renameModDisplayName: async (modId, displayName) => ({
    id: modId,
    name: displayName,
    files: [],
    enabled: false,
    source: "managed"
  }),
  attachSourceUrl: async (modId, sourceUrl) => ({
    id: modId,
    name: modId,
    sourceUrl,
    files: [],
    enabled: false,
    source: "managed"
  }),
  removeSourceUrl: async (modId) => ({
    id: modId,
    name: modId,
    files: [],
    enabled: false,
    source: "managed"
  }),
  uninstallManagedMod: async (modId) => ({ modId, trashedPath: "", issues: [] }),
  listTrashEntries: async () => [],
  restoreTrashedMod: async () => ({ restoredPath: "" }),
  runtimeDiagnostics: async () => ({
    managedRoot: "",
    managedModsDir: "",
    trashFilesDir: "",
    waylandWorkaroundDisabled: false
  }),
  openManagedModsFolder: async () => {},
  openManagerFolder: async () => {}
};
/* c8 ignore stop */

export type AppState = {
  instances: GameInstance[];
  selectedInstanceId: string | null;
  mods: Mod[];
  issues: Issue[];
  trashEntries: TrashEntry[];
  lastSuccess: string | null;
  lastDryRun: DryRunResult | null;
  scanStatus: "idle" | "scanning";
  manageAllStatus: "idle" | "managing";
  manageAllProgress: ManageAllProgress | null;
  selectInstance: (id: string | null) => void;
  loadInstances: () => Promise<void>;
  selectInstanceAndScan: (id: string) => Promise<void>;
  rescanSelected: () => Promise<void>;
  addIssue: (issue: Issue) => void;
  addCustomInstance: (path: string) => Promise<void>;
  importArchive: (archivePath: string, name: string, slug?: string) => Promise<void>;
  renameModDisplayName: (modId: string, displayName: string) => Promise<Mod | null>;
  attachSourceUrl: (modId: string, sourceUrl: string, providerId?: string) => Promise<Mod | null>;
  removeSourceUrl: (modId: string) => Promise<Mod | null>;
  uninstallManagedMod: (modId: string) => Promise<UninstallResult | null>;
  loadTrashEntries: () => Promise<void>;
  restoreTrashedMod: (trashName: string) => Promise<RestoreResult | null>;
  manageExternalMod: (modId: string) => Promise<MigrateResult | null>;
  manageAllExternalMods: () => Promise<MigrateResult[]>;
  clearSuccess: () => void;
  openManagedModsFolder: () => Promise<void>;
  openManagerFolder: () => Promise<void>;
  getDiagnosticsReport: () => Promise<string | null>;
  toggleMod: (mod: Mod, targetEnabled: boolean, instanceId: string) => Promise<DryRunResult>;
};

const severityRank: Record<Issue["severity"], number> = {
  info: 1,
  warning: 2,
  error: 3
};

function mergeIssueList(existing: Issue[], incoming: Issue): Issue[] {
  const ix = existing.findIndex((it) => it.id === incoming.id);
  if (ix === -1) {
    return [...existing, incoming];
  }

  const current = existing[ix];
  const keepIncoming = severityRank[incoming.severity] >= severityRank[current.severity];
  if (!keepIncoming) {
    return existing;
  }

  const next = [...existing];
  next[ix] = incoming;
  return next;
}

function mergeIssues(existing: Issue[], incoming: Issue[]): Issue[] {
  return incoming.reduce(mergeIssueList, existing);
}

function toIssue(error: unknown, fallbackId: string, fallbackMsg: string): Issue {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    const maybeCode =
      "code" in error && typeof (error as { code: unknown }).code === "string"
        ? ((error as { code: string }).code as Issue["code"])
        : undefined;

    return {
      id: `${fallbackId}-${Date.now()}`,
      severity: "error",
      message: (error as { message: string }).message,
      code: maybeCode
    };
  }

  return {
    id: `${fallbackId}-${Date.now()}`,
    severity: "error",
    message: fallbackMsg
  };
}

export function createAppStore(apiOverrides: Partial<BackendApi> = {}) {
  const api: BackendApi = { ...defaultApi, ...apiOverrides };

  return createStore<AppState>((set, get) => ({
    instances: [],
    selectedInstanceId: null,
    mods: [],
    issues: [],
    trashEntries: [],
    lastSuccess: null,
    lastDryRun: null,
    scanStatus: "idle",
    manageAllStatus: "idle",
    manageAllProgress: null,
    selectInstance: (id) => set({ selectedInstanceId: id }),
    loadInstances: async () => {
      const instances = await api.detectGameInstances();
      set({ instances });
    },
    selectInstanceAndScan: async (id) => {
      set({ scanStatus: "scanning" });
      try {
        const mods = await api.scanMods(id);
        set({ selectedInstanceId: id, mods });
      } catch (error) {
        set((state) => ({
          issues: mergeIssueList(state.issues, toIssue(error, "scan", "Scan failed"))
        }));
      } finally {
        set({ scanStatus: "idle" });
      }
    },
    rescanSelected: async () => {
      const id = get().selectedInstanceId;
      if (!id) return;
      set({ scanStatus: "scanning" });
      try {
        const mods = await api.scanMods(id);
        set({ mods });

        const orphans = await api.detectOrphanSymlinks(id);
        if (orphans.length > 0) {
          const orphanIssues = orphans.map((orphan, i) => ({
            id: `orphan-${i}-${orphan.path}`,
            severity: "warning" as const,
            message: `Orphan symlink: ${orphan.path}`,
            code: "EXTERNAL_LINK" as const,
            context: { target: orphan.target }
          }));
          set((state) => ({ issues: mergeIssues(state.issues, orphanIssues) }));
        }
      } catch (error) {
        set((state) => ({
          issues: mergeIssueList(state.issues, toIssue(error, "scan", "Scan failed"))
        }));
      } finally {
        set({ scanStatus: "idle" });
      }
    },
    addIssue: (issue) => set((state) => ({ issues: mergeIssueList(state.issues, issue) })),
    clearSuccess: () => set({ lastSuccess: null }),
    addCustomInstance: async (path) => {
      try {
        const instance = await api.validateCustomInstance(path);
        set((state) => ({ instances: [...state.instances, instance] }));
        const mods = await api.scanMods(instance.id);
        set({ selectedInstanceId: instance.id, mods });
      } catch (error) {
        set((state) => ({
          issues: mergeIssueList(state.issues, toIssue(error, "custom-path", "Custom path invalid"))
        }));
      }
    },
    openManagedModsFolder: async () => {
      try {
        await api.openManagedModsFolder();
      } catch (error) {
        set((state) => ({
          issues: mergeIssueList(state.issues, toIssue(error, "open-mod-folder", "Open mod folder failed"))
        }));
      }
    },
    openManagerFolder: async () => {
      try {
        await api.openManagerFolder();
      } catch (error) {
        set((state) => ({
          issues: mergeIssueList(state.issues, toIssue(error, "open-manager-folder", "Open manager folder failed"))
        }));
      }
    },
    getDiagnosticsReport: async () => {
      try {
        const diagnostics = await api.runtimeDiagnostics();
        const state = get();
        return [
          "TS4 Mod Manager Diagnostics",
          `Selected instance: ${state.selectedInstanceId ?? "none"}`,
          `Instances: ${state.instances.length}`,
          `Mods: ${state.mods.length}`,
          `Issues: ${state.issues.length}`,
          `Managed root: ${diagnostics.managedRoot}`,
          `Managed mods dir: ${diagnostics.managedModsDir}`,
          `Trash files dir: ${diagnostics.trashFilesDir}`,
          `Wayland workaround: ${diagnostics.waylandWorkaround ?? "unset"}`,
          `Wayland workaround disabled: ${diagnostics.waylandWorkaroundDisabled}`,
          "Recent issues:",
          ...state.issues.slice(-5).map((issue) => `- [${issue.severity}] ${issue.code ?? "NO_CODE"}: ${issue.message}`)
        ].join("\n");
      } catch (error) {
        set((state) => ({
          issues: mergeIssueList(state.issues, toIssue(error, "diagnostics", "Diagnostics failed"))
        }));
        return null;
      }
    },
    uninstallManagedMod: async (modId) => {
      const instanceId = get().selectedInstanceId;
      if (!instanceId) return null;
      try {
        const result = await api.uninstallManagedMod(modId, instanceId);
        set((state) => ({
          mods: state.mods.filter((mod) => mod.id !== modId),
          lastSuccess: `Moved ${modId} to trash`,
          issues: result.issues.length > 0 ? mergeIssues(state.issues, result.issues) : state.issues
        }));
        return result;
      } catch (error) {
        set((state) => ({
          issues: mergeIssueList(state.issues, toIssue(error, "uninstall", "Uninstall failed"))
        }));
        return null;
      }
    },
    loadTrashEntries: async () => {
      try {
        const trashEntries = await api.listTrashEntries();
        set({ trashEntries });
      } catch (error) {
        set((state) => ({
          issues: mergeIssueList(state.issues, toIssue(error, "trash-list", "Trash list failed"))
        }));
      }
    },
    manageExternalMod: async (modId) => {
      const instanceId = get().selectedInstanceId;
      if (!instanceId) return null;
      try {
        const result = await api.migrateExternalMod(modId, instanceId);
        const mods = await api.scanMods(instanceId);
        set((state) => ({
          mods,
          lastSuccess: `Managing ${modId}`,
          issues: result.issues.length > 0 ? mergeIssues(state.issues, result.issues) : state.issues
        }));
        return result;
      } catch (error) {
        set((state) => ({
          issues: mergeIssueList(state.issues, toIssue(error, "manage-mod", "Manage mod failed"))
        }));
        return null;
      }
    },
    manageAllExternalMods: async () => {
      const instanceId = get().selectedInstanceId;
      if (!instanceId) return [];
      const externalMods = get().mods.filter((mod) => mod.source === "external");
      if (externalMods.length === 0) return [];

      set({ manageAllStatus: "managing", manageAllProgress: { completed: 0, total: externalMods.length, currentModName: externalMods[0]?.name ?? null } });
      const results: MigrateResult[] = [];
      try {
        for (const [index, mod] of externalMods.entries()) {
          set({ manageAllProgress: { completed: index, total: externalMods.length, currentModName: mod.name } });
          const result = await api.migrateExternalMod(mod.id, instanceId);
          results.push(result);
          set({ manageAllProgress: { completed: index + 1, total: externalMods.length, currentModName: externalMods[index + 1]?.name ?? null } });
          if (result.issues.length > 0) {
            set((state) => ({ issues: mergeIssues(state.issues, result.issues) }));
          }
        }
        const mods = await api.scanMods(instanceId);
        set({ mods, lastSuccess: `Managing ${results.length} mod${results.length === 1 ? "" : "s"}` });
        return results;
      } catch (error) {
        set((state) => ({
          issues: mergeIssueList(state.issues, toIssue(error, "manage-all-mods", "Manage all mods failed"))
        }));
        return results;
      } finally {
        set({ manageAllStatus: "idle", manageAllProgress: null });
      }
    },
    restoreTrashedMod: async (trashName) => {
      const instanceId = get().selectedInstanceId;
      if (!instanceId) return null;
      try {
        const result = await api.restoreTrashedMod(trashName, instanceId);
        const trashEntries = await api.listTrashEntries();
        set({ trashEntries, lastSuccess: `Restored ${trashName}` });
        const mods = await api.scanMods(instanceId);
        set({ mods });
        return result;
      } catch (error) {
        set((state) => ({
          issues: mergeIssueList(state.issues, toIssue(error, "trash-restore", "Restore failed"))
        }));
        return null;
      }
    },
    removeSourceUrl: async (modId) => {
      try {
        const withoutSource = await api.removeSourceUrl(modId);
        let updated: Mod | null = null;
        set((state) => ({
          mods: state.mods.map((mod) => {
            if (mod.id !== modId) return mod;
            updated = {
              ...mod,
              ...withoutSource,
              id: mod.id,
              name: withoutSource.name || mod.name,
              files: withoutSource.files.length > 0 ? withoutSource.files : mod.files,
              sourceUrl: withoutSource.sourceUrl
            };
            return updated;
          })
        }));
        return updated;
      } catch (error) {
        set((state) => ({
          issues: mergeIssueList(state.issues, toIssue(error, "source-url", "Source URL remove failed"))
        }));
        return null;
      }
    },
    attachSourceUrl: async (modId, sourceUrl, providerId) => {
      try {
        const withSource = await api.attachSourceUrl(modId, sourceUrl, providerId);
        let updated: Mod | null = null;
        set((state) => ({
          mods: state.mods.map((mod) => {
            if (mod.id !== modId) return mod;
            updated = {
              ...mod,
              ...withSource,
              id: mod.id,
              name: withSource.name || mod.name,
              files: withSource.files.length > 0 ? withSource.files : mod.files
            };
            return updated;
          })
        }));
        return updated;
      } catch (error) {
        set((state) => ({
          issues: mergeIssueList(state.issues, toIssue(error, "source-url", "Source URL attach failed"))
        }));
        return null;
      }
    },
    renameModDisplayName: async (modId, displayName) => {
      try {
        const renamed = await api.renameModDisplayName(modId, displayName);
        let updated: Mod | null = null;
        set((state) => ({
          mods: state.mods.map((mod) => {
            if (mod.id !== modId) return mod;
            updated = { ...mod, ...renamed, id: mod.id, name: renamed.name };
            return updated;
          })
        }));
        return updated;
      } catch (error) {
        set((state) => ({
          issues: mergeIssueList(state.issues, toIssue(error, "rename", "Rename failed"))
        }));
        return null;
      }
    },
    importArchive: async (archivePath, name, slug) => {
      try {
        await api.importArchive(archivePath, name, slug);
        const id = get().selectedInstanceId;
        if (!id) return;
        const mods = await api.scanMods(id);
        set({ mods });
      } catch (error) {
        set((state) => ({
          issues: mergeIssueList(state.issues, toIssue(error, "import", "Import failed"))
        }));
      }
    },
    toggleMod: async (mod, targetEnabled, instanceId) => {
      let effectiveModId = mod.id;

      if (mod.source === "external") {
        const migration = await api.migrateExternalMod(mod.id, instanceId);
        effectiveModId = migration.managedModId;
        if (migration.issues.length > 0) {
          set((state) => ({ issues: mergeIssues(state.issues, migration.issues) }));
        }
      }

      const dryRun = await api.dryRunToggle(effectiveModId, targetEnabled, instanceId);
      set({ lastDryRun: dryRun });

      if (dryRun.issues.length > 0) {
        set((state) => ({ issues: mergeIssues(state.issues, dryRun.issues) }));
      }

      if (!dryRun.canApply) {
        return dryRun;
      }

      const applied = await api.applyToggle(effectiveModId, targetEnabled, instanceId);
      if (applied.issues.length > 0) {
        set((state) => ({ issues: mergeIssues(state.issues, applied.issues) }));
      }

      return dryRun;
    }
  }));
}
