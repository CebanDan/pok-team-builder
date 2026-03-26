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
  name: z.string().max(100).optional(),
  format: z.enum(["ou", "uu", "vgc", "custom"]).optional(),
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

    const team = await prisma.$transaction(async (tx) => {
      let finalName = parsed.name?.trim();

      if (!finalName || finalName.toLowerCase() === "new team") {
        const existingTeams = await tx.team.findMany({
          where: { userId: user.id, name: { startsWith: "New Team" } },
          select: { name: true },
        });

        let maxNumber = 0;
        for (const t of existingTeams) {
          if (t.name.toLowerCase() === "new team") {
            maxNumber = Math.max(maxNumber, 0);
          } else {
            const match = t.name.match(/^New Team (\d+)$/i);
            if (match) {
              const num = parseInt(match[1], 10);
              if (!isNaN(num)) {
                maxNumber = Math.max(maxNumber, num);
              }
            }
          }
        }
        finalName = maxNumber === 0 && !existingTeams.some(t => t.name.toLowerCase() === "new team") 
          ? "New Team" 
          : `New Team ${maxNumber + 1}`;
      }

      const format = parsed.format ?? "custom";
      const rule = FORMAT_RULES[format];
      const maxSize = Math.min(parsed.maxSize ?? rule.defaultTeamSize, rule.maxTeamSize);
      const data = parsed.data ?? { members: [] };

      const createdTeam = await tx.team.create({
        data: {
          userId: user.id,
          name: finalName,
          format,
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
