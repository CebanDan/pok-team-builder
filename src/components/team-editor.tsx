"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  analyzeMemberMoves,
  analyzeTeamWeaknesses,
  buildTypeChart,
  getAnalyzerTypeNames,
  getCoverageIndicator,
  getMemberDefensiveMultiplier,
  getTeamCoverageByType,
  isDamagingMove,
  offensiveMultiplier,
  suggestCountersByType,
} from "@/lib/analysis";
import { createDefaultMember, NATURES, STATS, type FormatId, type TeamData, type TeamMember } from "@/lib/domain";
import type { BootstrapPayload, SavePayload, TeamPayload } from "@/lib/editor-types";
import { FORMAT_OPTIONS, getFormatRule, validateMemberAgainstFormat } from "@/lib/formats";
import { ApiError, apiFetch } from "@/lib/http-client";
import {
  createMoveLookup,
  createSpeciesLookup,
  normalizeName,
  toTitleCase,
  type MoveEntry,
  type SpeciesEntry,
} from "@/lib/pokedex";
import { exportShowdownText, parseShowdownText } from "@/lib/showdown";
import { DEFAULT_TYPE_ENTRIES } from "@/lib/type-chart-fallback";

import { MemberCard } from "@/components/member-card";
import { TeamAnalysis } from "@/components/team-analysis";
import { TeamChecklist } from "@/components/team-checklist";
import { SpriteImage } from "@/components/sprite-image";

type EditableTeam = {
  name: string;
  format?: FormatId;
  maxSize: number;
  data: TeamData;
};

type SpeciesRuntimeOptions = {
  abilities: string[];
  moves: string[];
};

const SLOT_COUNT = 6;
const HISTORY_LIMIT = 60;
const FALLBACK_BOOTSTRAP: BootstrapPayload = {
  formats: FORMAT_OPTIONS,
  types: DEFAULT_TYPE_ENTRIES,
  species: [],
  moves: [],
  items: [],
  abilities: [],
};

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sanitizeMember(member: TeamMember): TeamMember {
  const next = cloneValue(member);
  next.level = 100;

  for (const stat of STATS) {
    next.evs[stat] = Math.max(0, Math.min(252, next.evs[stat] ?? 0));
    next.ivs[stat] = Math.max(0, Math.min(31, next.ivs[stat] ?? 31));
  }

  const totalEv = STATS.reduce((sum, stat) => sum + next.evs[stat], 0);
  if (totalEv > 510) {
    let overflow = totalEv - 510;
    const orderedStats = [...STATS].sort((left, right) => next.evs[right] - next.evs[left]);
    for (const stat of orderedStats) {
      if (overflow <= 0) break;
      const reduction = Math.min(overflow, next.evs[stat]);
      next.evs[stat] -= reduction;
      overflow -= reduction;
    }
  }

  next.moves = [...next.moves.slice(0, 4), "", "", "", ""].slice(0, 4);
  return next;
}

function normalizeMembers(members: TeamMember[], slotCount = SLOT_COUNT): TeamMember[] {
  const next = members.slice(0, slotCount).map((member) => sanitizeMember(member));
  while (next.length < slotCount) next.push(createDefaultMember());
  return next;
}

function normalizeEditableTeam(team: EditableTeam): EditableTeam {
  return {
    ...team,
    maxSize: SLOT_COUNT,
    data: {
      members: normalizeMembers(team.data.members, SLOT_COUNT),
    },
  };
}

function toEditableTeam(team: TeamPayload["team"]): EditableTeam {
  return normalizeEditableTeam({
    name: team.name,
    format: team.format,
    maxSize: SLOT_COUNT,
    data: cloneValue(team.data),
  });
}

export function TeamEditor({ teamId }: { teamId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapPayload>(FALLBACK_BOOTSTRAP);
  const [team, setTeam] = useState<TeamPayload["team"] | null>(null);
  const [draft, setDraft] = useState<EditableTeam | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [dirty, setDirty] = useState(false);
  const [history, setHistory] = useState<EditableTeam[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);
  const [threatType, setThreatType] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"import" | "export" | null>(null);
  const [showMobileImport, setShowMobileImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [exportText, setExportText] = useState("");
  const [resolvedMoves, setResolvedMoves] = useState<Record<string, MoveEntry>>({});
  const [resolvedSpecies, setResolvedSpecies] = useState<Record<string, SpeciesEntry>>({});
  const [speciesRuntimeOptions, setSpeciesRuntimeOptions] = useState<Record<string, SpeciesRuntimeOptions>>({});

  const historyRef = useRef<EditableTeam[]>([]);
  const historyIndexRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportTextAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    async function loadTeam() {
      setLoading(true);
      setError(null);
      try {
        const payload = await apiFetch<TeamPayload>(`/api/teams/${teamId}`, { method: "GET" });
        if (!active) return;
        const editable = toEditableTeam(payload.team);
        setTeam(payload.team);
        setDraft(editable);
        setSelectedSlotIndex(0);
        historyRef.current = [cloneValue(editable)];
        historyIndexRef.current = 0;
        setHistory(historyRef.current);
        setHistoryIndex(0);
        setLoading(false);
      } catch (loadError) {
        if (!active) return;
        if (loadError instanceof ApiError && loadError.status === 401) {
          window.location.href = "/";
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Failed to load team.");
        setLoading(false);
      }
    }

    void loadTeam();
    return () => {
      active = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [teamId]);

  useEffect(() => {
    let active = true;
    async function loadBootstrap() {
      try {
        const payload = await apiFetch<BootstrapPayload>("/api/data/bootstrap", { method: "GET" });
        if (!active) return;
        setBootstrap(payload);
        setResolvedMoves({});
        setThreatType((current) => current || "");
      } catch {
        if (!active) return;
      }
    }
    void loadBootstrap();
    return () => {
      active = false;
    };
  }, []);

  const speciesLookup = useMemo(() => createSpeciesLookup(bootstrap.species), [bootstrap.species]);
  const effectiveSpeciesLookup = useMemo(
    () => ({ ...speciesLookup, ...resolvedSpecies }),
    [speciesLookup, resolvedSpecies],
  );
  const moveLookup = useMemo(() => createMoveLookup(bootstrap.moves), [bootstrap.moves]);
  const effectiveMoveLookup = useMemo(
    () => ({ ...moveLookup, ...resolvedMoves }),
    [moveLookup, resolvedMoves],
  );
  const typeChart = useMemo(
    () => buildTypeChart(bootstrap.types.length ? bootstrap.types : DEFAULT_TYPE_ENTRIES),
    [bootstrap.types],
  );
  const speciesOptions = useMemo(() => {
    if (bootstrap.species.length) return bootstrap.species;
    const deduped: Record<string, SpeciesEntry> = {};
    for (const entry of Object.values(resolvedSpecies)) {
      deduped[normalizeName(entry.name)] = entry;
    }
    return Object.values(deduped).sort((left, right) => left.display.localeCompare(right.display));
  }, [bootstrap.species, resolvedSpecies]);
  const threatTypeOptions = useMemo(() => {
    return getAnalyzerTypeNames(typeChart);
  }, [typeChart]);

  const formatRule = draft ? getFormatRule(draft.format) : null;

  const constraintIssues = useMemo(() => {
    if (!draft || !formatRule) return [];
    return draft.data.members.flatMap((member) => validateMemberAgainstFormat(member, formatRule));
  }, [draft, formatRule]);

  const weaknesses = useMemo(() => {
    if (!draft) return [];
    return analyzeTeamWeaknesses(draft.data.members, effectiveSpeciesLookup, typeChart);
  }, [draft, effectiveSpeciesLookup, typeChart]);

  const resistanceMatrix = useMemo(() => {
    if (!draft) return [];
    const typeNames = getAnalyzerTypeNames(typeChart);
    return typeNames.map((typeName) => {
      const memberMultipliers = draft.data.members.map((member) => {
        return getMemberDefensiveMultiplier(member, typeName, effectiveSpeciesLookup, typeChart);
      });
      const weak = memberMultipliers.filter((value): value is number => value !== null && value > 1).length;
      const resistant = memberMultipliers.filter((value): value is number => value !== null && value < 1).length;
      return {
        type: typeName,
        memberMultipliers,
        weak,
        resistant,
        coverage: resistant - weak,
      };
    });
  }, [draft, effectiveSpeciesLookup, typeChart]);

  const moveCoverageMatrix = useMemo(() => {
    if (!draft) return [];
    const typeNames = getAnalyzerTypeNames(typeChart);
    return typeNames.map((targetType) => {
      const memberMultipliers = draft.data.members.map((member) => {
        let bestMultiplier = 0;
        let foundMove = false;
        for (const moveName of member.moves) {
          const move = effectiveMoveLookup[normalizeName(moveName)];
          if (!move) continue;
          if (!isDamagingMove(move)) continue; // Skip status moves
          foundMove = true;
          const multiplier = offensiveMultiplier(move.type, targetType, typeChart);
          if (multiplier > bestMultiplier) {
            bestMultiplier = multiplier;
          }
        }
        if (!foundMove) return null;
        return bestMultiplier;
      });
      const weak = memberMultipliers.filter((value): value is number => value !== null && value > 1).length;
      const resistant = memberMultipliers.filter(
        (value): value is number => value !== null && value > 0 && value < 1,
      ).length;
      const coverage = memberMultipliers.reduce<number>((best, value) => {
        if (value === null) return best;
        return value > best ? value : best;
      }, 0);
      return {
        type: targetType,
        memberMultipliers,
        weak,
        resistant,
        coverage,
      };
    });
  }, [draft, effectiveMoveLookup, typeChart]);

  const coverageByType = useMemo(() => {
    if (!draft) return {};
    return getTeamCoverageByType(draft.data.members, effectiveMoveLookup, typeChart);
  }, [draft, effectiveMoveLookup, typeChart]);

  const coverageIndicator = useMemo(() => {
    if (!draft) return { coveredTypes: 0, totalTypes: 0, averageBestMultiplier: 0 };
    return getCoverageIndicator(draft.data.members, effectiveMoveLookup, typeChart);
  }, [draft, effectiveMoveLookup, typeChart]);

  const moveSummaryByMember = useMemo(() => {
    if (!draft) return {};
    return Object.fromEntries(
      draft.data.members.map((member) => [member.id, analyzeMemberMoves(member, effectiveMoveLookup, typeChart)]),
    ) as Record<string, ReturnType<typeof analyzeMemberMoves>>;
  }, [draft, effectiveMoveLookup, typeChart]);

  const threatSuggestions = useMemo(() => {
    if (!draft || !threatType) return [];
    return suggestCountersByType(
      threatType,
      draft.data.members,
      effectiveSpeciesLookup,
      effectiveMoveLookup,
      typeChart,
    );
  }, [draft, threatType, effectiveSpeciesLookup, effectiveMoveLookup, typeChart]);

  useEffect(() => {
    if (!draft) return;
    const unknownMoves = new Set<string>();
    for (const member of draft.data.members) {
      for (const moveName of member.moves) {
        const normalized = normalizeName(moveName);
        if (!normalized) continue;
        const knownMove = effectiveMoveLookup[normalized];
        if (
          !knownMove ||
          knownMove.type === "unknown" ||
          (knownMove.power === null && !knownMove.damageClass)
        ) {
          unknownMoves.add(normalized);
        }
      }
    }
    if (!unknownMoves.size) return;

    let cancelled = false;
    const toResolve = Array.from(unknownMoves).slice(0, 12);
    void Promise.all(
      toResolve.map(async (moveId) => {
        try {
          const response = await fetch(`https://pokeapi.co/api/v2/move/${moveId}`);
          if (!response.ok) return null;
          const payload = (await response.json()) as {
            name: string;
            type: { name: string };
            priority: number;
            power: number | null;
            damage_class?: { name: string } | null;
          };
          return {
            name: payload.name,
            display: payload.name
              .split("-")
              .map((part) => (part.length ? part[0].toUpperCase() + part.slice(1) : part))
              .join(" "),
            type: payload.type.name,
            priority: payload.priority,
            power: payload.power,
            damageClass: payload.damage_class?.name ?? null,
          } satisfies MoveEntry;
        } catch {
          return null;
        }
      }),
    ).then((resolved) => {
      if (cancelled) return;
      // resolved elements are either MoveEntry objects or null; filter out nulls
      const valid = resolved.filter((entry): entry is MoveEntry => entry !== null);
      if (!valid.length) return;
      setResolvedMoves((current) => ({
        ...current,
        ...Object.fromEntries(valid.map((entry) => [normalizeName(entry.name), entry])),
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [draft, effectiveMoveLookup]);

  useEffect(() => {
    if (!draft) return;

    const unresolvedSpecies = Array.from(
      new Set(
        draft.data.members
          .map((member) => normalizeName(member.species))
          .filter((value) => Boolean(value))
          .filter((value) => {
            const known = effectiveSpeciesLookup[value];
            return !known || !known.types.length;
          }),
      ),
    ).slice(0, 8);

    if (!unresolvedSpecies.length) return;

    let cancelled = false;
    void Promise.all(
      unresolvedSpecies.map(async (speciesId) => {
        try {
          const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}`);
          if (!response.ok) return null;
          const payload = (await response.json()) as {
            id: number;
            name: string;
            types: { slot: number; type: { name: string } }[];
            forms: { name: string }[];
          };
          return {
            name: payload.name,
            display: payload.name
              .split("-")
              .map((part) => (part.length ? part[0].toUpperCase() + part.slice(1) : part))
              .join(" "),
            types: payload.types.sort((left, right) => left.slot - right.slot).map((entry) => entry.type.name),
            forms: payload.forms.map((entry) => entry.name),
            pokeapiId: payload.id,
            sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${payload.id}.png`,
          } satisfies SpeciesEntry;
        } catch {
          return null;
        }
      }),
    ).then((resolved) => {
      if (cancelled) return;
      const valid = resolved.filter(
        (entry): entry is NonNullable<(typeof resolved)[number]> => Boolean(entry),
      );
      if (!valid.length) return;
      setResolvedSpecies((current) => {
        const merged = { ...current };
        for (const speciesEntry of valid) {
          merged[normalizeName(speciesEntry.name)] = speciesEntry;
          merged[normalizeName(speciesEntry.display)] = speciesEntry;
        }
        return merged;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [draft, effectiveSpeciesLookup]);

  useEffect(() => {
    if (!draft) return;

    const unresolvedSpecies = Array.from(
      new Set(
        draft.data.members
          .map((member) => normalizeName(member.species))
          .filter(Boolean)
          .filter((speciesId) => !speciesRuntimeOptions[speciesId]),
      ),
    ).slice(0, 8);

    if (!unresolvedSpecies.length) return;

    let cancelled = false;
    void Promise.all(
      unresolvedSpecies.map(async (speciesId) => {
        try {
          const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}`);
          if (!response.ok) return null;
          const payload = (await response.json()) as {
            name: string;
            abilities: { ability: { name: string } }[];
            moves: { move: { name: string } }[];
          };

          const toDisplay = (value: string) =>
            value
              .split("-")
              .map((part) => (part.length ? part[0].toUpperCase() + part.slice(1) : part))
              .join(" ");

          const abilityOptions = Array.from(
            new Set(payload.abilities.map((entry) => toDisplay(entry.ability.name))),
          ).sort((left, right) => left.localeCompare(right));

          const moveOptions = Array.from(
            new Set(payload.moves.map((entry) => toDisplay(entry.move.name))),
          ).sort((left, right) => left.localeCompare(right));

          return {
            key: speciesId,
            canonical: normalizeName(payload.name),
            value: {
              abilities: abilityOptions,
              moves: moveOptions,
            } satisfies SpeciesRuntimeOptions,
          };
        } catch {
          return null;
        }
      }),
    ).then((resolved) => {
      if (cancelled) return;
      const valid = resolved.filter((entry): entry is NonNullable<(typeof resolved)[number]> => Boolean(entry));
      if (!valid.length) return;
      setSpeciesRuntimeOptions((current) => {
        const next = { ...current };
        for (const entry of valid) {
          next[entry.key] = entry.value;
          next[entry.canonical] = entry.value;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [draft, speciesRuntimeOptions]);

  function syncHistory(nextHistory: EditableTeam[], nextIndex: number) {
    historyRef.current = nextHistory;
    historyIndexRef.current = nextIndex;
    setHistory(nextHistory);
    setHistoryIndex(nextIndex);
  }

  function pushHistory(nextValue: EditableTeam) {
    const base = historyRef.current.slice(0, historyIndexRef.current + 1);
    const appended = [...base, cloneValue(nextValue)];
    const trimmed = appended.slice(Math.max(0, appended.length - HISTORY_LIMIT));
    syncHistory(trimmed, trimmed.length - 1);
  }

  function updateDraft(updater: (current: EditableTeam) => EditableTeam) {
    setDraft((current) => {
      if (!current) return current;
      const nextValue = normalizeEditableTeam(updater(cloneValue(current)));
      pushHistory(nextValue);
      setDirty(true);
      return nextValue;
    });
  }

  function updateMember(memberId: string, updater: (entry: TeamMember) => void) {
    updateDraft((current) => {
      const member = current.data.members.find((entry) => entry.id === memberId);
      if (member) updater(member);
      return current;
    });
  }

  function clearMemberSlot(memberId: string) {
    updateDraft((current) => {
      const index = current.data.members.findIndex((entry) => entry.id === memberId);
      if (index >= 0) current.data.members[index] = createDefaultMember();
      return current;
    });
  }

  function handleUndo() {
    if (historyIndexRef.current <= 0) return;
    const nextIndex = historyIndexRef.current - 1;
    const nextValue = cloneValue(historyRef.current[nextIndex]);
    syncHistory(historyRef.current, nextIndex);
    setDraft(nextValue);
    setDirty(true);
  }

  function handleRedo() {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    const nextIndex = historyIndexRef.current + 1;
    const nextValue = cloneValue(historyRef.current[nextIndex]);
    syncHistory(historyRef.current, nextIndex);
    setDraft(nextValue);
    setDirty(true);
  }

  const saveTeam = useCallback(
    async (value: EditableTeam) => {
      if (!team) return;
      setSaveState("saving");
      try {
        const payload = await apiFetch<SavePayload>(`/api/teams/${team.id}`, {
          method: "PUT",
          body: value,
        });
        setTeam(payload.team);
        setDirty(false);
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 900);
      } catch (saveError) {
        setSaveState("error");
        setError(saveError instanceof Error ? saveError.message : "Save failed.");
      }
    },
    [team],
  );

  useEffect(() => {
    if (!draft || !dirty) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveTeam(draft);
    }, 1000);
  }, [draft, dirty, saveTeam]);

  useEffect(() => {
    if (showModal && modalMode === "export" && exportTextAreaRef.current) {
      exportTextAreaRef.current.select();
    }
  }, [showModal, modalMode]);

  function applyImportFromText(text: string) {
    if (!draft) return;
    const imported = normalizeMembers(parseShowdownText(text), SLOT_COUNT);
    updateDraft((current) => {
      current.data.members = imported;
      return current;
    });
    setShowModal(false);
    setShowMobileImport(false);
  }

  function applyImport() {
    applyImportFromText(importText);
  }

  function saveExportedText() {
    applyImportFromText(exportText);
  }

  function openExport() {
    if (!draft) return;
    setExportText(exportShowdownText(draft.data.members));
    setModalMode("export");
    setShowModal(true);
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[1500px] px-3 py-4 sm:px-6 sm:py-6">
        <section className="panel-dark rounded-2xl p-6">
          <p className="text-sm font-semibold tracking-wide text-slate-200">Opening team...</p>
        </section>
      </main>
    );
  }

  if (!draft) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[1500px] px-3 py-4 sm:px-6 sm:py-6">
        <section className="panel-dark rounded-2xl p-6">
          <p className="text-sm font-semibold text-rose-300">{error ?? "Could not open this team."}</p>
          <div className="mt-3 flex gap-2">
            <Link
              className="rounded-md border border-slate-600 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
              href="/"
            >
              Back
            </Link>
            <button
              className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-amber-400"
              onClick={() => window.location.reload()}
              type="button"
            >
              Retry
            </button>
          </div>
        </section>
      </main>
    );
  }

  const selectedMember = draft.data.members[selectedSlotIndex];
  const selectedSpeciesId = normalizeName(selectedMember.species);
  const selectedSpeciesLookup = effectiveSpeciesLookup[selectedSpeciesId];
  const selectedRuntimeKey = selectedSpeciesLookup
    ? normalizeName(selectedSpeciesLookup.name)
    : selectedSpeciesId;
  const selectedRuntimeOptions = speciesRuntimeOptions[selectedRuntimeKey] ?? speciesRuntimeOptions[selectedSpeciesId];

  // Include all moves (both damaging and status) so they all appear in search
  const moveOptions = Array.from(
    new Set([
      ...(selectedRuntimeOptions?.moves?.length ? selectedRuntimeOptions.moves : []),
      ...bootstrap.moves.map((entry) => entry.display),
    ]),
  ).sort();
  const abilityOptions = selectedRuntimeOptions?.abilities?.length
    ? selectedRuntimeOptions.abilities
    : bootstrap.abilities.map((entry) => entry.display);
  const itemOptions = bootstrap.items.map((entry) => entry.display);
  const natureOptions = [...NATURES];

  const selectedThreatTypes = Array.from(
    new Set(threatType.split(/[\s,/|+_-]+/g).map((entry) => normalizeName(entry)).filter(Boolean)),
  ).slice(0, 2);
  const threatTypeOne = selectedThreatTypes[0] ?? "";
  const threatTypeTwo = selectedThreatTypes[1] ?? "";

  function updateThreatSelection(primary: string, secondary: string) {
    const normalizedPrimary = normalizeName(primary);
    const normalizedSecondary = normalizeName(secondary);
    const next = [normalizedPrimary, normalizedSecondary].filter(Boolean);
    const deduped = Array.from(new Set(next)).slice(0, 2);
    setThreatType(deduped.join(" "));
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1500px] px-3 py-4 sm:px-6 sm:py-6">
      <header className="panel-dark mb-4 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Pok Team Builder</p>
            <h1 className="text-2xl font-semibold text-slate-100">{draft.name || "Untitled Team"}</h1>
            <p className="text-xs text-slate-400">Team ID: {teamId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-md border border-slate-600 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-800"
              href="/"
            >
              Back
            </Link>
            <button
              className="rounded-md border border-slate-600 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
              disabled={historyIndex <= 0}
              onClick={handleUndo}
              type="button"
            >
              Undo
            </button>
            <button
              className="rounded-md border border-slate-600 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
              disabled={historyIndex >= history.length - 1}
              onClick={handleRedo}
              type="button"
            >
              Redo
            </button>
            <button
              className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
              onClick={() => void saveTeam(draft)}
              type="button"
            >
              Save
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              Team Name
            </span>
            <input
              className="input-dark w-full rounded-md px-2.5 py-2 text-sm transition"
              onChange={(event) =>
                updateDraft((current) => {
                  current.name = event.target.value;
                  return current;
                })
              }
              value={draft.name}
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              className="rounded-md border border-slate-600 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
              onClick={() => {
                  const isMobile = typeof window !== "undefined" && window.innerWidth < 1280;
                  const hasTeamMembers = draft && draft.data.members.some((m) => m.species);
                  if (isMobile) {
                    setModalMode("import");
                    setShowMobileImport(true);
                    setShowModal(false);
                    return;
                  }
                  if (hasTeamMembers) {
                    openExport();
                  } else {
                    setModalMode("import");
                    setShowModal(true);
                  }
              }}
              type="button"
            >
              Import/Export
            </button>
            <p className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-300">
              {saveState === "saving"
                ? "Saving..."
                : saveState === "saved"
                  ? "Saved"
                  : saveState === "error"
                    ? "Save failed"
                    : dirty
                      ? "Unsaved"
                      : "Synced"}
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4 order-2 xl:order-1">
          {showModal && modalMode === "import" ? (
            <section className="panel-dark rounded-2xl p-4 hidden xl:block">
              <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-amber-300">Import Showdown Text</h2>
              <textarea
                className="input-dark mt-2 h-40 w-full rounded-md px-2 py-1.5 text-xs transition"
                onChange={(event) => setImportText(event.target.value)}
                value={importText}
              />
              <div className="mt-2 flex gap-2">
                <button
                  className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-400"
                  onClick={applyImport}
                  type="button"
                >
                  Apply
                </button>
                <button
                  className="rounded-md border border-slate-600 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-slate-800"
                  onClick={() => setShowModal(false)}
                  type="button"
                >
                  Close
                </button>
              </div>
            </section>
          ) : null}

          {showModal && modalMode === "export" ? (
            <section className="panel-dark rounded-2xl p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-amber-300">Export Showdown Text</h2>
              <textarea
                className="input-dark mt-2 h-40 w-full rounded-md px-2 py-1.5 text-xs transition"
                ref={exportTextAreaRef}
                value={exportText}
                onChange={(event) => setExportText(event.target.value)}
              />
              <div className="mt-2 flex gap-2">
                <button
                  className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-400"
                  onClick={() => {
                    void navigator.clipboard.writeText(exportText);
                  }}
                  type="button"
                >
                  Copy
                </button>
                <button
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-slate-50 transition hover:bg-emerald-500"
                  onClick={saveExportedText}
                  type="button"
                >
                  Save
                </button>
                <button
                  className="rounded-md border border-slate-600 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-slate-800"
                  onClick={() => setShowModal(false)}
                  type="button"
                >
                  Close
                </button>
              </div>
            </section>
          ) : null}

          <MemberCard
            abilityOptions={abilityOptions}
            coverageByType={coverageByType}
            index={selectedSlotIndex}
            itemOptions={itemOptions}
            issues={constraintIssues.filter((issue) => issue.memberId === selectedMember.id)}
            member={selectedMember}
            moveOptions={moveOptions}
            moveSummary={moveSummaryByMember[selectedMember.id] ?? []}
            natureOptions={natureOptions}
            onChange={updateMember}
            onRemove={clearMemberSlot}
            removeLabel="Clear"
            speciesOptions={speciesOptions}
          />

          <TeamAnalysis
            coverageSummary={coverageIndicator}
            moveCoverageMatrix={moveCoverageMatrix}
            members={draft.data.members.map((member) => ({ id: member.id, species: member.species }))}
            resistanceMatrix={resistanceMatrix}
            weaknessRows={weaknesses}
          />
        </section>

        <aside className="space-y-4 order-1 xl:order-2">
          {showMobileImport ? (
            <section className="panel-dark rounded-2xl p-4 xl:hidden">
              <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-amber-300">Import Showdown Text</h2>
              <textarea
                className="input-dark mt-2 h-40 w-full rounded-md px-2 py-1.5 text-xs transition"
                onChange={(event) => setImportText(event.target.value)}
                value={importText}
              />
              <div className="mt-2 flex gap-2">
                <button
                  className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-400"
                  onClick={() => {
                    applyImport();
                    setShowMobileImport(false);
                  }}
                  type="button"
                >
                  Apply
                </button>
                <button
                  className="rounded-md border border-slate-600 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-slate-800"
                  onClick={() => setShowMobileImport(false)}
                  type="button"
                >
                  Close
                </button>
              </div>
            </section>
          ) : null}

          <section className="panel-dark rounded-2xl p-3">
            <div className="flex items-center justify-between border-b border-slate-700/70 pb-2">
              <h2 className="text-lg font-semibold text-slate-100">Team</h2>
            </div>
            <div className="mt-2 space-y-2">
              {draft.data.members.map((member, index) => {
                const active = selectedSlotIndex === index;
                return (
                  <button
                    className={`w-full rounded-xl border px-2 py-2 text-left transition ${
                      active
                        ? "border-amber-400 bg-amber-400/15"
                        : "border-slate-700 bg-slate-900/60 hover:border-slate-500 hover:bg-slate-800/70"
                    }`}
                    key={`slot-${member.id}`}
                    onClick={() => setSelectedSlotIndex(index)}
                    type="button"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold leading-none text-amber-300">+</span>
                      <SpriteImage
                        alt={member.species || `Slot ${index + 1}`}
                        className="h-9 w-9 rounded bg-slate-950/80 object-contain"
                        species={member.species}
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Slot {index + 1}</p>
                        <p className="truncate text-sm font-semibold text-slate-100">
                          {member.species || "Add Pokemon"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel-dark-soft rounded-2xl p-3 hidden xl:block">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-300">Counter Suggestions</h3>

            <div className="mt-2 grid gap-2 xl:grid-cols-1">
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">Threat Type 1</span>
                <select
                  className="input-dark w-full rounded-md px-2 py-1.5 text-xs"
                  onChange={(event) => {
                    const nextPrimary = event.target.value;
                    const nextSecondary = threatTypeTwo === nextPrimary ? "" : threatTypeTwo;
                    updateThreatSelection(nextPrimary, nextSecondary);
                  }}
                  value={threatTypeOne}
                >
                  <option value="">None</option>
                  {threatTypeOptions.map((typeName) => (
                    <option key={`threat-type-one-${typeName}`} value={typeName}>
                      {toTitleCase(typeName)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">Threat Type 2</span>
                <select
                  className="input-dark w-full rounded-md px-2 py-1.5 text-xs"
                  onChange={(event) => {
                    const nextSecondary = event.target.value;
                    const nextPrimary = threatTypeOne === nextSecondary ? "" : threatTypeOne;
                    updateThreatSelection(nextPrimary, nextSecondary);
                  }}
                  value={threatTypeTwo}
                >
                  <option value="">None</option>
                  {threatTypeOptions.map((typeName) => (
                    <option key={`threat-type-two-${typeName}`} value={typeName}>
                      {toTitleCase(typeName)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-2 space-y-2">
              {threatSuggestions.length ? (
                threatSuggestions.map((entry) => (
                  <div
                    className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1.5"
                    key={`threat-suggestion-${entry.memberId}`}
                  >
                    <p className="text-xs font-semibold text-slate-100">
                      {entry.species || "Unknown"} <span className="text-slate-400">score {entry.score}</span>
                    </p>
                    <p className="text-[11px] text-slate-300">{entry.reasons.join(" ")}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">Select threat types to see suggested counters.</p>
              )}
            </div>
          </section>
        </aside>

        <div className="space-y-4 order-3 xl:order-2">
          <TeamChecklist members={draft.data.members} moveLookup={effectiveMoveLookup} />

          <section className="panel-dark-soft rounded-2xl p-3 xl:hidden">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-300">Counter Suggestions</h3>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">Threat Type 1</span>
                <select
                  className="input-dark w-full rounded-md px-2 py-1.5 text-xs"
                  onChange={(event) => {
                    const nextPrimary = event.target.value;
                    const nextSecondary = threatTypeTwo === nextPrimary ? "" : threatTypeTwo;
                    updateThreatSelection(nextPrimary, nextSecondary);
                  }}
                  value={threatTypeOne}
                >
                  <option value="">None</option>
                  {threatTypeOptions.map((typeName) => (
                    <option key={`threat-type-one-${typeName}`} value={typeName}>
                      {toTitleCase(typeName)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">Threat Type 2</span>
                <select
                  className="input-dark w-full rounded-md px-2 py-1.5 text-xs"
                  onChange={(event) => {
                    const nextSecondary = event.target.value;
                    const nextPrimary = threatTypeOne === nextSecondary ? "" : threatTypeOne;
                    updateThreatSelection(nextPrimary, nextSecondary);
                  }}
                  value={threatTypeTwo}
                >
                  <option value="">None</option>
                  {threatTypeOptions.map((typeName) => (
                    <option key={`threat-type-two-${typeName}`} value={typeName}>
                      {toTitleCase(typeName)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-2 space-y-2">
              {threatSuggestions.length ? (
                threatSuggestions.map((entry) => (
                  <div
                    className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1.5"
                    key={`threat-suggestion-${entry.memberId}`}
                  >
                    <p className="text-xs font-semibold text-slate-100">
                      {entry.species || "Unknown"} <span className="text-slate-400">score {entry.score}</span>
                    </p>
                    <p className="text-[11px] text-slate-300">{entry.reasons.join(" ")}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400">Select threat types to see suggested counters.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </main>
  );
}
