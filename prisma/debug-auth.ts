import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function debugAuth() {
  const email = "cebandan116@gmail.com";
  const password = "password123"; // Assuming this was the password used

  console.log(`--- Debugging Auth for ${email} ---`);

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      console.log("❌ User not found in database.");
      
      // List all users to see what's there
      const allUsers = await prisma.user.findMany({ select: { email: true } });
      console.log("Current users in DB:", allUsers.map(u => u.email));
      return;
    }

    console.log("✅ User found in database.");
    console.log("Stored Password Hash:", user.passwordHash);

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    console.log(`Password "${password}" match:`, isMatch ? "✅ YES" : "❌ NO");

    // Test with common variations if it failed
    if (!isMatch) {
      const variations = ["Password123", "password", "12345678"];
      for (const v of variations) {
        const match = await bcrypt.compare(v, user.passwordHash);
        if (match) {
          console.log(`💡 Found match with variation: "${v}"`);
        }
      }
    }

  } catch (error) {
    console.error("Error during debug:", error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

debugAuth();
