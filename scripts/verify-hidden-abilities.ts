import { mergeSpeciesAbilityOptions } from "../src/lib/ability-utils";
import { normalizeName, type AbilityEntry } from "../src/lib/pokedex";

const POKEAPI_BASE = "https://pokeapi.co/api/v2";

type PokemonListResponse = {
  results: { name: string }[];
};

type PokemonResponse = {
  name: string;
  abilities: { ability: { name: string }; is_hidden: boolean }[];
};

type RegressionExpectation = {
  species: string;
  hiddenAbility: string;
};

const REGRESSION_EXPECTATIONS: RegressionExpectation[] = [
  { species: "gliscor", hiddenAbility: "poison-heal" },
];

function parseFlag(flag: string): string | undefined {
  const index = process.argv.findIndex((token) => token === flag);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function parseSpeciesFilter(): string[] {
  const explicit = parseFlag("--species");
  if (!explicit) return [];
  return explicit
    .split(",")
    .map((entry) => normalizeName(entry))
    .filter(Boolean);
}

function parseLimit(): number | null {
  const raw = parseFlag("--limit");
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseConcurrency(): number {
  const raw = parseFlag("--concurrency");
  if (!raw) return 12;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return 12;
  return Math.min(40, parsed);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return (await response.json()) as T;
}

async function resolveSpeciesNames(): Promise<string[]> {
  const selected = parseSpeciesFilter();
  if (selected.length) return selected;

  const list = await fetchJson<PokemonListResponse>(`${POKEAPI_BASE}/pokemon?limit=2000`);
  let species = list.results.map((entry) => normalizeName(entry.name)).filter(Boolean);

  const limit = parseLimit();
  if (limit) species = species.slice(0, limit);
  return species;
}

async function withConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, values.length || 1)) }, async () => {
      while (cursor < values.length) {
        const current = cursor;
        cursor += 1;
        results[current] = await worker(values[current], current);
      }
    }),
  );

  return results;
}

async function main(): Promise<void> {
  const speciesNames = await resolveSpeciesNames();
  const concurrency = parseConcurrency();

  if (!speciesNames.length) {
    console.log("[HIDDEN-AUDIT] No species selected.");
    return;
  }

  console.log(`[HIDDEN-AUDIT] Auditing ${speciesNames.length} species with concurrency ${concurrency}...`);

  const mismatches: string[] = [];
  const regressionMismatches: string[] = [];
  const hiddenBySpecies = new Map<string, Set<string>>();

  await withConcurrency(speciesNames, concurrency, async (speciesName, index) => {
    try {
      const payload = await fetchJson<PokemonResponse>(`${POKEAPI_BASE}/pokemon/${speciesName}`);
      const speciesAbilities: AbilityEntry[] = payload.abilities.map((entry) => ({
        name: entry.ability.name,
        display: entry.ability.name
          .split("-")
          .map((part) => (part.length ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
          .join(" "),
        isHidden: entry.is_hidden,
      }));

      // Simulate the editor merge path where resolved ability metadata exists globally
      // but should never override per-species hidden flags.
      const resolvedMap = Object.fromEntries(
        speciesAbilities.map((ability) => [
          normalizeName(ability.name),
          {
            name: ability.name,
            display: ability.display,
            description: "cached",
            // Intentionally omit isHidden to model global cache entries.
          } satisfies AbilityEntry,
        ]),
      );

      const merged = mergeSpeciesAbilityOptions(speciesAbilities, resolvedMap);
      const canonicalHidden = new Set(
        payload.abilities
          .filter((entry) => entry.is_hidden)
          .map((entry) => normalizeName(entry.ability.name))
          .filter(Boolean),
      );
      hiddenBySpecies.set(normalizeName(payload.name), canonicalHidden);

      const mergedHidden = new Set(
        merged
          .filter((entry) => entry.isHidden)
          .map((entry) => normalizeName(entry.name))
          .filter(Boolean),
      );

      for (const abilityName of canonicalHidden) {
        if (!mergedHidden.has(abilityName)) {
          mismatches.push(`${speciesName}: hidden ability "${abilityName}" not marked hidden after merge.`);
        }
      }
      for (const abilityName of mergedHidden) {
        if (!canonicalHidden.has(abilityName)) {
          mismatches.push(`${speciesName}: ability "${abilityName}" marked hidden unexpectedly.`);
        }
      }

      if ((index + 1) % 100 === 0 || index === speciesNames.length - 1) {
        console.log(`[HIDDEN-AUDIT] Processed ${index + 1}/${speciesNames.length}`);
      }
    } catch (error) {
      mismatches.push(
        `${speciesName}: fetch failure (${error instanceof Error ? error.message : "unknown error"})`,
      );
    }
  });

  for (const expectation of REGRESSION_EXPECTATIONS) {
    const speciesId = normalizeName(expectation.species);
    if (!speciesNames.includes(speciesId)) continue;

    const hiddenSet = hiddenBySpecies.get(speciesId);
    if (!hiddenSet) {
      regressionMismatches.push(`${speciesId}: species not audited.`);
      continue;
    }
    const expectedAbility = normalizeName(expectation.hiddenAbility);
    if (!hiddenSet.has(expectedAbility)) {
      regressionMismatches.push(
        `${speciesId}: expected hidden ability "${expectedAbility}" is not hidden in canonical source.`,
      );
    }
  }

  if (mismatches.length || regressionMismatches.length) {
    console.error("[HIDDEN-AUDIT] Hidden ability audit failed.");
    if (mismatches.length) {
      console.error(`[HIDDEN-AUDIT] Mapping mismatches (${mismatches.length}):`);
      for (const mismatch of mismatches.slice(0, 200)) {
        console.error(`  - ${mismatch}`);
      }
    }
    if (regressionMismatches.length) {
      console.error(`[HIDDEN-AUDIT] Regression mismatches (${regressionMismatches.length}):`);
      for (const mismatch of regressionMismatches) {
        console.error(`  - ${mismatch}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  console.log(`[HIDDEN-AUDIT] Success: ${speciesNames.length} species validated.`);
}

main().catch((error) => {
  console.error("[HIDDEN-AUDIT] Fatal error:", error);
  process.exitCode = 1;
});
