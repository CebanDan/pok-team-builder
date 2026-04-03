import { normalizeName, type AbilityEntry } from "@/lib/pokedex";

export function mergeSpeciesAbilityWithResolved(
  speciesAbility: AbilityEntry,
  resolvedAbility?: AbilityEntry,
): AbilityEntry {
  if (!resolvedAbility) {
    return { ...speciesAbility };
  }

  return {
    ...resolvedAbility,
    ...speciesAbility,
    // Hidden ability status is species-specific and must not be overridden by global caches.
    isHidden: speciesAbility.isHidden,
  };
}

export function mergeSpeciesAbilityOptions(
  speciesAbilities: AbilityEntry[],
  resolvedAbilities: Record<string, AbilityEntry>,
): AbilityEntry[] {
  return speciesAbilities.map((ability) => {
    const key = normalizeName(ability.name);
    return mergeSpeciesAbilityWithResolved(ability, resolvedAbilities[key]);
  });
}
