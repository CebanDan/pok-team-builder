import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError, zodError } from "@/lib/api";
import { createSessionToken, hashPassword, setSessionCookie } from "@/lib/auth";
import { getPrismaSetupErrorMessage } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";
import { authSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = authSchema.parse(body);
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existing) {
      return jsonError("Email already registered.", 409);
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
      },
      select: { id: true, email: true, createdAt: true, updatedAt: true },
    });

    const token = createSessionToken(user);
    const response = NextResponse.json({ user }, { status: 201 });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    if (error instanceof ZodError) return zodError(error);
    const setupMessage = getPrismaSetupErrorMessage(error);
    if (setupMessage) return jsonError(setupMessage, 500);
    console.error("register error", error);
    return jsonError("Failed to register user.", 500);
  }
}
