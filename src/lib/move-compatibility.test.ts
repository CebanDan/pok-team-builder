import { describe, expect, it } from "vitest";

import {
  auditPokemonMoveCompatibility,
  auditPokemonMoveMappings,
  buildCompatibilityIndex,
  classifyMoveLearnMethod,
  filterCompatibleMoves,
  getMatchingCompatibilityDetails,
  sortCompatibleMovesBySpeciesType,
  type MoveCompatibilityFilter,
  type PokemonMoveCompatibilityPayload,
} from "@/lib/move-compatibility";
import type { MoveEntry } from "@/lib/pokedex";

const MOVE_LOOKUP: Record<string, MoveEntry> = {
  flamethrower: {
    name: "flamethrower",
    display: "Flamethrower",
    type: "fire",
    power: 90,
    accuracy: 100,
    priority: 0,
    damageClass: "special",
  },
  "air-slash": {
    name: "air-slash",
    display: "Air Slash",
    type: "flying",
    power: 75,
    accuracy: 95,
    priority: 0,
    damageClass: "special",
  },
  fly: {
    name: "fly",
    display: "Fly",
    type: "flying",
    power: 90,
    accuracy: 95,
    priority: 0,
    damageClass: "physical",
  },
  scald: {
    name: "scald",
    display: "Scald",
    type: "water",
    power: 80,
    accuracy: 100,
    priority: 0,
    damageClass: "special",
  },
};

const POKEMON_MOVES: PokemonMoveCompatibilityPayload[] = [
  {
    move: { name: "flamethrower" },
    version_group_details: [
      {
        level_learned_at: 46,
        move_learn_method: { name: "level-up" },
        version_group: { name: "scarlet-violet" },
      },
      {
        level_learned_at: 0,
        move_learn_method: { name: "machine" },
        version_group: { name: "sword-shield" },
      },
    ],
  },
  {
    move: { name: "air-slash" },
    version_group_details: [
      {
        level_learned_at: 0,
        move_learn_method: { name: "machine" },
        version_group: { name: "scarlet-violet" },
      },
      {
        level_learned_at: 0,
        move_learn_method: { name: "stadium-surfing" },
        version_group: { name: "yellow" },
      },
    ],
  },
  {
    move: { name: "fly" },
    version_group_details: [
      {
        level_learned_at: 0,
        move_learn_method: { name: "machine" },
        version_group: { name: "scarlet-violet" },
      },
    ],
  },
];

const TOXAPEX_MOVES: PokemonMoveCompatibilityPayload[] = [
  {
    move: { name: "scald" },
    version_group_details: [
      {
        level_learned_at: 0,
        move_learn_method: { name: "machine" },
        version_group: { name: "sun-moon" },
      },
      {
        level_learned_at: 0,
        move_learn_method: { name: "machine" },
        version_group: { name: "ultra-sun-ultra-moon" },
      },
      {
        level_learned_at: 0,
        move_learn_method: { name: "machine" },
        version_group: { name: "sword-shield" },
      },
    ],
  },
];

describe("move compatibility helpers", () => {
  it("builds compatibility index with latest version detection", () => {
    const result = buildCompatibilityIndex(POKEMON_MOVES, MOVE_LOOKUP);
    expect(result.latestVersionGroup).toBe("scarlet-violet");
    expect(result.versionGroups[0]).toBe("scarlet-violet");
    expect(result.moves).toHaveLength(3);

    const flamethrower = result.moves.find((entry) => entry.display === "Flamethrower");
    expect(flamethrower?.compatibility[0]?.versionGroup).toBe("scarlet-violet");
  });

  it("filters by level, generation, and event toggles", () => {
    const result = buildCompatibilityIndex(POKEMON_MOVES, MOVE_LOOKUP);
    const baseFilter: MoveCompatibilityFilter = {
      versionGroup: "latest",
      latestVersionGroup: result.latestVersionGroup,
      maxLevel: 40,
      includeEventMoves: false,
      includeSpecialMoves: true,
    };

    const latestMoves = filterCompatibleMoves(result.moves, baseFilter);
    expect(latestMoves.map((entry) => entry.display)).toEqual(["Air Slash", "Fly"]);

    const allGensWithEvents = filterCompatibleMoves(result.moves, {
      ...baseFilter,
      versionGroup: "all",
      includeEventMoves: true,
      maxLevel: 100,
    });
    expect(allGensWithEvents.map((entry) => entry.display)).toContain("Flamethrower");

    const airSlash = result.moves.find((entry) => entry.display === "Air Slash");
    const details = getMatchingCompatibilityDetails(airSlash?.compatibility ?? [], {
      ...baseFilter,
      versionGroup: "all",
      includeEventMoves: false,
    });
    expect(details.some((detail) => detail.isEvent)).toBe(false);
  });

  it("prioritizes STAB moves when sorting", () => {
    const result = buildCompatibilityIndex(POKEMON_MOVES, MOVE_LOOKUP);
    const sorted = sortCompatibleMovesBySpeciesType(result.moves, ["fire"]);
    expect(sorted[0]?.display).toBe("Flamethrower");
  });

  it("classifies non-standard methods as event or special", () => {
    expect(classifyMoveLearnMethod("stadium-surfing")).toBe("event");
    expect(classifyMoveLearnMethod("zygarde-cube")).toBe("special");
  });

  it("keeps cross-generation moves like toxapex scald in comprehensive mode", () => {
    const index = buildCompatibilityIndex(TOXAPEX_MOVES, MOVE_LOOKUP);

    const latestOnly = filterCompatibleMoves(index.moves, {
      versionGroup: "latest",
      latestVersionGroup: "scarlet-violet",
      maxLevel: 100,
      includeEventMoves: true,
      includeSpecialMoves: true,
    });
    expect(latestOnly.map((entry) => entry.display)).not.toContain("Scald");

    const allGenerations = filterCompatibleMoves(index.moves, {
      versionGroup: "all",
      latestVersionGroup: "scarlet-violet",
      maxLevel: 100,
      includeEventMoves: true,
      includeSpecialMoves: true,
    });
    expect(allGenerations.map((entry) => entry.display)).toContain("Scald");
  });

  it("audits learnset mappings against canonical move lists", () => {
    const index = buildCompatibilityIndex(TOXAPEX_MOVES, MOVE_LOOKUP);
    const directAudit = auditPokemonMoveMappings(TOXAPEX_MOVES, index.moves);
    expect(directAudit.missingMoves).toEqual([]);
    expect(directAudit.unexpectedMoves).toEqual([]);

    const compatibilityAudit = auditPokemonMoveCompatibility(TOXAPEX_MOVES, MOVE_LOOKUP);
    expect(compatibilityAudit.missingMoves).toEqual([]);
    expect(compatibilityAudit.unexpectedMoves).toEqual([]);
  });
});
