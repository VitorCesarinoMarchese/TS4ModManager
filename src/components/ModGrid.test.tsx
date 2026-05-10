import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModGrid } from "./ModGrid";

function makeMods(count: number, prefix = "Mod") {
  return Array.from({ length: count }, (_, i) => ({
    id: `m${i + 1}`,
    name: `${prefix} ${String(i + 1).padStart(2, "0")}`,
    files: [`${prefix.toLowerCase()}-${i + 1}.package`],
    enabled: false,
    source: "managed" as const
  }));
}

describe("ModGrid pagination", () => {
  it("uses 24 mods as the default page size", () => {
    render(<ModGrid mods={makeMods(30)} search="" />);

    expect(screen.getByText("Mod 01")).toBeInTheDocument();
    expect(screen.getByText("Mod 24")).toBeInTheDocument();
    expect(screen.queryByText("Mod 25")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1–24 of 30 mods")).toBeInTheDocument();
  });

  it("allows switching page size to 12 and 48", () => {
    render(<ModGrid mods={makeMods(50)} search="" />);

    expect(screen.getByLabelText("Mods per page")).toHaveClass("appearance-none");
    expect(screen.getByLabelText("Mods per page")).toHaveClass("theme-control");
    expect(screen.getByLabelText("Mods per page")).toHaveClass("!bg-[var(--color-surface)]");
    expect(screen.getByLabelText("Mods per page")).toHaveStyle({ color: "var(--color-text)" });
    expect(screen.getByTestId("mods-page-size-caret")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Mods per page"), { target: { value: "12" } });
    expect(screen.getByText("Mod 12")).toBeInTheDocument();
    expect(screen.queryByText("Mod 13")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Mods per page"), { target: { value: "48" } });
    expect(screen.getByText("Mod 48")).toBeInTheDocument();
    expect(screen.queryByText("Mod 49")).not.toBeInTheDocument();
  });

  it("supports previous, next, and page number navigation", () => {
    render(<ModGrid mods={makeMods(50)} search="" />);

    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Mod 25")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveClass("border-accent", "bg-accent");

    fireEvent.click(screen.getByRole("button", { name: "Page 1" }));
    expect(screen.getByText("Mod 01")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Page 3" }));
    expect(screen.getByText("Mod 49")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("keeps current page when search still has that page", () => {
    const { rerender } = render(<ModGrid mods={makeMods(40)} search="" />);

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Mod 25")).toBeInTheDocument();

    rerender(<ModGrid mods={makeMods(40)} search="Mod" />);
    expect(screen.getByText("Mod 25")).toBeInTheDocument();
  });

  it("clamps current page when search makes it invalid", async () => {
    const mods = [...makeMods(30, "Keep"), ...makeMods(30, "Other")];
    const { rerender } = render(<ModGrid mods={mods} search="" />);

    fireEvent.click(screen.getByRole("button", { name: "Page 3" }));
    expect(screen.getByText("Other 19")).toBeInTheDocument();

    rerender(<ModGrid mods={mods} search="Keep" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
      expect(screen.getByText("Keep 25")).toBeInTheDocument();
    });
  });

  it("shows empty search state", () => {
    render(<ModGrid mods={makeMods(5)} search="zzz" />);

    expect(screen.getByText("No mods match your search.")).toBeInTheDocument();
  });

  it("uses filtered result count for pagination range", () => {
    const mods = [...makeMods(30, "Keep"), ...makeMods(30, "Other")];
    render(<ModGrid mods={mods} search="Keep" />);

    expect(screen.getByText("Showing 1–24 of 30 mods")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 2" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Page 3" })).not.toBeInTheDocument();
  });
});
