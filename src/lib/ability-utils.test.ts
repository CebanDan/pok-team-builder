import { describe, expect, it } from "vitest";

import { mergeSpeciesAbilityOptions, mergeSpeciesAbilityWithResolved } from "@/lib/ability-utils";
import type { AbilityEntry } from "@/lib/pokedex";

describe("ability hidden flag merging", () => {
  it("preserves hidden flag for gliscor poison heal when resolved cache lacks isHidden", () => {
    const speciesAbility: AbilityEntry = {
      name: "poison-heal",
      display: "Poison Heal",
      isHidden: true,
    };
    const resolvedAbility: AbilityEntry = {
      name: "poison-heal",
      display: "Poison Heal",
      description: "Heals if poisoned.",
      shortDescription: "Heals while poisoned.",
    };

    const merged = mergeSpeciesAbilityWithResolved(speciesAbility, resolvedAbility);
    expect(merged.isHidden).toBe(true);
    expect(merged.description).toBe("Heals if poisoned.");
  });

  it("does not mark non-hidden abilities as hidden", () => {
    const speciesAbility: AbilityEntry = {
      name: "hyper-cutter",
      display: "Hyper Cutter",
      isHidden: false,
    };
    const resolvedAbility: AbilityEntry = {
      name: "hyper-cutter",
      display: "Hyper Cutter",
      description: "Prevents Attack drops.",
    };

    const merged = mergeSpeciesAbilityWithResolved(speciesAbility, resolvedAbility);
    expect(merged.isHidden).toBe(false);
  });

  it("merges full species ability lists while keeping species hidden flags", () => {
    const speciesAbilities: AbilityEntry[] = [
      { name: "hyper-cutter", display: "Hyper Cutter", isHidden: false },
      { name: "sand-veil", display: "Sand Veil", isHidden: false },
      { name: "poison-heal", display: "Poison Heal", isHidden: true },
    ];
    const resolvedAbilities: Record<string, AbilityEntry> = {
      "hyper-cutter": { name: "hyper-cutter", display: "Hyper Cutter", description: "Cached detail" },
      "sand-veil": { name: "sand-veil", display: "Sand Veil", description: "Cached detail" },
      "poison-heal": { name: "poison-heal", display: "Poison Heal", description: "Cached detail" },
    };

    const merged = mergeSpeciesAbilityOptions(speciesAbilities, resolvedAbilities);
    const poisonHeal = merged.find((ability) => ability.name === "poison-heal");
    expect(poisonHeal?.isHidden).toBe(true);
    expect(poisonHeal?.description).toBe("Cached detail");
  });
});
