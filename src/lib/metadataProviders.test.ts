import { describe, expect, it } from "vitest";
import {
  curseForgeProvider,
  getMetadataProviderForUrl,
  localNameProvider,
  modTheSimsProvider,
  metadataProviders
} from "./metadataProviders";

describe("metadata providers", () => {
  it("exposes stable provider ids", () => {
    expect(metadataProviders.map((provider) => provider.id)).toEqual([
      "local",
      "curseforge",
      "modthesims"
    ]);
  });

  it("selects CurseForge for CurseForge mod URLs", () => {
    expect(getMetadataProviderForUrl("https://www.curseforge.com/sims4/mods/mc-command-center")?.id).toBe(
      "curseforge"
    );
    expect(curseForgeProvider.canHandleUrl("https://curseforge.com/sims4/mods/foo")).toBe(true);
  });

  it("selects ModTheSims only for pasted ModTheSims URLs", () => {
    expect(getMetadataProviderForUrl("https://modthesims.info/d/123456/example-mod")?.id).toBe(
      "modthesims"
    );
    expect(modTheSimsProvider.canHandleUrl("https://www.modthesims.info/download.php?t=123456")).toBe(
      true
    );
  });

  it("ignores unsupported URLs and local provider does not claim URLs", () => {
    expect(getMetadataProviderForUrl("https://example.test/mod")).toBeNull();
    expect(getMetadataProviderForUrl("not a url")).toBeNull();
    expect(localNameProvider.canHandleUrl("https://curseforge.com/sims4/mods/foo")).toBe(false);
  });
});
