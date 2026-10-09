import { toBackendErrorCode } from "../lib/error";
import { createStore } from "zustand/vanilla";
import type { DryRunResult, GameInstance, Issue, Mod, RestoreResult, RuntimeDiagnostics, SourceCandidate, SourceMetadata, TrashEntry } from "../lib/types";

export type ApplyResult = {
  applied: boolean;
  issues: Issue[];
};

export type MigrateResult = {
  managedModId: string;
  issues: Issue[];
};

export type ImportResult = Mod;

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
  pickArchiveFile: () => Promise<string | null>;
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
  attachSourceUrl: (modId: string, sourceUrl: string, providerId?: string, metadata?: SourceMetadata) => Promise<Mod>;
  findSourceCandidates: (modId: string, instanceId: string, apiKey?: string) => Promise<SourceCandidate[]>;
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
  importArchive: async () => ({ id: "", name: "", files: [], enabled: false, source: "managed" }),
  pickArchiveFile: async () => null,
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
  attachSourceUrl: async (modId, sourceUrl, _providerId, metadata) => ({
    id: modId,
    name: modId,
    sourceUrl,
    preview: metadata?.previewUrl,
    files: [],
    enabled: false,
    source: "managed"
  }),
  findSourceCandidates: async () => [],
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
    waylandWorkaroundDisabled: false,
    appVersion: "0.0.0",
    buildTarget: "unknown"
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
  scanRevision: number;
  manageAllStatus: "idle" | "managing";
  manageAllProgress: ManageAllProgress | null;
  selectInstance: (id: string | null) => void;
  loadInstances: () => Promise<void>;
  selectInstanceAndScan: (id: string) => Promise<void>;
  rescanSelected: () => Promise<void>;
  addIssue: (issue: Issue) => void;
  addCustomInstance: (path: string) => Promise<void>;
  replaceGameRoots: (roots: string[], selectedRoot?: string) => Promise<boolean>;
  importArchive: (archivePath: string, name: string, slug?: string) => Promise<boolean>;
  pickArchiveFile: () => Promise<string | null>;
  renameModDisplayName: (modId: string, displayName: string) => Promise<Mod | null>;
  attachSourceUrl: (modId: string, sourceUrl: string, providerId?: string, metadata?: SourceMetadata) => Promise<Mod | null>;
  findSourceCandidates: (modId: string, apiKey?: string) => Promise<SourceCandidate[]>;
  removeSourceUrl: (modId: string) => Promise<Mod | null>;
  uninstallManagedMod: (modId: string) => Promise<UninstallResult | null>;
  loadTrashEntries: () => Promise<void>;
  restoreTrashedMod: (trashName: string) => Promise<RestoreResult | null>;
  manageExternalMod: (modId: string) => Promise<MigrateResult | null>;
  manageAllExternalMods: () => Promise<MigrateResult[]>;
  clearSuccess: () => void;
  setSuccess: (message: string) => void;
  openManagedModsFolder: () => Promise<void>;
  openManagerFolder: () => Promise<void>;
  getDiagnosticsReport: () => Promise<string | null>;
  toggleMod: (mod: Mod, targetEnabled: boolean, instanceId: string, approve?: (dryRun: DryRunResult) => Promise<boolean>) => Promise<DryRunResult>;
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
    typeof error.message === "string"
  ) {
    const maybeCode =
      "code" in error && typeof error.code === "string"
        ? toBackendErrorCode(error.code)
        : undefined;

    return {
      id: `${fallbackId}-${Date.now()}`,
      severity: "error",
      message: error.message,
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

  let scanGeneration = 0;
  let instanceGeneration = 0;
  const metadataEdits = new Map<string, number>();
  return createStore<AppState>((set, get) => {
    const report = (error: unknown, id: string, message: string) => set((state) => ({ issues: mergeIssueList(state.issues, toIssue(error, id, message)) }));
    const scan = async (id: string) => {
      if (get().selectedInstanceId !== id) return;
      const generation = ++scanGeneration;
      set({ scanStatus: "scanning" });
      const current = () => generation === scanGeneration && get().selectedInstanceId === id;
      try {
        const mods = await api.scanMods(id);
        if (!current()) return;
        set((state) => ({ mods, scanRevision: state.scanRevision + 1 }));
        const orphans = await api.detectOrphanSymlinks(id);
        if (!current()) return;
        const orphanIssues: Issue[] = orphans.map((orphan, index) => ({
          id: `orphan-${index}-${orphan.path}`, severity: "warning", message: `Orphan symlink: ${orphan.path}`,
          code: "EXTERNAL_LINK", context: { target: orphan.target }
        }));
        set((state) => ({ issues: mergeIssues(state.issues.filter((issue) => !issue.id.startsWith("orphan-")), orphanIssues) }));
      } catch (error) {
        if (current()) report(error, "scan", "Scan failed");
      } finally {
        if (current()) set({ scanStatus: "idle" });
      }
    };
    return ({
    instances: [],
    selectedInstanceId: null,
    mods: [],
    issues: [],
    trashEntries: [],
    lastSuccess: null,
    lastDryRun: null,
    scanStatus: "idle",
    scanRevision: 0,
    manageAllStatus: "idle",
    manageAllProgress: null,
    selectInstance: (id) => {
      ++instanceGeneration;
      ++scanGeneration;
      set({ selectedInstanceId: id, mods: [], scanStatus: "idle" });
    },
    loadInstances: async () => {
      try { set({ instances: await api.detectGameInstances() }); }
      catch (error) { report(error, "detect-instances", "Game detection failed"); }
    },
    selectInstanceAndScan: async (id) => {
      get().selectInstance(id);
      await scan(id);
    },
    rescanSelected: async () => {
      const id = get().selectedInstanceId;
      if (id) await scan(id);
    },
    addIssue: (issue) => set((state) => ({ issues: mergeIssueList(state.issues, issue) })),
    clearSuccess: () => set({ lastSuccess: null }),
    setSuccess: (message) => set({ lastSuccess: message }),
    replaceGameRoots: async (roots, selectedRoot) => {
      try {
        const instances: GameInstance[] = [];
        for (const path of roots) {
          const validated = await api.validateCustomInstance(path);
          const existing = get().instances.find((instance) => instance.path === path);
          instances.push(existing ?? validated);
        }
        const selected = instances.find((instance) => instance.path === selectedRoot) ?? instances[0];
        get().selectInstance(selected?.id ?? null);
        set({ instances });
        if (selected) await scan(selected.id);
        return true;
      } catch (error) {
        report(error, "settings-roots", "Settings game roots could not be validated");
        return false;
      }
    },
    addCustomInstance: async (path) => {
      const generation = instanceGeneration;
      try {
        const instance = await api.validateCustomInstance(path);
        set((state) => ({ instances: [...state.instances, instance] }));
        if (generation === instanceGeneration) await get().selectInstanceAndScan(instance.id);
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
          `App version: ${diagnostics.appVersion}`,
          `Build target: ${diagnostics.buildTarget}`,
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
      if (!instanceId || get().mods.find((mod) => mod.id === modId)?.source === "external") return null;
      try {
        const result = await api.uninstallManagedMod(modId, instanceId);
        set((state) => ({
          mods: state.selectedInstanceId === instanceId ? state.mods.filter((mod) => mod.id !== modId) : state.mods,
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
        await scan(instanceId);
        set((state) => ({
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
        set({ lastSuccess: `Managing ${results.length} mod${results.length === 1 ? "" : "s"}` });
        return results;
      } catch (error) {
        set((state) => ({
          issues: mergeIssueList(state.issues, toIssue(error, "manage-all-mods", "Manage all mods failed"))
        }));
        return results;
      } finally {
        await scan(instanceId);
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
        await scan(instanceId);
        return result;
      } catch (error) {
        const issue = toIssue(error, "trash-restore", "Restore failed");
        const restoreIssue = issue.code === "PATH_COLLISION"
          ? { ...issue, message: `${issue.message}. Open the Mods folder and move or rename the existing file before restoring.` }
          : issue;
        set((state) => ({
          issues: mergeIssueList(state.issues, restoreIssue)
        }));
        return null;
      }
    },
    findSourceCandidates: async (modId, apiKey) => {
      const instanceId = get().selectedInstanceId;
      if (!instanceId) return [];
      try {
        return await api.findSourceCandidates(modId, instanceId, apiKey);
      } catch (error) {
        set((state) => ({
          issues: mergeIssueList(state.issues, toIssue(error, "source-lookup", "Source lookup failed"))
        }));
        throw error;
      }
    },
    removeSourceUrl: async (modId) => {
      const instanceId = get().selectedInstanceId;
      const generation = instanceGeneration;
      const edit = (metadataEdits.get(modId) ?? 0) + 1;
      metadataEdits.set(modId, edit);
      try {
        const withoutSource = await api.removeSourceUrl(modId);
        if (get().selectedInstanceId !== instanceId || generation !== instanceGeneration || metadataEdits.get(modId) !== edit) return null;
        let updated: Mod | null = null;
        set((state) => ({
          mods: state.mods.map((mod) => {
            if (mod.id !== modId) return mod;
            updated = {
              ...mod,
              ...withoutSource,
              id: mod.id,
              name: withoutSource.name || mod.name,
              files: mod.files,
              enabled: mod.enabled,
              source: mod.source,
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
    attachSourceUrl: async (modId, sourceUrl, providerId, metadata) => {
      const instanceId = get().selectedInstanceId;
      const generation = instanceGeneration;
      const edit = (metadataEdits.get(modId) ?? 0) + 1;
      metadataEdits.set(modId, edit);
      try {
        const withSource = await api.attachSourceUrl(modId, sourceUrl, providerId, metadata);
        if (get().selectedInstanceId !== instanceId || generation !== instanceGeneration || metadataEdits.get(modId) !== edit) return null;
        let updated: Mod | null = null;
        set((state) => ({
          mods: state.mods.map((mod) => {
            if (mod.id !== modId) return mod;
            updated = {
              ...mod,
              ...withSource,
              id: mod.id,
              name: withSource.name || mod.name,
              files: mod.files,
              enabled: mod.enabled,
              source: mod.source
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
      const instanceId = get().selectedInstanceId;
      const generation = instanceGeneration;
      const edit = (metadataEdits.get(modId) ?? 0) + 1;
      metadataEdits.set(modId, edit);
      try {
        const renamed = await api.renameModDisplayName(modId, displayName);
        if (get().selectedInstanceId !== instanceId || generation !== instanceGeneration || metadataEdits.get(modId) !== edit) return null;
        let updated: Mod | null = null;
        set((state) => ({
          mods: state.mods.map((mod) => {
            if (mod.id !== modId) return mod;
            updated = { ...mod, ...renamed, id: mod.id, name: renamed.name, files: mod.files, enabled: mod.enabled, source: mod.source };
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
        const imported = await api.importArchive(archivePath, name, slug);
        set((state) => ({
          mods: [imported, ...state.mods.filter((mod) => mod.id !== imported.id)]
        }));
        return true;
      } catch (error) {
        set((state) => ({
          issues: mergeIssueList(state.issues, toIssue(error, "import", "Import failed"))
        }));
        return false;
      }
    },
    pickArchiveFile: async () => {
      try {
        return await api.pickArchiveFile();
      } catch (error) {
        set((state) => ({
          issues: mergeIssueList(state.issues, toIssue(error, "archive-picker", "Archive picker failed"))
        }));
        return null;
      }
    },
    toggleMod: async (mod, targetEnabled, instanceId, approve) => {
      try {
      if (mod.source === "external") {
        const issue: Issue = { id: `external-toggle-${mod.id}`, severity: "warning", message: "Manage this external mod before toggling it.", code: "EXTERNAL_LINK" };
        set((state) => ({ issues: mergeIssueList(state.issues, issue) }));
        return { canApply: false, operations: [], issues: [issue] };
      }
      const effectiveModId = mod.id;

      const dryRun = await api.dryRunToggle(effectiveModId, targetEnabled, instanceId);
      set({ lastDryRun: dryRun });

      if (dryRun.issues.length > 0) {
        set((state) => ({ issues: mergeIssues(state.issues, dryRun.issues) }));
      }

      if (approve && !await approve(dryRun)) return dryRun;
      if (!dryRun.canApply) return dryRun;
      const applied = await api.applyToggle(effectiveModId, targetEnabled, instanceId);
      if (applied.issues.length > 0) {
        set((state) => ({ issues: mergeIssues(state.issues, applied.issues) }));
      }

      await scan(instanceId);
      return dryRun;
      } catch (error) {
        const issue = toIssue(error, "toggle", "Toggle failed");
        set((state) => ({ issues: mergeIssueList(state.issues, issue) }));
        await scan(instanceId);
        return { canApply: false, operations: [], issues: [issue] };
      }
    }
  });
  });
}
