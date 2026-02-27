import { describe, expect, it } from "vitest";

import {
  analyzeMemberMoves,
  analyzeTeamWeaknesses,
  buildTypeChart,
  getCoverageIndicator,
  getTeamCoverageByType,
  parseThreatTypesInput,
  suggestCountersByType,
} from "@/lib/analysis";
import type { TeamMember } from "@/lib/domain";
import { createMoveLookup, createSpeciesLookup, type MoveEntry, type SpeciesEntry, type TypeEntry } from "@/lib/pokedex";

const TYPES: TypeEntry[] = [
  {
    name: "electric",
    display: "Electric",
    relations: {
      doubleDamageFrom: ["ground"],
      doubleDamageTo: ["water", "flying"],
      halfDamageFrom: ["electric", "flying", "steel"],
      halfDamageTo: ["electric", "grass", "dragon"],
      noDamageFrom: [],
      noDamageTo: ["ground"],
    },
  },
  {
    name: "fire",
    display: "Fire",
    relations: {
      doubleDamageFrom: ["water", "ground", "rock"],
      doubleDamageTo: ["grass", "ice", "bug", "steel"],
      halfDamageFrom: ["fire", "grass", "ice", "bug", "steel", "fairy"],
      halfDamageTo: ["fire", "water", "rock", "dragon"],
      noDamageFrom: [],
      noDamageTo: [],
    },
  },
  {
    name: "flying",
    display: "Flying",
    relations: {
      doubleDamageFrom: ["electric", "ice", "rock"],
      doubleDamageTo: ["grass", "fighting", "bug"],
      halfDamageFrom: ["grass", "fighting", "bug"],
      halfDamageTo: ["electric", "rock", "steel"],
      noDamageFrom: ["ground"],
      noDamageTo: [],
    },
  },
  {
    name: "grass",
    display: "Grass",
    relations: {
      doubleDamageFrom: ["fire", "ice", "poison", "flying", "bug"],
      doubleDamageTo: ["water", "ground", "rock"],
      halfDamageFrom: ["water", "electric", "grass", "ground"],
      halfDamageTo: ["fire", "grass", "poison", "flying", "bug", "dragon", "steel"],
      noDamageFrom: [],
      noDamageTo: [],
    },
  },
  {
    name: "ground",
    display: "Ground",
    relations: {
      doubleDamageFrom: ["water", "grass", "ice"],
      doubleDamageTo: ["fire", "electric", "poison", "rock", "steel"],
      halfDamageFrom: ["poison", "rock"],
      halfDamageTo: ["grass", "bug"],
      noDamageFrom: ["electric"],
      noDamageTo: ["flying"],
    },
  },
  {
    name: "water",
    display: "Water",
    relations: {
      doubleDamageFrom: ["electric", "grass"],
      doubleDamageTo: ["fire", "ground", "rock"],
      halfDamageFrom: ["fire", "water", "ice", "steel"],
      halfDamageTo: ["water", "grass", "dragon"],
      noDamageFrom: [],
      noDamageTo: [],
    },
  },
];

const SPECIES: SpeciesEntry[] = [
  { name: "charizard", display: "Charizard", types: ["fire", "flying"], forms: [] },
  { name: "swampert", display: "Swampert", types: ["water", "ground"], forms: [] },
  { name: "rotom-wash", display: "Rotom-Wash", types: ["electric", "water"], forms: [] },
];

const MOVES: MoveEntry[] = [
  { name: "thunderbolt", display: "Thunderbolt", type: "electric", priority: 0, power: 90 },
  { name: "earthquake", display: "Earthquake", type: "ground", priority: 0, power: 100 },
  { name: "energy-ball", display: "Energy Ball", type: "grass", priority: 0, power: 90 },
];

const TEAM: TeamMember[] = [
  {
    id: "1",
    species: "Charizard",
    form: "",
    ability: "",
    item: "",
    level: 50,
    nature: "Timid",
    gender: "N",
    evs: { hp: 0, atk: 0, def: 0, spa: 252, spd: 4, spe: 252 },
    ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
    moves: ["Thunderbolt", "Energy Ball", "", ""],
  },
  {
    id: "2",
    species: "Swampert",
    form: "",
    ability: "",
    item: "",
    level: 50,
    nature: "Adamant",
    gender: "N",
    evs: { hp: 252, atk: 252, def: 4, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    moves: ["Earthquake", "", "", ""],
  },
];

describe("analysis library", () => {
  it("computes weakness rows with weak/resist/immune counts", () => {
    const chart = buildTypeChart(TYPES);
    const speciesLookup = createSpeciesLookup(SPECIES);
    const rows = analyzeTeamWeaknesses(TEAM, speciesLookup, chart);

    const electricRow = rows.find((row) => row.type === "electric");
    const grassRow = rows.find((row) => row.type === "grass");
    expect(electricRow).toMatchObject({ weak: 1, immune: 1 });
    expect(grassRow).toMatchObject({ weak: 1, resistant: 1 });
  });

  it("computes team move coverage by defending type", () => {
    const chart = buildTypeChart(TYPES);
    const moveLookup = createMoveLookup(MOVES);
    const coverage = getTeamCoverageByType(TEAM, moveLookup, chart);
    expect(coverage.water).toBe(2);
    expect(coverage.flying).toBe(2);
    expect(coverage.grass).toBe(0.5);
  });

  it("exposes move analyzer immunity and coverage indicator", () => {
    const chart = buildTypeChart(TYPES);
    const moveLookup = createMoveLookup(MOVES);
    const summary = analyzeMemberMoves(TEAM[1], moveLookup, chart);
    const earthquake = summary.find((entry) => entry.move.toLowerCase() === "earthquake");
    expect(earthquake?.coverage.immune).toContain("flying");

    const indicator = getCoverageIndicator(TEAM, moveLookup, chart);
    expect(indicator.coveredTypes).toBeGreaterThan(0);
    expect(indicator.totalTypes).toBe(TYPES.length);
  });

  it("parses dual-type threats and surfaces 4x counter suggestions", () => {
    const chart = buildTypeChart(TYPES);
    const speciesLookup = createSpeciesLookup(SPECIES);
    const moveLookup = createMoveLookup(MOVES);

    expect(parseThreatTypesInput("water ground", chart)).toEqual(["water", "ground"]);

    const suggestions = suggestCountersByType("water ground", TEAM, speciesLookup, moveLookup, chart);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]?.species).toBe("Charizard");
    expect(suggestions[0]?.reasons.join(" ")).toContain("4x");
  });

  it("accounts for defensive ability immunities like Levitate", () => {
    const chart = buildTypeChart(TYPES);
    const speciesLookup = createSpeciesLookup(SPECIES);
    const levitateTeam: TeamMember[] = [
      {
        id: "3",
        species: "Rotom-Wash",
        form: "",
        ability: "Levitate",
        item: "",
        level: 50,
        nature: "Calm",
        gender: "N",
        evs: { hp: 252, atk: 0, def: 0, spa: 0, spd: 252, spe: 4 },
        ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
        moves: ["Thunderbolt", "", "", ""],
      },
    ];

    const rows = analyzeTeamWeaknesses(levitateTeam, speciesLookup, chart);
    const groundRow = rows.find((row) => row.type === "ground");
    expect(groundRow).toMatchObject({ weak: 0, immune: 1 });
  });

  it("treats variable-power physical/special moves as damaging", () => {
    const miniTypes: TypeEntry[] = [
      {
        name: "fighting",
        display: "Fighting",
        relations: {
          doubleDamageFrom: ["flying", "psychic", "fairy"],
          doubleDamageTo: ["normal", "rock", "steel", "ice", "dark"],
          halfDamageFrom: ["bug", "rock", "dark"],
          halfDamageTo: ["flying", "poison", "bug", "psychic", "fairy"],
          noDamageFrom: [],
          noDamageTo: ["ghost"],
        },
      },
      {
        name: "normal",
        display: "Normal",
        relations: {
          doubleDamageFrom: ["fighting"],
          doubleDamageTo: [],
          halfDamageFrom: [],
          halfDamageTo: ["rock", "steel"],
          noDamageFrom: ["ghost"],
          noDamageTo: ["ghost"],
        },
      },
    ];

    const miniMoves: MoveEntry[] = [
      {
        name: "low-kick",
        display: "Low Kick",
        type: "fighting",
        priority: 0,
        power: null,
        damageClass: "physical",
      },
    ];

    const miniMember: TeamMember = {
      id: "low-kick-user",
      species: "Any",
      form: "",
      ability: "",
      item: "",
      level: 50,
      nature: "Serious",
      gender: "N",
      evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      moves: ["Low Kick", "", "", ""],
    };

    const chart = buildTypeChart(miniTypes);
    const moveLookup = createMoveLookup(miniMoves);

    const summary = analyzeMemberMoves(miniMember, moveLookup, chart);
    expect(summary[0]?.coverage.superEffective).toContain("normal");

    const coverage = getTeamCoverageByType([miniMember], moveLookup, chart);
    expect(coverage.normal).toBe(2);
  });
});
