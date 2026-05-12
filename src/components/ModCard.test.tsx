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

    const card = screen.getByLabelText("mod-card-m1");
    expect(card).toHaveAttribute("data-animated", "true");
    expect(card).toHaveClass("theme-surface");
    expect(card).toHaveClass("!border-[var(--color-border)]");
    expect(card).toHaveClass("!bg-[var(--color-surface)]");
    expect(card).not.toHaveClass("bg-white");
    expect(card).not.toHaveClass("dark:bg-slate-900");
    expect(card).toHaveClass("dark:hover:border-accent");
    expect(card).toHaveClass("dark:hover:shadow-accent/20");
    expect(card).not.toHaveClass("dark:hover:bg-slate-800/80");
    expect(card).not.toHaveClass("dark:hover:bg-slate-900");
    expect(screen.getByTitle("MyMod")).toHaveClass("truncate");
    expect(screen.getByText("1 files")).toBeInTheDocument();
    expect(screen.getByText("No Preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "toggle-m1" })).toHaveTextContent("Enable");
    expect(screen.getByRole("button", { name: "details-m1" })).toBeInTheDocument();
  });

  it("renders preview image and falls back when it fails", () => {
    render(
      <ModCard
        mod={{ id: "m1", name: "MyMod", files: ["a.package"], enabled: false, source: "managed", preview: "https://img.example/cover.png" }}
      />
    );

    const image = screen.getByRole("img", { name: "MyMod" });
    expect(image).toHaveAttribute("src", "https://img.example/cover.png");
    expect(image).toHaveAttribute("referrerPolicy", "no-referrer");

    fireEvent.error(image);
    expect(screen.getByText("No Preview")).toBeInTheDocument();
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
