import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE_NAME = "ptb_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = {
  sub: string;
  email: string;
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn("JWT_SECRET is not set. Using insecure development fallback secret.");
    return "dev-only-insecure-secret-change-me";
  }

  throw new Error("JWT_SECRET is required in production.");
}

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, 12);
}

export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

export function createSessionToken(user: { id: string; email: string }): string {
  return jwt.sign({ sub: user.id, email: user.email }, getJwtSecret(), {
    expiresIn: SESSION_DURATION_SECONDS,
  });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as SessionPayload;
    if (!payload.sub || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  return prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, createdAt: true, updatedAt: true },
  });
}

export function setSessionCookie(response: NextResponse, token: string | null): void {
  const secureCookie =
    process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE?.toLowerCase() === "true";

  if (!token) {
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      path: "/",
      maxAge: 0,
    });
    return;
  }

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}
