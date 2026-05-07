import { describe, expect, it, vi } from "vitest";
import {
  createCurseForgeProvider,
  createModTheSimsProvider,
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

  it("CurseForge fetch skips network when API key is missing", async () => {
    const fetchFn = vi.fn();
    const provider = createCurseForgeProvider({ apiKey: undefined, fetchFn });

    const metadata = await provider.fetchMetadataFromUrl("https://www.curseforge.com/sims4/mods/example");

    expect(metadata).toEqual({ sourceUrl: "https://www.curseforge.com/sims4/mods/example" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("CurseForge fetch maps mocked API metadata", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            name: "Example Mod",
            summary: "Short description",
            logo: { url: "https://img.example/logo.png" },
            authors: [{ name: "Creator" }],
            latestFilesIndexes: [{ gameVersion: "1.2.3" }]
          }
        ]
      })
    });
    const provider = createCurseForgeProvider({ apiKey: "key", fetchFn });

    const metadata = await provider.fetchMetadataFromUrl("https://www.curseforge.com/sims4/mods/example");

    expect(metadata).toEqual({
      displayName: "Example Mod",
      description: "Short description",
      sourceUrl: "https://www.curseforge.com/sims4/mods/example",
      previewUrl: "https://img.example/logo.png",
      author: "Creator",
      version: "1.2.3"
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.curseforge.com/v1/mods/search?gameId=7806&slug=example",
      { headers: { "x-api-key": "key" } }
    );
  });

  it("ModTheSims fetch extracts metadata from pasted HTML URL", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html>
          <head>
            <meta property="og:description" content="Long mod description" />
            <meta property="og:image" content="https://static.modthesims.info/preview.jpg" />
          </head>
          <body>
            <h1>Example MTS Mod</h1>
            <a rel="author">MTS Creator</a>
            <span class="version">v2.0</span>
          </body>
        </html>
      `
    });
    const provider = createModTheSimsProvider({ fetchFn });

    const metadata = await provider.fetchMetadataFromUrl("https://modthesims.info/d/123456/example");

    expect(metadata).toEqual({
      displayName: "Example MTS Mod",
      description: "Long mod description",
      sourceUrl: "https://modthesims.info/d/123456/example",
      previewUrl: "https://static.modthesims.info/preview.jpg",
      author: "MTS Creator",
      version: "v2.0"
    });
    expect(fetchFn).toHaveBeenCalledWith("https://modthesims.info/d/123456/example");
  });

  it("ModTheSims fetch fails gracefully", async () => {
    const provider = createModTheSimsProvider({ fetchFn: vi.fn().mockRejectedValue(new Error("offline")) });

    await expect(provider.fetchMetadataFromUrl("https://modthesims.info/d/123456/example")).resolves.toEqual({
      sourceUrl: "https://modthesims.info/d/123456/example"
    });
  });

  it("ignores unsupported URLs and local provider does not claim URLs", () => {
    expect(getMetadataProviderForUrl("https://example.test/mod")).toBeNull();
    expect(getMetadataProviderForUrl("not a url")).toBeNull();
    expect(localNameProvider.canHandleUrl("https://curseforge.com/sims4/mods/foo")).toBe(false);
  });
});
