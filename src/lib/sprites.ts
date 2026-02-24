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
  return `https://play.pokemonshowdown.com/sprites/gen5/${id}.png`;
}

export function getPokemonArtworkUrl(pokeapiId?: number, speciesName?: string): string {
  if (pokeapiId && pokeapiId > 0) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeapiId}.png`;
  }
  return getPokemonSpriteUrl(speciesName ?? "");
}
