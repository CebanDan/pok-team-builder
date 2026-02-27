
"use client";

import { STATS, type ConstraintIssue, type MoveAnalysis, type TeamMember } from "@/lib/domain";
import type { SpeciesEntry } from "@/lib/pokedex";
import { toTitleCase } from "@/lib/pokedex";

import { SpriteImage } from "@/components/sprite-image";
import { SpeciesAutocomplete } from "@/components/species-autocomplete";
import { TextAutocomplete } from "@/components/text-autocomplete";

type MoveSummary = MoveAnalysis;

type Props = {
  member: TeamMember;
  index: number;
  issues: ConstraintIssue[];
  moveSummary: MoveSummary[];
  coverageByType: Record<string, number>;
  speciesOptions: SpeciesEntry[];
  moveOptions: string[];
  abilityOptions: string[];
  itemOptions: string[];
  natureOptions: string[];
  onRemove: (memberId: string) => void;
  onChange: (memberId: string, updater: (entry: TeamMember) => void) => void;
  removeLabel?: string;
  compact?: boolean;
  readOnly?: boolean;
};

function clampInput(value: string, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function clampEvWithTotal(stat: keyof TeamMember["evs"], value: number, evs: TeamMember["evs"]): number {
  const clamped = Math.max(0, Math.min(252, value));
  const usedWithoutStat = STATS.filter((entry) => entry !== stat).reduce((sum, key) => sum + evs[key], 0);
  const remaining = Math.max(0, 510 - usedWithoutStat);
  return Math.min(clamped, remaining);
}

export function MemberCard({
  member,
  index,
  issues,
  moveSummary,
  coverageByType,
  speciesOptions,
  moveOptions,
  abilityOptions,
  itemOptions,
  natureOptions,
  onRemove,
  onChange,
  removeLabel = "Clear Slot",
  compact = false,
  readOnly = false,
}: Props) {
  const speciesEntry = speciesOptions.find(
    (entry) =>
      entry.name.toLowerCase() === member.species.toLowerCase() ||
      entry.display.toLowerCase() === member.species.toLowerCase(),
  );

  return (
    <article className="panel-dark rounded-2xl p-3 sm:p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <SpriteImage
            alt={member.species || `Slot ${index + 1}`}
            className="h-14 w-14 rounded-md border border-slate-700 bg-slate-950/90 object-contain"
            pokeapiId={speciesEntry?.pokeapiId}
            species={member.species}
          />
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Slot {index + 1}</p>
            <p className="text-base font-semibold text-slate-100">{member.species || "Empty Slot"}</p>
          </div>
        </div>
        {!readOnly ? (
          <button
            className="rounded-md border border-rose-500/60 bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-200 transition hover:bg-rose-500/20"
            onClick={() => onRemove(member.id)}
            type="button"
          >
            {removeLabel}
          </button>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Pokemon
          </span>
          {readOnly ? (
            <div className="input-dark rounded-md px-2 py-1.5 text-xs">{member.species || "-"}</div>
          ) : (
            <SpeciesAutocomplete
              onChange={(nextSpecies) =>
                onChange(member.id, (entry) => {
                  entry.species = nextSpecies;
                })
              }
              placeholder="Type Pokemon..."
              species={speciesOptions}
              value={member.species}
            />
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Item
          </span>
          {readOnly ? (
            <div className="input-dark rounded-md px-2 py-1.5 text-xs">{member.item || "-"}</div>
          ) : (
            <TextAutocomplete
              onChange={(nextValue) =>
                onChange(member.id, (entry) => {
                  entry.item = nextValue;
                })
              }
              options={itemOptions}
              placeholder="Type item..."
              value={member.item}
            />
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Ability
          </span>
          {readOnly ? (
            <div className="input-dark rounded-md px-2 py-1.5 text-xs">{member.ability || "-"}</div>
          ) : (
            <TextAutocomplete
              onChange={(nextValue) =>
                onChange(member.id, (entry) => {
                  entry.ability = nextValue;
                })
              }
              options={abilityOptions}
              placeholder="Type ability..."
              value={member.ability}
            />
          )}
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4">
        {member.moves.map((move, moveIndex) => (
          <label className="block" key={`${member.id}-move-${moveIndex}`}>
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Move {moveIndex + 1}
            </span>
            {readOnly ? (
              <div className="input-dark rounded-md px-2 py-1.5 text-xs">{move || "-"}</div>
            ) : (
              <TextAutocomplete
                onChange={(nextValue) =>
                  onChange(member.id, (entry) => {
                    entry.moves[moveIndex] = nextValue;
                  })
                }
                options={moveOptions}
                placeholder="Type move..."
                value={move}
              />
            )}
          </label>
        ))}
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block lg:col-span-2">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Nature</span>
          {readOnly ? (
            <div className="input-dark rounded-md px-2 py-1.5 text-xs">{member.nature || "-"}</div>
          ) : (
            <TextAutocomplete
              onChange={(nextValue) =>
                onChange(member.id, (entry) => {
                  entry.nature = nextValue;
                })
              }
              options={natureOptions}
              placeholder="Type nature..."
              value={member.nature}
            />
          )}
        </label>
      </div>

      {issues.length ? (
        <div className="mt-2 rounded-md border border-amber-400/60 bg-amber-400/10 px-2 py-1.5">
          <ul className="list-disc pl-4 text-[11px] text-amber-200">
            {issues.map((issue, issueIndex) => (
              <li key={`${member.id}-issue-${issueIndex}`}>{issue.reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!compact && moveSummary.length ? (
        <div className="mt-2 grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
          {moveSummary.map((entry, moveIndex) => {
            const seCount = entry.coverage.superEffective.length;
            const nCount = entry.coverage.neutral.length;
            const nvCount = entry.coverage.resisted.length + entry.coverage.immune.length;
            const isStatusMove = !entry.hasPower;
            return (
              <div
                className="panel-dark-soft rounded-md border border-slate-700/50 px-2 py-1.5 flex flex-col"
                key={`${member.id}-${moveIndex}`}
              >
                <p className="text-xs font-semibold text-slate-100 truncate">
                  {entry.move} <span className="text-slate-500 text-[10px]">({toTitleCase(entry.type)})</span>
                </p>
                {isStatusMove ? (
                  <p className="mt-1 text-[10px] text-slate-400">Status Move</p>
                ) : (
                  <>
                    <div className="mt-1 text-[10px] text-slate-300">
                      <div className="flex gap-2">
                        <span><span className="text-emerald-300 font-medium">SE</span> {seCount}</span>
                        <span><span className="text-slate-300 font-medium">N</span> {nCount}</span>
                        <span><span className="text-rose-300 font-medium">NV</span> {nvCount}</span>
                      </div>
                    </div>
                    {entry.coverage.superEffective.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {entry.coverage.superEffective.map((typeName) => (
                          <span
                            className="rounded px-1.5 py-0.5 text-[9px] font-medium border border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                            key={`${member.id}-${entry.move}-${typeName}`}
                          >
                            {toTitleCase(typeName)}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {!compact ? (
        <div className="mt-2">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            EV Spread ({Object.values(member.evs).reduce((sum, value) => sum + value, 0)}/510)
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
            {STATS.map((stat) => (
              <label className="block" key={`${member.id}-ev-${stat}`}>
                <span className="mb-0.5 block text-[10px] uppercase text-slate-500">{stat}</span>
                <input
                  className="input-dark w-full rounded px-1 py-1 text-[11px] transition disabled:opacity-60"
                  disabled={readOnly}
                  max={252}
                  min={0}
                  onChange={(event) =>
                    onChange(member.id, (entry) => {
                      const nextValue = clampInput(event.target.value, 0, 252);
                      entry.evs[stat] = clampEvWithTotal(stat, nextValue, entry.evs);
                    })
                  }
                  type="number"
                  value={member.evs[stat]}
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
