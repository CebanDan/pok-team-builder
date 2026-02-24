import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError, zodError } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { FORMAT_RULES } from "@/lib/formats";
import { prisma } from "@/lib/prisma";
import { serializeTeamRecord } from "@/lib/team";
import { updateTeamSchema } from "@/lib/validators";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ teamId: string }>;
};

async function getOwnedTeam(request: NextRequest, teamId: string) {
  const user = await getAuthUser(request);
  if (!user) return { error: jsonError("Unauthorized.", 401), user: null, team: null };

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      versions: {
        select: { version: true },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!team || team.userId !== user.id) {
    return { error: jsonError("Team not found.", 404), user: null, team: null };
  }

  return { error: null, user, team };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { teamId } = await context.params;
  const result = await getOwnedTeam(request, teamId);
  if (result.error || !result.team) return result.error ?? jsonError("Team not found.", 404);

  return NextResponse.json({
    team: serializeTeamRecord({
      id: result.team.id,
      name: result.team.name,
      format: result.team.format,
      maxSize: result.team.maxSize,
      data: result.team.data,
      createdAt: result.team.createdAt,
      updatedAt: result.team.updatedAt,
    }),
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { teamId } = await context.params;
    const result = await getOwnedTeam(request, teamId);
    if (result.error || !result.team) return result.error ?? jsonError("Team not found.", 404);

    const payload = await request.json();
    const parsed = updateTeamSchema.parse(payload);
    const formatRule = FORMAT_RULES[parsed.format];
    const maxSize = Math.min(parsed.maxSize, formatRule.maxTeamSize);
    const nextVersion = (result.team.versions[0]?.version ?? 0) + 1;

    const updatedTeam = await prisma.$transaction(async (tx) => {
      const updated = await tx.team.update({
        where: { id: teamId },
        data: {
          name: parsed.name.trim(),
          format: parsed.format,
          maxSize,
          data: parsed.data,
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
          teamId,
          version: nextVersion,
          snapshot: {
            name: updated.name,
            format: updated.format,
            maxSize: updated.maxSize,
            data: updated.data,
          },
        },
      });

      return updated;
    });

    return NextResponse.json({ team: serializeTeamRecord(updatedTeam), version: nextVersion });
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    console.error("update team error", error);
    return jsonError("Failed to update team.", 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { teamId } = await context.params;
  const result = await getOwnedTeam(request, teamId);
  if (result.error || !result.team) return result.error ?? jsonError("Team not found.", 404);

  await prisma.team.delete({ where: { id: teamId } });
  return NextResponse.json({ ok: true });
}
