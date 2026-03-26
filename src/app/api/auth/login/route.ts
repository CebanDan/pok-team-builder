import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError, zodError } from "@/lib/api";
import {
  createSessionToken,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { getPrismaSetupErrorMessage } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";
import { authSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = authSchema.parse(body);
    const normalizedEmail = email.toLowerCase().trim();

    console.log(`[LOGIN] Attempt for: "${normalizedEmail}"`);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, passwordHash: true, createdAt: true, updatedAt: true },
    });

    if (!user) {
      console.warn(`[LOGIN] User NOT found: "${normalizedEmail}"`);
      return jsonError("Invalid email or password.", 401);
    }

    console.log(`[LOGIN] User found, verifying password hash: ${user.passwordHash.substring(0, 10)}...`);
    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      console.warn(`[LOGIN] Password mismatch for: "${normalizedEmail}"`);
      return jsonError("Invalid email or password.", 401);
    }

    console.log(`[LOGIN] Success for: "${normalizedEmail}"`);

    const token = createSessionToken(user);
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    const setupMessage = getPrismaSetupErrorMessage(error);
    if (setupMessage) return jsonError(setupMessage, 500);
    console.error("login error", error);
    return jsonError("Failed to log in.", 500);
  }
}
