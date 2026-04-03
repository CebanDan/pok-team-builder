"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { type AbilityEntry } from "@/lib/pokedex";
import { clsx } from "clsx";
import { sanitizePokeApiDescription } from "@/lib/string-utils";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  abilities: AbilityEntry[];
  onSelect: (abilityName: string) => void;
  selectedAbility?: string;
};

type AbilityDetailsResponse = {
  effect_entries?: { effect?: string; short_effect?: string; language?: { name?: string } }[];
  flavor_text_entries?: { flavor_text?: string; language?: { name?: string } }[];
};

export function AbilitiesModal({
  isOpen,
  onClose,
  abilities,
  onSelect,
  selectedAbility,
}: Props) {
  const [search, setSearch] = useState("");
  const [loadingAbilities, setLoadingAbilities] = useState<Record<string, boolean>>({});
  const [detailedAbilities, setDetailedAbilities] = useState<Record<string, AbilityEntry>>({});
  const [attemptedAbilities, setAttemptedAbilities] = useState<Record<string, boolean>>({});

  const filteredAbilities = useMemo(() => {
    const term = search.toLowerCase();
    return abilities.filter(
      (ability) =>
        ability.display.toLowerCase().includes(term) ||
        ability.name.toLowerCase().includes(term) ||
        ability.description?.toLowerCase().includes(term)
    );
  }, [abilities, search]);

  const handleSelect = (abilityName: string) => {
    onSelect(abilityName);
    onClose();
  };

  const fetchAbilityDetails = useCallback(
    async (ability: AbilityEntry) => {
      if (
        attemptedAbilities[ability.name] ||
        detailedAbilities[ability.name] ||
        loadingAbilities[ability.name] ||
        ability.description ||
        ability.shortDescription
      ) {
        return;
      }

      setAttemptedAbilities((prev) => ({ ...prev, [ability.name]: true }));
      setLoadingAbilities((prev) => ({ ...prev, [ability.name]: true }));
      try {
        const response = await fetch(`https://pokeapi.co/api/v2/ability/${ability.name}`);
        if (!response.ok) throw new Error();
        const data = (await response.json()) as AbilityDetailsResponse;

        const englishEffect = data.effect_entries?.find((entry) => entry.language?.name === "en");
        const englishFlavor = data.flavor_text_entries?.find((entry) => entry.language?.name === "en");

        setDetailedAbilities((prev) => ({
          ...prev,
          [ability.name]: {
            ...ability,
            description: sanitizePokeApiDescription(englishEffect?.effect || englishFlavor?.flavor_text),
            shortDescription: sanitizePokeApiDescription(englishEffect?.short_effect || englishFlavor?.flavor_text),
          },
        }));
      } catch {
        // Keep base ability data on fetch failure.
      } finally {
        setLoadingAbilities((prev) => ({ ...prev, [ability.name]: false }));
      }
    },
    [attemptedAbilities, detailedAbilities, loadingAbilities],
  );

  useEffect(() => {
    if (!isOpen) return;

    const prefetchCandidates = filteredAbilities
      .filter(
        (ability) =>
          !ability.description &&
          !ability.shortDescription &&
          !attemptedAbilities[ability.name] &&
          !detailedAbilities[ability.name] &&
          !loadingAbilities[ability.name],
      )
      .slice(0, 80);

    if (!prefetchCandidates.length) return;
    void Promise.all(prefetchCandidates.map((ability) => fetchAbilityDetails(ability)));
  }, [isOpen, filteredAbilities, attemptedAbilities, detailedAbilities, loadingAbilities, fetchAbilityDetails]);

  const renderAbilityButton = (ability: AbilityEntry) => {
    const isActive = selectedAbility === ability.display;
    const details = detailedAbilities[ability.name] || ability;
    const isLoading = loadingAbilities[ability.name];

    return (
      <button
        key={ability.name}
        onClick={() => handleSelect(ability.display)}
        onMouseEnter={() => void fetchAbilityDetails(ability)}
        className={clsx(
          "group grid w-full grid-cols-[1fr_2fr] items-center gap-4 rounded-xl px-4 py-4 text-left transition-all duration-200",
          isActive
            ? "bg-amber-400/10 border-l-4 border-amber-400"
            : "hover:bg-slate-800/50 border-l-4 border-transparent"
        )}
      >
        <div className="flex flex-col">
          <span
            className={clsx(
              "text-xs font-bold italic uppercase tracking-wider transition-colors",
              isActive ? "text-amber-400" : "text-slate-300 group-hover:text-amber-400"
            )}
          >
            {ability.display}
          </span>
          {ability.isHidden && (
            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-amber-500/80">
              Hidden Ability
            </span>
          )}
        </div>
        <span className="text-[11px] leading-relaxed text-slate-400 line-clamp-2 italic">
          {details.shortDescription || details.description || (isLoading ? "Loading description..." : "No description available.")}
        </span>
      </button>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select an Ability"
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg
              className="h-4 w-4 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            className="input-dark w-full rounded-xl bg-slate-950/50 py-3 pl-10 pr-4 text-sm font-medium tracking-wide placeholder:text-slate-600 focus:ring-2 focus:ring-amber-500/50 transition-all"
            placeholder="SEARCH FOR ABILITY..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[1fr_2fr] gap-4 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 border-b border-slate-800">
          <span>Ability Asset</span>
          <span>Description</span>
        </div>

        {/* Ability List */}
        <div className="space-y-1 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
          {filteredAbilities.length > 0 ? (
            filteredAbilities.map(renderAbilityButton)
          ) : (
            <div className="py-12 text-center text-slate-500 italic">
              No abilities found matching &quot;{search}&quot;
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
