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
