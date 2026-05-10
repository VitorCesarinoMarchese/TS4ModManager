import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemedSelect } from "./ThemedSelect";

describe("ThemedSelect", () => {
  it("renders themed popup options and selects a value", () => {
    const onChange = vi.fn();
    render(
      <ThemedSelect
        label="Active theme"
        value="Dark"
        options={[
          { value: "Light", label: "Light" },
          { value: "Dark", label: "Dark" }
        ]}
        onChange={onChange}
      />
    );

    const combo = screen.getByRole("combobox", { name: "Active theme" });
    expect(combo).toHaveClass("theme-control", "!bg-[var(--color-surface)]", "!border-[var(--color-border)]");

    fireEvent.click(combo);
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveClass("theme-surface", "!bg-[var(--color-surface)]", "!border-[var(--color-border)]");

    fireEvent.click(screen.getByRole("option", { name: "Light" }));
    expect(onChange).toHaveBeenCalledWith("Light");
  });
});
