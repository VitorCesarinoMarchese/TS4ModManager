export type ThemeMode = "light" | "dark" | "system";

export type AppTheme = {
  name: string;
  colors: {
    accent: string;
    background: string;
    surface: string;
    text: string;
    mutedText: string;
    border: string;
  };
};

export const THEME_MODE_STORAGE_KEY = "ts4mm-theme-mode";
export const ACTIVE_THEME_STORAGE_KEY = "ts4mm-active-theme";
export const CUSTOM_THEMES_STORAGE_KEY = "ts4mm-custom-themes";
export const LEGACY_THEME_STORAGE_KEY = "ts4mm-theme";
export const LEGACY_CUSTOM_THEME_STORAGE_KEY = "ts4mm-custom-theme";

export const LIGHT_THEME: AppTheme = {
  name: "Light",
  colors: {
    accent: "#10b981",
    background: "#f8fafc",
    surface: "#ffffff",
    text: "#020617",
    mutedText: "#64748b",
    border: "#cbd5e1"
  }
};

export const DARK_THEME: AppTheme = {
  name: "Dark",
  colors: {
    accent: "#10b981",
    background: "#15171c",
    surface: "#111827",
    text: "#f8fafc",
    mutedText: "#cbd5e1",
    border: "#334155"
  }
};

export const DEFAULT_THEME = LIGHT_THEME;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const COLOR_KEYS = ["accent", "background", "surface", "text", "mutedText", "border"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isAppTheme(value: unknown): value is AppTheme {
  if (!isRecord(value) || typeof value.name !== "string" || value.name.trim() === "" || !isRecord(value.colors)) return false;
  const colors = value.colors;
  return COLOR_KEYS.every((key) => typeof colors[key] === "string" && HEX_COLOR.test(colors[key]));
}

export function parseThemeJson(json: string): AppTheme | null {
  try {
    const parsed = JSON.parse(json) as unknown;
    return isAppTheme(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseThemesJson(json: string | null): AppTheme[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isAppTheme) : [];
  } catch {
    return [];
  }
}

export function serializeTheme(theme: AppTheme) {
  return JSON.stringify(theme, null, 2);
}

export function upsertTheme(themes: AppTheme[], theme: AppTheme) {
  const index = themes.findIndex((item) => item.name === theme.name);
  if (index === -1) return [...themes, theme];
  return themes.map((item, itemIndex) => (itemIndex === index ? theme : item));
}

export function createThemeCopy(baseTheme: AppTheme, existingThemes: AppTheme[]) {
  let index = existingThemes.length + 1;
  let name = `Custom Theme ${index}`;
  const existingNames = new Set(existingThemes.map((theme) => theme.name));
  while (existingNames.has(name)) {
    index += 1;
    name = `Custom Theme ${index}`;
  }
  return { ...baseTheme, name };
}

export function resolveTheme(activeThemeName: string, customThemes: AppTheme[], systemPrefersDark: boolean) {
  const custom = customThemes.find((theme) => theme.name === activeThemeName);
  if (custom) return custom;
  if (activeThemeName === "Dark") return DARK_THEME;
  if (activeThemeName === "System") return systemPrefersDark ? DARK_THEME : LIGHT_THEME;
  return LIGHT_THEME;
}

export function shouldUseDarkClass(activeThemeName: string, customThemes: AppTheme[], systemPrefersDark: boolean) {
  if (customThemes.some((theme) => theme.name === activeThemeName)) return false;
  return activeThemeName === "Dark" || (activeThemeName === "System" && systemPrefersDark);
}

export function applyThemeVariables(theme: AppTheme, root: HTMLElement = document.documentElement) {
  root.style.setProperty("--color-accent", theme.colors.accent);
  root.style.setProperty("--color-background", theme.colors.background);
  root.style.setProperty("--color-surface", theme.colors.surface);
  root.style.setProperty("--color-text", theme.colors.text);
  root.style.setProperty("--color-muted-text", theme.colors.mutedText);
  root.style.setProperty("--color-border", theme.colors.border);

  if (root === document.documentElement) {
    document.body.style.backgroundColor = theme.colors.background;
    document.body.style.color = theme.colors.text;
  }
}
