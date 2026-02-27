export const STATS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;

export type StatKey = (typeof STATS)[number];
export type Gender = "M" | "F" | "N";
export type FormatId = "ou" | "uu" | "vgc" | "custom";

export type StatSpread = Record<StatKey, number>;

export interface TeamMember {
  id: string;
  species: string;
  form: string;
  ability: string;
  item: string;
  level: number;
  nature: string;
  gender: Gender;
  evs: StatSpread;
  ivs: StatSpread;
  moves: string[];
}

export interface TeamData {
  members: TeamMember[];
}

export interface TeamRecord {
  id: string;
  name: string;
  format?: FormatId;
  maxSize: number;
  createdAt: string;
  updatedAt: string;
  data: TeamData;
}

export interface TeamVersionRecord {
  id: string;
  version: number;
  createdAt: string;
}

export interface TypeRelations {
  doubleDamageFrom: string[];
  doubleDamageTo: string[];
  halfDamageFrom: string[];
  halfDamageTo: string[];
  noDamageFrom: string[];
  noDamageTo: string[];
}

export type TypeChart = Record<string, TypeRelations>;

export interface FormatRule {
  id: FormatId;
  name: string;
  description: string;
  defaultTeamSize: number;
  maxTeamSize: number;
  bannedSpecies: string[];
  bannedMoves: string[];
  bannedItems: string[];
}

export interface ConstraintIssue {
  memberId: string;
  field: "species" | "move" | "item";
  value: string;
  reason: string;
}

export interface TeamWeaknessEntry {
  type: string;
  weak: number;
  resistant: number;
  immune: number;
  neutral: number;
}

export interface MoveEffectivenessBreakdown {
  superEffective: string[];
  neutral: string[];
  resisted: string[];
  immune: string[];
}

export interface MoveAnalysis {
  move: string;
  type: string;
  coverage: MoveEffectivenessBreakdown;
}

export interface CounterSuggestion {
  memberId: string;
  species: string;
  score: number;
  reasons: string[];
}

export const NATURES = [
  "Hardy",
  "Lonely",
  "Brave",
  "Adamant",
  "Naughty",
  "Bold",
  "Docile",
  "Relaxed",
  "Impish",
  "Lax",
  "Timid",
  "Hasty",
  "Serious",
  "Jolly",
  "Naive",
  "Modest",
  "Mild",
  "Quiet",
  "Bashful",
  "Rash",
  "Calm",
  "Gentle",
  "Sassy",
  "Careful",
  "Quirky",
] as const;

export function createEmptyStats(defaultValue: number): StatSpread {
  return {
    hp: defaultValue,
    atk: defaultValue,
    def: defaultValue,
    spa: defaultValue,
    spd: defaultValue,
    spe: defaultValue,
  };
}

export function createDefaultMember(): TeamMember {
  return {
    id: crypto.randomUUID(),
    species: "",
    form: "",
    ability: "",
    item: "",
    level: 100,
    nature: "Serious",
    gender: "N",
    evs: createEmptyStats(0),
    ivs: createEmptyStats(31),
    moves: ["", "", "", ""],
  };
}

export function createDefaultTeamData(): TeamData {
  return {
    members: [],
  };
}
