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

export const CUSTOM_THEME_STORAGE_KEY = "ts4mm-custom-theme";

export const DEFAULT_THEME: AppTheme = {
  name: "Default",
  colors: {
    accent: "#10b981",
    background: "#f8fafc",
    surface: "#ffffff",
    text: "#020617",
    mutedText: "#64748b",
    border: "#cbd5e1"
  }
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isAppTheme(value: unknown): value is AppTheme {
  if (!isRecord(value) || typeof value.name !== "string" || !isRecord(value.colors)) return false;
  const colors = value.colors;
  return ["accent", "background", "surface", "text", "mutedText", "border"].every(
    (key) => typeof colors[key] === "string" && HEX_COLOR.test(colors[key])
  );
}

export function parseThemeJson(json: string): AppTheme | null {
  try {
    const parsed = JSON.parse(json) as unknown;
    return isAppTheme(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function serializeTheme(theme: AppTheme) {
  return JSON.stringify(theme, null, 2);
}

export function applyThemeVariables(theme: AppTheme, root: HTMLElement = document.documentElement) {
  root.style.setProperty("--color-accent", theme.colors.accent);
  root.style.setProperty("--color-background", theme.colors.background);
  root.style.setProperty("--color-surface", theme.colors.surface);
  root.style.setProperty("--color-text", theme.colors.text);
  root.style.setProperty("--color-muted-text", theme.colors.mutedText);
  root.style.setProperty("--color-border", theme.colors.border);
}
