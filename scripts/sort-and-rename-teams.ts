import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import readline from "readline";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  console.log("--- Team Renaming Script ---");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      teams: {
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, createdAt: true },
      },
    },
  });

  if (users.length === 0) {
    console.log("No users found. Exiting.");
    return;
  }

  const changes: { userId: string; teamId: string; oldName: string; newName: string }[] = [];

  console.log("\n🔍 Preview of proposed changes:");
  for (const user of users) {
    console.log(`\n👤 User: ${user.email}`);
    if (user.teams.length === 0) {
      console.log("  No teams to rename.");
      continue;
    }

    user.teams.forEach((team, index) => {
      const newName = `Team ${index + 1}`;
      if (team.name !== newName) {
        changes.push({
          userId: user.id,
          teamId: team.id,
          oldName: team.name,
          newName,
        });
        console.log(`  - [${team.id}] "${team.name}" -> "${newName}"`);
      }
    });
  }

  if (changes.length === 0) {
    console.log("\n✅ No renames needed. All teams are already in sequential order.");
    return;
  }

  console.log(`\nFound ${changes.length} teams to rename across ${users.length} users.`);

  rl.question(
    "\n⚠️  This is a destructive action. Are you sure you want to proceed? (yes/no): ",
    async (answer) => {
      if (answer.toLowerCase() !== "yes") {
        console.log("\n❌ Operation cancelled.");
        rl.close();
        return;
      }

      try {
        console.log("\n⏳ Applying changes...");
        await prisma.$transaction(async (tx) => {
          for (const change of changes) {
            await tx.team.update({
              where: { id: change.teamId },
              data: { name: change.newName },
            });
          }
        });

        console.log("\n✅ Successfully renamed all teams.");
        console.log("\n--- Final Report ---");
        for (const change of changes) {
          console.log(`  - [${change.teamId}] "${change.oldName}" was renamed to "${change.newName}"`);
        }
      } catch (error) {
        console.error("\n🚨 An error occurred during the transaction. All changes have been rolled back.");
        console.error(error);
      } finally {
        rl.close();
      }
    },
  );
}

main()
  .catch((e) => {
    console.error("Script failed:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
