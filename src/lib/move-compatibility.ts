import { normalizeName, toTitleCase, type MoveEntry } from "@/lib/pokedex";

export type MoveLearnMethodCategory =
  | "level-up"
  | "machine"
  | "egg"
  | "tutor"
  | "form-change"
  | "event"
  | "special";

export interface MoveCompatibilityDetail {
  versionGroup: string;
  versionGroupLabel: string;
  generation: number | null;
  learnMethod: string;
  learnMethodLabel: string;
  methodCategory: MoveLearnMethodCategory;
  levelLearnedAt: number;
  isEvent: boolean;
}

export interface CompatibleMoveEntry extends MoveEntry {
  compatibility: MoveCompatibilityDetail[];
}

export interface PokemonMoveCompatibilityPayload {
  move: {
    name: string;
  };
  version_group_details: {
    level_learned_at: number;
    move_learn_method: {
      name: string;
    };
    version_group: {
      name: string;
    };
  }[];
}

export type MoveCompatibilityVersionFilter = "latest" | "all" | string;

export interface MoveCompatibilityFilter {
  versionGroup: MoveCompatibilityVersionFilter;
  latestVersionGroup: string | null;
  maxLevel: number;
  includeEventMoves: boolean;
  includeSpecialMoves: boolean;
}

export interface CompatibilityIndexResult {
  moves: CompatibleMoveEntry[];
  versionGroups: string[];
  latestVersionGroup: string | null;
}

export interface MoveLearnsetAuditResult {
  canonicalMoveCount: number;
  mappedMoveCount: number;
  missingMoves: string[];
  unexpectedMoves: string[];
}

const VERSION_GROUP_ORDER = [
  "red-blue",
  "yellow",
  "gold-silver",
  "crystal",
  "ruby-sapphire",
  "emerald",
  "firered-leafgreen",
  "diamond-pearl",
  "platinum",
  "heartgold-soulsilver",
  "black-white",
  "colosseum",
  "xd",
  "black-2-white-2",
  "x-y",
  "omega-ruby-alpha-sapphire",
  "sun-moon",
  "ultra-sun-ultra-moon",
  "lets-go-pikachu-lets-go-eevee",
  "sword-shield",
  "brilliant-diamond-and-shining-pearl",
  "legends-arceus",
  "scarlet-violet",
] as const;

const VERSION_GROUP_GENERATION: Record<string, number> = {
  "red-blue": 1,
  yellow: 1,
  "gold-silver": 2,
  crystal: 2,
  "ruby-sapphire": 3,
  emerald: 3,
  "firered-leafgreen": 3,
  "diamond-pearl": 4,
  platinum: 4,
  "heartgold-soulsilver": 4,
  "black-white": 5,
  colosseum: 3,
  xd: 3,
  "black-2-white-2": 5,
  "x-y": 6,
  "omega-ruby-alpha-sapphire": 6,
  "sun-moon": 7,
  "ultra-sun-ultra-moon": 7,
  "lets-go-pikachu-lets-go-eevee": 7,
  "sword-shield": 8,
  "brilliant-diamond-and-shining-pearl": 8,
  "legends-arceus": 8,
  "scarlet-violet": 9,
};

const METHOD_SORT_ORDER: Record<MoveLearnMethodCategory, number> = {
  "level-up": 0,
  machine: 1,
  tutor: 2,
  egg: 3,
  "form-change": 4,
  event: 5,
  special: 6,
};

const EVENT_METHODS = new Set([
  "colosseum-purification",
  "stadium-surfing",
  "light-ball-egg",
  "xd",
]);

export function toVersionGroupLabel(versionGroup: string): string {
  return toTitleCase(normalizeName(versionGroup));
}

export function getVersionGroupGeneration(versionGroup: string): number | null {
  const normalized = normalizeName(versionGroup);
  return VERSION_GROUP_GENERATION[normalized] ?? null;
}

export function getVersionGroupOrder(versionGroup: string): number {
  const normalized = normalizeName(versionGroup);
  return VERSION_GROUP_ORDER.indexOf(normalized as (typeof VERSION_GROUP_ORDER)[number]);
}

export function classifyMoveLearnMethod(learnMethod: string): MoveLearnMethodCategory {
  const normalized = normalizeName(learnMethod);
  if (normalized === "level-up") return "level-up";
  if (normalized === "machine") return "machine";
  if (normalized === "egg") return "egg";
  if (normalized === "tutor") return "tutor";
  if (normalized === "form-change") return "form-change";
  if (normalized.includes("event") || EVENT_METHODS.has(normalized)) return "event";
  return "special";
}

export function isEventLearnMethod(learnMethod: string): boolean {
  return classifyMoveLearnMethod(learnMethod) === "event";
}

function compareVersionGroupsDesc(left: string, right: string): number {
  const leftOrder = getVersionGroupOrder(left);
  const rightOrder = getVersionGroupOrder(right);
  if (leftOrder !== rightOrder) {
    return rightOrder - leftOrder;
  }
  return left.localeCompare(right);
}

function compareCompatibilityDetail(left: MoveCompatibilityDetail, right: MoveCompatibilityDetail): number {
  const versionCompare = compareVersionGroupsDesc(left.versionGroup, right.versionGroup);
  if (versionCompare !== 0) return versionCompare;

  const leftMethod = METHOD_SORT_ORDER[left.methodCategory] ?? Number.MAX_SAFE_INTEGER;
  const rightMethod = METHOD_SORT_ORDER[right.methodCategory] ?? Number.MAX_SAFE_INTEGER;
  if (leftMethod !== rightMethod) return leftMethod - rightMethod;

  if (left.levelLearnedAt !== right.levelLearnedAt) {
    return right.levelLearnedAt - left.levelLearnedAt;
  }

  return left.learnMethod.localeCompare(right.learnMethod);
}

function createFallbackMove(moveName: string): MoveEntry {
  const normalized = normalizeName(moveName);
  return {
    name: normalized,
    display: toTitleCase(normalized),
    type: "normal",
    priority: 0,
    power: null,
    accuracy: null,
    damageClass: null,
  };
}

function resolveActiveVersionGroup(
  versionGroup: MoveCompatibilityVersionFilter,
  latestVersionGroup: string | null,
): string | null {
  if (versionGroup === "all") return null;
  if (versionGroup === "latest") return latestVersionGroup ? normalizeName(latestVersionGroup) : null;
  const normalized = normalizeName(versionGroup);
  return normalized || null;
}

export function getMatchingCompatibilityDetails(
  compatibility: MoveCompatibilityDetail[],
  filter: MoveCompatibilityFilter,
): MoveCompatibilityDetail[] {
  const maxLevel = Math.max(1, Math.min(100, Math.floor(filter.maxLevel || 100)));
  const activeVersionGroup = resolveActiveVersionGroup(filter.versionGroup, filter.latestVersionGroup);

  return compatibility
    .filter((detail) => {
      if (activeVersionGroup && detail.versionGroup !== activeVersionGroup) return false;
      if (detail.methodCategory === "level-up" && detail.levelLearnedAt > maxLevel) return false;
      if (!filter.includeEventMoves && detail.isEvent) return false;
      if (!filter.includeSpecialMoves && detail.methodCategory === "special") return false;
      return true;
    })
    .sort(compareCompatibilityDetail);
}

export function buildCompatibilityIndex(
  pokemonMoves: PokemonMoveCompatibilityPayload[],
  moveLookup: Record<string, MoveEntry>,
): CompatibilityIndexResult {
  const versionGroupSet = new Set<string>();
  const moves: CompatibleMoveEntry[] = [];

  for (const entry of pokemonMoves) {
    const moveId = normalizeName(entry.move?.name ?? "");
    if (!moveId) continue;

    const seenDetails = new Set<string>();
    const compatibility: MoveCompatibilityDetail[] = [];

    for (const detail of entry.version_group_details ?? []) {
      const versionGroup = normalizeName(detail.version_group?.name ?? "");
      const learnMethod = normalizeName(detail.move_learn_method?.name ?? "");
      if (!versionGroup || !learnMethod) continue;

      const levelLearnedAt = Math.max(0, detail.level_learned_at ?? 0);
      const dedupeKey = `${versionGroup}|${learnMethod}|${levelLearnedAt}`;
      if (seenDetails.has(dedupeKey)) continue;
      seenDetails.add(dedupeKey);

      const methodCategory = classifyMoveLearnMethod(learnMethod);
      versionGroupSet.add(versionGroup);

      compatibility.push({
        versionGroup,
        versionGroupLabel: toVersionGroupLabel(versionGroup),
        generation: getVersionGroupGeneration(versionGroup),
        learnMethod,
        learnMethodLabel: toTitleCase(learnMethod),
        methodCategory,
        levelLearnedAt,
        isEvent: methodCategory === "event",
      });
    }

    if (!compatibility.length) continue;

    const baseMove = moveLookup[moveId] ?? createFallbackMove(moveId);
    moves.push({
      ...baseMove,
      compatibility: compatibility.sort(compareCompatibilityDetail),
    });
  }

  const versionGroups = Array.from(versionGroupSet).sort(compareVersionGroupsDesc);
  return {
    moves: moves.sort((left, right) => left.display.localeCompare(right.display)),
    versionGroups,
    latestVersionGroup: versionGroups[0] ?? null,
  };
}

export function filterCompatibleMoves(
  moves: CompatibleMoveEntry[],
  filter: MoveCompatibilityFilter,
): CompatibleMoveEntry[] {
  return moves.filter((move) => getMatchingCompatibilityDetails(move.compatibility, filter).length > 0);
}

function canonicalMoveNames(pokemonMoves: PokemonMoveCompatibilityPayload[]): string[] {
  const names = new Set<string>();
  for (const entry of pokemonMoves) {
    const moveId = normalizeName(entry.move?.name ?? "");
    if (!moveId) continue;
    const hasCompatibleSource = (entry.version_group_details ?? []).some((detail) => {
      const versionGroup = normalizeName(detail.version_group?.name ?? "");
      const learnMethod = normalizeName(detail.move_learn_method?.name ?? "");
      return Boolean(versionGroup && learnMethod);
    });
    if (!hasCompatibleSource) continue;
    names.add(moveId);
  }
  return Array.from(names).sort((left, right) => left.localeCompare(right));
}

function mappedMoveNames(moves: CompatibleMoveEntry[]): string[] {
  return Array.from(new Set(moves.map((move) => normalizeName(move.name)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

export function auditPokemonMoveMappings(
  pokemonMoves: PokemonMoveCompatibilityPayload[],
  mappedMoves: CompatibleMoveEntry[],
): MoveLearnsetAuditResult {
  const canonical = canonicalMoveNames(pokemonMoves);
  const mapped = mappedMoveNames(mappedMoves);
  const canonicalSet = new Set(canonical);
  const mappedSet = new Set(mapped);

  const missingMoves = canonical.filter((moveName) => !mappedSet.has(moveName));
  const unexpectedMoves = mapped.filter((moveName) => !canonicalSet.has(moveName));

  return {
    canonicalMoveCount: canonical.length,
    mappedMoveCount: mapped.length,
    missingMoves,
    unexpectedMoves,
  };
}

export function auditPokemonMoveCompatibility(
  pokemonMoves: PokemonMoveCompatibilityPayload[],
  moveLookup: Record<string, MoveEntry>,
): MoveLearnsetAuditResult {
  const indexed = buildCompatibilityIndex(pokemonMoves, moveLookup);
  return auditPokemonMoveMappings(pokemonMoves, indexed.moves);
}

export function sortCompatibleMovesBySpeciesType(
  moves: CompatibleMoveEntry[],
  speciesTypes: string[],
): CompatibleMoveEntry[] {
  const typeSet = new Set(speciesTypes.map((typeName) => normalizeName(typeName)).filter(Boolean));
  const sorted = [...moves];
  sorted.sort((left, right) => {
    const leftStab = typeSet.has(normalizeName(left.type)) ? 1 : 0;
    const rightStab = typeSet.has(normalizeName(right.type)) ? 1 : 0;
    if (leftStab !== rightStab) return rightStab - leftStab;
    return left.display.localeCompare(right.display);
  });
  return sorted;
}
