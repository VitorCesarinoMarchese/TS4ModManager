import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Toast } from "./Toast";

describe("Toast", () => {
  it("shows latest issue", () => {
    render(<Toast issue={{ id: "1", severity: "error", message: "Boom" }} />);
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });
});
