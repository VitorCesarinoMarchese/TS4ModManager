import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModDetailsPanel } from "./ModDetailsPanel";

const mod = {
  id: "m1",
  name: "MyMod",
  files: ["packages/a.package", "script.ts4script"],
  enabled: true,
  source: "managed" as const
};

describe("ModDetailsPanel", () => {
  it("renders mod details and file list", () => {
    render(<ModDetailsPanel mod={mod} onClose={() => {}} />);

    expect(screen.getByRole("dialog", { name: "mod-details" })).toHaveAttribute("data-animated", "true");
    expect(screen.getByText("MyMod")).toBeInTheDocument();
    expect(screen.getByText("2 files")).toBeInTheDocument();
    expect(screen.getByTitle("packages/a.package")).toHaveClass("truncate");
    expect(screen.getByTitle("packages/a.package")).toHaveClass("!border-[var(--color-border)]");
    expect(screen.getByRole("dialog", { name: "mod-details" })).toHaveClass("!border-[var(--color-border)]");
  });

  it("warns before removing source URL", () => {
    const onRemoveSourceUrl = vi.fn();
    render(
      <ModDetailsPanel
        mod={{ ...mod, sourceUrl: "https://modthesims.info/d/123456/example" }}
        onClose={() => {}}
        onRemoveSourceUrl={onRemoveSourceUrl}
      />
    );

    expect(screen.getByRole("button", { name: "close-mod-details" })).toHaveClass("hover:!border-red-500");
    expect(screen.getByRole("button", { name: "close-mod-details" })).not.toHaveClass("border-red-500");
    expect(screen.getByRole("button", { name: "remove-source-url" })).toHaveClass("hover:!border-red-500");
    expect(screen.getByRole("button", { name: "remove-source-url" })).not.toHaveClass("border-red-500");

    fireEvent.click(screen.getByRole("button", { name: "remove-source-url" }));
    expect(screen.getByRole("alertdialog", { name: "remove-source-warning" })).toBeInTheDocument();
    expect(onRemoveSourceUrl).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "cancel-remove-source" }));
    expect(screen.queryByRole("alertdialog", { name: "remove-source-warning" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "remove-source-url" }));
    fireEvent.click(screen.getByRole("button", { name: "confirm-remove-source" }));
    expect(onRemoveSourceUrl).toHaveBeenCalledWith("m1");
  });

  it("attaches source URL and opens browser fallback", () => {
    const onAttachSourceUrl = vi.fn();
    const onOpenSourceUrl = vi.fn();
    render(
      <ModDetailsPanel
        mod={{ ...mod, sourceUrl: "https://modthesims.info/d/123456/example" }}
        onClose={() => {}}
        onAttachSourceUrl={onAttachSourceUrl}
        onOpenSourceUrl={onOpenSourceUrl}
      />
    );

    expect(screen.getByText("Provider: ModTheSims")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("edit-source-url"), {
      target: { value: "https://www.curseforge.com/sims4/mods/example" }
    });
    fireEvent.click(screen.getByRole("button", { name: "save-source-url" }));
    expect(onAttachSourceUrl).toHaveBeenCalledWith(
      "m1",
      "https://www.curseforge.com/sims4/mods/example",
      "curseforge"
    );

    fireEvent.click(screen.getByRole("button", { name: "open-source-url" }));
    expect(onOpenSourceUrl).toHaveBeenCalledWith("https://modthesims.info/d/123456/example");
  });

  it("warns before uninstalling managed mod", () => {
    const onUninstall = vi.fn();
    render(<ModDetailsPanel mod={mod} onClose={() => {}} onUninstall={onUninstall} />);

    fireEvent.click(screen.getByRole("button", { name: "uninstall-mod" }));
    expect(screen.getByRole("alertdialog", { name: "uninstall-warning" })).toHaveTextContent("Move mod to trash?");
    expect(onUninstall).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "cancel-uninstall" }));
    expect(screen.queryByRole("alertdialog", { name: "uninstall-warning" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "uninstall-mod" }));
    fireEvent.click(screen.getByRole("button", { name: "confirm-uninstall" }));
    expect(onUninstall).toHaveBeenCalledWith("m1");
  });

  it("shows manage and uninstall for external installed mods", () => {
    const onManageExternal = vi.fn();
    render(<ModDetailsPanel mod={{ ...mod, source: "external" }} onClose={() => {}} onUninstall={() => {}} onManageExternal={onManageExternal} />);

    expect(screen.getByRole("button", { name: "uninstall-mod" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "manage-external-mod" }));
    expect(onManageExternal).toHaveBeenCalledWith("m1");
  });

  it("closes and saves renamed mod", () => {
    const onClose = vi.fn();
    const onRename = vi.fn();
    render(<ModDetailsPanel mod={mod} onClose={onClose} onRename={onRename} />);

    fireEvent.change(screen.getByLabelText("edit-mod-name"), {
      target: { value: "Renamed" }
    });
    fireEvent.click(screen.getByRole("button", { name: "save-mod-name" }));
    expect(onRename).toHaveBeenCalledWith("m1", "Renamed");

    fireEvent.click(screen.getByRole("button", { name: "close-mod-details" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
