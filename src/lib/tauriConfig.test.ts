import { describe, expect, it } from "vitest";
import config from "../../src-tauri/tauri.conf.json";

describe("Tauri release config", () => {
  it("enables Linux AppImage and deb bundles", () => {
    expect(config.bundle.active).toBe(true);
    expect(config.bundle.targets).toEqual(["appimage", "deb"]);
  });

  it("declares Linux desktop metadata and icon", () => {
    expect(config.bundle.icon).toContain("icons/icon.png");
    expect(config.bundle.category).toBe("Utility");
    expect(config.bundle.shortDescription).toContain("Sims 4");
  });
});
