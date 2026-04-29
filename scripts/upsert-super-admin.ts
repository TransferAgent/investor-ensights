import { scryptSync, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { adminUsers } from "@shared/schema";
import { eq, ne } from "drizzle-orm";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_DISPLAY || "Super Admin";
  const purgeOthers = process.env.ADMIN_PURGE_OTHERS === "true";

  if (!username || !password) {
    console.error("Missing ADMIN_USERNAME or ADMIN_PASSWORD env vars.");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("ADMIN_PASSWORD must be at least 12 characters.");
    process.exit(1);
  }

  const existing = await db.select().from(adminUsers).where(eq(adminUsers.username, username)).limit(1);

  if (existing.length > 0) {
    await db
      .update(adminUsers)
      .set({ passwordHash: hashPassword(password), displayName })
      .where(eq(adminUsers.username, username));
    console.log(`Updated existing admin: ${username}`);
  } else {
    await db.insert(adminUsers).values({
      username,
      passwordHash: hashPassword(password),
      displayName,
    });
    console.log(`Created admin: ${username}`);
  }

  if (purgeOthers) {
    const removed = await db
      .delete(adminUsers)
      .where(ne(adminUsers.username, username))
      .returning({ username: adminUsers.username });
    console.log(`Removed ${removed.length} other admin(s): ${removed.map((r) => r.username).join(", ") || "none"}`);
  }

  const remaining = await db
    .select({ username: adminUsers.username, displayName: adminUsers.displayName })
    .from(adminUsers);
  console.log("Remaining admins:", remaining.map((r) => r.username).join(", "));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
