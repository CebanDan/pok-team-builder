"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { clsx } from "clsx";

import {
  getMatchingCompatibilityDetails,
  type CompatibleMoveEntry,
  type MoveCompatibilityDetail,
} from "@/lib/move-compatibility";
import { normalizeName, toTitleCase, type MoveEntry } from "@/lib/pokedex";
import { sanitizePokeApiDescription } from "@/lib/string-utils";

import { Modal } from "@/components/modal";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  moves: CompatibleMoveEntry[];
  onSelect: (moveName: string) => void;
  selectedMove?: string;
  pokemonName?: string;
  pokemonTypes: string[];
  memberLevel: number;
  compatibilityStatus: "loading" | "ready" | "invalid" | "error";
  compatibilityMessage?: string;
  latestVersionGroup: string | null;
};

type MoveDetailsResponse = {
  effect_entries?: { effect?: string; short_effect?: string; language?: { name?: string } }[];
  flavor_text_entries?: { flavor_text?: string; language?: { name?: string } }[];
  effect_chance?: number | null;
  power: number | null;
  accuracy: number | null;
  priority: number;
  damage_class?: { name?: string } | null;
  type: { name: string };
};

const TYPE_BADGE_CLASSES: Record<string, string> = {
  bug: "bg-lime-500/20 text-lime-200 border-lime-500/50",
  dark: "bg-zinc-500/20 text-zinc-200 border-zinc-400/50",
  dragon: "bg-indigo-500/20 text-indigo-200 border-indigo-400/50",
  electric: "bg-yellow-500/20 text-yellow-200 border-yellow-400/50",
  fairy: "bg-pink-500/20 text-pink-200 border-pink-400/50",
  fighting: "bg-red-500/20 text-red-200 border-red-400/50",
  fire: "bg-orange-500/20 text-orange-200 border-orange-400/50",
  flying: "bg-sky-500/20 text-sky-200 border-sky-400/50",
  ghost: "bg-violet-500/20 text-violet-200 border-violet-400/50",
  grass: "bg-emerald-500/20 text-emerald-200 border-emerald-400/50",
  ground: "bg-amber-600/20 text-amber-200 border-amber-500/50",
  ice: "bg-cyan-500/20 text-cyan-200 border-cyan-400/50",
  normal: "bg-stone-500/20 text-stone-200 border-stone-400/50",
  poison: "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/50",
  psychic: "bg-rose-500/20 text-rose-200 border-rose-400/50",
  rock: "bg-yellow-700/20 text-yellow-100 border-yellow-700/50",
  steel: "bg-slate-500/20 text-slate-200 border-slate-400/50",
  water: "bg-blue-500/20 text-blue-200 border-blue-400/50",
};

function toMethodBadge(detail: MoveCompatibilityDetail): string {
  if (detail.methodCategory === "level-up") return `Lv ${detail.levelLearnedAt}`;
  if (detail.methodCategory === "machine") return "Machine";
  if (detail.methodCategory === "egg") return "Egg";
  if (detail.methodCategory === "tutor") return "Tutor";
  if (detail.methodCategory === "form-change") return "Form";
  if (detail.methodCategory === "event") return "Event";
  return detail.learnMethodLabel;
}

export function MovesModal({
  isOpen,
  onClose,
  moves,
  onSelect,
  selectedMove,
  pokemonName,
  pokemonTypes,
  memberLevel,
  compatibilityStatus,
  compatibilityMessage,
  latestVersionGroup,
}: Props) {
  const [search, setSearch] = useState("");
  const [loadingMoves, setLoadingMoves] = useState<Record<string, boolean>>({});
  const [detailedMoves, setDetailedMoves] = useState<Record<string, MoveEntry>>({});
  const [attemptedMoves, setAttemptedMoves] = useState<Record<string, boolean>>({});
  const pokemonTypeSet = useMemo(() => new Set(pokemonTypes.map((typeName) => normalizeName(typeName))), [pokemonTypes]);

  useEffect(() => {
    setSearch("");
  }, [pokemonName]);

  const compatibilityFilter = useMemo(
    () => ({
      versionGroup: "all" as const,
      latestVersionGroup,
      maxLevel: memberLevel,
      includeEventMoves: true,
      includeSpecialMoves: true,
    }),
    [latestVersionGroup, memberLevel],
  );

  const filteredMoves = useMemo(() => {
    const normalizedTerm = search
      .toLowerCase()
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const searchTokens = normalizedTerm ? normalizedTerm.split(" ") : [];

    return moves.filter((move) => {
      const matchingCompatibility = getMatchingCompatibilityDetails(move.compatibility, compatibilityFilter);
      if (!matchingCompatibility.length) return false;

      const searchBlob = [
        move.display,
        move.name,
        move.description ?? "",
        move.shortDescription ?? "",
        ...matchingCompatibility.map((entry) => `${entry.versionGroupLabel} ${entry.learnMethodLabel}`),
      ]
        .join(" ")
        .toLowerCase()
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      return searchTokens.length === 0 || searchTokens.every((token) => searchBlob.includes(token));
    });
  }, [moves, search, compatibilityFilter]);

  const handleSelect = (moveName: string) => {
    onSelect(moveName);
    onClose();
  };

  const fetchMoveDetails = useCallback(
    async (move: MoveEntry): Promise<void> => {
      if (
        attemptedMoves[move.name] ||
        detailedMoves[move.name] ||
        loadingMoves[move.name] ||
        move.description ||
        move.shortDescription
      ) {
        return;
      }

      setAttemptedMoves((prev) => ({ ...prev, [move.name]: true }));
      setLoadingMoves((prev) => ({ ...prev, [move.name]: true }));
      try {
        const response = await fetch(`https://pokeapi.co/api/v2/move/${move.name}`);
        if (!response.ok) throw new Error();
        const data = (await response.json()) as MoveDetailsResponse;

        const englishEffect = data.effect_entries?.find((entry) => entry.language?.name === "en");
        const englishFlavor = data.flavor_text_entries?.find((entry) => entry.language?.name === "en");

        setDetailedMoves((prev) => ({
          ...prev,
          [move.name]: {
            ...move,
            description: sanitizePokeApiDescription(
              englishEffect?.effect || englishFlavor?.flavor_text,
              data.effect_chance,
            ),
            shortDescription: sanitizePokeApiDescription(
              englishEffect?.short_effect || englishFlavor?.flavor_text,
              data.effect_chance,
            ),
            power: data.power,
            accuracy: data.accuracy,
            priority: data.priority,
            damageClass: data.damage_class?.name ?? null,
            type: data.type.name,
          },
        }));
      } catch {
        // Keep the lightweight payload if details fail.
      } finally {
        setLoadingMoves((prev) => ({ ...prev, [move.name]: false }));
      }
    },
    [attemptedMoves, detailedMoves, loadingMoves],
  );

  useEffect(() => {
    if (!isOpen) return;

    const prefetchCandidates = filteredMoves
      .filter(
        (move) =>
          !move.description &&
          !move.shortDescription &&
          !attemptedMoves[move.name] &&
          !detailedMoves[move.name] &&
          !loadingMoves[move.name],
      )
      .slice(0, 80);

    if (!prefetchCandidates.length) return;
    void Promise.all(prefetchCandidates.map((move) => fetchMoveDetails(move)));
  }, [isOpen, filteredMoves, attemptedMoves, detailedMoves, loadingMoves, fetchMoveDetails]);

  const noMovesMessage = useMemo(() => {
    if (!pokemonName?.trim()) return "Select a valid Pokemon to view compatible moves.";
    if (compatibilityStatus === "loading") return `Loading compatible moves for ${pokemonName}...`;
    if (compatibilityStatus === "invalid") {
      return compatibilityMessage || "Pokemon selection is invalid. Choose a valid species or form.";
    }
    if (compatibilityStatus === "error") {
      return compatibilityMessage || "Could not load move compatibility right now.";
    }
    if (moves.length === 0) return "No compatible moves are available.";
    if (search.trim()) {
      return `No compatible moves found matching "${search}".`;
    }
    return "No compatible moves are available.";
  }, [pokemonName, compatibilityStatus, compatibilityMessage, moves.length, search]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select a Move"
      maxWidth="4xl"
    >
      <div className="space-y-4">
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
            placeholder="SEARCH COMPATIBLE MOVES..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-[1.15fr_0.75fr_1.1fr_2fr] gap-4 border-b border-slate-800 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          <span>Move</span>
          <span>Stats</span>
          <span>Class</span>
          <span>Description</span>
        </div>

        <div className="custom-scrollbar max-h-[500px] space-y-1 overflow-y-auto pr-1">
          {filteredMoves.length > 0 ? (
            filteredMoves.map((move) => {
              const isActive = selectedMove === move.display;
              const details = detailedMoves[move.name] || move;
              const isLoading = loadingMoves[move.name];
              const matchingCompatibility = getMatchingCompatibilityDetails(move.compatibility, compatibilityFilter);
              const previewBadges = matchingCompatibility.slice(0, 2).map(toMethodBadge);
              const primaryVersion = matchingCompatibility[0]?.versionGroupLabel;
              const stab = pokemonTypeSet.has(normalizeName(details.type));

              return (
                <button
                  key={move.name}
                  onClick={() => handleSelect(move.display)}
                  onMouseEnter={() => void fetchMoveDetails(move)}
                  className={clsx(
                    "group grid w-full grid-cols-[1.15fr_0.75fr_1.1fr_2fr] items-center gap-4 rounded-xl px-4 py-4 text-left transition-all duration-200",
                    isActive
                      ? "border-l-4 border-amber-400 bg-amber-400/10"
                      : "border-l-4 border-transparent hover:bg-slate-800/50",
                  )}
                >
                  <div className="flex flex-col gap-1">
                    <span
                      className={clsx(
                        "text-xs font-bold italic uppercase tracking-wider transition-colors",
                        isActive ? "text-amber-400" : "text-slate-300 group-hover:text-amber-400",
                      )}
                    >
                      {move.display}
                    </span>
                    <div className="flex flex-wrap items-center gap-1">
                      <span
                        className={clsx(
                          "inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight",
                          TYPE_BADGE_CLASSES[details.type] || "border-slate-600 bg-slate-700/50 text-slate-200",
                        )}
                      >
                        {toTitleCase(details.type)}
                      </span>
                      {stab ? (
                        <span className="rounded border border-amber-500/70 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight text-amber-200">
                          STAB
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 text-[10px] font-medium text-slate-300">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">PWR:</span>
                      <span className="font-bold">{typeof details.power === "number" ? details.power : "-"}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">ACC:</span>
                      <span className="font-bold">{typeof details.accuracy === "number" ? details.accuracy : "-"}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {details.damageClass ? toTitleCase(details.damageClass) : "Status"}
                    </span>
                    <span className="text-[9px] text-slate-500">
                      Priority: {details.priority > 0 ? `+${details.priority}` : details.priority < 0 ? details.priority : "0"}
                    </span>
                    {primaryVersion ? <span className="text-[9px] text-slate-500">{primaryVersion}</span> : null}
                    {previewBadges.length ? (
                      <div className="flex flex-wrap gap-1">
                        {previewBadges.map((badge, badgeIndex) => (
                          <span
                            className="rounded border border-slate-600 bg-slate-800/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-tight text-slate-200"
                            key={`${move.name}-${badge}-${badgeIndex}`}
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <span className="line-clamp-2 text-[11px] italic leading-relaxed text-slate-400">
                    {details.shortDescription || details.description || (isLoading ? "Loading..." : "No description available.")}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="rounded-xl border border-slate-700 bg-slate-950/40 py-12 text-center text-slate-400 italic">
              {noMovesMessage}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
