import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateTeamSchema } from "@/lib/validators";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ teamId: string; versionId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const { teamId, versionId } = await context.params;
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
    return jsonError("Team not found.", 404);
  }

  const sourceVersion = await prisma.teamVersion.findFirst({
    where: { id: versionId, teamId },
    select: { snapshot: true },
  });

  if (!sourceVersion) return jsonError("Version not found.", 404);

  const parsedSnapshot = updateTeamSchema.safeParse(sourceVersion.snapshot);
  if (!parsedSnapshot.success) {
    return jsonError("Stored version has invalid shape and cannot be restored.", 400);
  }

  const nextVersion = (team.versions[0]?.version ?? 0) + 1;
  const restoredTeam = await prisma.$transaction(async (tx) => {
    const updated = await tx.team.update({
      where: { id: teamId },
      data: {
        name: parsedSnapshot.data.name,
        format: parsedSnapshot.data.format,
        maxSize: parsedSnapshot.data.maxSize,
        data: parsedSnapshot.data.data,
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

  return NextResponse.json({
    team: {
      ...restoredTeam,
      createdAt: restoredTeam.createdAt.toISOString(),
      updatedAt: restoredTeam.updatedAt.toISOString(),
    },
    version: nextVersion,
  });
}
