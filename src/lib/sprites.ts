import { normalizeName } from "@/lib/pokedex";

type PokeApiListResponse = {
  results: {
    name: string;
    url: string;
  }[];
};

const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const POKEAPI_LIMIT = 2000;
const FALLBACK_SVG = "/file.svg";

let pokeApiIdLookupPromise: Promise<Map<string, number>> | null = null;

const SHOWDOWN_SPECIES_ALIASES: Record<string, string[]> = {
  "garchomp-mega-z": ["garchomp-mega", "garchomp"],
};

function toShowdownIdCandidates(species: string): string[] {
  const normalized = normalizeName(species)
    .replace(/\u2640/g, "f")
    .replace(/\u2642/g, "m");

  const hyphenated = normalized
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const compact = hyphenated.replace(/-/g, "");
  return dedupeSources([hyphenated, compact]);
}

function getIdFromPokeApiUrl(url: string): number | undefined {
  const match = url.match(/\/(\d+)\/?$/);
  if (!match) return undefined;
  const parsed = Number.parseInt(match[1], 10);
  return parsed > 0 ? parsed : undefined;
}

function dedupeSources(sources: string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    const value = source.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

function getShowdownSpriteSources(showdownId: string): string[] {
  if (!showdownId) return [];
  return [
    `https://play.pokemonshowdown.com/sprites/gen9/${showdownId}.png`,
    `https://play.pokemonshowdown.com/sprites/gen8/${showdownId}.png`,
    `https://play.pokemonshowdown.com/sprites/gen7/${showdownId}.png`,
    `https://play.pokemonshowdown.com/sprites/gen6/${showdownId}.png`,
    `https://play.pokemonshowdown.com/sprites/gen5/${showdownId}.png`,
    `https://play.pokemonshowdown.com/sprites/bw/${showdownId}.png`,
    `https://play.pokemonshowdown.com/sprites/ani/${showdownId}.gif`,
  ];
}

function getPokeApiSpriteSources(pokeapiId: number): string[] {
  return [
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeapiId}.png`,
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${pokeapiId}.png`,
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokeapiId}.png`,
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${pokeapiId}.gif`,
  ];
}

async function getPokeApiIdLookup(): Promise<Map<string, number>> {
  if (!pokeApiIdLookupPromise) {
    pokeApiIdLookupPromise = fetch(`${POKEAPI_BASE}/pokemon?limit=${POKEAPI_LIMIT}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch species list (${response.status})`);
        }
        const payload = (await response.json()) as PokeApiListResponse;
        const lookup = new Map<string, number>();
        for (const entry of payload.results) {
          const pokeapiId = getIdFromPokeApiUrl(entry.url);
          if (!pokeapiId) continue;
          const normalizedName = normalizeName(entry.name);
          lookup.set(normalizedName, pokeapiId);
          for (const showdownId of toShowdownIdCandidates(entry.name)) {
            lookup.set(showdownId, pokeapiId);
          }
        }
        return lookup;
      })
      .catch((error) => {
        pokeApiIdLookupPromise = null;
        throw error;
      });
  }

  return pokeApiIdLookupPromise;
}

export async function resolvePokemonPokeApiId(species: string): Promise<number | undefined> {
  const normalized = normalizeName(species);
  const aliases = SHOWDOWN_SPECIES_ALIASES[normalized] ?? [];
  const lookupKeys = dedupeSources([
    normalized,
    ...toShowdownIdCandidates(species),
    ...aliases,
    ...aliases.flatMap((entry) => toShowdownIdCandidates(entry)),
  ]);
  if (!lookupKeys.length) return undefined;

  try {
    const lookup = await getPokeApiIdLookup();
    for (const key of lookupKeys) {
      const found = lookup.get(key);
      if (typeof found === "number") return found;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function getPokemonSpriteUrl(species: string, pokeapiId?: number): string {
  const sources = getPokemonSpriteFallbacks(species, pokeapiId);
  return sources[0] ?? FALLBACK_SVG;
}

export function getPokemonSpriteFallbacks(species: string, pokeapiId?: number): string[] {
  const normalized = normalizeName(species);
  const aliases = SHOWDOWN_SPECIES_ALIASES[normalized] ?? [];
  const showdownIds = dedupeSources([
    ...toShowdownIdCandidates(species),
    ...aliases.flatMap((entry) => toShowdownIdCandidates(entry)),
  ]);
  const validPokeApiId =
    typeof pokeapiId === "number" && Number.isInteger(pokeapiId) && pokeapiId > 0
      ? pokeapiId
      : undefined;

  return dedupeSources([
    ...(validPokeApiId ? getPokeApiSpriteSources(validPokeApiId) : []),
    ...showdownIds.flatMap((showdownId) => getShowdownSpriteSources(showdownId)),
    FALLBACK_SVG,
  ]);
}

export function getPokemonArtworkUrl(pokeapiId?: number, speciesName?: string): string {
  return getPokemonSpriteUrl(speciesName ?? "", pokeapiId);
}
