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
      files: ["a.package"],
      source: "curseforge"
    });
    const api = createBackendApi(invoke);

    const res = await api.attachSourceUrl(
      "m1",
      "https://www.curseforge.com/sims4/mods/example",
      "curseforge"
    );

    expect(res.sourceUrl).toBe("https://www.curseforge.com/sims4/mods/example");
    expect(invoke).toHaveBeenCalledWith("attach_source_url", {
      modId: "m1",
      sourceUrl: "https://www.curseforge.com/sims4/mods/example",
      providerId: "curseforge"
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
