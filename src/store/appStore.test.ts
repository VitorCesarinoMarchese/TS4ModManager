import { describe, expect, it, vi } from "vitest";
import { createAppStore } from "./appStore";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("app store bootstrap", () => {
  it("starts with empty instances/mods/issues", () => {
    const store = createAppStore();
    const state = store.getState();

    expect(state.instances).toEqual([]);
    expect(state.mods).toEqual([]);
    expect(state.issues).toEqual([]);
    expect(state.selectedInstanceId).toBeNull();
    expect(state.scanStatus).toBe("idle");
  });

  it("allows setting selected instance", () => {
    const store = createAppStore();
    store.getState().selectInstance("inst-1");

    expect(store.getState().selectedInstanceId).toBe("inst-1");
  });

  it("loads detected instances", async () => {
    const api = {
      detectGameInstances: vi.fn().mockResolvedValue([
        { id: "n1", path: "/home/x/Documents/Electronic Arts/The Sims 4", source: "native" }
      ]),
      scanMods: vi.fn().mockResolvedValue([]),
      dryRunToggle: vi.fn().mockResolvedValue({ canApply: true, operations: [], issues: [] }),
      applyToggle: vi.fn().mockResolvedValue({ applied: true, issues: [] }),
      migrateExternalMod: vi.fn().mockResolvedValue({ managedModId: "m1", issues: [] })
    };

    const store = createAppStore(api);
    await store.getState().loadInstances();

    expect(store.getState().instances).toHaveLength(1);
    expect(api.detectGameInstances).toHaveBeenCalledTimes(1);
  });

  it("selecting instance triggers scan", async () => {
    const api = {
      detectGameInstances: vi.fn().mockResolvedValue([]),
      scanMods: vi.fn().mockResolvedValue([
        {
          id: "m1",
          name: "Mod1",
          files: ["x.package"],
          enabled: false,
          source: "managed"
        }
      ]),
      dryRunToggle: vi.fn().mockResolvedValue({ canApply: true, operations: [], issues: [] }),
      applyToggle: vi.fn().mockResolvedValue({ applied: true, issues: [] }),
      migrateExternalMod: vi.fn().mockResolvedValue({ managedModId: "m1", issues: [] })
    };

    const store = createAppStore(api);
    await store.getState().selectInstanceAndScan("inst-1");

    expect(store.getState().selectedInstanceId).toBe("inst-1");
    expect(store.getState().mods).toHaveLength(1);
    expect(api.scanMods).toHaveBeenCalledWith("inst-1");
  });

  it("stores issues persistently", () => {
    const store = createAppStore();

    store.getState().addIssue({
      id: "i1",
      severity: "warning",
      message: "Path collision",
      code: "PATH_COLLISION"
    });

    expect(store.getState().issues).toHaveLength(1);
    expect(store.getState().issues[0].message).toBe("Path collision");
  });

  it("toggle runs dry-run then apply when allowed", async () => {
    const api = {
      detectGameInstances: vi.fn().mockResolvedValue([]),
      scanMods: vi.fn().mockResolvedValue([]),
      dryRunToggle: vi.fn().mockResolvedValue({
        canApply: true,
        operations: [{ action: "create_symlink", path: "Mods/a.package" }],
        issues: []
      }),
      applyToggle: vi.fn().mockResolvedValue({
        applied: true,
        issues: []
      }),
      migrateExternalMod: vi.fn().mockResolvedValue({ managedModId: "mod-1", issues: [] })
    };

    const store = createAppStore(api);
    await store.getState().toggleMod(
      {
        id: "mod-1",
        name: "M",
        files: ["x.package"],
        enabled: false,
        source: "managed"
      },
      true,
      "inst-1"
    );

    expect(api.dryRunToggle).toHaveBeenCalledWith("mod-1", true, "inst-1");
    expect(api.applyToggle).toHaveBeenCalledWith("mod-1", true, "inst-1");
  });

  it("toggle stops on blocking dry-run and stores issues", async () => {
    const api = {
      detectGameInstances: vi.fn().mockResolvedValue([]),
      scanMods: vi.fn().mockResolvedValue([]),
      dryRunToggle: vi.fn().mockResolvedValue({
        canApply: false,
        operations: [{ action: "skip", path: "Mods/a.package", reason: "collision" }],
        issues: [
          {
            id: "i2",
            severity: "error",
            message: "Path collision",
            code: "PATH_COLLISION"
          }
        ]
      }),
      applyToggle: vi.fn().mockResolvedValue({ applied: true, issues: [] }),
      migrateExternalMod: vi.fn().mockResolvedValue({ managedModId: "mod-2", issues: [] })
    };

    const store = createAppStore(api);
    await store.getState().toggleMod(
      {
        id: "mod-2",
        name: "X",
        files: ["a.package"],
        enabled: false,
        source: "managed"
      },
      true,
      "inst-1"
    );

    expect(api.applyToggle).not.toHaveBeenCalled();
    expect(store.getState().issues.at(-1)?.code).toBe("PATH_COLLISION");
  });

  it("external toggle migrates first then toggles managed mod", async () => {
    const api = {
      detectGameInstances: vi.fn().mockResolvedValue([]),
      scanMods: vi.fn().mockResolvedValue([]),
      dryRunToggle: vi.fn().mockResolvedValue({
        canApply: true,
        operations: [{ action: "create_symlink", path: "Mods/a.package" }],
        issues: []
      }),
      applyToggle: vi.fn().mockResolvedValue({ applied: true, issues: [] }),
      migrateExternalMod: vi.fn().mockResolvedValue({
        managedModId: "managed-123",
        issues: [{ id: "m1", severity: "info", message: "Migrated" }]
      }),
      validateCustomInstance: vi.fn().mockResolvedValue({
        id: "c1",
        path: "/custom/path",
        source: "custom"
      })
    };

    const store = createAppStore(api);
    await store.getState().toggleMod(
      {
        id: "ext-1",
        name: "Ext",
        files: ["a.package"],
        enabled: false,
        source: "external"
      },
      true,
      "inst-1"
    );

    expect(api.migrateExternalMod).toHaveBeenCalledWith("ext-1", "inst-1");
    expect(api.dryRunToggle).toHaveBeenCalledWith("managed-123", true, "inst-1");
    expect(api.applyToggle).toHaveBeenCalledWith("managed-123", true, "inst-1");
    expect(store.getState().issues.at(-1)?.message).toBe("Migrated");
  });

  it("adds custom instance then scans it", async () => {
    const api = {
      detectGameInstances: vi.fn().mockResolvedValue([]),
      scanMods: vi.fn().mockResolvedValue([]),
      dryRunToggle: vi.fn().mockResolvedValue({ canApply: true, operations: [], issues: [] }),
      applyToggle: vi.fn().mockResolvedValue({ applied: true, issues: [] }),
      migrateExternalMod: vi.fn().mockResolvedValue({ managedModId: "m1", issues: [] }),
      validateCustomInstance: vi.fn().mockResolvedValue({
        id: "custom-1",
        path: "/games/sims4",
        source: "custom"
      }),
      importArchive: vi.fn().mockResolvedValue({ modId: "m2" })
    };

    const store = createAppStore(api);
    await store.getState().addCustomInstance("/games/sims4");

    expect(api.validateCustomInstance).toHaveBeenCalledWith("/games/sims4");
    expect(api.scanMods).toHaveBeenCalledWith("custom-1");
    expect(store.getState().instances.at(-1)?.id).toBe("custom-1");
    expect(store.getState().selectedInstanceId).toBe("custom-1");
  });

  it("rescan refreshes selected instance mods", async () => {
    const api = {
      detectGameInstances: vi.fn().mockResolvedValue([]),
      scanMods: vi.fn().mockResolvedValue([{ id: "m9", name: "R", files: [], enabled: false, source: "managed" }]),
      detectOrphanSymlinks: vi.fn().mockResolvedValue([{ path: "Mods/dead.package", target: "/missing" }]),
      dryRunToggle: vi.fn().mockResolvedValue({ canApply: true, operations: [], issues: [] }),
      applyToggle: vi.fn().mockResolvedValue({ applied: true, issues: [] }),
      migrateExternalMod: vi.fn().mockResolvedValue({ managedModId: "m1", issues: [] }),
      validateCustomInstance: vi.fn().mockResolvedValue({ id: "c", path: "/x", source: "custom" }),
      importArchive: vi.fn().mockResolvedValue({ modId: "m2" })
    };

    const store = createAppStore(api);
    store.getState().selectInstance("inst-1");
    await store.getState().rescanSelected();

    expect(api.scanMods).toHaveBeenCalledWith("inst-1");
    expect(api.detectOrphanSymlinks).toHaveBeenCalledWith("inst-1");
    expect(store.getState().mods).toHaveLength(1);
    expect(store.getState().issues.at(-1)?.message).toContain("Orphan symlink");
  });

  it("dedupes same issue id and keeps highest severity", () => {
    const store = createAppStore();

    store.getState().addIssue({ id: "dup", severity: "warning", message: "warn" });
    store.getState().addIssue({ id: "dup", severity: "error", message: "err" });

    expect(store.getState().issues).toHaveLength(1);
    expect(store.getState().issues[0].severity).toBe("error");
    expect(store.getState().issues[0].message).toBe("err");
  });

  it("renames mod display name and updates store", async () => {
    const api = {
      detectGameInstances: vi.fn().mockResolvedValue([]),
      scanMods: vi.fn().mockResolvedValue([{ id: "m1", name: "Detected", files: ["a.package"], enabled: false, source: "managed" }]),
      detectOrphanSymlinks: vi.fn().mockResolvedValue([]),
      dryRunToggle: vi.fn().mockResolvedValue({ canApply: true, operations: [], issues: [] }),
      applyToggle: vi.fn().mockResolvedValue({ applied: true, issues: [] }),
      migrateExternalMod: vi.fn().mockResolvedValue({ managedModId: "m1", issues: [] }),
      validateCustomInstance: vi.fn().mockResolvedValue({ id: "c", path: "/x", source: "custom" }),
      importArchive: vi.fn().mockResolvedValue({ modId: "m2" }),
      renameModDisplayName: vi.fn().mockResolvedValue({ id: "m1", name: "Custom", files: ["a.package"], enabled: false, source: "managed" })
    };

    const store = createAppStore(api);
    await store.getState().selectInstanceAndScan("inst-1");
    await store.getState().renameModDisplayName("m1", "Custom");

    expect(api.renameModDisplayName).toHaveBeenCalledWith("m1", "Custom");
    expect(store.getState().mods[0].name).toBe("Custom");
  });

  it("imports archive then rescans selected instance", async () => {
    const api = {
      detectGameInstances: vi.fn().mockResolvedValue([]),
      scanMods: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: "m2", name: "Imported", files: ["a.package"], enabled: false, source: "managed" }]),
      detectOrphanSymlinks: vi.fn().mockResolvedValue([]),
      dryRunToggle: vi.fn().mockResolvedValue({ canApply: true, operations: [], issues: [] }),
      applyToggle: vi.fn().mockResolvedValue({ applied: true, issues: [] }),
      migrateExternalMod: vi.fn().mockResolvedValue({ managedModId: "m1", issues: [] }),
      validateCustomInstance: vi.fn().mockResolvedValue({ id: "c", path: "/x", source: "custom" }),
      importArchive: vi.fn().mockResolvedValue({ modId: "m2" })
    };

    const store = createAppStore(api);
    await store.getState().selectInstanceAndScan("inst-1");
    await store.getState().importArchive("/tmp/mod.zip", "ZipMod");

    expect(api.importArchive).toHaveBeenCalledWith("/tmp/mod.zip", "ZipMod", undefined);
    expect(api.scanMods).toHaveBeenLastCalledWith("inst-1");
    expect(store.getState().mods.at(-1)?.name).toBe("Imported");
  });

  it("custom instance validation error stored as issue", async () => {
    const api = {
      detectGameInstances: vi.fn().mockResolvedValue([]),
      scanMods: vi.fn().mockResolvedValue([]),
      detectOrphanSymlinks: vi.fn().mockResolvedValue([]),
      dryRunToggle: vi.fn().mockResolvedValue({ canApply: true, operations: [], issues: [] }),
      applyToggle: vi.fn().mockResolvedValue({ applied: true, issues: [] }),
      migrateExternalMod: vi.fn().mockResolvedValue({ managedModId: "m1", issues: [] }),
      validateCustomInstance: vi.fn().mockRejectedValue({ code: "INVALID_PATH", message: "Bad custom path" }),
      importArchive: vi.fn().mockResolvedValue({ modId: "m2" })
    };

    const store = createAppStore(api);
    await store.getState().addCustomInstance("/bad/path");

    expect(store.getState().issues.at(-1)?.message).toBe("Bad custom path");
    expect(store.getState().issues.at(-1)?.code).toBe("INVALID_PATH");
  });

  it("import archive failure stored as issue", async () => {
    const api = {
      detectGameInstances: vi.fn().mockResolvedValue([]),
      scanMods: vi.fn().mockResolvedValue([]),
      detectOrphanSymlinks: vi.fn().mockResolvedValue([]),
      dryRunToggle: vi.fn().mockResolvedValue({ canApply: true, operations: [], issues: [] }),
      applyToggle: vi.fn().mockResolvedValue({ applied: true, issues: [] }),
      migrateExternalMod: vi.fn().mockResolvedValue({ managedModId: "m1", issues: [] }),
      validateCustomInstance: vi.fn().mockResolvedValue({ id: "c", path: "/x", source: "custom" }),
      importArchive: vi.fn().mockRejectedValue({ code: "ARCHIVE_EXTRACTION_FAILED", message: "Extract fail" })
    };

    const store = createAppStore(api);
    await store.getState().selectInstanceAndScan("inst-1");
    await store.getState().importArchive("/tmp/x.zip", "X");

    expect(store.getState().issues.at(-1)?.code).toBe("ARCHIVE_EXTRACTION_FAILED");
  });

  it("tracks scan status while rescan is pending", async () => {
    const scan = deferred<never[]>();
    const api = {
      detectGameInstances: vi.fn().mockResolvedValue([]),
      scanMods: vi.fn().mockReturnValue(scan.promise),
      detectOrphanSymlinks: vi.fn().mockResolvedValue([]),
      dryRunToggle: vi.fn().mockResolvedValue({ canApply: true, operations: [], issues: [] }),
      applyToggle: vi.fn().mockResolvedValue({ applied: true, issues: [] }),
      migrateExternalMod: vi.fn().mockResolvedValue({ managedModId: "m1", issues: [] }),
      validateCustomInstance: vi.fn().mockResolvedValue({ id: "c", path: "/x", source: "custom" }),
      importArchive: vi.fn().mockResolvedValue({ modId: "m2" })
    };

    const store = createAppStore(api);
    store.getState().selectInstance("inst-1");
    const rescan = store.getState().rescanSelected();

    expect(store.getState().scanStatus).toBe("scanning");
    scan.resolve([]);
    await rescan;
    expect(store.getState().scanStatus).toBe("idle");
  });

  it("clears scan status and stores issue when rescan fails", async () => {
    const api = {
      detectGameInstances: vi.fn().mockResolvedValue([]),
      scanMods: vi.fn().mockRejectedValue({ code: "IO_ERROR", message: "Scan failed" }),
      detectOrphanSymlinks: vi.fn().mockResolvedValue([]),
      dryRunToggle: vi.fn().mockResolvedValue({ canApply: true, operations: [], issues: [] }),
      applyToggle: vi.fn().mockResolvedValue({ applied: true, issues: [] }),
      migrateExternalMod: vi.fn().mockResolvedValue({ managedModId: "m1", issues: [] }),
      validateCustomInstance: vi.fn().mockResolvedValue({ id: "c", path: "/x", source: "custom" }),
      importArchive: vi.fn().mockResolvedValue({ modId: "m2" })
    };

    const store = createAppStore(api);
    store.getState().selectInstance("inst-1");
    await store.getState().rescanSelected();

    expect(store.getState().scanStatus).toBe("idle");
    expect(store.getState().issues.at(-1)?.message).toBe("Scan failed");
  });

  it("rescan no-op when no selected instance", async () => {
    const api = {
      detectGameInstances: vi.fn().mockResolvedValue([]),
      scanMods: vi.fn().mockResolvedValue([]),
      detectOrphanSymlinks: vi.fn().mockResolvedValue([]),
      dryRunToggle: vi.fn().mockResolvedValue({ canApply: true, operations: [], issues: [] }),
      applyToggle: vi.fn().mockResolvedValue({ applied: true, issues: [] }),
      migrateExternalMod: vi.fn().mockResolvedValue({ managedModId: "m1", issues: [] }),
      validateCustomInstance: vi.fn().mockResolvedValue({ id: "c", path: "/x", source: "custom" }),
      importArchive: vi.fn().mockResolvedValue({ modId: "m2" })
    };

    const store = createAppStore(api);
    await store.getState().rescanSelected();
    expect(api.scanMods).not.toHaveBeenCalled();
  });
});
