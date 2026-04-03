import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { FORMAT_OPTIONS } from "@/lib/formats";
import { prisma } from "@/lib/prisma";
import { sanitizePokeApiDescription } from "@/lib/string-utils";
import { DEFAULT_TYPE_ENTRIES } from "@/lib/type-chart-fallback";

export const runtime = "nodejs";

type NamedResource = {
  name: string;
  url: string;
};

type ListResponse = {
  results: NamedResource[];
};

const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const FALLBACK_CACHE_TTL_MS = 1000 * 60 * 30;

type FallbackCache = {
  expiresAt: number;
  types: {
    name: string;
    display: string;
    relations: {
      doubleDamageFrom: string[];
      doubleDamageTo: string[];
      halfDamageFrom: string[];
      halfDamageTo: string[];
      noDamageFrom: string[];
      noDamageTo: string[];
    };
  }[];
  species: {
    name: string;
    display: string;
    types: string[];
    forms: string[];
    pokeapiId: number | undefined;
    sprite: string | undefined;
  }[];
  items: {
    name: string;
    display: string;
  }[];
  abilities: {
    name: string;
    display: string;
  }[];
};

let fallbackCache: FallbackCache | null = null;
let itemsCache: any[] | null = null;
let abilitiesCache: any[] | null = null;
let movesCache: any[] | null = null;

type MovePayload = {
  name: string;
  display: string;
  type: string;
  priority: number;
  power: number | null;
  // always supplied; previous code treated absence the same as null
  damageClass: string | null;
};

type ItemAttributeResponse = {
  items: NamedResource[];
};

type ItemDetailsResponse = {
  id: number;
  name: string;
  category?: { name: string };
  attributes?: { name: string }[];
  sprites?: { default?: string | null };
  effect_entries?: { effect?: string; short_effect?: string; language?: { name?: string } }[];
  flavor_text_entries?: { text?: string; language?: { name?: string } }[];
};

type ItemPayload = {
  name: string;
  display: string;
  category: string;
  description: string;
  shortDescription: string;
  sprite?: string;
};

const HELD_ITEM_ATTRIBUTES = new Set(["holdable", "holdable-active"]);
const HELD_ITEM_CATEGORY_ALLOWLIST = new Set([
  "all-mail",
  "bad-held-items",
  "choice",
  "effort-training",
  "held-items",
  "in-a-pinch",
  "jewels",
  "mega-stones",
  "memories",
  "plates",
  "scarves",
  "species-specific",
  "training",
  "type-enhancement",
  "type-protection",
  "z-crystals",
]);

function toDisplay(name: string): string {
  return name
    .split("-")
    .map((segment) => (segment.length ? `${segment[0].toUpperCase()}${segment.slice(1)}` : segment))
    .join(" ");
}

async function fetchWithTimeout<T>(url: string, timeoutMs = 30000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      console.error(`[FETCH] PokeAPI fetch failed: ${response.status} ${url}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(`[FETCH] PokeAPI fetch error for ${url}:`, error instanceof Error ? error.message : error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function mapWithConcurrency<T, U>(
  entries: T[],
  worker: (entry: T, index: number) => Promise<U>,
  concurrency = 20,
): Promise<U[]> {
  const results: U[] = new Array(entries.length);
  const queue = [...entries.entries()];
  const workerCount = Math.max(1, Math.min(concurrency, entries.length || 1));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) return;
        const [index, entry] = next;
        results[index] = await worker(entry, index);
      }
    }),
  );

  return results;
}

async function fallbackList(url: string) {
  console.log(`[FALLBACK-LIST] Fetching from: ${url}`);
  const list = await fetchWithTimeout<ListResponse>(url);
  if (!list) {
    console.error(`[FALLBACK-LIST] Failed to fetch from ${url}`);
    return [];
  }
  const mapped = list.results.map((entry) => ({
    name: entry.name,
    display: toDisplay(entry.name),
    url: entry.url,
  }));
  console.log(`[FALLBACK-LIST] Got ${mapped.length} results from ${url}`);
  return mapped;
}

function getIdFromPokeApiUrl(url: string): number | undefined {
  const match = url.match(/\/(\d+)\/?$/);
  if (!match) return undefined;
  return Number.parseInt(match[1], 10);
}

async function getFallbackData() {
  if (fallbackCache && fallbackCache.expiresAt > Date.now()) {
    return fallbackCache;
  }

  const [species, items, abilities] = await Promise.all([
    fallbackList(`${POKEAPI_BASE}/pokemon?limit=2000`),
    fallbackList(`${POKEAPI_BASE}/item?limit=1000`),
    fallbackList(`${POKEAPI_BASE}/ability?limit=300`),
  ]);

  const mappedSpecies = species.map((entry) => {
    const pokeapiId = getIdFromPokeApiUrl(entry.url);
    return {
      name: entry.name,
      display: entry.display,
      types: [],
      forms: [],
      pokeapiId,
      sprite: pokeapiId
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeapiId}.png`
        : undefined,
    };
  });

  fallbackCache = {
    expiresAt: Date.now() + FALLBACK_CACHE_TTL_MS,
    types: DEFAULT_TYPE_ENTRIES,
    species: mappedSpecies,
    items: items.map((entry) => ({
      name: entry.name,
      display: entry.display,
    })),
    abilities: abilities.map((entry) => ({
      name: entry.name,
      display: entry.display,
    })),
  };
  return fallbackCache;
}

async function getItemsData(dbItems: any[]): Promise<ItemPayload[]> {
  if (itemsCache) {
    console.log(`[ITEMS] Using ${itemsCache.length} items from in-memory cache`);
    return itemsCache as ItemPayload[];
  }

  // We intentionally rebuild the held-item dataset from PokeAPI so the modal includes
  // only actual holdable items (Gen 1-9) with category + description metadata.
  if (Array.isArray(dbItems) && dbItems.length > 0) {
    console.log(
      `[ITEMS] Database has ${dbItems.length} items, but fetching canonical held-item dataset from PokeAPI.`,
    );
  } else {
    console.log("[ITEMS] Database empty, fetching held-item dataset from PokeAPI...");
  }

  try {
    const [holdable, holdableActive, categoryPayloads] = await Promise.all([
      fetchWithTimeout<ItemAttributeResponse>(`${POKEAPI_BASE}/item-attribute/holdable`),
      fetchWithTimeout<ItemAttributeResponse>(`${POKEAPI_BASE}/item-attribute/holdable-active`),
      Promise.all(
        Array.from(HELD_ITEM_CATEGORY_ALLOWLIST).map(async (categoryName) => {
          const payload = await fetchWithTimeout<ItemAttributeResponse>(`${POKEAPI_BASE}/item-category/${categoryName}`);
          return {
            categoryName,
            items: payload?.items ?? [],
          };
        }),
      ),
    ]);

    const attributeResources = [
      ...(holdable?.items ?? []),
      ...(holdableActive?.items ?? []),
    ].map((entry) => ({ ...entry, sourceCategory: null as string | null }));

    const categoryResources = categoryPayloads.flatMap(({ categoryName, items }) =>
      items.map((entry) => ({
        ...entry,
        sourceCategory: categoryName,
      })),
    );

    const mergedResources = [...attributeResources, ...categoryResources];

    if (!mergedResources.length) {
      console.error("[ITEMS] Could not fetch held-item resources from PokeAPI.");
      if (!Array.isArray(dbItems) || !dbItems.length) return [];
      const dbFallback = dbItems.map((entry) => ({
        name: entry.name,
        display: entry.display,
        category: "held-items",
        description: "",
        shortDescription: "",
        sprite: entry.name
          ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${entry.name}.png`
          : undefined,
      })) satisfies ItemPayload[];
      itemsCache = dbFallback;
      return dbFallback;
    }

    const uniqueResources = Array.from(new Map(mergedResources.map((entry) => [entry.name, entry])).values());

    const detailedItems = await mapWithConcurrency(
      uniqueResources,
      async (entry): Promise<ItemPayload | null> => {
        const detail = await fetchWithTimeout<ItemDetailsResponse>(entry.url, 7000);
        if (!detail) return null;

        const categoryName = detail.category?.name ?? entry.sourceCategory ?? "held-items";
        const hasHoldableAttribute =
          detail.attributes?.some((attribute) => HELD_ITEM_ATTRIBUTES.has(attribute.name)) ?? false;
        const isAllowlistedCategory = HELD_ITEM_CATEGORY_ALLOWLIST.has(categoryName);
        if (!hasHoldableAttribute && !isAllowlistedCategory) return null;

        const englishEffect = detail.effect_entries?.find((effect) => effect.language?.name === "en");
        const englishFlavor = detail.flavor_text_entries?.find((flavor) => flavor.language?.name === "en");

        return {
          name: detail.name,
          display: toDisplay(detail.name),
          category: categoryName,
          description: sanitizePokeApiDescription(englishEffect?.effect || englishFlavor?.text),
          shortDescription: sanitizePokeApiDescription(englishEffect?.short_effect || englishFlavor?.text),
          sprite: detail.sprites?.default ?? undefined,
        };
      },
      25,
    );

    const result = detailedItems
      .filter((entry): entry is ItemPayload => Boolean(entry))
      .sort((left, right) => left.display.localeCompare(right.display));

    itemsCache = result;
    console.log(`[ITEMS] Loaded ${result.length} holdable items with metadata.`);
    return result;
  } catch (error) {
    console.error("[ITEMS] Failed to fetch held-item dataset:", error instanceof Error ? error.message : error);
    if (!Array.isArray(dbItems) || !dbItems.length) return [];
    return dbItems.map((entry) => ({
      name: entry.name,
      display: entry.display,
      category: "held-items",
      description: "",
      shortDescription: "",
      sprite: entry.name
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${entry.name}.png`
        : undefined,
    })) satisfies ItemPayload[];
  }
}

async function getAbilitiesData(dbAbilities: any[]): Promise<any[]> {
  // If database has abilities, use them
  if (Array.isArray(dbAbilities) && dbAbilities.length > 0) {
    console.log(`[ABILITIES] Using ${dbAbilities.length} abilities from database`);
    return dbAbilities;
  }
  
  // Check cache first
  if (abilitiesCache) {
    console.log(`[ABILITIES] Using ${abilitiesCache.length} abilities from in-memory cache`);
    return abilitiesCache;
  }
  
  // Fetch from PokeAPI
  console.log("[ABILITIES] Database empty, fetching from PokeAPI...");
  try {
    const response = await fetchWithTimeout<ListResponse>(`${POKEAPI_BASE}/ability?limit=300`);
    if (!response || !response.results) {
      console.error("[ABILITIES] PokeAPI returned no data");
      return [];
    }
    
    const result = response.results.map((entry) => ({
      name: entry.name,
      display: toDisplay(entry.name),
    }));
    
    abilitiesCache = result;
    console.log(`[ABILITIES] Successfully fetched and cached ${result.length} abilities from PokeAPI`);
    return result;
  } catch (error) {
    console.error("[ABILITIES] Failed to fetch from PokeAPI:", error instanceof Error ? error.message : error);
    return [];
  }
}

async function getMovesData(dbMoves: any[]): Promise<any[]> {
  async function hydrateMissingDamageClass(moves: MovePayload[]): Promise<MovePayload[]> {
    const ambiguousMoves = moves.filter((move) => move.power === null && !move.damageClass);
    if (!ambiguousMoves.length) return moves;

    console.log(`[MOVES] Hydrating damage class for ${ambiguousMoves.length} power-null moves...`);

    // Fetch in controlled batches to avoid hammering PokeAPI.
    const batchSize = 25;
    const damageClassByName = new Map<string, string | null>();

    for (let index = 0; index < ambiguousMoves.length; index += batchSize) {
      const batch = ambiguousMoves.slice(index, index + batchSize);
      const resolved = await Promise.all(
        batch.map(async (move) => {
          const detail = await fetchWithTimeout<{
            damage_class?: { name: string } | null;
          }>(`${POKEAPI_BASE}/move/${move.name}`, 5000);
          return {
            name: move.name,
            damageClass: detail?.damage_class?.name ?? null,
          };
        }),
      );

      for (const entry of resolved) {
        damageClassByName.set(entry.name, entry.damageClass);
      }
    }

    return moves.map((move) => {
      if (move.damageClass) return move;
      if (move.power !== null) return move;
      const hydratedDamageClass = damageClassByName.get(move.name);
      if (typeof hydratedDamageClass === "undefined") return move;
      return {
        ...move,
        damageClass: hydratedDamageClass,
      };
    });
  }

  // If database has moves, use them
  if (Array.isArray(dbMoves) && dbMoves.length > 0) {
    if (movesCache && movesCache.length === dbMoves.length) {
      console.log(`[MOVES] Using ${movesCache.length} moves from in-memory cache`);
      return movesCache;
    }

    const normalizedDbMoves = dbMoves.map((move) => ({
      name: move.name,
      display: move.display,
      type: move.type,
      priority: move.priority ?? 0,
      power: move.power ?? null,
      damageClass: move.damageClass ?? null,
    })) satisfies MovePayload[];

    const hydratedDbMoves = await hydrateMissingDamageClass(normalizedDbMoves);
    movesCache = hydratedDbMoves;
    console.log(`[MOVES] Using ${hydratedDbMoves.length} moves from database`);
    return hydratedDbMoves;
  }
  
  // Check cache first
  if (movesCache) {
    console.log(`[MOVES] Using ${movesCache.length} moves from in-memory cache`);
    return movesCache;
  }
  
  // Fetch from PokeAPI
  console.log("[MOVES] Database empty, fetching from PokeAPI...");
  try {
    const response = await fetchWithTimeout<ListResponse>(`${POKEAPI_BASE}/move?limit=1100`);
    if (!response || !response.results) {
      console.error("[MOVES] PokeAPI returned no data");
      return [];
    }
    
    // Fetch detailed move information in parallel (max 10 at a time to avoid overload)
    const moveDetails = await Promise.all(
      response.results.map(async (entry, index) => {
        try {
          // Rate limit: fetch in batches
          if (index % 10 === 0) await new Promise(r => setTimeout(r, 100));
          
          const detail = await fetchWithTimeout<{
            power: number | null;
            type: { name: string };
            priority: number;
            damage_class?: { name: string } | null;
          }>(entry.url, 5000); // 5 second timeout per move
          
          return {
            name: entry.name,
            display: toDisplay(entry.name),
            type: detail?.type?.name ?? "unknown",
            priority: detail?.priority ?? 0,
            power: detail?.power ?? null,
            damageClass: detail?.damage_class?.name ?? null,
          };
        } catch {
          // Fallback if individual move fetch fails
          return {
            name: entry.name,
            display: toDisplay(entry.name),
            type: "unknown",
            priority: 0,
            power: null,
            damageClass: null,
          };
        }
      })
    );
    
    const hydratedMoves = await hydrateMissingDamageClass(moveDetails);
    movesCache = hydratedMoves;
    console.log(`[MOVES] Successfully fetched and cached ${hydratedMoves.length} moves from PokeAPI with details`);
    return hydratedMoves;
  } catch (error) {
    console.error("[MOVES] Failed to fetch from PokeAPI:", error instanceof Error ? error.message : error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  let types: any[] = [];
  let species: any[] = [];
  let moves: any[] = [];
  let items: any[] = [];
  let abilities: any[] = [];

  try {
    const results = await Promise.all([
      prisma.pokemonType.findMany({
        orderBy: { id: "asc" },
        select: { id: true, display: true, relations: true },
      }),
      prisma.pokemonSpecies.findMany({
        orderBy: { name: "asc" },
        select: { pokeapiId: true, name: true, display: true, types: true, forms: true },
      }),
      prisma.pokemonMove.findMany({
        orderBy: { name: "asc" },
        select: { name: true, display: true, type: true, priority: true, power: true, damageClass: true },
      }),
      prisma.pokemonItem.findMany({
        orderBy: { name: "asc" },
        select: { name: true, display: true },
      }),
      prisma.pokemonAbility.findMany({
        orderBy: { name: "asc" },
        select: { name: true, display: true },
      }),
    ]);
    types = results[0];
    species = results[1];
    moves = results[2];
    items = results[3];
    abilities = results[4];
  } catch (error) {
    console.error("[BOOTSTRAP] Database connection failed, using fallback:", error instanceof Error ? error.message : error);
  }

  console.log(`Bootstrap query results - Types: ${types.length}, Species: ${species.length}, Moves: ${moves.length}, Items: ${items.length}, Abilities: ${abilities.length}`);

  let fallbackData: FallbackCache | null = null;
  if (!types.length || !species.length) {
    fallbackData = await getFallbackData();
  }

  const responseTypes = types.length
    ? types.map((typeEntry) => ({
        name: typeEntry.id,
        display: typeEntry.display,
        relations: typeEntry.relations,
      }))
    : (fallbackData?.types.length ? fallbackData.types : DEFAULT_TYPE_ENTRIES);

  const responseSpecies = species.length
    ? species.map((entry) => ({
        ...entry,
        sprite:
          typeof entry.pokeapiId === "number"
            ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${entry.pokeapiId}.png`
            : undefined,
      }))
    : (fallbackData?.species ?? []);

  const responseMoves = await getMovesData(moves);

  // Always fetch items and abilities from fallback if not in database
  const [responseItems, responseAbilities] = await Promise.all([
    getItemsData(items),
    getAbilitiesData(abilities),
  ]);

  console.log(`[BOOTSTRAP] Final response - Items: ${responseItems.length}, Abilities: ${responseAbilities.length}`);

  const response = {
    formats: FORMAT_OPTIONS,
    types: responseTypes,
    species: responseSpecies,
    moves: responseMoves,
    items: responseItems,
    abilities: responseAbilities,
  };

  console.log(`[BOOTSTRAP] Final response - Moves: ${responseMoves.length}, Items: ${responseItems.length}, Abilities: ${responseAbilities.length}`);
  
  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
