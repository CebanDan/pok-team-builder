import type { TypeRelations } from "@/lib/domain";

export interface SpeciesEntry {
  name: string;
  display: string;
  types: string[];
  forms: string[];
  pokeapiId?: number;
  sprite?: string;
}

export interface MoveEntry {
  name: string;
  display: string;
  type: string;
  priority: number;
  power: number | null;
  accuracy: number | null;
  // always present; null means unknown/status
  damageClass: string | null;
  description?: string;
  shortDescription?: string;
}

export interface ItemEntry {
  name: string;
  display: string;
  category?: string;
  description?: string;
  shortDescription?: string;
  sprite?: string;
}

export interface AbilityEntry {
  name: string;
  display: string;
  description?: string;
  shortDescription?: string;
  usage?: number;
  isHidden?: boolean;
}

export interface TypeEntry {
  name: string;
  display: string;
  relations: TypeRelations;
}

export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export function toTitleCase(name: string): string {
  return name
    .split("-")
    .map((segment) => (segment.length ? segment[0].toUpperCase() + segment.slice(1) : segment))
    .join(" ");
}

export function createSpeciesLookup(species: SpeciesEntry[]): Record<string, SpeciesEntry> {
  const map: Record<string, SpeciesEntry> = {};
  for (const entry of species) {
    map[normalizeName(entry.name)] = entry;
    map[normalizeName(entry.display)] = entry;
  }
  return map;
}

export function createMoveLookup(moves: MoveEntry[]): Record<string, MoveEntry> {
  return Object.fromEntries(moves.map((entry) => [normalizeName(entry.name), entry]));
}

export function createItemLookup(items: ItemEntry[]): Record<string, ItemEntry> {
  const map: Record<string, ItemEntry> = {};
  for (const entry of items) {
    map[normalizeName(entry.name)] = entry;
    map[normalizeName(entry.display)] = entry;
  }
  return map;
}

export function createAbilityLookup(abilities: AbilityEntry[]): Record<string, AbilityEntry> {
  const map: Record<string, AbilityEntry> = {};
  for (const entry of abilities) {
    map[normalizeName(entry.name)] = entry;
    map[normalizeName(entry.display)] = entry;
  }
  return map;
}
