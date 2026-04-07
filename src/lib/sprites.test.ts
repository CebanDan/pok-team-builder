import { describe, expect, it } from "vitest";

import { getPokemonSpriteFallbacks } from "@/lib/sprites";

describe("sprite aliases", () => {
  it("prefers rotom-wash sprite ids when species is rotom-w", () => {
    const sources = getPokemonSpriteFallbacks("Rotom-W");
    expect(sources[0]).toContain("/rotom-wash.");
    expect(sources.some((source) => source.includes("/rotom-w."))).toBe(true);
  });

  it("uses official artwork first when a pokeapi id is known", () => {
    const sources = getPokemonSpriteFallbacks("Rotom-W", 479);
    expect(sources[0]).toContain("/official-artwork/479.png");
  });
});
