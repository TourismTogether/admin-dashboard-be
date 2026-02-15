/**
 * Seed admin: add prto2802@gmail.com (existing user in `users` table) as admin.
 * Run after migrations: pnpm run db:seed
 * The user must already exist in `users` (register in the app with that email first).
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { userAdmin, users } from "../src/db/schema";

const ADMIN_EMAIL = "prto2802@gmail.com";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl.trim() });
  const db = drizzle(pool);

  const [user] = await db
    .select({ userId: users.userId })
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);

  if (!user) {
    console.error(
      `No user found with email "${ADMIN_EMAIL}". Please register in the app first, then run this seed again.`
    );
    await pool.end();
    process.exit(1);
  }

  const [existing] = await db
    .select()
    .from(userAdmin)
    .where(eq(userAdmin.userId, user.userId))
    .limit(1);

  if (existing) {
    console.log("Admin already exists for:", ADMIN_EMAIL);
    await pool.end();
    return;
  }

  await db.insert(userAdmin).values({
    userId: user.userId,
  });

  console.log("Admin added for:", ADMIN_EMAIL, "(user_id:", user.userId, ")");
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
