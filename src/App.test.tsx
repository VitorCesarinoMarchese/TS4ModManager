import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { createAppStore } from "./store/appStore";

function makeApi(overrides: Record<string, unknown> = {}) {
  return {
    detectGameInstances: vi.fn().mockResolvedValue([
      {
        id: "inst-1",
        path: "/home/x/Documents/Electronic Arts/The Sims 4",
        source: "native"
      }
    ]),
    scanMods: vi.fn().mockResolvedValue([
      {
        id: "mod-1",
        name: "BuildPack",
        files: ["a.package"],
        enabled: false,
        source: "managed",
        groupPath: ["Build", "BuildPack"]
      }
    ]),
    detectOrphanSymlinks: vi.fn().mockResolvedValue([]),
    dryRunToggle: vi.fn().mockResolvedValue({
      canApply: true,
      operations: [{ action: "create_symlink", path: "a.package" }],
      issues: []
    }),
    applyToggle: vi.fn().mockResolvedValue({ applied: true, issues: [] }),
    migrateExternalMod: vi.fn().mockResolvedValue({ managedModId: "mod-1", issues: [] }),
    validateCustomInstance: vi.fn().mockResolvedValue({ id: "custom-1", path: "/x", source: "custom" }),
    importArchive: vi.fn().mockResolvedValue({ modId: "m1" }),
    ...overrides
  };
}

describe("App redesign", () => {
  it("renders top bar, sidebar, and mod grid", async () => {
    const api = makeApi();
    const store = createAppStore(api);
    render(<App store={store} />);

    expect(screen.getByText("Sims 4 Mod Manager")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText("game-instances-sidebar")).toBeInTheDocument();
      expect(screen.getByLabelText("mods-grid")).toBeInTheDocument();
      expect(screen.getByText("BuildPack")).toBeInTheDocument();
    });
  });

  it("opens and closes settings modal from top bar", () => {
    const api = makeApi();
    const store = createAppStore(api);
    render(<App store={store} />);

    fireEvent.click(screen.getByRole("button", { name: "open-settings" }));
    const modal = screen.getByRole("dialog", { name: "settings-modal" });
    expect(modal).toBeInTheDocument();
    expect(modal).not.toHaveClass("overflow-auto");
    expect(modal).toHaveClass("overflow-visible");

    fireEvent.click(screen.getByRole("button", { name: "close-settings" }));
    expect(screen.queryByRole("dialog", { name: "settings-modal" })).not.toBeInTheDocument();
  });

  it("toggles dark mode class on root element", async () => {
    const api = makeApi();
    const store = createAppStore(api);
    const { container } = render(<App store={store} />);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(container.querySelector(".app-shell")?.classList.contains("dark")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "toggle-theme" }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(container.querySelector(".app-shell")?.classList.contains("dark")).toBe(true);
  });

  it("opens mod details and can rename mod", async () => {
    const api = makeApi();
    const store = createAppStore(api);
    render(<App store={store} />);

    await waitFor(() => {
      expect(screen.getByText("BuildPack")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "details-mod-1" }));
    expect(screen.getByRole("dialog", { name: "mod-details" })).toBeInTheDocument();
    expect(screen.getByText("a.package")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("edit-mod-name"), {
      target: { value: "MyRenamedMod" }
    });
    fireEvent.click(screen.getByRole("button", { name: "save-mod-name" }));

    expect(screen.getAllByText("MyRenamedMod").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "close-mod-details" }));
    expect(screen.queryByRole("dialog", { name: "mod-details" })).not.toBeInTheDocument();
  });

  it("imports archive from settings modal", async () => {
    const api = makeApi();
    const store = createAppStore(api);
    render(<App store={store} />);

    await waitFor(() => {
      expect(screen.getByText("BuildPack")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "open-settings" }));
    fireEvent.change(screen.getByLabelText("Archive path"), {
      target: { value: "/tmp/mod.zip" }
    });
    fireEvent.change(screen.getByLabelText("Mod name"), {
      target: { value: "MyZip" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Import Archive" }));

    await waitFor(() => {
      expect(api.importArchive).toHaveBeenCalledWith("/tmp/mod.zip", "MyZip", undefined);
      expect(api.scanMods).toHaveBeenCalledWith("inst-1");
    });
  });
});
