import type { GameInstance } from "./types";
export type TransferTheme = "light" | "dark" | "system";
export type SettingsTransfer = {
  version: 1;
  theme: TransferTheme;
  gameRoots: string[];
  selectedRoot?: string;
  curseforgeApiKey?: string;
};
export function parseSettingsTransfer(json: string): SettingsTransfer {
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new Error("Choose a valid settings JSON file."); }
  if (typeof value !== "object" || value === null || !("version" in value) || value.version !== 1 || !("theme" in value) ||
      (value.theme !== "light" && value.theme !== "dark" && value.theme !== "system") || !("gameRoots" in value) || !Array.isArray(value.gameRoots)) {
    throw new Error("Settings must use version 1, a built-in theme, and a list of game roots.");
  }
  const allowed = new Set(["version", "theme", "gameRoots", "selectedRoot", "curseforgeApiKey"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error("This settings file contains unsupported fields.");
  const gameRoots: string[] = [];
  for (const root of value.gameRoots) {
    if (typeof root !== "string" || !root.trim() || root !== root.trim() || root.includes("\0")) throw new Error("Each game root must be a nonempty path.");
    const absolute = root.startsWith("/") || /^[A-Za-z]:[\\/]/.test(root) || /^\\\\[^\\]+\\[^\\]+/.test(root);
    if (!absolute) throw new Error("Each game root must use an absolute path.");
    if (!gameRoots.includes(root)) gameRoots.push(root);
  }
  const result: SettingsTransfer = { version: 1, theme: value.theme, gameRoots };
  if ("selectedRoot" in value) {
    if (typeof value.selectedRoot !== "string" || !gameRoots.includes(value.selectedRoot)) throw new Error("The selected root must appear in game roots.");
    result.selectedRoot = value.selectedRoot;
  }
  if ("curseforgeApiKey" in value) {
    if (typeof value.curseforgeApiKey !== "string") throw new Error("The API key field must be a string.");
    result.curseforgeApiKey = value.curseforgeApiKey;
  }
  return result;
}
export function buildSettingsTransfer({ activeThemeName, instances, selectedInstanceId, curseforgeApiKey, includeApiKey, customThemeFallback }: {
  activeThemeName: string; instances: GameInstance[]; selectedInstanceId: string | null; curseforgeApiKey: string;
  includeApiKey: boolean; customThemeFallback?: TransferTheme;
}): SettingsTransfer {
  const theme = activeThemeName === "Light" ? "light" : activeThemeName === "Dark" ? "dark" : activeThemeName === "System" ? "system" : customThemeFallback;
  if (!theme) throw new Error("Choose a built-in theme for this settings export. Export custom colors separately.");
  const result: SettingsTransfer = { version: 1, theme, gameRoots: [...new Set(instances.map((instance) => instance.path))] };
  const selectedRoot = instances.find((instance) => instance.id === selectedInstanceId)?.path;
  if (selectedRoot) result.selectedRoot = selectedRoot;
  if (includeApiKey) result.curseforgeApiKey = curseforgeApiKey;
  return result;
}
export function downloadSettingsFile(settings: SettingsTransfer): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "ts4mm-settings.json";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
