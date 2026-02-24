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
};

let fallbackCache: FallbackCache | null = null;

function toDisplay(name: string): string {
  return name
    .split("-")
    .map((segment) => (segment.length ? `${segment[0].toUpperCase()}${segment.slice(1)}` : segment))
    .join(" ");
}

async function fetchWithTimeout<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fallbackList(url: string) {
  const list = await fetchWithTimeout<ListResponse>(url);
  if (!list) return [];
  return list.results.map((entry) => ({
    name: entry.name,
    display: toDisplay(entry.name),
    url: entry.url,
  }));
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

  const species = await fallbackList(`${POKEAPI_BASE}/pokemon?limit=1302`);

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
  };
  return fallbackCache;
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const [types, species, moves, items, abilities] = await Promise.all([
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

  const responseMoves = moves.length
    ? moves
    : [];

  const responseItems = items.length ? items : [];
  const responseAbilities = abilities.length ? abilities : [];

  return NextResponse.json({
    formats: FORMAT_OPTIONS,
    types: responseTypes,
    species: responseSpecies,
    moves: responseMoves,
    items: responseItems,
    abilities: responseAbilities,
  });
}
