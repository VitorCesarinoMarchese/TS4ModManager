export type MetadataProviderId = "local" | "curseforge" | "modthesims";

export type ResolvedModMetadata = {
  displayName?: string;
  description?: string;
  sourceUrl: string;
  previewUrl?: string;
  author?: string;
  version?: string;
};

export type MetadataProvider = {
  id: MetadataProviderId;
  name: string;
  canHandleUrl(url: string): boolean;
  fetchMetadataFromUrl(url: string): Promise<ResolvedModMetadata>;
};

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

type ProviderFetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  json?(): Promise<unknown>;
  text?(): Promise<string>;
}>;

type CurseForgeApiMod = {
  name?: string;
  summary?: string;
  logo?: { url?: string };
  authors?: Array<{ name?: string }>;
  latestFilesIndexes?: Array<{ gameVersion?: string }>;
};

function unsupportedFetch(providerName: string): (url: string) => Promise<ResolvedModMetadata> {
  return async (url) => ({
    sourceUrl: url,
    description: `${providerName} metadata fetch not implemented yet`
  });
}

export const localNameProvider: MetadataProvider = {
  id: "local",
  name: "Local names",
  canHandleUrl: () => false,
  fetchMetadataFromUrl: unsupportedFetch("Local")
};

function curseForgeSlug(raw: string): string | null {
  const url = parseUrl(raw);
  if (!url) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const modsIndex = parts.findIndex((part) => part.toLowerCase() === "mods");
  return modsIndex >= 0 ? parts[modsIndex + 1] ?? null : null;
}

export function createCurseForgeProvider({
  apiKey,
  fetchFn
}: {
  apiKey?: string;
  fetchFn?: ProviderFetch;
} = {}): MetadataProvider {
  return {
    id: "curseforge",
    name: "CurseForge",
    canHandleUrl: (raw) => {
      const url = parseUrl(raw);
      if (!url) return false;
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      return host === "curseforge.com" && url.pathname.toLowerCase().startsWith("/sims4/mods/");
    },
    async fetchMetadataFromUrl(sourceUrl) {
      const key = apiKey?.trim();
      const slug = curseForgeSlug(sourceUrl);
      const fetcher = fetchFn ?? (globalThis.fetch as ProviderFetch | undefined);
      if (!key || !slug || !fetcher) return { sourceUrl };

      const response = await fetcher(
        `https://api.curseforge.com/v1/mods/search?gameId=7806&slug=${encodeURIComponent(slug)}`,
        { headers: { "x-api-key": key } }
      );
      if (!response.ok) return { sourceUrl };

      const json = (await response.json?.()) as { data?: CurseForgeApiMod[] };
      const mod = json.data?.[0];
      if (!mod) return { sourceUrl };

      return {
        displayName: mod.name,
        description: mod.summary,
        sourceUrl,
        previewUrl: mod.logo?.url,
        author: mod.authors?.[0]?.name,
        version: mod.latestFilesIndexes?.[0]?.gameVersion
      };
    }
  };
}

const viteEnv = import.meta as unknown as { env?: { VITE_CURSEFORGE_API_KEY?: string } };

export const curseForgeProvider: MetadataProvider = createCurseForgeProvider({
  apiKey: viteEnv.env?.VITE_CURSEFORGE_API_KEY
});

function textContent(doc: Document, selector: string): string | undefined {
  return doc.querySelector(selector)?.textContent?.trim() || undefined;
}

function metaContent(doc: Document, selector: string): string | undefined {
  return doc.querySelector<HTMLMetaElement>(selector)?.content?.trim() || undefined;
}

export function createModTheSimsProvider({
  fetchFn
}: { fetchFn?: ProviderFetch } = {}): MetadataProvider {
  return {
    id: "modthesims",
    name: "ModTheSims",
    canHandleUrl: (raw) => {
      const url = parseUrl(raw);
      if (!url) return false;
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      const path = url.pathname.toLowerCase();
      return host === "modthesims.info" && (path.startsWith("/d/") || path === "/download.php");
    },
    async fetchMetadataFromUrl(sourceUrl) {
      try {
        const fetcher = fetchFn ?? (globalThis.fetch as ProviderFetch | undefined);
        if (!fetcher) return { sourceUrl };
        const response = await fetcher(sourceUrl);
        if (!response.ok || !response.text) return { sourceUrl };
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        return {
          displayName: textContent(doc, "h1") || metaContent(doc, 'meta[property="og:title"]'),
          description: metaContent(doc, 'meta[property="og:description"]'),
          sourceUrl,
          previewUrl: metaContent(doc, 'meta[property="og:image"]'),
          author: textContent(doc, '[rel="author"]') || textContent(doc, ".username"),
          version: textContent(doc, ".version")
        };
      } catch {
        return { sourceUrl };
      }
    }
  };
}

export const modTheSimsProvider: MetadataProvider = createModTheSimsProvider();

export const metadataProviders: MetadataProvider[] = [
  localNameProvider,
  curseForgeProvider,
  modTheSimsProvider
];

export function getMetadataProviderForUrl(url: string): MetadataProvider | null {
  return metadataProviders.find((provider) => provider.canHandleUrl(url)) ?? null;
}
