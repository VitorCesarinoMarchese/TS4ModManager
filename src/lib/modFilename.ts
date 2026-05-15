import type { Mod } from "./types";

export type ParsedModFilename = {
  author?: string;
  modName?: string;
};

export function parseModFilename(raw: string): ParsedModFilename {
  const stem = stripExtension(raw.split(/[\\/]/).filter(Boolean).at(-1) ?? raw).trim();
  if (!stem) return {};

  const bracketed = parseBracketedAuthor(stem);
  if (bracketed) return bracketed;

  const underscore = parseUnderscoreAuthor(stem);
  if (underscore) return underscore;

  return { modName: stem };
}

export function matchesModSearch(mod: Mod, rawQuery: string): boolean {
  const query = rawQuery.trim();
  if (!query) return true;

  const scoped = query.match(/^(author|mod):(.+)$/i);
  if (scoped) {
    const scope = scoped[1].toLowerCase();
    const value = normalizeSearch(scoped[2]);
    if (!value) return true;
    const parsedNames = parsedNamesForMod(mod);
    const haystacks = scope === "author" ? parsedNames.authors : parsedNames.modNames;
    return haystacks.some((item) => normalizeSearch(item).includes(value));
  }

  const flat = normalizeSearch(query);
  return [mod.name, ...mod.files].some((item) => normalizeSearch(item).includes(flat));
}

function parsedNamesForMod(mod: Mod): { authors: string[]; modNames: string[] } {
  const parsed = mod.files.map(parseModFilename);
  return {
    authors: parsed.flatMap((item) => item.author ? [item.author] : []),
    modNames: [mod.name, ...parsed.flatMap((item) => item.modName ? [item.modName] : [])]
  };
}

function parseBracketedAuthor(stem: string): ParsedModFilename | null {
  const match = stem.match(/^\[([^\]]+)]\s*(.+)$/);
  if (!match) return null;
  return { author: match[1].trim(), modName: match[2].trim() };
}

function parseUnderscoreAuthor(stem: string): ParsedModFilename | null {
  const index = stem.indexOf("_");
  if (index <= 0 || index === stem.length - 1) return null;
  const author = stem.slice(0, index).trim();
  const modName = stem.slice(index + 1).trim();
  return author && modName ? { author, modName } : null;
}

function stripExtension(value: string): string {
  return value.replace(/\.(package|ts4script|zip|rar|7z)$/i, "");
}

function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}
