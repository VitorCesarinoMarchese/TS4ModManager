import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

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
    expect(screen.getByRole("option", { name: "Steam Instance 2" })).toHaveAttribute(
      "title",
      "/steam/path"
    );
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
