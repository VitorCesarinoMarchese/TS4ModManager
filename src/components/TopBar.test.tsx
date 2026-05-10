import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TopBar } from "./TopBar";

describe("TopBar", () => {
  it("renders title and settings button without theme toggle", () => {
    render(<TopBar />);
    expect(screen.getByText("Sims 4 Mod Manager")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "open-settings" })).toHaveClass("focus:ring-accent/40");
    expect(screen.queryByRole("button", { name: "toggle-theme" })).not.toBeInTheDocument();
  });

  it("fires onSettings when button clicked", () => {
    const onSettings = vi.fn();
    render(<TopBar onSettings={onSettings} />);

    fireEvent.click(screen.getByRole("button", { name: "open-settings" }));
    expect(onSettings).toHaveBeenCalledTimes(1);
  });
});
