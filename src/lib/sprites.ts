import { normalizeName } from "@/lib/pokedex";

function toShowdownId(species: string): string {
  return normalizeName(species)
    .replace(/['.:%]/g, "")
    .replace(/♀/g, "-f")
    .replace(/♂/g, "-m")
    .replace(/[^a-z0-9-]/g, "");
}

function getPokeapiSpeciesId(species: string): number | null {
  // This will be resolved from the database, but as a fallback we can estimate
  // For now, we'll rely on the ID passed from the database
  return null;
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
  // Start with more reliable/complete sources first
  const fallbacks = [
    // PokeAPI official artwork (highest quality, most reliable)
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id.split("-")[0]}.png`,
    // Showdown gen9 sprite
    `https://play.pokemonshowdown.com/sprites/gen9/${id}.png`,
    // Showdown gen8 sprite
    `https://play.pokemonshowdown.com/sprites/gen8/${id}.png`,
    // PokeAPI gen5 sprite
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id.split("-")[0]}.png`,
    // Showdown gen7 sprite
    `https://play.pokemonshowdown.com/sprites/gen7/${id}.png`,
    // Showdown gen5 sprite
    `https://play.pokemonshowdown.com/sprites/gen5/${id}.png`,
  ];
  
  return fallbacks;
}

export function getPokemonArtworkUrl(pokeapiId?: number, speciesName?: string): string {
  if (pokeapiId && pokeapiId > 0) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeapiId}.png`;
  }
  return getPokemonSpriteUrl(speciesName ?? "");
}
