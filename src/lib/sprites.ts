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
  
  // Simplified fallback chain - just try different generations
  // This is more reliable than trying complex form extraction
  return [
    `https://play.pokemonshowdown.com/sprites/gen9/${id}.png`,
    `https://play.pokemonshowdown.com/sprites/gen8/${id}.png`,
    `https://play.pokemonshowdown.com/sprites/gen7/${id}.png`,
    `https://play.pokemonshowdown.com/sprites/gen6/${id}.png`,
    `https://play.pokemonshowdown.com/sprites/gen5/${id}.png`,
    `/file.svg`,
  ];
}

export function getPokemonArtworkUrl(pokeapiId?: number, speciesName?: string): string {
  if (pokeapiId && pokeapiId > 0) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeapiId}.png`;
  }
  return getPokemonSpriteUrl(speciesName ?? "");
}
