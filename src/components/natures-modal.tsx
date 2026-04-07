"use client";

import { useMemo, useState } from "react";

import { clsx } from "clsx";

import { normalizeName } from "@/lib/pokedex";

import { Modal } from "@/components/modal";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  natures: string[];
  onSelect: (natureName: string) => void;
  selectedNature?: string;
};

type NatureEffect = {
  increase: "atk" | "def" | "spa" | "spd" | "spe" | null;
  decrease: "atk" | "def" | "spa" | "spd" | "spe" | null;
  description: string;
  usage: string;
};

const STAT_LABELS: Record<Exclude<NatureEffect["increase"], null>, string> = {
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};

const NATURE_EFFECTS: Record<string, NatureEffect> = {
  hardy: { increase: null, decrease: null, description: "No stat changes.", usage: "Balanced picks" },
  lonely: { increase: "atk", decrease: "def", description: "Raises Attack, lowers Defense.", usage: "All-out physical" },
  brave: { increase: "atk", decrease: "spe", description: "Raises Attack, lowers Speed.", usage: "Trick Room physical" },
  adamant: { increase: "atk", decrease: "spa", description: "Raises Attack, lowers Special Attack.", usage: "Physical sweepers" },
  naughty: { increase: "atk", decrease: "spd", description: "Raises Attack, lowers Special Defense.", usage: "Aggressive breakers" },
  bold: { increase: "def", decrease: "atk", description: "Raises Defense, lowers Attack.", usage: "Physical walling" },
  docile: { increase: null, decrease: null, description: "No stat changes.", usage: "Balanced picks" },
  relaxed: { increase: "def", decrease: "spe", description: "Raises Defense, lowers Speed.", usage: "Trick Room tanks" },
  impish: { increase: "def", decrease: "spa", description: "Raises Defense, lowers Special Attack.", usage: "Physical walling" },
  lax: { increase: "def", decrease: "spd", description: "Raises Defense, lowers Special Defense.", usage: "Physical pivots" },
  timid: { increase: "spe", decrease: "atk", description: "Raises Speed, lowers Attack.", usage: "Special sweepers" },
  hasty: { increase: "spe", decrease: "def", description: "Raises Speed, lowers Defense.", usage: "Fast offense" },
  serious: { increase: null, decrease: null, description: "No stat changes.", usage: "Balanced picks" },
  jolly: { increase: "spe", decrease: "spa", description: "Raises Speed, lowers Special Attack.", usage: "Physical sweepers" },
  naive: { increase: "spe", decrease: "spd", description: "Raises Speed, lowers Special Defense.", usage: "Fast mixed" },
  modest: { increase: "spa", decrease: "atk", description: "Raises Special Attack, lowers Attack.", usage: "Special sweepers" },
  mild: { increase: "spa", decrease: "def", description: "Raises Special Attack, lowers Defense.", usage: "Special breakers" },
  quiet: { increase: "spa", decrease: "spe", description: "Raises Special Attack, lowers Speed.", usage: "Trick Room special" },
  bashful: { increase: null, decrease: null, description: "No stat changes.", usage: "Balanced picks" },
  rash: { increase: "spa", decrease: "spd", description: "Raises Special Attack, lowers Special Defense.", usage: "Mixed breakers" },
  calm: { increase: "spd", decrease: "atk", description: "Raises Special Defense, lowers Attack.", usage: "Special walling" },
  gentle: { increase: "spd", decrease: "def", description: "Raises Special Defense, lowers Defense.", usage: "Special pivots" },
  sassy: { increase: "spd", decrease: "spe", description: "Raises Special Defense, lowers Speed.", usage: "Trick Room support" },
  careful: { increase: "spd", decrease: "spa", description: "Raises Special Defense, lowers Special Attack.", usage: "Special walling" },
  quirky: { increase: null, decrease: null, description: "No stat changes.", usage: "Balanced picks" },
};

function getNatureEffectSummary(effect: NatureEffect): string {
  if (!effect.increase || !effect.decrease) return "Neutral";
  return `+${STAT_LABELS[effect.increase]} / -${STAT_LABELS[effect.decrease]}`;
}

function getNatureEffect(natureName: string): NatureEffect {
  return (
    NATURE_EFFECTS[normalizeName(natureName)] ?? {
      increase: null,
      decrease: null,
      description: "No stat changes.",
      usage: "Balanced picks",
    }
  );
}

export function NaturesModal({
  isOpen,
  onClose,
  natures,
  onSelect,
  selectedNature,
}: Props) {
  const [search, setSearch] = useState("");

  const filteredNatures = useMemo(() => {
    const normalizedTerm = search
      .toLowerCase()
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const searchTokens = normalizedTerm ? normalizedTerm.split(" ") : [];

    return natures
      .map((nature) => {
        const effect = getNatureEffect(nature);
        const summary = getNatureEffectSummary(effect);
        const searchBlob = [nature, summary, effect.description, effect.usage]
          .join(" ")
          .toLowerCase()
          .replace(/[-_]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const matchesSearch =
          searchTokens.length === 0 || searchTokens.every((token) => searchBlob.includes(token));

        if (!matchesSearch) return null;

        return {
          nature,
          effect,
          summary,
        };
      })
      .filter(
        (
          value,
        ): value is {
          nature: string;
          effect: NatureEffect;
          summary: string;
        } => Boolean(value),
      );
  }, [natures, search]);

  const handleSelect = (natureName: string) => {
    onSelect(natureName);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select a Nature"
      maxWidth="3xl"
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
            placeholder="SEARCH FOR NATURE..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-[1fr_1.4fr_1fr] gap-4 border-b border-slate-800 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          <span>Nature Asset</span>
          <span>Description</span>
          <span>Usage</span>
        </div>

        <div className="custom-scrollbar max-h-[500px] space-y-1 overflow-y-auto pr-1">
          {filteredNatures.length > 0 ? (
            filteredNatures.map((entry) => {
              const isActive = normalizeName(selectedNature ?? "") === normalizeName(entry.nature);
              const neutral = entry.summary === "Neutral";

              return (
                <button
                  key={entry.nature}
                  onClick={() => handleSelect(entry.nature)}
                  className={clsx(
                    "group grid w-full grid-cols-[1fr_1.4fr_1fr] items-center gap-4 rounded-xl px-4 py-4 text-left transition-all duration-200",
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
                      {entry.nature}
                    </span>
                    <span
                      className={clsx(
                        "inline-flex w-fit rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-tight",
                        neutral
                          ? "border-slate-600 bg-slate-800/70 text-slate-300"
                          : "border-emerald-500/70 bg-emerald-500/15 text-emerald-200",
                      )}
                    >
                      {entry.summary}
                    </span>
                  </div>

                  <span className="line-clamp-2 text-[11px] italic leading-relaxed text-slate-400">
                    {entry.effect.description}
                  </span>

                  <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-300">
                    {entry.effect.usage}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="py-12 text-center text-slate-500 italic">
              No natures found matching &quot;{search}&quot;
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
