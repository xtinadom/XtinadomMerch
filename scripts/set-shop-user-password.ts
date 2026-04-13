/**
 * Set a ShopUser password by email (local / ops). Does not send email.
 *
 * Usage:
 *   npx tsx scripts/set-shop-user-password.ts <email> [newPassword]
 *
 * If `newPassword` is omitted, uses a default (printed to stdout). Min 10 chars when you pass one.
 *
 * Requires DATABASE_URL (or pooled URL) in .env — same as the app.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hashShopPassword } from "../src/lib/shop-password";

const DEFAULT_PASSWORD = "Localdev-xtinadom-2026!";

async function main() {
  const email = String(process.argv[2] ?? "")
    .trim()
    .toLowerCase();
  let password = String(process.argv[3] ?? "").trim();
  if (!email || !email.includes("@")) {
    console.error("Usage: npx tsx scripts/set-shop-user-password.ts <email> [newPassword]");
    process.exit(1);
  }
  if (!password) {
    password = DEFAULT_PASSWORD;
    console.info(`[set-shop-user-password] No password arg — using default (see below).`);
  }
  if (password.length < 10) {
    console.error("Password must be at least 10 characters.");
    process.exit(1);
  }

  const user = await prisma.shopUser.findUnique({ where: { email } });
  if (!user) {
    console.error(`No ShopUser with email: ${email}`);
    process.exit(1);
  }

  const passwordHash = hashShopPassword(password);
  await prisma.shopUser.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  console.info(`Updated password for ShopUser ${user.id} (${email}).`);
  if (password === DEFAULT_PASSWORD) {
    console.info(`Password is: ${DEFAULT_PASSWORD}`);
  } else {
    console.info("Password set to the value you passed on the command line.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
