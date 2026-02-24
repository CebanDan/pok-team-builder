import { NextResponse } from "next/server";

import { setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, null);
  return response;
}
