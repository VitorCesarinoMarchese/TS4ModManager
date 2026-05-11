import { describe, expect, it, vi } from "vitest";
import { createBackendApi } from "./backendApi";

describe("backend api wrapper", () => {
  it("calls detect instances command", async () => {
    const invoke = vi.fn().mockResolvedValue([{ id: "n1", path: "/p", source: "native" }]);
    const api = createBackendApi(invoke);

    const res = await api.detectGameInstances();

    expect(res).toHaveLength(1);
    expect(invoke).toHaveBeenCalledWith("detect_game_instances");
  });

  it("maps dry-run payload", async () => {
    const invoke = vi.fn().mockResolvedValue({
      canApply: true,
      operations: [{ action: "create_symlink", path: "Mods/a.package" }],
      issues: []
    });

    const api = createBackendApi(invoke);
    const res = await api.dryRunToggle("m1", true, "i1");

    expect(res.canApply).toBe(true);
    expect(invoke).toHaveBeenCalledWith("dry_run_toggle", {
      modId: "m1",
      targetEnabled: true,
      instanceId: "i1"
    });
  });

  it("maps apply payload", async () => {
    const invoke = vi.fn().mockResolvedValue({ applied: true, issues: [] });
    const api = createBackendApi(invoke);

    const res = await api.applyToggle("m1", true, "i1");

    expect(res.applied).toBe(true);
    expect(invoke).toHaveBeenCalledWith("apply_toggle", {
      modId: "m1",
      targetEnabled: true,
      instanceId: "i1"
    });
  });

  it("normalizes scanned mod key to frontend id", async () => {
    const invoke = vi.fn().mockResolvedValue([
      {
        key: "FolderA",
        name: "FolderA",
        files: ["FolderA/a.package"],
        enabled: false,
        source: "managed"
      }
    ]);
    const api = createBackendApi(invoke);

    const [mod] = await api.scanMods("i1");

    expect(mod.id).toBe("FolderA");
    expect(mod.name).toBe("FolderA");
    expect(invoke).toHaveBeenCalledWith("scan_mods", { instanceId: "i1" });
  });

  it("normalizes scanned mod id and fallback name branches", async () => {
    const invoke = vi.fn().mockResolvedValue([
      {
        id: "real-id",
        key: "FolderA",
        name: "FolderA",
        files: ["FolderA/a.package"],
        enabled: false,
        source: "managed"
      },
      {
        name: "No Key Mod",
        files: ["b.package"],
        enabled: false,
        source: "external"
      }
    ]);
    const api = createBackendApi(invoke);

    const mods = await api.scanMods("i1");

    expect(mods[0].id).toBe("real-id");
    expect(mods[1]).toMatchObject({ id: "No Key Mod", source: "external" });
  });

  it("maps metadata fallbacks for IDs, names, files, and external source", async () => {
    const invoke = vi.fn().mockResolvedValue({ id: "meta-id", source: "external" });
    const api = createBackendApi(invoke);

    const res = await api.renameModDisplayName("m1", "Fallback Name");

    expect(res).toEqual({
      id: "meta-id",
      name: "Fallback Name",
      files: [],
      enabled: false,
      source: "external",
      sourceUrl: undefined
    });
  });

  it("keeps normalized error details", async () => {
    const invoke = vi.fn().mockRejectedValue({
      code: "PATH_COLLISION",
      message: "collision",
      details: { path: "Mods/a.package" }
    });
    const api = createBackendApi(invoke);

    await expect(api.scanMods("i1")).rejects.toMatchObject({
      code: "PATH_COLLISION",
      message: "collision",
      details: { path: "Mods/a.package" }
    });
  });

  it("normalizes malformed backend errors", async () => {
    const invoke = vi.fn().mockRejectedValue({ code: 123, message: null });
    const api = createBackendApi(invoke);

    await expect(api.detectGameInstances()).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      message: "Unknown backend error"
    });
  });

  it("throws typed error for backend failure", async () => {
    const invoke = vi.fn().mockRejectedValue({ code: "PATH_COLLISION", message: "collision" });
    const api = createBackendApi(invoke);

    await expect(api.scanMods("i1")).rejects.toMatchObject({
      code: "PATH_COLLISION",
      message: "collision"
    });
  });

  it("maps unknown error to internal", async () => {
    const invoke = vi.fn().mockRejectedValue("boom");
    const api = createBackendApi(invoke);

    await expect(api.detectGameInstances()).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      message: "Unknown backend error"
    });
  });

  it("calls migrate external command", async () => {
    const invoke = vi.fn().mockResolvedValue({ managedModId: "managed-1", issues: [] });
    const api = createBackendApi(invoke);

    const res = await api.migrateExternalMod("ext-1", "inst-1");

    expect(res.managedModId).toBe("managed-1");
    expect(invoke).toHaveBeenCalledWith("migrate_external_mod", {
      modId: "ext-1",
      instanceId: "inst-1"
    });
  });

  it("calls validate custom instance command", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValue({ id: "c1", path: "/games/sims4", source: "custom" });
    const api = createBackendApi(invoke);

    const res = await api.validateCustomInstance("/games/sims4");

    expect(res.id).toBe("c1");
    expect(invoke).toHaveBeenCalledWith("validate_custom_instance", { path: "/games/sims4" });
  });

  it("calls remove source URL command", async () => {
    const invoke = vi.fn().mockResolvedValue({
      modId: "m1",
      displayName: "My Mod",
      files: [],
      source: "local"
    });
    const api = createBackendApi(invoke);

    const res = await api.removeSourceUrl("m1");

    expect(res.sourceUrl).toBeUndefined();
    expect(invoke).toHaveBeenCalledWith("remove_source_url", { modId: "m1" });
  });

  it("calls attach source URL command", async () => {
    const invoke = vi.fn().mockResolvedValue({
      modId: "m1",
      displayName: "My Mod",
      sourceUrl: "https://www.curseforge.com/sims4/mods/example",
      previewUrl: "https://img.example/cover.jpg",
      files: ["a.package"],
      source: "curseforge"
    });
    const api = createBackendApi(invoke);

    const res = await api.attachSourceUrl(
      "m1",
      "https://www.curseforge.com/sims4/mods/example",
      "curseforge",
      { displayName: "My Mod", previewUrl: "https://img.example/cover.jpg" }
    );

    expect(res.sourceUrl).toBe("https://www.curseforge.com/sims4/mods/example");
    expect(res.preview).toBe("https://img.example/cover.jpg");
    expect(invoke).toHaveBeenCalledWith("attach_source_url", {
      modId: "m1",
      sourceUrl: "https://www.curseforge.com/sims4/mods/example",
      providerId: "curseforge",
      displayName: "My Mod",
      previewUrl: "https://img.example/cover.jpg"
    });
  });

  it("calls rename mod display name command", async () => {
    const invoke = vi.fn().mockResolvedValue({
      modId: "m1",
      name: "Raw Local Name",
      displayName: "Custom Display",
      files: ["a.package"],
      source: "local"
    });
    const api = createBackendApi(invoke);

    const res = await api.renameModDisplayName("m1", "Custom Display");

    expect(res.name).toBe("Custom Display");
    expect(invoke).toHaveBeenCalledWith("rename_mod_display_name", {
      modId: "m1",
      displayName: "Custom Display"
    });
  });

  it("calls uninstall managed mod command", async () => {
    const invoke = vi.fn().mockResolvedValue({ modId: "m1", trashedPath: "/trash/m1", issues: [] });
    const api = createBackendApi(invoke);

    const res = await api.uninstallManagedMod("m1", "inst-1");

    expect(res.trashedPath).toBe("/trash/m1");
    expect(invoke).toHaveBeenCalledWith("uninstall_managed_mod", {
      modId: "m1",
      instanceId: "inst-1"
    });
  });

  it("normalizes open folder command failures", async () => {
    const invoke = vi.fn().mockRejectedValue({ code: "IO_ERROR", message: "xdg-open failed" });
    const api = createBackendApi(invoke);

    await expect(api.openManagedModsFolder()).rejects.toMatchObject({ code: "IO_ERROR" });
    await expect(api.openManagerFolder()).rejects.toMatchObject({ code: "IO_ERROR" });
  });

  it("calls trash list and restore commands", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce([{ name: "mod-1-123", path: "/trash/mod-1-123", originalPath: "/mods/mod-1", deletionDate: "2026-05-10T20:00:00" }])
      .mockResolvedValueOnce({ restoredPath: "/mods/mod-1" });
    const api = createBackendApi(invoke);

    await expect(api.listTrashEntries()).resolves.toEqual([
      { name: "mod-1-123", path: "/trash/mod-1-123", originalPath: "/mods/mod-1", deletionDate: "2026-05-10T20:00:00" }
    ]);
    await expect(api.restoreTrashedMod("mod-1-123", "inst-1")).resolves.toEqual({ restoredPath: "/mods/mod-1" });

    expect(invoke).toHaveBeenCalledWith("list_trash_entries");
    expect(invoke).toHaveBeenCalledWith("restore_trashed_mod", { trashName: "mod-1-123", instanceId: "inst-1" });
  });

  it("normalizes runtime diagnostics command failures", async () => {
    const invoke = vi.fn().mockRejectedValue({ code: "IO_ERROR", message: "diag failed" });
    const api = createBackendApi(invoke);

    await expect(api.runtimeDiagnostics()).rejects.toMatchObject({ code: "IO_ERROR", message: "diag failed" });
  });

  it("calls runtime diagnostics command", async () => {
    const invoke = vi.fn().mockResolvedValue({
      managedRoot: "/home/me/.local/share/sims4-mod-manager",
      managedModsDir: "/home/me/.local/share/sims4-mod-manager/mods",
      trashFilesDir: "/home/me/.local/share/Trash/files",
      waylandWorkaround: "1",
      waylandWorkaroundDisabled: false,
      appVersion: "0.1.0",
      buildTarget: "linux-x64"
    });
    const api = createBackendApi(invoke);

    await expect(api.runtimeDiagnostics()).resolves.toMatchObject({ managedModsDir: expect.stringContaining("mods") });
    expect(invoke).toHaveBeenCalledWith("runtime_diagnostics");
  });

  it("calls open folder commands", async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    const api = createBackendApi(invoke);

    await api.openManagedModsFolder();
    await api.openManagerFolder();

    expect(invoke).toHaveBeenCalledWith("open_managed_mods_folder");
    expect(invoke).toHaveBeenCalledWith("open_manager_folder");
  });

  it("calls import archive command", async () => {
    const invoke = vi.fn().mockResolvedValue({ modId: "m7" });
    const api = createBackendApi(invoke);

    const res = await api.importArchive("/tmp/a.zip", "A", "a");

    expect(res.modId).toBe("m7");
    expect(invoke).toHaveBeenCalledWith("import_archive", {
      archivePath: "/tmp/a.zip",
      name: "A",
      slug: "a"
    });
  });

  it("calls detect orphan symlinks command", async () => {
    const invoke = vi.fn().mockResolvedValue([{ path: "Mods/dead.package", target: "/x" }]);
    const api = createBackendApi(invoke);

    const res = await api.detectOrphanSymlinks("inst-1");

    expect(res).toHaveLength(1);
    expect(invoke).toHaveBeenCalledWith("detect_orphan_symlinks", { instanceId: "inst-1" });
  });
});
