import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_THEME } from "../lib/theme";
import { SettingsPage } from "./SettingsPage";

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
    expect(screen.getByRole("option", { name: "Steam Instance 2" })).toHaveAttribute("title", "/steam/path");
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

  it("selects, creates, edits, imports, exports, and resets themes", async () => {
    const onSelectTheme = vi.fn();
    const onCreateTheme = vi.fn();
    const onThemeChange = vi.fn();
    const onThemeImport = vi.fn();
    const onThemeExport = vi.fn().mockResolvedValue(undefined);
    const onThemeReset = vi.fn();
    render(
      <SettingsPage
        instances={[]}
        selectedInstanceId={null}
        onSelectInstance={() => {}}
        onRescan={() => {}}
        onAddCustomPath={() => {}}
        activeThemeName="Purple"
        activeTheme={purpleTheme}
        customThemes={[purpleTheme]}
        onSelectTheme={onSelectTheme}
        onCreateTheme={onCreateTheme}
        onThemeChange={onThemeChange}
        onThemeImport={onThemeImport}
        onThemeExport={onThemeExport}
        onThemeReset={onThemeReset}
      />
    );

    expect(screen.getByRole("group", { name: "theme-editor" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Active theme" })).toHaveValue("Purple");
    fireEvent.change(screen.getByRole("combobox", { name: "Active theme" }), { target: { value: "Dark" } });
    expect(onSelectTheme).toHaveBeenCalledWith("Dark");

    fireEvent.click(screen.getByRole("button", { name: "Create Custom Theme" }));
    expect(onCreateTheme).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Accent color"), { target: { value: "#22c55e" } });
    expect(onThemeChange).toHaveBeenCalledWith({ ...purpleTheme, colors: { ...purpleTheme.colors, accent: "#22c55e" } });
    fireEvent.change(screen.getByLabelText("Background color"), { target: { value: "#020617" } });
    expect(onThemeChange).toHaveBeenCalledWith({ ...purpleTheme, colors: { ...purpleTheme.colors, background: "#020617" } });

    fireEvent.click(screen.getByRole("button", { name: "Export Theme" }));
    await waitFor(() => expect(onThemeExport).toHaveBeenCalledWith(purpleTheme));
    expect(screen.getByRole("status")).toHaveTextContent("Copied theme JSON");

    fireEvent.change(screen.getByLabelText("Theme JSON import"), { target: { value: JSON.stringify(purpleTheme) } });
    fireEvent.click(screen.getByRole("button", { name: "Import Theme" }));
    expect(onThemeImport).toHaveBeenCalledWith(purpleTheme);

    fireEvent.change(screen.getByLabelText("Theme JSON import"), { target: { value: "bad json" } });
    fireEvent.click(screen.getByRole("button", { name: "Import Theme" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid theme JSON");

    fireEvent.click(screen.getByRole("button", { name: "Reset Themes" }));
    expect(onThemeReset).toHaveBeenCalledTimes(1);
  });

  it("disables color editing for built-in themes", () => {
    render(
      <SettingsPage
        instances={[]}
        selectedInstanceId={null}
        onSelectInstance={() => {}}
        onRescan={() => {}}
        onAddCustomPath={() => {}}
        activeThemeName="Light"
        activeTheme={DEFAULT_THEME}
      />
    );

    expect(screen.getByText("Create or select a custom theme to edit colors.")).toBeInTheDocument();
    expect(screen.getByLabelText("Accent color")).toBeDisabled();
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
