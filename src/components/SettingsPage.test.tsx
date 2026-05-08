import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_THEME } from "../lib/theme";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  it("renders friendly instance names and hides raw paths", () => {
    render(
      <SettingsPage
        instances={[
          { id: "n1", path: "/native/path", source: "native" },
          { id: "s1", path: "/steam/path", source: "steam" }
        ]}
        selectedInstanceId="s1"
        onSelectInstance={() => {}}
        onRescan={() => {}}
        onAddCustomPath={() => {}}
      />
    );

    expect(screen.getByText("Detected Game Paths")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Steam Instance 2")).toBeInTheDocument();
    expect(screen.queryByText("/steam/path")).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Steam Instance 2" })).toHaveAttribute(
      "title",
      "/steam/path"
    );
    expect(screen.getByRole("combobox", { name: "Active instance" })).toHaveClass("appearance-none");
  });

  it("fires rescan click", () => {
    const onRescan = vi.fn();
    render(
      <SettingsPage
        instances={[]}
        selectedInstanceId={null}
        onSelectInstance={() => {}}
        onRescan={onRescan}
        onAddCustomPath={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Rescan Mods" }));
    expect(onRescan).toHaveBeenCalledTimes(1);
  });

  it("edits, imports, exports, and resets themes", () => {
    const onThemeChange = vi.fn();
    render(
      <SettingsPage
        instances={[]}
        selectedInstanceId={null}
        onSelectInstance={() => {}}
        onRescan={() => {}}
        onAddCustomPath={() => {}}
        theme={DEFAULT_THEME}
        onThemeChange={onThemeChange}
        onThemeReset={() => onThemeChange(DEFAULT_THEME)}
      />
    );

    expect(screen.getByRole("group", { name: "theme-editor" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Accent color"), { target: { value: "#22c55e" } });
    expect(onThemeChange).toHaveBeenCalledWith({
      ...DEFAULT_THEME,
      colors: { ...DEFAULT_THEME.colors, accent: "#22c55e" }
    });

    const exported = screen.getByLabelText("Theme JSON export") as HTMLTextAreaElement;
    expect(exported.value).toContain('"accent": "#10b981"');

    const importedTheme = {
      ...DEFAULT_THEME,
      name: "Purple",
      colors: { ...DEFAULT_THEME.colors, accent: "#a855f7" }
    };
    fireEvent.change(screen.getByLabelText("Theme JSON import"), {
      target: { value: JSON.stringify(importedTheme) }
    });
    fireEvent.click(screen.getByRole("button", { name: "Import Theme" }));
    expect(onThemeChange).toHaveBeenCalledWith(importedTheme);

    fireEvent.change(screen.getByLabelText("Theme JSON import"), { target: { value: "bad json" } });
    fireEvent.click(screen.getByRole("button", { name: "Import Theme" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid theme JSON");

    fireEvent.click(screen.getByRole("button", { name: "Reset Theme" }));
    expect(onThemeChange).toHaveBeenCalledWith(DEFAULT_THEME);
  });

  it("submits custom path", () => {
    const onAddCustomPath = vi.fn();
    render(
      <SettingsPage
        instances={[]}
        selectedInstanceId={null}
        onSelectInstance={() => {}}
        onRescan={() => {}}
        onAddCustomPath={onAddCustomPath}
      />
    );

    fireEvent.change(screen.getByLabelText("Custom Sims 4 path"), {
      target: { value: "/games/sims4" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Custom Path" }));

    expect(onAddCustomPath).toHaveBeenCalledWith("/games/sims4");
  });
});
