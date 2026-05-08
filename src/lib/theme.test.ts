import { describe, expect, it } from "vitest";
import { applyThemeVariables, DEFAULT_THEME, parseThemeJson, serializeTheme } from "./theme";

describe("theme helpers", () => {
  it("serializes and parses a valid app theme", () => {
    const theme = {
      name: "Plumbob Night",
      colors: {
        accent: "#22c55e",
        background: "#0f172a",
        surface: "#111827",
        text: "#f8fafc",
        mutedText: "#cbd5e1",
        border: "#334155"
      }
    };

    expect(parseThemeJson(serializeTheme(theme))).toEqual(theme);
  });

  it("applies theme colors through CSS variables", () => {
    const root = document.createElement("div");
    applyThemeVariables(DEFAULT_THEME, root);

    expect(root.style.getPropertyValue("--color-accent")).toBe("#10b981");
    expect(root.style.getPropertyValue("--color-background")).toBe("#f8fafc");
    expect(root.style.getPropertyValue("--color-surface")).toBe("#ffffff");
    expect(root.style.getPropertyValue("--color-text")).toBe("#020617");
    expect(root.style.getPropertyValue("--color-muted-text")).toBe("#64748b");
    expect(root.style.getPropertyValue("--color-border")).toBe("#cbd5e1");
  });

  it("rejects invalid imported theme JSON", () => {
    expect(parseThemeJson("not json")).toBeNull();
    expect(parseThemeJson(JSON.stringify({ name: "bad", colors: { accent: "green" } }))).toBeNull();
    expect(parseThemeJson(JSON.stringify({ ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors, accent: "#12345" } }))).toBeNull();
  });
});
