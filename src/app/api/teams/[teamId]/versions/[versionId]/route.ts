import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ teamId: string; versionId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const { teamId, versionId } = await context.params;
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { userId: true },
  });

  if (!team || team.userId !== user.id) {
    return jsonError("Team not found.", 404);
  }

  const version = await prisma.teamVersion.findFirst({
    where: { id: versionId, teamId },
    select: { id: true, version: true, snapshot: true, createdAt: true },
  });

  if (!version) return jsonError("Version not found.", 404);

  return NextResponse.json({
    version: {
      ...version,
      createdAt: version.createdAt.toISOString(),
    },
  });
}
