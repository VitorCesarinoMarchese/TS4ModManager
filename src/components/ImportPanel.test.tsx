import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { archivePathFromBrowserDrop, archivePathFromTauriDrop, ImportPanel } from "./ImportPanel";

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
});
