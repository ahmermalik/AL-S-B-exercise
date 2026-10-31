import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

export async function setup() {
  if (!process.env.BETTER_AUTH_SECRET) {
    if (process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET must be configured before starting the application.");
    const secret = randomBytes(32).toString("hex");
    const envPath = path.resolve(".env.local");
    if (!fs.existsSync(envPath)) fs.writeFileSync(envPath, "", { mode: 0o600 });
    fs.appendFileSync(envPath, `\nBETTER_AUTH_SECRET=${secret}\n`);
    process.env.BETTER_AUTH_SECRET = secret;
  }
  const { db, initializeDatabase, sqlite } = await import("../src/server/db");
  const { user, account, authTablesSql } = await import("../src/server/auth-schema");
  const { eq } = await import("drizzle-orm");
  const { hashPassword } = await import("better-auth/crypto");
  initializeDatabase(); sqlite.exec(authTablesSql);
  const password = process.env.LOCAL_SEED_PASSWORD;
  if (!password || password.length < 12) throw new Error("Set LOCAL_SEED_PASSWORD to at least 12 characters in .env.local.");
  for (const role of ["manager", "accountant"] as const) {
    const email = `${role}@assetliving.com`;
    const name = role === "manager" ? "Sandy Tran-Li" : "Hunter Harty";
    // Move accounts created under the earlier .local walkthrough domain instead of creating duplicates.
    const legacy = `${role}@assetliving.local`;
    if (!db.select().from(user).where(eq(user.email, email)).get() && db.select().from(user).where(eq(user.email, legacy)).get()) db.update(user).set({ email, updatedAt: new Date() }).where(eq(user.email, legacy)).run();
    const existing = db.select().from(user).where(eq(user.email, email)).get();
    // Keep walkthrough account names in sync when setup runs against an existing database.
    if (existing && existing.name !== name) db.update(user).set({ name, updatedAt: new Date() }).where(eq(user.email, email)).run();
    if (!existing) {
      const id = randomUUID(); const now = new Date();
      const hashed = await hashPassword(password);
      db.transaction(tx => {
        tx.insert(user).values({ id, email, name, role, emailVerified: true, createdAt: now, updatedAt: now }).run();
        tx.insert(account).values({ id: randomUUID(), userId: id, accountId: id, providerId: "credential", password: hashed, createdAt: now, updatedAt: now }).run();
      });
    }
  }
  const workbook = process.env.SOURCE_WORKBOOK_PATH || "data/source/close-pack.xlsx";
  if (fs.existsSync(workbook)) {
    const { importWorkbook, getWorkspace } = await import("../src/server/store");
    if (!getWorkspace().source) await importWorkbook(fs.readFileSync(workbook), "September 2026 Close Pack.xlsx");
  }
  console.log("Local accounts and source records are ready.");
}

if (/setup\.(ts|mjs)$/.test(process.argv[1] || "")) setup().catch(error => { console.error(error); process.exitCode = 1; });
