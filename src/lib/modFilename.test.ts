import { describe, expect, it } from "vitest";
import { matchesModSearch, parseModFilename } from "./modFilename";
import type { Mod } from "./types";

describe("mod filename parsing", () => {
  it("parses underscore author and mod names", () => {
    expect(parseModFilename("Aurum_HairstyleF178_Serana.package")).toEqual({
      author: "Aurum",
      modName: "HairstyleF178_Serana"
    });
  });

  it("parses bracketed author names", () => {
    expect(parseModFilename("[Gabymelove Sims] Converse Platform High Tops (M) • CF Edition.package")).toEqual({
      author: "Gabymelove Sims",
      modName: "Converse Platform High Tops (M) • CF Edition"
    });
  });

  it("parses lowercase underscore author and mod names", () => {
    expect(parseModFilename("moonmoonsim_botanica_f_tattoo.package")).toEqual({
      author: "moonmoonsim",
      modName: "botanica_f_tattoo"
    });
  });

  it("matches author and mod scoped search filters", () => {
    const mod: Mod = {
      id: "m1",
      name: "Aurum HairstyleF178 Serana",
      files: ["Aurum_HairstyleF178_Serana.package"],
      enabled: false,
      source: "managed"
    };

    expect(matchesModSearch(mod, "author:Aurum")).toBe(true);
    expect(matchesModSearch(mod, "mod:Serana")).toBe(true);
    expect(matchesModSearch(mod, "author:moonmoonsim")).toBe(false);
  });
});
