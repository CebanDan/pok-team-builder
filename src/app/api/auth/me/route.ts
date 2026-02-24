import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { getPrismaSetupErrorMessage } from "@/lib/prisma-errors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch (error) {
    const setupMessage = getPrismaSetupErrorMessage(error);
    if (setupMessage) return jsonError(setupMessage, 500);
    console.error("auth me error", error);
    return jsonError("Failed to resolve current session.", 500);
  }
}
