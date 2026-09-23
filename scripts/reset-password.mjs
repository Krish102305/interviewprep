/**
 * Set a new temporary password for an account (until "Forgot password" by
 * email exists). Signs the account out everywhere.
 *
 *   npm run reset-password -- you@example.com
 *
 * Run it where the app's DATABASE_URL is set: locally for your laptop's
 * database, or on Railway via `railway ssh` for the live site.
 */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: npm run reset-password -- you@example.com");
  process.exit(1);
}
const db = new PrismaClient();
try {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    const count = await db.user.count();
    console.error(`No account with email ${email} in this database (${count} account${count === 1 ? "" : "s"} total).`);
    console.error("Remember: your laptop and the live site have separate databases.");
    process.exit(1);
  }
  const temp = crypto.randomBytes(6).toString("base64url");
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(temp, 10) } });
  await db.session.deleteMany({ where: { userId: user.id } });
  console.log(`Temporary password for ${email}: ${temp}`);
  console.log("Sign in with it, then set your own under Profile → Password.");
} finally {
  await db.$disconnect();
}
