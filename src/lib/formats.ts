import type { ConstraintIssue, FormatId, FormatRule, TeamMember } from "@/lib/domain";

const UBERS_BANNED = [
  "mewtwo",
  "ho-oh",
  "lugia",
  "rayquaza",
  "kyogre",
  "groudon",
  "xerneas",
  "yveltal",
  "zacian",
  "zacian-crowned",
  "zamazenta-crowned",
  "koraidon",
  "miraidon",
  "calyrex-shadow",
  "calyrex-ice",
  "eternatus",
  "arceus",
  "dialga-origin",
  "palkia-origin",
  "giratina-origin",
] as const;

const UU_EXTRA_BANNED = [
  "kingambit",
  "great-tusk",
  "gholdengo",
  "dragapult",
  "iron-valiant",
  "roaring-moon",
  "raging-bolt",
  "garganacl",
  "zamazenta",
  "samurott-hisui",
] as const;

const VGC_BANNED_SPECIES = [
  "mewtwo",
  "lugia",
  "ho-oh",
  "rayquaza",
  "kyogre",
  "groudon",
  "dialga",
  "palkia",
  "giratina",
  "reshiram",
  "zekrom",
  "xerneas",
  "yveltal",
  "solgaleo",
  "lunala",
  "zacian",
  "zamazenta",
  "calyrex-shadow",
  "calyrex-ice",
  "koraidon",
  "miraidon",
  "arceus",
] as const;

const OHKO_MOVES = ["fissure", "guillotine", "horn-drill", "sheer-cold"] as const;

export const FORMAT_RULES: Record<FormatId, FormatRule> = {
  ou: {
    id: "ou",
    name: "OU Singles",
    description: "Smogon-style OverUsed baseline with Ubers excluded.",
    defaultTeamSize: 6,
    maxTeamSize: 6,
    bannedSpecies: [...UBERS_BANNED],
    bannedMoves: [],
    bannedItems: [],
  },
  uu: {
    id: "uu",
    name: "UU Singles",
    description: "UnderUsed baseline with common OU/Ubers threats removed.",
    defaultTeamSize: 6,
    maxTeamSize: 6,
    bannedSpecies: [...UBERS_BANNED, ...UU_EXTRA_BANNED],
    bannedMoves: [],
    bannedItems: [],
  },
  vgc: {
    id: "vgc",
    name: "VGC Doubles",
    description: "Official doubles style with restricted legends and OHKO moves removed.",
    defaultTeamSize: 4,
    maxTeamSize: 6,
    bannedSpecies: [...VGC_BANNED_SPECIES],
    bannedMoves: [...OHKO_MOVES],
    bannedItems: [],
  },
  custom: {
    id: "custom",
    name: "Custom",
    description: "No restrictions. Use your own rules.",
    defaultTeamSize: 6,
    maxTeamSize: 6,
    bannedSpecies: [],
    bannedMoves: [],
    bannedItems: [],
  },
};

export const FORMAT_OPTIONS = Object.values(FORMAT_RULES);

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export function getFormatRule(format?: FormatId): FormatRule {
  if (!format) return FORMAT_RULES.custom;
  return FORMAT_RULES[format] ?? FORMAT_RULES.custom;
}

export function validateMemberAgainstFormat(
  member: TeamMember,
  formatRule: FormatRule,
): ConstraintIssue[] {
  const issues: ConstraintIssue[] = [];
  const species = normalize(member.species);
  const item = normalize(member.item);

  if (species && formatRule.bannedSpecies.includes(species)) {
    issues.push({
      memberId: member.id,
      field: "species",
      value: member.species,
      reason: `${member.species} is banned in ${formatRule.name}.`,
    });
  }

  if (item && formatRule.bannedItems.includes(item)) {
    issues.push({
      memberId: member.id,
      field: "item",
      value: member.item,
      reason: `${member.item} is banned in ${formatRule.name}.`,
    });
  }

  for (const move of member.moves) {
    const normalizedMove = normalize(move);
    if (normalizedMove && formatRule.bannedMoves.includes(normalizedMove)) {
      issues.push({
        memberId: member.id,
        field: "move",
        value: move,
        reason: `${move} is banned in ${formatRule.name}.`,
      });
    }
  }

  return issues;
}
