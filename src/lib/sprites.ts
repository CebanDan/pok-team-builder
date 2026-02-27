import { normalizeName } from "@/lib/pokedex";

function toShowdownId(species: string): string {
  return normalizeName(species)
    .replace(/['.:%]/g, "")
    .replace(/♀/g, "-f")
    .replace(/♂/g, "-m")
    .replace(/[^a-z0-9-]/g, "");
}

export function getPokemonSpriteUrl(species: string): string {
  const id = toShowdownId(species);
  if (!id) return "/file.svg";
  return `https://play.pokemonshowdown.com/sprites/gen9/${id}.png`;
}

export function getPokemonSpriteFallbacks(species: string): string[] {
  const id = toShowdownId(species);
  if (!id) return ["/file.svg"];
  
  // Try multiple sprite sources, prioritized by likelihood of success
  // Use Showdown as primary - they have comprehensive sprite coverage
  const fallbacks = [
    // Showdown gen9 sprite (gen9 is latest/most complete)
    `https://play.pokemonshowdown.com/sprites/gen9/${id}.png`,
    // Showdown gen8 sprite
    `https://play.pokemonshowdown.com/sprites/gen8/${id}.png`,
    // Showdown gen7 sprite
    `https://play.pokemonshowdown.com/sprites/gen7/${id}.png`,
    // Showdown gen5 sprite
    `https://play.pokemonshowdown.com/sprites/gen5/${id}.png`,
    // Showdown gen4 sprite
    `https://play.pokemonshowdown.com/sprites/gen4/${id}.png`,
    // PokeAPI front default (fallback)
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
  ];
  
  return fallbacks;
}

export function getPokemonArtworkUrl(pokeapiId?: number, speciesName?: string): string {
  if (pokeapiId && pokeapiId > 0) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeapiId}.png`;
  }
  return getPokemonSpriteUrl(speciesName ?? "");
}
