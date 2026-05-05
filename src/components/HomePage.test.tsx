import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomePage } from "./HomePage";

const mods = [
  {
    id: "1",
    name: "BetterBuild",
    files: ["a.package"],
    enabled: true,
    source: "managed" as const,
    groupPath: ["Build", "BetterBuild"]
  },
  {
    id: "2",
    name: "SkinPack",
    files: ["b.package"],
    enabled: false,
    source: "external" as const,
    groupPath: ["CAS", "SkinPack"]
  }
];

describe("HomePage", () => {
  it("renders mod cards", () => {
    render(<HomePage mods={mods} search="" />);

    expect(screen.getByLabelText("mods-grid")).toBeInTheDocument();
    expect(screen.getByText("BetterBuild")).toBeInTheDocument();
    expect(screen.getByText("SkinPack")).toBeInTheDocument();
    expect(screen.getByTitle("BetterBuild")).toHaveClass("truncate");
  });

  it("filters mods by search", () => {
    render(<HomePage mods={mods} search="skin" />);

    expect(screen.queryByText("BetterBuild")).not.toBeInTheDocument();
    expect(screen.getByText("SkinPack")).toBeInTheDocument();
  });

  it("shows external badge", () => {
    render(<HomePage mods={mods} search="" />);
    expect(screen.getByText("External")).toBeInTheDocument();
  });

  it("disables toggle button when mod blocked by dry-run", () => {
    render(<HomePage mods={mods} search="" toggleDisabledById={{ "2": true }} />);

    expect(screen.getByLabelText("toggle-2")).toBeDisabled();
    expect(screen.getByLabelText("toggle-1")).not.toBeDisabled();
  });
});
