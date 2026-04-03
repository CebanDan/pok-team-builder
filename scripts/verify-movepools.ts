import { auditPokemonMoveCompatibility, buildCompatibilityIndex, type PokemonMoveCompatibilityPayload } from "../src/lib/move-compatibility";
import { normalizeName } from "../src/lib/pokedex";

const POKEAPI_BASE = "https://pokeapi.co/api/v2";

type PokemonListResponse = {
  results: { name: string }[];
};

type PokemonResponse = {
  name: string;
  moves: PokemonMoveCompatibilityPayload[];
};

type PairExpectation = {
  species: string;
  move: string;
};

const REGRESSION_EXPECTATIONS: PairExpectation[] = [
  { species: "toxapex", move: "scald" },
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

function canonicalMoveSet(pokemonMoves: PokemonMoveCompatibilityPayload[]): Set<string> {
  const set = new Set<string>();
  for (const entry of pokemonMoves) {
    const moveId = normalizeName(entry.move?.name ?? "");
    if (!moveId) continue;
    const valid = (entry.version_group_details ?? []).some((detail) => {
      const versionGroup = normalizeName(detail.version_group?.name ?? "");
      const learnMethod = normalizeName(detail.move_learn_method?.name ?? "");
      return Boolean(versionGroup && learnMethod);
    });
    if (!valid) continue;
    set.add(moveId);
  }
  return set;
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
  const result = new Array<R>(values.length);
  let cursor = 0;

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, values.length || 1)) }, async () => {
      while (cursor < values.length) {
        const current = cursor;
        cursor += 1;
        result[current] = await worker(values[current], current);
      }
    }),
  );

  return result;
}

async function main(): Promise<void> {
  const speciesNames = await resolveSpeciesNames();
  const concurrency = parseConcurrency();

  if (!speciesNames.length) {
    console.log("[MOVETOOL] No species selected.");
    return;
  }

  console.log(`[MOVETOOL] Auditing ${speciesNames.length} species with concurrency ${concurrency}...`);

  const failures: string[] = [];
  const regressionFailures: string[] = [];
  const lookup: Record<string, { canonical: Set<string>; mapped: Set<string> }> = {};

  await withConcurrency(speciesNames, concurrency, async (speciesName, index) => {
    try {
      const payload = await fetchJson<PokemonResponse>(`${POKEAPI_BASE}/pokemon/${speciesName}`);
      const audit = auditPokemonMoveCompatibility(payload.moves ?? [], {});
      const indexed = buildCompatibilityIndex(payload.moves ?? [], {});
      const canonical = canonicalMoveSet(payload.moves ?? []);
      const mapped = new Set(indexed.moves.map((move) => normalizeName(move.name)).filter(Boolean));
      lookup[normalizeName(payload.name)] = { canonical, mapped };

      if (audit.missingMoves.length || audit.unexpectedMoves.length) {
        failures.push(
          `${speciesName}: missing=${audit.missingMoves.length}, unexpected=${audit.unexpectedMoves.length}`,
        );
      }

      if ((index + 1) % 100 === 0 || index === speciesNames.length - 1) {
        console.log(`[MOVETOOL] Processed ${index + 1}/${speciesNames.length}`);
      }
    } catch (error) {
      failures.push(
        `${speciesName}: fetch failure (${error instanceof Error ? error.message : "unknown error"})`,
      );
    }
  });

  for (const expectation of REGRESSION_EXPECTATIONS) {
    const speciesId = normalizeName(expectation.species);
    if (!speciesNames.includes(speciesId)) {
      continue;
    }
    const moveId = normalizeName(expectation.move);
    const value = lookup[speciesId];
    if (!value) {
      regressionFailures.push(`${speciesId}: species not audited.`);
      continue;
    }
    if (!value.canonical.has(moveId)) {
      regressionFailures.push(`${speciesId}: canonical source missing expected move ${moveId}.`);
      continue;
    }
    if (!value.mapped.has(moveId)) {
      regressionFailures.push(`${speciesId}: mapped learnset missing expected move ${moveId}.`);
    }
  }

  if (failures.length || regressionFailures.length) {
    console.error("[MOVETOOL] Learnset audit failed.");
    if (failures.length) {
      console.error(`[MOVETOOL] Mapping mismatches (${failures.length}):`);
      for (const failure of failures.slice(0, 100)) {
        console.error(`  - ${failure}`);
      }
    }
    if (regressionFailures.length) {
      console.error(`[MOVETOOL] Regression mismatches (${regressionFailures.length}):`);
      for (const failure of regressionFailures) {
        console.error(`  - ${failure}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  console.log(`[MOVETOOL] Success: ${speciesNames.length} species validated with no missing assignments.`);
}

main().catch((error) => {
  console.error("[MOVETOOL] Fatal error:", error);
  process.exitCode = 1;
});
