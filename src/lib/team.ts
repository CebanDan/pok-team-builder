import { FORMAT_RULES } from "@/lib/formats";

import type { FormatId, TeamData, TeamRecord } from "@/lib/domain";

export function createEmptyTeamData(): TeamData {
  return {
    members: [],
  };
}

export function makeDefaultTeamPayload(format: FormatId): Pick<TeamRecord, "format" | "maxSize" | "data"> {
  const rule = FORMAT_RULES[format] ?? FORMAT_RULES.custom;
  return {
    format,
    maxSize: rule.defaultTeamSize,
    data: createEmptyTeamData(),
  };
}

export function serializeTeamRecord(team: {
  id: string;
  name: string;
  format: string | null;
  maxSize: number;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
}): TeamRecord {
  return {
    id: team.id,
    name: team.name,
    format: team.format as FormatId | undefined,
    maxSize: team.maxSize,
    data: team.data as TeamData,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
  };
}
