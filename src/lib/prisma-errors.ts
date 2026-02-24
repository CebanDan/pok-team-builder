import { Prisma } from "@prisma/client";

function getDatabaseTarget(): string {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return `${url.hostname}:${url.port || "5432"}`;
  } catch {
    return "configured DATABASE_URL";
  }
}

export function getPrismaSetupErrorMessage(error: unknown): string | null {
  const databaseTarget = getDatabaseTarget();
  const offlineMessage =
    `Database is offline or unreachable at ${databaseTarget}. Start PostgreSQL and verify DATABASE_URL.`;

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return "Database connection failed. Start PostgreSQL and verify DATABASE_URL in .env.";
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") {
      return "Database tables are missing. Run: npm run prisma:migrate -- --name init";
    }
    if (error.code === "P1000" || error.code === "P1001") {
      return "Database is unreachable or credentials are invalid. Check DATABASE_URL and Postgres status.";
    }
    if (error.code === "ECONNREFUSED" || error.code === "EHOSTUNREACH") {
      return offlineMessage;
    }
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    const message = String(error.message ?? "");
    if (message.includes("ECONNREFUSED") || message.includes("EHOSTUNREACH")) {
      return offlineMessage;
    }
  }

  return null;
}
