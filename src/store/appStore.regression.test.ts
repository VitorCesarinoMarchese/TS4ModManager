import { describe, expect, it, vi } from "vitest";
import { createAppStore } from "./appStore";
import type { Mod } from "../lib/types";
const mod: Mod = { id: "m", name: "M", enabled: true, files: ["live.package"], source: "managed" };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
describe("catalog reconciliation", () => {
  it("refreshes scan facts after an applied toggle", async () => {
    const scanMods = vi.fn().mockResolvedValue([{ ...mod, enabled: false }]);
    const store = createAppStore({ scanMods });
    store.setState({ selectedInstanceId: "a", mods: [mod] });
    await store.getState().toggleMod(mod, false, "a");
    expect(scanMods).toHaveBeenCalledWith("a");
    expect(store.getState().mods[0].enabled).toBe(false);
  });
  it.each(["rename", "attach", "remove"])("preserves scan facts during %s metadata edit", async (operation) => {
    const response = { ...mod, name: "Edited", enabled: false, files: ["metadata.package"] };
    const store = createAppStore({ renameModDisplayName: async () => response, attachSourceUrl: async () => response, removeSourceUrl: async () => response });
    store.setState({ selectedInstanceId: "a", mods: [mod] });
    if (operation === "rename") await store.getState().renameModDisplayName("m", "Edited");
    if (operation === "attach") await store.getState().attachSourceUrl("m", "https://example.com");
    if (operation === "remove") await store.getState().removeSourceUrl("m");
    expect(store.getState().mods[0]).toMatchObject({ enabled: true, files: ["live.package"] });
  });
  it("keeps latest instance when an old scan completes last", async () => {
    const old = deferred<Mod[]>();
    const store = createAppStore({ scanMods: (id) => id === "a" ? old.promise : Promise.resolve([{ ...mod, id: "b" }]) });
    const pending = store.getState().selectInstanceAndScan("a");
    await store.getState().selectInstanceAndScan("b");
    old.resolve([mod]);
    await pending;
    expect(store.getState().selectedInstanceId).toBe("b");
    expect(store.getState().mods[0].id).toBe("b");
  });
  it("ignores metadata completion after navigating to another instance", async () => {
    const pending = deferred<Mod>();
    const store = createAppStore({ renameModDisplayName: () => pending.promise });
    store.setState({ selectedInstanceId: "a", mods: [mod] });
    const rename = store.getState().renameModDisplayName("m", "Edited");
    store.setState({ selectedInstanceId: "b", mods: [mod] });
    pending.resolve({ ...mod, name: "Edited" });
    expect(await rename).toBeNull();
    expect(store.getState().mods[0].name).toBe("M");
  });
  it("replaces orphan scan issues and preserves operation issues", async () => {
    const store = createAppStore({ detectOrphanSymlinks: vi.fn().mockResolvedValueOnce([{ path: "old", target: "missing" }]).mockResolvedValueOnce([]) });
    store.setState({ selectedInstanceId: "a" });
    await store.getState().rescanSelected();
    store.getState().addIssue({ id: "operation", severity: "warning", message: "Keep" });
    await store.getState().rescanSelected();
    expect(store.getState().issues.map((issue) => issue.id)).toEqual(["operation"]);
  });
  it("handles detection and toggle errors", async () => {
    const store = createAppStore({ detectGameInstances: async () => { throw new Error("detect failed"); }, dryRunToggle: async () => { throw new Error("toggle failed"); } });
    await expect(store.getState().loadInstances()).resolves.toBeUndefined();
    await expect(store.getState().toggleMod(mod, false, "a")).resolves.toMatchObject({ canApply: false });
    expect(store.getState().issues.map((issue) => issue.message)).toEqual(["detect failed", "toggle failed"]);
  });
});

it("validates every imported root before replacing instances", async () => {
  const store = createAppStore({ validateCustomInstance: async (path) => { if (path === "/bad") throw new Error("Invalid root"); return { id: `validated:${path}`, path, source: "custom" }; } });
  store.setState({ instances: [{ id: "old", path: "/old", source: "native" }], selectedInstanceId: "old", mods: [mod] });
  expect(await store.getState().replaceGameRoots(["/good", "/bad"], "/good")).toBe(false);
  expect(store.getState().instances.map((instance) => instance.id)).toEqual(["old"]);
  expect(store.getState().mods).toEqual([mod]);
  expect(await store.getState().replaceGameRoots(["/good"], "/good")).toBe(true);
  expect(store.getState().selectedInstanceId).toBe("validated:/good");
});

it("ignores metadata responses after leaving and returning to the same instance", async () => {
  const response = deferred<Mod>();
  const store = createAppStore({ renameModDisplayName: () => response.promise });
  store.setState({ selectedInstanceId: "a", mods: [mod] });
  const rename = store.getState().renameModDisplayName("m", "Old");
  store.getState().selectInstance("b");
  store.getState().selectInstance("a");
  store.setState({ mods: [mod] });
  response.resolve({ ...mod, name: "Old" });
  expect(await rename).toBeNull();
  expect(store.getState().mods[0].name).toBe("M");
});
it("keeps the latest metadata edit when an older response completes last", async () => {
  const old = deferred<Mod>();
  const store = createAppStore({ renameModDisplayName: () => old.promise, attachSourceUrl: async () => ({ ...mod, name: "Latest", sourceUrl: "https://example.com/real" }) });
  store.setState({ selectedInstanceId: "a", mods: [mod] });
  const rename = store.getState().renameModDisplayName("m", "Old");
  await store.getState().attachSourceUrl("m", "https://example.com/real");
  old.resolve({ ...mod, name: "Old" });
  expect(await rename).toBeNull();
  expect(store.getState().mods[0].name).toBe("Latest");
});
