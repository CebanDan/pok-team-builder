import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  const migrationPath = path.join(process.cwd(), "prisma", "migrations", "0001_init", "migration.sql");
  const migrationSql = await fs.readFile(migrationPath, "utf8");

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(migrationSql);
    console.info("Database schema initialized.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("already exists")) {
      console.info("Database schema already initialized.");
    } else {
      throw error;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Failed to initialize schema:", error);
  process.exitCode = 1;
});
