"use client";

import type { TeamMember } from "@/lib/domain";
import type { MoveEntry } from "@/lib/pokedex";
import { normalizeName } from "@/lib/pokedex";

const ENTRY_HAZARD_MOVES = [
  "stealth-rock",
  "toxic-spikes",
  "spikes",
  "reflect",
  "light-screen",
  "sticky-web",
];

const DEFOG_MOVES = ["defog"];

const RECOVERY_MOVES = [
  "recover",
  "roost",
  "softboil",
  "synthesis",
  "slack-off",
  "pain-split",
  "wish",
  "aqua-ring",
  "morning-sun",
  "moonlight",
  "restore",
];

const BOOSTING_MOVES = [
  "swords-dance",
  "dragon-dance",
  "nasty-plot",
  "bulk-up",
  "calm-mind",
  "curse",
  "growth",
  "iron-defense",
  "rock-polish",
  "quiver-dance",
  "morning-sun",
];

const PIVOT_MOVES = [
  "volt-switch",
  "u-turn",
  "teleport",
  "baton-pass",
  "flip-turn",
];

const CLERIC_MOVES = ["heal-bell", "refresh"];

const PHAZER_MOVES = ["dragon-tail", "roar", "whirlwind"];

const CHOICE_ITEMS = ["choice-scarf", "choice-band", "choice-specs"];

type ChecklistItem = {
  label: string;
  active: boolean;
};

type TeamChecklistData = {
  general: ChecklistItem[];
  offensive: ChecklistItem[];
  defensive: ChecklistItem[];
};

function hasEntryHazard(members: TeamMember[], moveLookup: Record<string, MoveEntry>): boolean {
  return members.some((member) =>
    member.moves.some(
      (moveName) =>
        ENTRY_HAZARD_MOVES.includes(normalizeName(moveName)) ||
        ENTRY_HAZARD_MOVES.includes(normalizeName(moveLookup[normalizeName(moveName)]?.name ?? "")),
    ),
  );
}

function hasDefogger(members: TeamMember[], moveLookup: Record<string, MoveEntry>): boolean {
  return members.some((member) =>
    member.moves.some(
      (moveName) =>
        DEFOG_MOVES.includes(normalizeName(moveName)) ||
        DEFOG_MOVES.includes(normalizeName(moveLookup[normalizeName(moveName)]?.name ?? "")),
    ),
  );
}

function hasReliableRecovery(members: TeamMember[], moveLookup: Record<string, MoveEntry>): boolean {
  return members.some((member) =>
    member.moves.some(
      (moveName) =>
        RECOVERY_MOVES.includes(normalizeName(moveName)) ||
        RECOVERY_MOVES.includes(normalizeName(moveLookup[normalizeName(moveName)]?.name ?? "")),
    ),
  );
}

function hasBoostingMove(members: TeamMember[], moveLookup: Record<string, MoveEntry>): boolean {
  return members.some((member) =>
    member.moves.some(
      (moveName) =>
        BOOSTING_MOVES.includes(normalizeName(moveName)) ||
        BOOSTING_MOVES.includes(normalizeName(moveLookup[normalizeName(moveName)]?.name ?? "")),
    ),
  );
}

function hasPivotMove(members: TeamMember[], moveLookup: Record<string, MoveEntry>): boolean {
  return members.some((member) =>
    member.moves.some(
      (moveName) =>
        PIVOT_MOVES.includes(normalizeName(moveName)) ||
        PIVOT_MOVES.includes(normalizeName(moveLookup[normalizeName(moveName)]?.name ?? "")),
    ),
  );
}

function hasCleric(members: TeamMember[], moveLookup: Record<string, MoveEntry>): boolean {
  return members.some((member) =>
    member.moves.some(
      (moveName) =>
        CLERIC_MOVES.includes(normalizeName(moveName)) ||
        CLERIC_MOVES.includes(normalizeName(moveLookup[normalizeName(moveName)]?.name ?? "")),
    ),
  );
}

function hasPhazer(members: TeamMember[], moveLookup: Record<string, MoveEntry>): boolean {
  return members.some((member) =>
    member.moves.some(
      (moveName) =>
        PHAZER_MOVES.includes(normalizeName(moveName)) ||
        PHAZER_MOVES.includes(normalizeName(moveLookup[normalizeName(moveName)]?.name ?? "")),
    ),
  );
}

function hasStatusMove(members: TeamMember[], moveLookup: Record<string, MoveEntry>): boolean {
  return members.some((member) =>
    member.moves.some((moveName) => {
      const move = moveLookup[normalizeName(moveName)];
      return move && move.power === null;
    }),
  );
}

function hasChoiceItem(members: TeamMember[]): boolean {
  return members.some((member) =>
    CHOICE_ITEMS.includes(normalizeName(member.item ?? "")),
  );
}

export function evaluateTeamChecklist(
  members: TeamMember[],
  moveLookup: Record<string, MoveEntry>,
): TeamChecklistData {
  return {
    general: [
      { label: "Entry Hazard", active: hasEntryHazard(members, moveLookup) },
      { label: "Defogger", active: hasDefogger(members, moveLookup) },
      { label: "Reliable Recovery", active: hasReliableRecovery(members, moveLookup) },
    ],
    offensive: [
      { label: "Boosting Move", active: hasBoostingMove(members, moveLookup) },
      { label: "Choice Item", active: hasChoiceItem(members) },
      { label: "Pivot Move", active: hasPivotMove(members, moveLookup) },
    ],
    defensive: [
      { label: "Cleric", active: hasCleric(members, moveLookup) },
      { label: "Phazer", active: hasPhazer(members, moveLookup) },
      { label: "Status Move", active: hasStatusMove(members, moveLookup) },
    ],
  };
}

interface TeamChecklistProps {
  members: TeamMember[];
  moveLookup: Record<string, MoveEntry>;
}

export function TeamChecklist({ members, moveLookup }: TeamChecklistProps) {
  const checklist = evaluateTeamChecklist(members, moveLookup);

  const renderChecklistGroup = (title: string, items: ChecklistItem[]) => (
    <div key={title}>
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 mb-2">{title}</h3>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div
              className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                item.active
                  ? "bg-emerald-500/30 border border-emerald-500 text-emerald-300"
                  : "bg-red-500/30 border border-red-500 text-red-300"
              }`}
            >
              {item.active ? "✓" : "✗"}
            </div>
            <span className={`text-xs font-medium ${item.active ? "text-slate-200" : "text-slate-400"}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <section className="panel-dark rounded-2xl p-3">
      <div className="flex items-center justify-between border-b border-slate-700/70 pb-2 mb-3">
        <h2 className="text-sm font-semibold text-slate-100">Team Checklist</h2>
        <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-semibold">
          Checklist
        </span>
      </div>
      <div className="space-y-4">
        {renderChecklistGroup("General", checklist.general)}
        {renderChecklistGroup("Offensive", checklist.offensive)}
        {renderChecklistGroup("Defensive", checklist.defensive)}
      </div>
    </section>
  );
}
