import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool();
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
});

const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const SPECIES_LIMIT = Number.parseInt(process.env.SEED_SPECIES_LIMIT ?? "386", 10);
const MOVES_LIMIT = Number.parseInt(process.env.SEED_MOVES_LIMIT ?? "350", 10);
const ITEMS_LIMIT = Number.parseInt(process.env.SEED_ITEMS_LIMIT ?? "250", 10);
const ABILITIES_LIMIT = Number.parseInt(process.env.SEED_ABILITIES_LIMIT ?? "250", 10);
const REQUEST_CONCURRENCY = Number.parseInt(process.env.SEED_CONCURRENCY ?? "8", 10);

type NamedAPIResource = {
  name: string;
  url: string;
};

type ListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: NamedAPIResource[];
};

function toDisplay(name: string): string {
  return name
    .split("-")
    .map((segment) => (segment.length > 0 ? `${segment[0].toUpperCase()}${segment.slice(1)}` : segment))
    .join(" ");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string, retries = 3): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Request failed (${response.status}): ${url}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(500 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

async function withConcurrency<T>(
  entries: T[],
  worker: (entry: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, REQUEST_CONCURRENCY) }, async () => {
    while (cursor < entries.length) {
      const index = cursor;
      cursor += 1;
      await worker(entries[index], index);
    }
  });
  await Promise.all(runners);
}

async function seedTypes(): Promise<void> {
  console.info("Seeding type chart...");
  const typeList = await fetchJson<ListResponse>(`${POKEAPI_BASE}/type?limit=100`);
  const battleTypes = typeList.results.filter((entry) => entry.name !== "shadow" && entry.name !== "unknown");

  await withConcurrency(battleTypes, async (entry) => {
    const detail = await fetchJson<{
      name: string;
      damage_relations: {
        double_damage_from: NamedAPIResource[];
        double_damage_to: NamedAPIResource[];
        half_damage_from: NamedAPIResource[];
        half_damage_to: NamedAPIResource[];
        no_damage_from: NamedAPIResource[];
        no_damage_to: NamedAPIResource[];
      };
    }>(entry.url);

    await prisma.pokemonType.upsert({
      where: { id: detail.name },
      create: {
        id: detail.name,
        display: toDisplay(detail.name),
        relations: {
          doubleDamageFrom: detail.damage_relations.double_damage_from.map((value) => value.name),
          doubleDamageTo: detail.damage_relations.double_damage_to.map((value) => value.name),
          halfDamageFrom: detail.damage_relations.half_damage_from.map((value) => value.name),
          halfDamageTo: detail.damage_relations.half_damage_to.map((value) => value.name),
          noDamageFrom: detail.damage_relations.no_damage_from.map((value) => value.name),
          noDamageTo: detail.damage_relations.no_damage_to.map((value) => value.name),
        } satisfies Prisma.JsonObject,
      },
      update: {
        display: toDisplay(detail.name),
        relations: {
          doubleDamageFrom: detail.damage_relations.double_damage_from.map((value) => value.name),
          doubleDamageTo: detail.damage_relations.double_damage_to.map((value) => value.name),
          halfDamageFrom: detail.damage_relations.half_damage_from.map((value) => value.name),
          halfDamageTo: detail.damage_relations.half_damage_to.map((value) => value.name),
          noDamageFrom: detail.damage_relations.no_damage_from.map((value) => value.name),
          noDamageTo: detail.damage_relations.no_damage_to.map((value) => value.name),
        } satisfies Prisma.JsonObject,
      },
    });
  });
}

async function seedSpecies(): Promise<void> {
  console.info("Seeding species...");
  const speciesList = await fetchJson<ListResponse>(`${POKEAPI_BASE}/pokemon?limit=${SPECIES_LIMIT}`);
  await withConcurrency(speciesList.results, async (entry, index) => {
    const detail = await fetchJson<{
      id: number;
      name: string;
      types: { slot: number; type: NamedAPIResource }[];
      forms: NamedAPIResource[];
    }>(entry.url);

    await prisma.pokemonSpecies.upsert({
      where: { pokeapiId: detail.id },
      create: {
        pokeapiId: detail.id,
        name: detail.name,
        display: toDisplay(detail.name),
        types: detail.types.sort((a, b) => a.slot - b.slot).map((value) => value.type.name),
        forms: detail.forms.map((form) => form.name),
      },
      update: {
        name: detail.name,
        display: toDisplay(detail.name),
        types: detail.types.sort((a, b) => a.slot - b.slot).map((value) => value.type.name),
        forms: detail.forms.map((form) => form.name),
      },
    });

    if ((index + 1) % 50 === 0) {
      console.info(`  Species seeded: ${index + 1}/${speciesList.results.length}`);
    }
  });
}

async function seedMoves(): Promise<void> {
  console.info("Seeding moves...");
  const moveList = await fetchJson<ListResponse>(`${POKEAPI_BASE}/move?limit=${MOVES_LIMIT}`);
  await withConcurrency(moveList.results, async (entry, index) => {
    const detail = await fetchJson<{
      id: number;
      name: string;
      type: NamedAPIResource;
      power: number | null;
      accuracy: number | null;
      pp: number | null;
      priority: number;
      damage_class: NamedAPIResource | null;
    }>(entry.url);

    await prisma.pokemonMove.upsert({
      where: { pokeapiId: detail.id },
      create: {
        pokeapiId: detail.id,
        name: detail.name,
        display: toDisplay(detail.name),
        type: detail.type.name,
        power: detail.power,
        accuracy: detail.accuracy,
        pp: detail.pp,
        priority: detail.priority,
        damageClass: detail.damage_class?.name ?? null,
      },
      update: {
        name: detail.name,
        display: toDisplay(detail.name),
        type: detail.type.name,
        power: detail.power,
        accuracy: detail.accuracy,
        pp: detail.pp,
        priority: detail.priority,
        damageClass: detail.damage_class?.name ?? null,
      },
    });

    if ((index + 1) % 100 === 0) {
      console.info(`  Moves seeded: ${index + 1}/${moveList.results.length}`);
    }
  });
}

async function seedItems(): Promise<void> {
  console.info("Seeding items...");
  const itemList = await fetchJson<ListResponse>(`${POKEAPI_BASE}/item?limit=${ITEMS_LIMIT}`);
  await withConcurrency(itemList.results, async (entry, index) => {
    const detail = await fetchJson<{ id: number; name: string }>(entry.url);
    await prisma.pokemonItem.upsert({
      where: { pokeapiId: detail.id },
      create: {
        pokeapiId: detail.id,
        name: detail.name,
        display: toDisplay(detail.name),
      },
      update: {
        name: detail.name,
        display: toDisplay(detail.name),
      },
    });

    if ((index + 1) % 100 === 0) {
      console.info(`  Items seeded: ${index + 1}/${itemList.results.length}`);
    }
  });
}

async function seedAbilities(): Promise<void> {
  console.info("Seeding abilities...");
  const abilityList = await fetchJson<ListResponse>(`${POKEAPI_BASE}/ability?limit=${ABILITIES_LIMIT}`);
  await withConcurrency(abilityList.results, async (entry, index) => {
    const detail = await fetchJson<{ id: number; name: string }>(entry.url);
    await prisma.pokemonAbility.upsert({
      where: { pokeapiId: detail.id },
      create: {
        pokeapiId: detail.id,
        name: detail.name,
        display: toDisplay(detail.name),
      },
      update: {
        name: detail.name,
        display: toDisplay(detail.name),
      },
    });

    if ((index + 1) % 100 === 0) {
      console.info(`  Abilities seeded: ${index + 1}/${abilityList.results.length}`);
    }
  });
}

async function main(): Promise<void> {
  console.info("Starting PokeAPI seed...");
  console.info(
    `Limits => species:${SPECIES_LIMIT}, moves:${MOVES_LIMIT}, items:${ITEMS_LIMIT}, abilities:${ABILITIES_LIMIT}, concurrency:${REQUEST_CONCURRENCY}`,
  );

  const [typeCount, speciesCount, moveCount, itemCount, abilityCount] = await Promise.all([
    prisma.pokemonType.count(),
    prisma.pokemonSpecies.count(),
    prisma.pokemonMove.count(),
    prisma.pokemonItem.count(),
    prisma.pokemonAbility.count(),
  ]);

  const hasEnoughSeedData =
    typeCount >= 18 &&
    speciesCount >= SPECIES_LIMIT &&
    moveCount >= MOVES_LIMIT &&
    itemCount >= ITEMS_LIMIT &&
    abilityCount >= ABILITIES_LIMIT;

  if (hasEnoughSeedData) {
    console.info("Seed data already present at requested limits. Skipping.");
    return;
  }

  await seedTypes();
  await seedSpecies();
  await seedMoves();
  await seedItems();
  await seedAbilities();

  console.info("Seed complete.");

  await prisma.$disconnect();
  await pool.end();
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
