import { createDefaultMember, type TeamMember } from "@/lib/domain";

const STAT_ALIAS: Record<string, keyof TeamMember["evs"]> = {
  hp: "hp",
  atk: "atk",
  def: "def",
  spa: "spa",
  spd: "spd",
  spe: "spe",
};

function normalizeStatToken(value: string): keyof TeamMember["evs"] | null {
  const token = value.trim().toLowerCase().replace(".", "");
  if (token === "spatk" || token === "spa") return "spa";
  if (token === "spdef" || token === "spd") return "spd";
  if (token === "speed" || token === "spe") return "spe";
  if (token === "attack" || token === "atk") return "atk";
  if (token === "defense" || token === "def") return "def";
  if (token === "hp") return "hp";
  return STAT_ALIAS[token] ?? null;
}

function parseSpread(line: string): Partial<Record<keyof TeamMember["evs"], number>> {
  const spread: Partial<Record<keyof TeamMember["evs"], number>> = {};
  const parts = line.split("/").map((segment) => segment.trim());
  for (const part of parts) {
    const [amountRaw, statRaw] = part.split(" ");
    const amount = Number.parseInt(amountRaw, 10);
    if (!statRaw || Number.isNaN(amount)) continue;
    const stat = normalizeStatToken(statRaw);
    if (stat) spread[stat] = amount;
  }
  return spread;
}

function parseHeader(line: string): {
  species: string;
  item: string;
  gender: TeamMember["gender"];
} {
  const [left, right = ""] = line.split("@").map((chunk) => chunk.trim());
  let speciesPart = left;
  const item = right;
  let gender: TeamMember["gender"] = "N";

  if (speciesPart.includes("(M)")) {
    gender = "M";
    speciesPart = speciesPart.replace("(M)", "").trim();
  }
  if (speciesPart.includes("(F)")) {
    gender = "F";
    speciesPart = speciesPart.replace("(F)", "").trim();
  }

  const nicknameMatch = speciesPart.match(/\(([^)]+)\)$/);
  const species = nicknameMatch ? nicknameMatch[1].trim() : speciesPart.trim();

  return {
    species,
    item,
    gender,
  };
}

export function parseShowdownText(raw: string): TeamMember[] {
  const sets = raw
    .split(/\n\s*\n/g)
    .map((set) => set.trim())
    .filter(Boolean);

  return sets.map((setText) => {
    const member = createDefaultMember();
    const lines = setText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return member;

    const header = parseHeader(lines[0]);
    member.species = header.species;
    member.item = header.item;
    member.gender = header.gender;

    const moves: string[] = [];
    for (const line of lines.slice(1)) {
      if (line.startsWith("Ability:")) {
        member.ability = line.replace("Ability:", "").trim();
      } else if (line.startsWith("Gender:")) {
        const value = line.replace("Gender:", "").trim().toLowerCase();
        member.gender = value.startsWith("m") ? "M" : value.startsWith("f") ? "F" : "N";
      } else if (line.startsWith("EVs:")) {
        const parsed = parseSpread(line.replace("EVs:", "").trim());
        member.evs = {
          hp: parsed.hp ?? 0,
          atk: parsed.atk ?? 0,
          def: parsed.def ?? 0,
          spa: parsed.spa ?? 0,
          spd: parsed.spd ?? 0,
          spe: parsed.spe ?? 0,
        };
      } else if (line.startsWith("IVs:")) {
        const parsed = parseSpread(line.replace("IVs:", "").trim());
        member.ivs = {
          hp: parsed.hp ?? 31,
          atk: parsed.atk ?? 31,
          def: parsed.def ?? 31,
          spa: parsed.spa ?? 31,
          spd: parsed.spd ?? 31,
          spe: parsed.spe ?? 31,
        };
      } else if (line.endsWith("Nature")) {
        member.nature = line.replace("Nature", "").trim();
      } else if (line.startsWith("-")) {
        moves.push(line.replace(/^-/, "").trim());
      }
    }

    member.moves = [...moves.slice(0, 4), "", "", "", ""].slice(0, 4);
    return member;
  });
}

function serializeSpread(prefix: string, spread: TeamMember["evs"], includeDefaults: boolean): string {
  const entries: Array<[string, number]> = [
    ["HP", spread.hp],
    ["Atk", spread.atk],
    ["Def", spread.def],
    ["SpA", spread.spa],
    ["SpD", spread.spd],
    ["Spe", spread.spe],
  ];
  const filtered = entries.filter(([, value]) => (includeDefaults ? value !== 31 : value > 0));

  if (!filtered.length) return "";
  return `${prefix}: ${filtered.map(([stat, value]) => `${value} ${stat}`).join(" / ")}`;
}

export function exportShowdownText(members: TeamMember[]): string {
  return members
    .filter((member) => member.species.trim())
    .map((member) => {
      const lines: string[] = [];
      const genderToken = member.gender === "N" ? "" : ` (${member.gender})`;
      const itemToken = member.item ? ` @ ${member.item}` : "";
      lines.push(`${member.species}${genderToken}${itemToken}`);
      if (member.ability) lines.push(`Ability: ${member.ability}`);
      lines.push(`Level: ${member.level}`);
      lines.push(`${member.nature || "Serious"} Nature`);

      const evLine = serializeSpread("EVs", member.evs, false);
      if (evLine) lines.push(evLine);

      const ivLine = serializeSpread("IVs", member.ivs, true);
      if (ivLine) lines.push(ivLine);

      for (const move of member.moves.filter(Boolean)) {
        lines.push(`- ${move}`);
      }

      return lines.join("\n");
    })
    .join("\n\n");
}
