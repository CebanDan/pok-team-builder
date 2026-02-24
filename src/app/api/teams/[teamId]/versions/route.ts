import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ teamId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const { teamId } = await context.params;
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, userId: true },
  });

  if (!team || team.userId !== user.id) {
    return jsonError("Team not found.", 404);
  }

  const versions = await prisma.teamVersion.findMany({
    where: { teamId },
    orderBy: { version: "desc" },
    take: 50,
    select: {
      id: true,
      version: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    versions: versions.map((version) => ({
      ...version,
      createdAt: version.createdAt.toISOString(),
    })),
  });
}
