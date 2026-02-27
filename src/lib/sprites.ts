import { normalizeName } from "@/lib/pokedex";

function toShowdownId(species: string): string {
  return normalizeName(species)
    .replace(/['.:%]/g, "")
    .replace(/♀/g, "-f")
    .replace(/♂/g, "-m")
    .replace(/[^a-z0-9-]/g, "");
}

function extractBaseId(fullId: string): string {
  // For forms like "aegislash-shield", extract just "aegislash"
  const parts = fullId.split("-");
  if (parts.length > 1) {
    // Common form indicators that map to the base Pokémon
    return parts[0];
  }
  return fullId;
}

export function getPokemonSpriteUrl(species: string): string {
  const id = toShowdownId(species);
  if (!id) return "/file.svg";
  return `https://play.pokemonshowdown.com/sprites/gen9/${id}.png`;
}

export function getPokemonSpriteFallbacks(species: string): string[] {
  const id = toShowdownId(species);
  if (!id) return ["/file.svg"];
  
  const baseId = extractBaseId(id);
  
  // Try multiple sprite sources, prioritized by likelihood of success
  // Use the form-specific ID first, then fall back to base Pokémon
  const fallbacks = [
    // Showdown gen9 sprite with form
    `https://play.pokemonshowdown.com/sprites/gen9/${id}.png`,
    // Showdown gen9 base sprite (if form doesn't exist)
    `https://play.pokemonshowdown.com/sprites/gen9/${baseId}.png`,
    // Showdown gen8 sprite with form
    `https://play.pokemonshowdown.com/sprites/gen8/${id}.png`,
    // Showdown gen8 base sprite
    `https://play.pokemonshowdown.com/sprites/gen8/${baseId}.png`,
    // Showdown gen7 sprite with form
    `https://play.pokemonshowdown.com/sprites/gen7/${id}.png`,
    // Showdown gen7 base sprite
    `https://play.pokemonshowdown.com/sprites/gen7/${baseId}.png`,
    // Showdown gen5 sprite with form
    `https://play.pokemonshowdown.com/sprites/gen5/${id}.png`,
    // Showdown gen5 base sprite
    `https://play.pokemonshowdown.com/sprites/gen5/${baseId}.png`,
    // PokeAPI front default with form (unlikely but try)
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
    // PokeAPI front default base
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${baseId}.png`,
  ];
  
  return fallbacks;
}

export function getPokemonArtworkUrl(pokeapiId?: number, speciesName?: string): string {
  if (pokeapiId && pokeapiId > 0) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeapiId}.png`;
  }
  return getPokemonSpriteUrl(speciesName ?? "");
}
