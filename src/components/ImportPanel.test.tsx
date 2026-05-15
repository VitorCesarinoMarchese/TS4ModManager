import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { archivePathFromBrowserDrop, archivePathFromTauriDrop, ImportPanel } from "./ImportPanel";

const tauriDropHandlers = vi.hoisted(() => [] as Array<(event: { payload: { type: string; paths?: string[] } }) => void>);
const tauriUnlisten = vi.hoisted(() => vi.fn());
const onDragDropEvent = vi.hoisted(() => vi.fn((handler: (event: { payload: { type: string; paths?: string[] } }) => void) => {
  tauriDropHandlers.push(handler);
  return Promise.resolve(tauriUnlisten);
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ onDragDropEvent })
}));

afterEach(() => {
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  tauriDropHandlers.length = 0;
  tauriUnlisten.mockClear();
  onDragDropEvent.mockClear();
});

describe("ImportPanel", () => {
  it("submits archive path and name", () => {
    const onImport = vi.fn();
    render(<ImportPanel onImport={onImport} />);

    expect(screen.getByLabelText("Drop archive here")).toHaveClass("!border-[var(--color-border)]");

    fireEvent.change(screen.getByLabelText("Archive path"), {
      target: { value: "/tmp/mod.zip" }
    });
    fireEvent.change(screen.getByLabelText("Mod name"), {
      target: { value: "MyMod" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Import Archive" }));

    expect(onImport).toHaveBeenCalledWith("/tmp/mod.zip", "MyMod", undefined);
  });

  it("extracts archive paths from Tauri drag drop payloads", () => {
    expect(archivePathFromTauriDrop({ type: "drop", paths: ["/tmp/tauri.zip"] })).toBe("/tmp/tauri.zip");
    expect(archivePathFromTauriDrop({ type: "over", paths: ["/tmp/ignore.zip"] })).toBeNull();
    expect(archivePathFromTauriDrop({ type: "drop", paths: [] })).toBeNull();
  });

  it("extracts browser drop paths", () => {
    expect(archivePathFromBrowserDrop([{ path: "/tmp/drop.zip", name: "drop.zip" } as File & { path: string }])).toBe("/tmp/drop.zip");
    expect(archivePathFromBrowserDrop([{ name: "fallback.zip" } as File])).toBe("fallback.zip");
    expect(archivePathFromBrowserDrop([])).toBeNull();
  });

  it("submits with a derived mod name when name is empty", () => {
    const onImport = vi.fn();
    render(<ImportPanel onImport={onImport} />);

    fireEvent.change(screen.getByLabelText("Archive path"), {
      target: { value: "/tmp/My Cool Mod.zip" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Import Archive" }));

    expect(onImport).toHaveBeenCalledWith("/tmp/My Cool Mod.zip", "My Cool Mod", undefined);
  });

  it("accepts dropped archive path", () => {
    const onImport = vi.fn();
    render(<ImportPanel onImport={onImport} />);

    fireEvent.change(screen.getByLabelText("Mod name"), {
      target: { value: "Dropped" }
    });
    fireEvent.drop(screen.getByLabelText("Drop archive here"), {
      dataTransfer: {
        files: [{ path: "/tmp/drop.zip" }]
      }
    });

    fireEvent.click(screen.getByRole("button", { name: "Import Archive" }));
    expect(onImport).toHaveBeenCalledWith("/tmp/drop.zip", "Dropped", undefined);
  });

  it("chooses an archive path from a native file picker", async () => {
    const onImport = vi.fn();
    const onChooseArchive = vi.fn().mockResolvedValue("/tmp/chosen-file.zip");
    render(<ImportPanel onImport={onImport} onChooseArchive={onChooseArchive} />);

    fireEvent.click(screen.getByRole("button", { name: "Choose Archive" }));
    await waitFor(() => expect(screen.getByLabelText("Archive path")).toHaveValue("/tmp/chosen-file.zip"));

    fireEvent.click(screen.getByRole("button", { name: "Import Archive" }));
    expect(onChooseArchive).toHaveBeenCalledTimes(1);
    expect(onImport).toHaveBeenCalledWith("/tmp/chosen-file.zip", "chosen-file", undefined);
  });

  it("listens for native Tauri window file-drop events", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: { metadata: { currentWindow: { label: "main" } } }
    });
    const onImport = vi.fn();
    render(<ImportPanel onImport={onImport} />);

    await waitFor(() => expect(onDragDropEvent).toHaveBeenCalledTimes(1));
    tauriDropHandlers[0]?.({ payload: { type: "drop", paths: ["/tmp/native-drop.zip"] } });
    await waitFor(() => expect(screen.getByLabelText("Archive path")).toHaveValue("/tmp/native-drop.zip"));

    fireEvent.click(screen.getByRole("button", { name: "Import Archive" }));
    expect(onImport).toHaveBeenCalledWith("/tmp/native-drop.zip", "native-drop", undefined);
  });
});
