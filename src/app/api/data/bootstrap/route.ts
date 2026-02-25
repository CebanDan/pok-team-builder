import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { FORMAT_OPTIONS } from "@/lib/formats";
import { prisma } from "@/lib/prisma";
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
    fallbackList(`${POKEAPI_BASE}/pokemon?limit=1302`),
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

async function getItemsData(dbItems: any[]): Promise<any[]> {
  // If database has items, use them
  if (Array.isArray(dbItems) && dbItems.length > 0) {
    console.log(`[ITEMS] Using ${dbItems.length} items from database`);
    return dbItems;
  }
  
  // Check cache first
  if (itemsCache) {
    console.log(`[ITEMS] Using ${itemsCache.length} items from in-memory cache`);
    return itemsCache;
  }
  
  // Fetch from PokeAPI
  console.log("[ITEMS] Database empty, fetching from PokeAPI...");
  try {
    const response = await fetchWithTimeout<ListResponse>(`${POKEAPI_BASE}/item?limit=1000`);
    if (!response || !response.results) {
      console.error("[ITEMS] PokeAPI returned no data");
      return [];
    }
    
    const result = response.results.map((entry) => ({
      name: entry.name,
      display: toDisplay(entry.name),
    }));
    
    itemsCache = result;
    console.log(`[ITEMS] Successfully fetched and cached ${result.length} items from PokeAPI`);
    return result;
  } catch (error) {
    console.error("[ITEMS] Failed to fetch from PokeAPI:", error instanceof Error ? error.message : error);
    return [];
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
  // If database has moves, use them
  if (Array.isArray(dbMoves) && dbMoves.length > 0) {
    console.log(`[MOVES] Using ${dbMoves.length} moves from database`);
    return dbMoves;
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
          }>(entry.url, 5000); // 5 second timeout per move
          
          return {
            name: entry.name,
            display: toDisplay(entry.name),
            type: detail?.type?.name ?? "unknown",
            priority: detail?.priority ?? 0,
            power: detail?.power ?? null,
          };
        } catch {
          // Fallback if individual move fetch fails
          return {
            name: entry.name,
            display: toDisplay(entry.name),
            type: "unknown",
            priority: 0,
            power: null,
          };
        }
      })
    );
    
    movesCache = moveDetails;
    console.log(`[MOVES] Successfully fetched and cached ${moveDetails.length} moves from PokeAPI with details`);
    return moveDetails;
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
        select: { name: true, display: true, type: true, priority: true, power: true },
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
