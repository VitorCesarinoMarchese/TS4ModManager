import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { openExternalUrl } from "./lib/openUrl";
import { createAppStore } from "./store/appStore";

vi.mock("./lib/openUrl", () => ({
  openExternalUrl: vi.fn().mockResolvedValue(undefined)
}));

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
    renameModDisplayName: vi.fn().mockImplementation((modId: string, displayName: string) =>
      Promise.resolve({
        id: modId,
        name: displayName,
        files: ["a.package"],
        enabled: false,
        source: "managed"
      })
    ),
    attachSourceUrl: vi.fn().mockImplementation((modId: string, sourceUrl: string) =>
      Promise.resolve({
        id: modId,
        name: "MyMod",
        sourceUrl,
        files: ["a.package"],
        enabled: false,
        source: "managed"
      })
    ),
    removeSourceUrl: vi.fn().mockImplementation((modId: string) =>
      Promise.resolve({
        id: modId,
        name: "MyMod",
        files: ["a.package"],
        enabled: false,
        source: "managed"
      })
    ),
    ...overrides
  };
}

function mockClipboard() {
  Object.defineProperty(navigator, "clipboard", {
    writable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) }
  });
}

function mockLocalStorage() {
  let data: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    writable: true,
    value: {
      getItem: vi.fn((key: string) => data[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        data[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete data[key];
      }),
      clear: vi.fn(() => {
        data = {};
      })
    }
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function mockSystemTheme(prefersDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: prefersDark && query === "(prefers-color-scheme: dark)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
}

describe("App redesign", () => {
  beforeEach(() => {
    mockLocalStorage();
    mockClipboard();
    window.localStorage.clear();
    mockSystemTheme(false);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("hides sidebar by default for one instance and can expand it", async () => {
    const api = makeApi();
    const store = createAppStore(api);
    render(<App store={store} />);

    expect(screen.getByText("Sims 4 Mod Manager")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByLabelText("game-instances-sidebar")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "expand-game-instances" })).toBeInTheDocument();
      expect(screen.getByLabelText("mods-grid")).toBeInTheDocument();
      expect(screen.getByText("BuildPack")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "expand-game-instances" }));
    expect(screen.getByLabelText("game-instances-sidebar")).toBeInTheDocument();
    expect(window.localStorage.setItem).toHaveBeenCalledWith("ts4mm-sidebar-collapsed", "false");
  });

  it("shows sidebar by default for multiple instances and persists collapse", async () => {
    const api = makeApi({
      detectGameInstances: vi.fn().mockResolvedValue([
        { id: "inst-1", path: "/native", source: "native" },
        { id: "inst-2", path: "/steam", source: "steam" }
      ])
    });
    const store = createAppStore(api);
    render(<App store={store} />);

    await waitFor(() => {
      expect(screen.getByLabelText("game-instances-sidebar")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Steam Instance 2" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "collapse-game-instances" }));
    expect(screen.queryByLabelText("game-instances-sidebar")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "expand-game-instances" })).toBeInTheDocument();
    expect(window.localStorage.setItem).toHaveBeenCalledWith("ts4mm-sidebar-collapsed", "true");
  });

  it("uses persisted collapsed sidebar state", async () => {
    window.localStorage.setItem("ts4mm-sidebar-collapsed", "true");
    const api = makeApi({
      detectGameInstances: vi.fn().mockResolvedValue([
        { id: "inst-1", path: "/native", source: "native" },
        { id: "inst-2", path: "/steam", source: "steam" }
      ])
    });
    const store = createAppStore(api);
    render(<App store={store} />);

    await waitFor(() => {
      expect(screen.queryByLabelText("game-instances-sidebar")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "expand-game-instances" })).toBeInTheDocument();
    });
  });

  it("opens and closes settings modal from top bar", () => {
    const api = makeApi();
    const store = createAppStore(api);
    render(<App store={store} />);

    fireEvent.click(screen.getByRole("button", { name: "open-settings" }));
    const modal = screen.getByRole("dialog", { name: "settings-modal" });
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveAttribute("data-animated", "true");
    expect(modal).toHaveClass("max-h-[calc(100vh-2rem)]");
    expect(modal).toHaveClass("overflow-y-auto");
    expect(screen.getByRole("button", { name: "close-settings" })).toHaveClass("hover:border-red-500");
    expect(screen.getByRole("button", { name: "close-settings" })).not.toHaveClass("border-red-500");

    fireEvent.click(screen.getByRole("button", { name: "close-settings" }));
    expect(screen.queryByRole("dialog", { name: "settings-modal" })).not.toBeInTheDocument();
  });

  it("uses system dark theme from settings dropdown", () => {
    mockSystemTheme(true);
    const api = makeApi();
    const store = createAppStore(api);
    const { container } = render(<App store={store} />);

    fireEvent.click(screen.getByRole("button", { name: "open-settings" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Active theme" }));
    fireEvent.click(screen.getByRole("option", { name: "System" }));

    expect(screen.queryByRole("button", { name: "toggle-theme" })).not.toBeInTheDocument();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(container.querySelector(".app-shell")?.classList.contains("dark")).toBe(true);
  });

  it("uses stored theme preference over system theme", () => {
    window.localStorage.setItem("ts4mm-active-theme", "Light");
    mockSystemTheme(true);
    const api = makeApi();
    const store = createAppStore(api);
    const { container } = render(<App store={store} />);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(container.querySelector(".app-shell")?.classList.contains("dark")).toBe(false);
  });

  it("creates, persists, exports, and imports custom themes", async () => {
    const api = makeApi();
    const store = createAppStore(api);
    render(<App store={store} />);

    fireEvent.click(screen.getByRole("button", { name: "open-settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Custom Theme" }));
    expect(screen.getByLabelText("Theme name")).toHaveValue("Custom Theme 1");
    fireEvent.change(screen.getByLabelText("Theme name"), { target: { value: "Green Night" } });
    fireEvent.change(screen.getByLabelText("Accent color"), { target: { value: "#22c55e" } });
    fireEvent.change(screen.getByLabelText("Background color"), { target: { value: "#020617" } });

    expect(screen.getByRole("combobox", { name: "Active theme" })).toHaveTextContent("Green Night");
    expect(document.documentElement.style.getPropertyValue("--color-accent")).toBe("#22c55e");
    expect(document.documentElement.style.getPropertyValue("--color-background")).toBe("#020617");
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      "ts4mm-custom-themes",
      expect.stringContaining('"background":"#020617"')
    );

    fireEvent.click(screen.getByRole("button", { name: "Export Theme" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('"background": "#020617"')));

    const importedTheme = {
      name: "Imported",
      colors: {
        accent: "#a855f7",
        background: "#111827",
        surface: "#1f2937",
        text: "#f8fafc",
        mutedText: "#c4b5fd",
        border: "#6d28d9"
      }
    };
    fireEvent.change(screen.getByLabelText("Theme JSON import"), { target: { value: JSON.stringify(importedTheme) } });
    fireEvent.click(screen.getByRole("button", { name: "Import Theme" }));
    expect(document.documentElement.style.getPropertyValue("--color-border")).toBe("#6d28d9");
  });

  it("creates editable custom theme from dark without losing readable text", () => {
    const api = makeApi();
    const store = createAppStore(api);
    render(<App store={store} />);

    fireEvent.click(screen.getByRole("button", { name: "open-settings" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Active theme" }));
    fireEvent.click(screen.getByRole("option", { name: "Dark" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Custom Theme" }));

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.getPropertyValue("--color-background")).toBe("#15171c");
    expect(document.documentElement.style.getPropertyValue("--color-text")).toBe("#f8fafc");
  });

  it("resets only the active custom theme", () => {
    const existingTheme = {
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
    window.localStorage.setItem("ts4mm-active-theme", "Purple");
    window.localStorage.setItem("ts4mm-custom-themes", JSON.stringify([existingTheme]));
    const api = makeApi();
    const store = createAppStore(api);
    render(<App store={store} />);

    fireEvent.click(screen.getByRole("button", { name: "open-settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset Current Theme" }));

    expect(screen.getByRole("combobox", { name: "Active theme" })).toHaveTextContent("Purple");
    expect(document.documentElement.style.getPropertyValue("--color-accent")).toBe("#10b981");
    expect(window.localStorage.getItem("ts4mm-custom-themes")).toContain('"name":"Purple"');
  });

  it("asks before overwriting imported theme", () => {
    const existingTheme = {
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
    window.localStorage.setItem("ts4mm-custom-themes", JSON.stringify([existingTheme]));
    vi.mocked(window.confirm).mockReturnValue(false);
    const api = makeApi();
    const store = createAppStore(api);
    render(<App store={store} />);

    fireEvent.click(screen.getByRole("button", { name: "open-settings" }));
    fireEvent.change(screen.getByLabelText("Theme JSON import"), {
      target: { value: JSON.stringify({ ...existingTheme, colors: { ...existingTheme.colors, accent: "#22c55e" } }) }
    });
    fireEvent.click(screen.getByRole("button", { name: "Import Theme" }));

    expect(window.confirm).toHaveBeenCalledWith('Replace existing theme "Purple"?');
    expect(document.documentElement.style.getPropertyValue("--color-accent")).not.toBe("#22c55e");
  });

  it("shows loading overlay and disables rescan while scan is pending", async () => {
    const pendingScan = deferred<Awaited<ReturnType<ReturnType<typeof makeApi>["scanMods"]>>>();
    const api = makeApi({
      scanMods: vi
        .fn()
        .mockResolvedValueOnce([
          {
            id: "mod-1",
            name: "BuildPack",
            files: ["a.package"],
            enabled: false,
            source: "managed",
            groupPath: ["Build", "BuildPack"]
          }
        ])
        .mockReturnValueOnce(pendingScan.promise)
    });
    const store = createAppStore(api);
    render(<App store={store} />);

    await waitFor(() => {
      expect(screen.getByText("BuildPack")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Rescan" }));

    expect(screen.getByLabelText("mod-scan-loading")).toBeInTheDocument();
    expect(screen.getByText("Scanning mods...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rescan" })).toBeDisabled();
    expect(screen.getByTestId("rescan-icon")).toHaveClass("animate-spin");

    pendingScan.resolve([]);

    await waitFor(() => {
      expect(screen.queryByLabelText("mod-scan-loading")).not.toBeInTheDocument();
    });
  });

  it("clears scan loading state when scan fails", async () => {
    const api = makeApi({
      scanMods: vi
        .fn()
        .mockResolvedValueOnce([
          {
            id: "mod-1",
            name: "BuildPack",
            files: ["a.package"],
            enabled: false,
            source: "managed",
            groupPath: ["Build", "BuildPack"]
          }
        ])
        .mockRejectedValueOnce({ code: "IO_ERROR", message: "Scan failed" })
    });
    const store = createAppStore(api);
    render(<App store={store} />);

    await waitFor(() => {
      expect(screen.getByText("BuildPack")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Rescan" }));

    await waitFor(() => {
      expect(screen.queryByLabelText("mod-scan-loading")).not.toBeInTheDocument();
      expect(screen.getAllByText("Scan failed").length).toBeGreaterThan(0);
    });
  });

  it("shows popup warning when source URL save fails", async () => {
    const api = makeApi({
      attachSourceUrl: vi.fn().mockRejectedValue({
        code: "NOT_FOUND",
        message: "Metadata not found: /home/user/.local/share/sims4-mod-manager/mods/McCmdCenter_AllModules_2026_2_0/meta.json"
      })
    });
    const store = createAppStore(api);
    render(<App store={store} />);

    await waitFor(() => {
      expect(screen.getByText("BuildPack")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "details-mod-1" }));
    fireEvent.change(screen.getByLabelText("edit-source-url"), {
      target: { value: "https://www.curseforge.com/sims4/mods/mc-command-center" }
    });
    fireEvent.click(screen.getByRole("button", { name: "save-source-url" }));

    await waitFor(() => {
      expect(screen.getByRole("alertdialog", { name: "error-warning" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "dismiss-error-warning" })).toHaveClass("hover:border-red-500");
      expect(screen.getByRole("button", { name: "dismiss-error-warning" })).not.toHaveClass("border-red-500");
      expect(screen.getAllByText(/Metadata not found/).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "dismiss-error-warning" }));
    expect(screen.queryByRole("alertdialog", { name: "error-warning" })).not.toBeInTheDocument();
  });

  it("opens saved source URL through external opener", async () => {
    const api = makeApi({
      scanMods: vi.fn().mockResolvedValue([
        {
          id: "mod-1",
          name: "BuildPack",
          sourceUrl: "https://www.curseforge.com/sims4/mods/mc-command-center",
          files: ["a.package"],
          enabled: false,
          source: "managed",
          groupPath: ["Build", "BuildPack"]
        }
      ])
    });
    const store = createAppStore(api);
    render(<App store={store} />);

    await waitFor(() => {
      expect(screen.getByText("BuildPack")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "details-mod-1" }));
    fireEvent.click(screen.getByRole("button", { name: "open-source-url" }));

    expect(openExternalUrl).toHaveBeenCalledWith("https://www.curseforge.com/sims4/mods/mc-command-center");
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

    await waitFor(() => {
      expect(api.renameModDisplayName).toHaveBeenCalledWith("mod-1", "MyRenamedMod");
      expect(screen.getAllByText("MyRenamedMod").length).toBeGreaterThan(0);
    });

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
