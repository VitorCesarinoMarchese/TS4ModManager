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

export const curseForgeProvider: MetadataProvider = {
  id: "curseforge",
  name: "CurseForge",
  canHandleUrl: (raw) => {
    const url = parseUrl(raw);
    if (!url) return false;
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return host === "curseforge.com" && url.pathname.toLowerCase().startsWith("/sims4/mods/");
  },
  fetchMetadataFromUrl: unsupportedFetch("CurseForge")
};

export const modTheSimsProvider: MetadataProvider = {
  id: "modthesims",
  name: "ModTheSims",
  canHandleUrl: (raw) => {
    const url = parseUrl(raw);
    if (!url) return false;
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const path = url.pathname.toLowerCase();
    return host === "modthesims.info" && (path.startsWith("/d/") || path === "/download.php");
  },
  fetchMetadataFromUrl: unsupportedFetch("ModTheSims")
};

export const metadataProviders: MetadataProvider[] = [
  localNameProvider,
  curseForgeProvider,
  modTheSimsProvider
];

export function getMetadataProviderForUrl(url: string): MetadataProvider | null {
  return metadataProviders.find((provider) => provider.canHandleUrl(url)) ?? null;
}
