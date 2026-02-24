import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { jsonError, zodError } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { FORMAT_RULES } from "@/lib/formats";
import { prisma } from "@/lib/prisma";
import { serializeTeamRecord } from "@/lib/team";
import { teamDataSchema } from "@/lib/validators";

export const runtime = "nodejs";

const createPayloadSchema = z.object({
  name: z.string().min(1).max(100),
  format: z.enum(["ou", "uu", "vgc", "custom"]).default("custom"),
  maxSize: z.number().int().min(1).max(6).optional(),
  data: teamDataSchema.optional(),
});

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const teams = await prisma.team.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      format: true,
      maxSize: true,
      data: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    teams: teams.map(serializeTeamRecord),
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return jsonError("Unauthorized.", 401);

    const body = await request.json();
    const parsed = createPayloadSchema.parse(body);
    const rule = FORMAT_RULES[parsed.format];
    const maxSize = Math.min(parsed.maxSize ?? rule.defaultTeamSize, rule.maxTeamSize);
    const data = parsed.data ?? { members: [] };

    const team = await prisma.$transaction(async (tx) => {
      const createdTeam = await tx.team.create({
        data: {
          userId: user.id,
          name: parsed.name.trim(),
          format: parsed.format,
          maxSize,
          data,
        },
        select: {
          id: true,
          name: true,
          format: true,
          maxSize: true,
          data: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.teamVersion.create({
        data: {
          teamId: createdTeam.id,
          version: 1,
          snapshot: {
            name: createdTeam.name,
            format: createdTeam.format,
            maxSize: createdTeam.maxSize,
            data: createdTeam.data,
          },
        },
      });

      return createdTeam;
    });

    return NextResponse.json({ team: serializeTeamRecord(team) }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    console.error("create team error", error);
    return jsonError("Failed to create team.", 500);
  }
}
