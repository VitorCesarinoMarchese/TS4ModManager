import { describe, expect, it } from "vitest";
import { isRemotePreview, resolvePreviewSrc } from "./previewImage";

describe("previewImage", () => {
  it("keeps remote preview URLs unchanged", () => {
    expect(isRemotePreview("https://media.forgecdn.net/cover.png")).toBe(true);
    expect(resolvePreviewSrc("https://media.forgecdn.net/cover.png")).toBe("https://media.forgecdn.net/cover.png");
  });

  it("keeps relative preview paths unchanged outside Tauri", () => {
    expect(resolvePreviewSrc("Pack/cover.jpg")).toBe("Pack/cover.jpg");
  });

  it("keeps absolute local paths unchanged outside Tauri tests", () => {
    expect(resolvePreviewSrc("/home/user/The Sims 4/Mods/Pack/cover.jpg")).toBe("/home/user/The Sims 4/Mods/Pack/cover.jpg");
  });
});
