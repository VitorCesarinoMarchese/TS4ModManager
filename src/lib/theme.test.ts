import { describe, expect, it } from "vitest";
import {
  applyThemeVariables,
  createThemeCopy,
  DARK_THEME,
  DEFAULT_THEME,
  parseThemeJson,
  parseThemesJson,
  resolveTheme,
  serializeTheme,
  shouldUseDarkClass,
  upsertTheme
} from "./theme";

describe("theme helpers", () => {
  const purpleTheme = {
    name: "Purple",
    colors: {
      accent: "#a855f7",
      background: "#111827",
      surface: "#1f2937",
      text: "#f8fafc",
      mutedText: "#c4b5fd",
      border: "#6d28d9"
    }
  };

  it("serializes and parses a valid app theme", () => {
    expect(parseThemeJson(serializeTheme(purpleTheme))).toEqual(purpleTheme);
  });

  it("applies theme colors through CSS variables", () => {
    const root = document.createElement("div");
    applyThemeVariables(purpleTheme, root);

    expect(root.style.getPropertyValue("--color-accent")).toBe("#a855f7");
    expect(root.style.getPropertyValue("--color-background")).toBe("#111827");
    expect(root.style.getPropertyValue("--color-surface")).toBe("#1f2937");
    expect(root.style.getPropertyValue("--color-text")).toBe("#f8fafc");
    expect(root.style.getPropertyValue("--color-muted-text")).toBe("#c4b5fd");
    expect(root.style.getPropertyValue("--color-border")).toBe("#6d28d9");
  });

  it("rejects invalid imported theme JSON", () => {
    expect(parseThemeJson("not json")).toBeNull();
    expect(parseThemeJson(JSON.stringify({ name: "bad", colors: { accent: "green" } }))).toBeNull();
    expect(parseThemeJson(JSON.stringify({ ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors, accent: "#12345" } }))).toBeNull();
    expect(parseThemesJson("bad json")).toEqual([]);
    expect(parseThemesJson(JSON.stringify([purpleTheme, { name: "bad" }]))).toEqual([purpleTheme]);
  });

  it("creates and upserts named custom themes", () => {
    expect(createThemeCopy(DEFAULT_THEME, [])).toMatchObject({ name: "Custom Theme 1" });
    expect(createThemeCopy(DEFAULT_THEME, [{ ...DEFAULT_THEME, name: "Custom Theme 1" }])).toMatchObject({ name: "Custom Theme 2" });
    expect(upsertTheme([], purpleTheme)).toEqual([purpleTheme]);
    expect(upsertTheme([purpleTheme], { ...purpleTheme, colors: { ...purpleTheme.colors, accent: "#22c55e" } })[0].colors.accent).toBe("#22c55e");
  });

  it("resolves built-in, system, and custom themes", () => {
    expect(resolveTheme("Light", [], true)).toEqual(DEFAULT_THEME);
    expect(resolveTheme("Dark", [], false)).toEqual(DARK_THEME);
    expect(resolveTheme("System", [], true)).toEqual(DARK_THEME);
    expect(resolveTheme("Purple", [purpleTheme], false)).toEqual(purpleTheme);
    expect(shouldUseDarkClass("Dark", [], false)).toBe(true);
    expect(shouldUseDarkClass("System", [], true)).toBe(true);
    expect(shouldUseDarkClass("Purple", [purpleTheme], true)).toBe(false);
  });
});
