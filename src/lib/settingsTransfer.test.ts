import { describe, expect, it } from "vitest";
import { buildSettingsTransfer, parseSettingsTransfer } from "./settingsTransfer";
describe("local settings transfer", () => {
  it("omits secrets by default and maps selected instance ID to its root", () => {
    const result = buildSettingsTransfer({ activeThemeName: "Dark", instances: [{ id: "id", path: "/game", source: "custom" }], selectedInstanceId: "id", curseforgeApiKey: "test-only-local-key", includeApiKey: false });
    expect(result).toEqual({ version: 1, theme: "dark", gameRoots: ["/game"], selectedRoot: "/game" });
  });
  it("includes a key only by explicit request", () => {
    expect(buildSettingsTransfer({ activeThemeName: "System", instances: [], selectedInstanceId: null, curseforgeApiKey: "test-only-local-key", includeApiKey: true })).toEqual({ version: 1, theme: "system", gameRoots: [], curseforgeApiKey: "test-only-local-key" });
  });
  it("requires an explicit built-in fallback for a custom theme", () => {
    const args = { activeThemeName: "Custom", instances: [], selectedInstanceId: null, curseforgeApiKey: "", includeApiKey: false };
    expect(() => buildSettingsTransfer(args)).toThrow("Choose a built-in theme");
    expect(buildSettingsTransfer({ ...args, customThemeFallback: "light" }).theme).toBe("light");
  });
  it("accepts the version 1 format", () => {
    expect(parseSettingsTransfer('{"version":1,"theme":"system","gameRoots":["/game"],"selectedRoot":"/game"}')).toEqual({ version: 1, theme: "system", gameRoots: ["/game"], selectedRoot: "/game" });
  });
  it.each([
    'null', '{}', '{"version":2,"theme":"light","gameRoots":[]}',
    '{"version":1,"theme":"custom","gameRoots":[]}',
    '{"version":1,"theme":"dark","gameRoots":[" "]}',
    '{"version":1,"theme":"light","gameRoots":[],"selectedRoot":"/missing"}',
    '{"version":1,"theme":"light","gameRoots":[],"curseforgeApiKey":42}',
    '{"version":1,"theme":"light","gameRoots":[],"colors":{}}'
  ])("rejects invalid input without repeating it", (input) => { expect(() => parseSettingsTransfer(input)).toThrow(); });
});

it("writes settings to a local downloadable JSON file", async () => {
  const { downloadSettingsFile } = await import("./settingsTransfer");
  const { vi } = await import("vitest");
  let exportedBlob: Blob | undefined;
  const revoke = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: (blob: Blob) => { exportedBlob = blob; return "blob:local-settings"; }, revokeObjectURL: revoke });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe("ts4mm-settings.json");
    expect(this.href).toBe("blob:local-settings");
  });
  vi.useFakeTimers();
  try {
    downloadSettingsFile({ version: 1, theme: "dark", gameRoots: ["/game"] });
    expect(click).toHaveBeenCalledTimes(1);
    if (!exportedBlob) throw new Error("No exported file");
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith("blob:local-settings");
    vi.useRealTimers();
    const blob = exportedBlob;
    const read = new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob); });
    expect(JSON.parse(await read)).toEqual({ version: 1, theme: "dark", gameRoots: ["/game"] });
  } finally { vi.useRealTimers(); vi.unstubAllGlobals(); click.mockRestore(); }
});

it.each(["relative/game", "../game", "C:relative", "\\single-root"])("rejects relative game roots without echoing them", (root) => {
  const json = JSON.stringify({ version: 1, theme: "light", gameRoots: [root] });
  expect(() => parseSettingsTransfer(json)).toThrow("absolute path");
  try { parseSettingsTransfer(json); } catch (error) {
    expect(error instanceof Error && error.message.includes(root)).toBe(false);
  }
});
it.each(["/game", "C:\\Games\\Sims 4", "D:/Games/Sims 4", "\\\\server\\share\\Sims 4"])("accepts absolute game roots", (root) => {
  expect(parseSettingsTransfer(JSON.stringify({ version: 1, theme: "light", gameRoots: [root] })).gameRoots).toEqual([root]);
});
