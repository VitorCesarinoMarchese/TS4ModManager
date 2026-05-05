import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModCard } from "./ModCard";

describe("ModCard", () => {
  it("renders mod metadata and actions", () => {
    render(
      <ModCard
        mod={{ id: "m1", name: "MyMod", files: ["a.package"], enabled: false, source: "managed" }}
      />
    );

    expect(screen.getByLabelText("mod-card-m1")).toBeInTheDocument();
    expect(screen.getByTitle("MyMod")).toHaveClass("truncate");
    expect(screen.getByText("1 files")).toBeInTheDocument();
    expect(screen.getByText("No Preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "toggle-m1" })).toHaveTextContent("Enable");
    expect(screen.getByRole("button", { name: "details-m1" })).toBeInTheDocument();
  });

  it("fires callbacks from action buttons", () => {
    const onToggle = vi.fn();
    const onDetails = vi.fn();
    render(
      <ModCard
        mod={{ id: "m1", name: "MyMod", files: ["a.package"], enabled: false, source: "managed" }}
        onToggle={onToggle}
        onDetails={onDetails}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "toggle-m1" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle.mock.calls[0][0].id).toBe("m1");

    fireEvent.click(screen.getByRole("button", { name: "details-m1" }));
    expect(onDetails).toHaveBeenCalledTimes(1);
    expect(onDetails.mock.calls[0][0].id).toBe("m1");
  });
});
