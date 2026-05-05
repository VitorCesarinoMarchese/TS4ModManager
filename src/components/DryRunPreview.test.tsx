import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DryRunPreview } from "./DryRunPreview";

describe("DryRunPreview", () => {
  it("renders operations and reasons", () => {
    render(
      <DryRunPreview
        dryRun={{
          canApply: false,
          operations: [
            { action: "create_symlink", path: "a.package" },
            { action: "skip", path: "b.package", reason: "path collision" }
          ],
          issues: []
        }}
      />
    );

    expect(screen.getByText("Dry-Run Preview")).toBeInTheDocument();
    expect(screen.getByText("create_symlink")).toBeInTheDocument();
    expect(screen.getByText("b.package")).toBeInTheDocument();
    expect(screen.getByText("path collision")).toBeInTheDocument();
  });
});
