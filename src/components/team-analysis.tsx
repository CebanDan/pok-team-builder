"use client";

import { useState } from "react";

import { toTitleCase } from "@/lib/pokedex";
import { getPokemonSpriteUrl } from "@/lib/sprites";

type WeaknessEntry = {
  type: string;
  weak: number;
  resistant: number;
  immune: number;
  neutral: number;
};

type AnalyzerMember = {
  id: string;
  species: string;
};

type AnalyzerMatrixRow = {
  type: string;
  memberMultipliers: Array<number | null>;
  weak: number;
  resistant: number;
  coverage: number;
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

function formatMultiplier(value: number): string {
  if (value === 0) return "IMMUNE";
  if (value === 0.25) return "1/4x";
  if (value === 0.5) return "1/2x";
  if (value === 1) return "1x";
  if (value === 2) return "2x";
  if (value === 4) return "4x";
  if (Number.isInteger(value)) return `${value}x`;
  return `${value.toFixed(2)}x`;
}

function getCellClass(value: number | null, mode: "resistance" | "coverage"): string {
  if (value === null) return "border-slate-800 bg-slate-900/60 text-slate-500";
  if (value === 1) return "border-slate-700 bg-slate-800/70 text-slate-200";
  if (value === 0) {
    return mode === "resistance"
      ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-100"
      : "border-red-500/60 bg-red-500/20 text-red-100";
  }
  if (value > 1) {
    return mode === "resistance"
      ? "border-red-500/60 bg-red-500/25 text-red-100"
      : "border-emerald-500/60 bg-emerald-500/25 text-emerald-100";
  }
  return mode === "resistance"
    ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-100"
    : "border-red-500/60 bg-red-500/20 text-red-100";
}

function formatCoverageValue(value: number, mode: "resistance" | "coverage"): string {
  if (mode === "coverage") return formatMultiplier(value);
  if (value > 0) return `+${value}`;
  return String(value);
}

type Props = {
  weaknessRows: WeaknessEntry[];
  coverageSummary: {
    coveredTypes: number;
    totalTypes: number;
    averageBestMultiplier: number;
  };
  members: AnalyzerMember[];
  resistanceMatrix: AnalyzerMatrixRow[];
  moveCoverageMatrix: AnalyzerMatrixRow[];
};

export function TeamAnalysis({
  weaknessRows,
  coverageSummary,
  members,
  resistanceMatrix,
  moveCoverageMatrix,
}: Props) {
  const [analyzerMode, setAnalyzerMode] = useState<"resistance" | "coverage">("resistance");
  const tableRows = analyzerMode === "resistance" ? resistanceMatrix : moveCoverageMatrix;
  const hotspots = weaknessRows.filter((row) => row.weak > row.resistant + row.immune).slice(0, 4);

  return (
    <article className="panel-dark rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-slate-100">Weakness & Coverage Analyzer</h2>
        <div className="flex rounded-lg border border-slate-700 bg-slate-900/70 p-1 text-xs font-semibold">
          <button
            className={`rounded-md px-3 py-1.5 transition ${
              analyzerMode === "resistance" ? "bg-amber-500 text-slate-950" : "text-slate-300 hover:text-slate-100"
            }`}
            onClick={() => setAnalyzerMode("resistance")}
            type="button"
          >
            Resistance
          </button>
          <button
            className={`rounded-md px-3 py-1.5 transition ${
              analyzerMode === "coverage" ? "bg-amber-500 text-slate-950" : "text-slate-300 hover:text-slate-100"
            }`}
            onClick={() => setAnalyzerMode("coverage")}
            type="button"
          >
            Move Coverage
          </button>
        </div>
      </div>
      <p className="mb-3 mt-2 text-sm text-slate-300">
        Coverage: {coverageSummary.coveredTypes}/{coverageSummary.totalTypes} types hit super effectively.
        Average best multiplier: {coverageSummary.averageBestMultiplier}x
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-950/60">
        <table className="w-full min-w-[860px] border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-900/70 text-slate-300">
              <th className="px-1.5 py-1.5 text-left">Type</th>
              {members.map((member, index) => (
                <th className="px-1.5 py-1.5 text-center" key={`matrix-header-${member.id}`}>
                  <div className="flex flex-col items-center gap-0.5">
                    <img
                      alt={member.species || `slot-${index + 1}`}
                      className="h-6 w-6 rounded bg-slate-950 object-contain"
                      src={getPokemonSpriteUrl(member.species)}
                    />
                    <span className="max-w-[58px] truncate text-[9px] text-slate-300">
                      {member.species || `Slot ${index + 1}`}
                    </span>
                  </div>
                </th>
              ))}
              <th className="px-1.5 py-1.5 text-center">{analyzerMode === "resistance" ? "Weak." : "SE"}</th>
              <th className="px-1.5 py-1.5 text-center">{analyzerMode === "resistance" ? "Res." : "NVE"}</th>
              <th className="px-1.5 py-1.5 text-center">{analyzerMode === "resistance" ? "Total" : "Best"}</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.length ? (
              tableRows.map((row) => (
                <tr className="border-b border-slate-800/80" key={`matrix-row-${analyzerMode}-${row.type}`}>
                  <td className="px-1.5 py-1">
                    <span
                      className={`inline-flex min-w-[64px] items-center justify-center rounded border px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                        TYPE_BADGE_CLASSES[row.type] ?? "border-slate-600 bg-slate-700/50 text-slate-200"
                      }`}
                    >
                      {row.type}
                    </span>
                  </td>
                  {members.map((member, index) => {
                    const multiplier = row.memberMultipliers[index] ?? null;
                    return (
                      <td className="px-1 py-1 text-center" key={`matrix-cell-${row.type}-${member.id}`}>
                        <span
                          className={`inline-flex min-w-[46px] items-center justify-center rounded border px-1 py-0.5 text-[10px] font-semibold ${getCellClass(
                            multiplier,
                            analyzerMode,
                          )}`}
                        >
                          {multiplier === null ? "N/A" : formatMultiplier(multiplier)}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-1.5 py-1 text-center font-semibold text-rose-200">{row.weak}</td>
                  <td className="px-1.5 py-1 text-center font-semibold text-emerald-200">{row.resistant}</td>
                  <td className="px-1.5 py-1 text-center font-semibold text-amber-200">
                    {formatCoverageValue(row.coverage, analyzerMode)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-2 py-3 text-sm text-slate-400" colSpan={members.length + 4}>
                  Add Pokemon with valid data to populate this analyzer.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {analyzerMode === "resistance" && hotspots.length ? (
        <p className="mt-3 text-sm text-amber-200">
          Defensive holes: {hotspots.map((row) => toTitleCase(row.type)).join(", ")}
        </p>
      ) : null}
    </article>
  );
}

