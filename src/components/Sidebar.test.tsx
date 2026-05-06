import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  it("shows friendly instance names and keeps path in tooltip", () => {
    const onSelect = vi.fn();
    render(
      <Sidebar
        instances={[
          { id: "i1", source: "steam", path: "/long/path/one" },
          { id: "i2", source: "custom", path: "/long/path/two" }
        ]}
        selectedInstanceId="i1"
        onSelectInstance={onSelect}
      />
    );

    expect(screen.getByText("Steam Instance 1")).toBeInTheDocument();
    expect(screen.getByText("Custom Instance 2")).toBeInTheDocument();
    expect(screen.queryByText("/long/path/one")).not.toBeInTheDocument();

    const selectedButton = screen.getByRole("button", { name: "Steam Instance 1" });
    expect(selectedButton).toHaveAttribute("title", "/long/path/one");
    expect(selectedButton).toHaveAttribute("aria-pressed", "true");
    expect(selectedButton).toHaveClass("border-accent");
    expect(selectedButton).toHaveClass("bg-accent/10");

    fireEvent.click(screen.getByRole("button", { name: "Custom Instance 2" }));
    expect(onSelect).toHaveBeenCalledWith("i2");
  });
});
