import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IssuesPanel } from "./IssuesPanel";

describe("IssuesPanel", () => {
  it("renders persistent issues list", () => {
    render(
      <IssuesPanel
        issues={[
          { id: "1", severity: "warning", message: "Hash duplicate" },
          { id: "2", severity: "error", message: "Path collision", code: "PATH_COLLISION" }
        ]}
      />
    );

    expect(screen.getByText("Issues")).toBeInTheDocument();
    expect(screen.getByText("Hash duplicate")).toBeInTheDocument();
    expect(screen.getByText("Path collision")).toBeInTheDocument();
    expect(screen.getByText("PATH_COLLISION")).toBeInTheDocument();
  });

  it("shows clean empty state without emoji", () => {
    render(<IssuesPanel issues={[]} />);
    expect(screen.getByText("No issues detected")).toBeInTheDocument();
    expect(screen.queryByText(/✔/)).not.toBeInTheDocument();
  });
});
