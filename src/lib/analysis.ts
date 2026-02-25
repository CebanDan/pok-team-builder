import type {
  CounterSuggestion,
  MoveAnalysis,
  MoveEffectivenessBreakdown,
  TeamMember,
  TeamWeaknessEntry,
  TypeChart,
  TypeRelations,
} from "@/lib/domain";
import { normalizeName, type MoveEntry, type SpeciesEntry, type TypeEntry } from "@/lib/pokedex";

const STANDARD_TYPE_ORDER = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
] as const;

const ABILITY_IMMUNITIES: Record<string, string[]> = {
  "desolate-land": ["water"],
  "dry-skin": ["water"],
  "earth-eater": ["ground"],
  "flash-fire": ["fire"],
  "levitate": ["ground"],
  "lightning-rod": ["electric"],
  mountaineer: ["rock"],
  "motor-drive": ["electric"],
  "primordial-sea": ["fire"],
  "sap-sipper": ["grass"],
  "storm-drain": ["water"],
  "volt-absorb": ["electric"],
  "water-absorb": ["water"],
  "well-baked-body": ["fire"],
};

const ABILITY_RESISTANCE_FACTORS: Record<string, Partial<Record<string, number>>> = {
  "heatproof": { fire: 0.5 },
  "purifying-salt": { ghost: 0.5 },
  "thick-fat": { fire: 0.5, ice: 0.5 },
  "water-bubble": { fire: 0.5 },
};

const ABILITY_WEAKNESS_FACTORS: Record<string, Partial<Record<string, number>>> = {
  "dry-skin": { fire: 1.25 },
};

function getTypeRelation(chart: TypeChart, typeName: string): TypeRelations | undefined {
  return chart[normalizeName(typeName)];
}

export function getAnalyzerTypeNames(typeChart: TypeChart): string[] {
  const available = new Set(Object.keys(typeChart));
  const standard = STANDARD_TYPE_ORDER.filter((typeName) => available.has(typeName));
  if (standard.length >= STANDARD_TYPE_ORDER.length - 1) return [...standard];
  return Object.keys(typeChart).sort((left, right) => left.localeCompare(right));
}

function applyDefensiveAbilityMultiplier(
  baseMultiplier: number,
  attackingType: string,
  abilityName: string,
): number {
  if (baseMultiplier === 0) return 0;
  const attacking = normalizeName(attackingType);
  const ability = normalizeName(abilityName);
  if (!ability) return baseMultiplier;

  if (ability === "wonder-guard") {
    return baseMultiplier > 1 ? baseMultiplier : 0;
  }

  if (ABILITY_IMMUNITIES[ability]?.includes(attacking)) return 0;

  let next = baseMultiplier;
  const resistanceFactor = ABILITY_RESISTANCE_FACTORS[ability]?.[attacking];
  if (typeof resistanceFactor === "number") next *= resistanceFactor;
  const weaknessFactor = ABILITY_WEAKNESS_FACTORS[ability]?.[attacking];
  if (typeof weaknessFactor === "number") next *= weaknessFactor;

  return next;
}

export function parseThreatTypesInput(threatInput: string, typeChart: TypeChart): string[] {
  const availableTypes = new Set(Object.keys(typeChart));
  const pieces = threatInput
    .toLowerCase()
    .split(/[\s,/|+_-]+/g)
    .map((value) => normalizeName(value))
    .filter(Boolean);

  if (!pieces.length) return [];

  const unique = Array.from(new Set(pieces));
  const valid = unique.filter((value) => availableTypes.has(value));
  if (valid.length) return valid.slice(0, 2);
  return unique.slice(0, 2);
}

export function buildTypeChart(types: TypeEntry[]): TypeChart {
  return Object.fromEntries(
    types.map((typeEntry) => [normalizeName(typeEntry.name), typeEntry.relations]),
  );
}

export function offensiveMultiplier(
  attackingType: string,
  defendingType: string,
  typeChart: TypeChart,
): number {
  const attacking = getTypeRelation(typeChart, attackingType);
  const defending = normalizeName(defendingType);
  if (!attacking) return 1;
  if (attacking.noDamageTo.includes(defending)) return 0;
  if (attacking.doubleDamageTo.includes(defending)) return 2;
  if (attacking.halfDamageTo.includes(defending)) return 0.5;
  return 1;
}

export function defensiveMultiplier(
  attackingType: string,
  defendingTypes: string[],
  typeChart: TypeChart,
): number {
  if (!defendingTypes.length) return 1;
  return defendingTypes.reduce(
    (multiplier, defendingType) =>
      multiplier * offensiveMultiplier(attackingType, defendingType, typeChart),
    1,
  );
}

function getMemberTypes(member: TeamMember, speciesLookup: Record<string, SpeciesEntry>): string[] {
  const species = speciesLookup[normalizeName(member.species)];
  return species?.types ?? [];
}

function getMemberMoves(member: TeamMember, moveLookup: Record<string, MoveEntry>): MoveEntry[] {
  return member.moves
    .map((moveName) => moveLookup[normalizeName(moveName)])
    .filter((move): move is MoveEntry => Boolean(move));
}

export function getMemberDefensiveMultiplier(
  member: TeamMember,
  attackingType: string,
  speciesLookup: Record<string, SpeciesEntry>,
  typeChart: TypeChart,
): number | null {
  const types = getMemberTypes(member, speciesLookup);
  if (!types.length) return null;
  const baseMultiplier = defensiveMultiplier(attackingType, types, typeChart);
  return applyDefensiveAbilityMultiplier(baseMultiplier, attackingType, member.ability);
}

export function analyzeTeamWeaknesses(
  members: TeamMember[],
  speciesLookup: Record<string, SpeciesEntry>,
  typeChart: TypeChart,
): TeamWeaknessEntry[] {
  const activeMembers = members.filter((member) => getMemberTypes(member, speciesLookup).length > 0);
  const typeNames = getAnalyzerTypeNames(typeChart);

  return typeNames
    .map((attackType) => {
      const counts = {
        weak: 0,
        resistant: 0,
        immune: 0,
        neutral: 0,
      };

      for (const member of activeMembers) {
        const multiplier = getMemberDefensiveMultiplier(member, attackType, speciesLookup, typeChart);
        if (multiplier === null) continue;
        if (multiplier === 0) counts.immune += 1;
        else if (multiplier > 1) counts.weak += 1;
        else if (multiplier < 1) counts.resistant += 1;
        else counts.neutral += 1;
      }

      return {
        type: attackType,
        ...counts,
      };
    })
    .sort((a, b) => b.weak - b.resistant - b.immune - (a.weak - a.resistant - a.immune));
}

export function getMoveEffectivenessBreakdown(
  moveType: string,
  typeChart: TypeChart,
): MoveEffectivenessBreakdown {
  const breakdown: MoveEffectivenessBreakdown = {
    superEffective: [],
    neutral: [],
    resisted: [],
    immune: [],
  };

  for (const targetType of getAnalyzerTypeNames(typeChart)) {
    const multiplier = offensiveMultiplier(moveType, targetType, typeChart);
    if (multiplier === 0) breakdown.immune.push(targetType);
    else if (multiplier > 1) breakdown.superEffective.push(targetType);
    else if (multiplier < 1) breakdown.resisted.push(targetType);
    else breakdown.neutral.push(targetType);
  }

  return breakdown;
}

export function analyzeMemberMoves(
  member: TeamMember,
  moveLookup: Record<string, MoveEntry>,
  typeChart: TypeChart,
): MoveAnalysis[] {
  return member.moves
    .filter(Boolean)
    .map((moveName) => {
      const move = moveLookup[normalizeName(moveName)];
      if (!move) {
        return {
          move: moveName,
          type: "unknown",
          coverage: {
            superEffective: [],
            neutral: [],
            resisted: [],
            immune: [],
          },
        };
      }

      // Skip status moves (no power/damage)
      if (move.power === null) {
        return null;
      }

      return {
        move: move.display,
        type: move.type,
        coverage: getMoveEffectivenessBreakdown(move.type, typeChart),
      };
    })
    .filter((entry): entry is MoveAnalysis => Boolean(entry));
}

export function getTeamCoverageByType(
  members: TeamMember[],
  moveLookup: Record<string, MoveEntry>,
  typeChart: TypeChart,
): Record<string, number> {
  const typeNames = getAnalyzerTypeNames(typeChart);
  const coverage: Record<string, number> = Object.fromEntries(typeNames.map((type) => [type, 0]));

  for (const targetType of typeNames) {
    let bestMultiplier = 0;
    for (const member of members) {
      const moves = getMemberMoves(member, moveLookup)
        .filter((move) => move.power !== null); // Only count damaging moves for coverage
      for (const move of moves) {
        const multiplier = offensiveMultiplier(move.type, targetType, typeChart);
        if (multiplier > bestMultiplier) {
          bestMultiplier = multiplier;
        }
      }
    }
    coverage[targetType] = bestMultiplier;
  }

  return coverage;
}

export function getCoverageIndicator(
  members: TeamMember[],
  moveLookup: Record<string, MoveEntry>,
  typeChart: TypeChart,
): {
  coveredTypes: number;
  totalTypes: number;
  averageBestMultiplier: number;
} {
  const coverage = getTeamCoverageByType(members, moveLookup, typeChart);
  const multipliers = Object.values(coverage);
  const coveredTypes = multipliers.filter((value) => value > 1).length;
  const averageBestMultiplier =
    multipliers.reduce((sum, value) => sum + value, 0) / Math.max(multipliers.length, 1);

  return {
    coveredTypes,
    totalTypes: multipliers.length,
    averageBestMultiplier: Number(averageBestMultiplier.toFixed(2)),
  };
}

export function suggestCountersByType(
  threatType: string,
  members: TeamMember[],
  speciesLookup: Record<string, SpeciesEntry>,
  moveLookup: Record<string, MoveEntry>,
  typeChart: TypeChart,
): CounterSuggestion[] {
  const threatTypes = parseThreatTypesInput(threatType, typeChart);
  if (!threatTypes.length) return [];

  return members
    .map((member) => {
      const reasons: string[] = [];
      const defenseMultipliers = threatTypes
        .map((threat) => getMemberDefensiveMultiplier(member, threat, speciesLookup, typeChart))
        .filter((value): value is number => value !== null);
      const worstDefense = defenseMultipliers.length ? Math.max(...defenseMultipliers) : 1;
      let score = 0;

      if (worstDefense === 0) {
        score += 3;
        reasons.push("Immune to listed threat STAB types.");
      } else if (worstDefense < 1) {
        score += 2;
        reasons.push("Resists listed threat STAB types.");
      } else if (worstDefense === 1) {
        score += 1;
        reasons.push("Can switch in neutrally to listed STAB types.");
      }

      let bestMoveMultiplier = 0;
      let bestMoveName = "";
      let priorityPresent = false;
      for (const move of getMemberMoves(member, moveLookup).filter((m) => m.power !== null)) {
        const multiplier = defensiveMultiplier(move.type, threatTypes, typeChart);
        if (multiplier > bestMoveMultiplier) {
          bestMoveMultiplier = multiplier;
          bestMoveName = move.display || move.name;
        }
        if (move.priority > 0) priorityPresent = true;
      }

      if (bestMoveMultiplier >= 4) {
        score += 4;
        reasons.push(`${bestMoveName} hits for 4x.`);
      } else if (bestMoveMultiplier > 1) {
        score += 3;
        reasons.push(`${bestMoveName} hits super effectively.`);
      } else if (bestMoveMultiplier === 1) {
        score += 1;
        reasons.push(`${bestMoveName} hits neutrally.`);
      }

      if (priorityPresent) {
        score += 1;
        reasons.push("Has priority options.");
      }

      return {
        memberId: member.id,
        species: member.species || "Unknown",
        score,
        reasons,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function suggestCountersByOpponent(
  opponentSpecies: string,
  members: TeamMember[],
  speciesLookup: Record<string, SpeciesEntry>,
  moveLookup: Record<string, MoveEntry>,
  typeChart: TypeChart,
): CounterSuggestion[] {
  const opponent = speciesLookup[normalizeName(opponentSpecies)];
  if (!opponent) return [];

  return members
    .map((member) => {
      const reasons: string[] = [];
      let switchSafety = 0;

      for (const opponentType of opponent.types) {
        const multiplier = getMemberDefensiveMultiplier(member, opponentType, speciesLookup, typeChart);
        if (multiplier === null) continue;
        if (multiplier === 0) {
          switchSafety += 2;
        } else if (multiplier < 1) {
          switchSafety += 1;
        } else if (multiplier > 1) {
          switchSafety -= 1;
        }
      }

      if (switchSafety > 1) reasons.push("Strong defensive switch profile.");
      else if (switchSafety > 0) reasons.push("Reasonable switch profile.");

      let bestOffense = 0;
      let priorityPresent = false;
      for (const move of getMemberMoves(member, moveLookup)) {
        const multiplier = opponent.types.reduce(
          (running, defenderType) => running * offensiveMultiplier(move.type, defenderType, typeChart),
          1,
        );
        if (multiplier > bestOffense) bestOffense = multiplier;
        if (move.priority > 0) priorityPresent = true;
      }

      if (bestOffense > 1) reasons.push("Has super-effective hit on opponent.");
      if (priorityPresent) reasons.push("Has priority pressure.");

      const score = switchSafety + (bestOffense > 1 ? 3 : bestOffense === 1 ? 1 : 0) + (priorityPresent ? 1 : 0);
      return {
        memberId: member.id,
        species: member.species || "Unknown",
        score,
        reasons,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
