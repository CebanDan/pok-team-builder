import type { FormatId, TeamRecord, TeamVersionRecord } from "@/lib/domain";
import type { AbilityEntry, ItemEntry, MoveEntry, SpeciesEntry, TypeEntry } from "@/lib/pokedex";

export type BootstrapPayload = {
  formats: {
    id: FormatId;
    name: string;
    description: string;
    defaultTeamSize: number;
    maxTeamSize: number;
    bannedSpecies: string[];
    bannedMoves: string[];
    bannedItems: string[];
  }[];
  types: TypeEntry[];
  species: SpeciesEntry[];
  moves: MoveEntry[];
  items: ItemEntry[];
  abilities: AbilityEntry[];
};

export type TeamPayload = {
  team: TeamRecord;
};

export type SavePayload = {
  team: TeamRecord;
  version: number;
};

export type VersionsPayload = {
  versions: TeamVersionRecord[];
};
