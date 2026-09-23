/**
 * Promote an existing account to admin. Admin can never be chosen at sign-up,
 * so this is how the first admin is created on a real deployment:
 *
 *   npm run make-admin -- you@example.com
 *
 * Sign up normally first, then run this where the app's DATABASE_URL is set
 * (locally, or on Railway via `railway ssh`).
 */
import { PrismaClient } from "@prisma/client";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: npm run make-admin -- you@example.com");
  process.exit(1);
}
const db = new PrismaClient();
try {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No account with email ${email}. Sign up on the site first, then run this again.`);
    process.exit(1);
  }
  if (user.role === "admin") console.log(`${email} is already an admin.`);
  else {
    await db.user.update({ where: { id: user.id }, data: { role: "admin" } });
    await db.adminAction.create({ data: { adminId: user.id, targetUserId: user.id, action: "promote_admin", details: `Promoted from ${user.role} via make-admin script` } });
    console.log(`${email} is now an admin. Sign out and back in to see the Admin dashboard.`);
  }
} finally {
  await db.$disconnect();
}
