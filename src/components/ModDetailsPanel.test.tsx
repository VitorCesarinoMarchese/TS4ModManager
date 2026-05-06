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
