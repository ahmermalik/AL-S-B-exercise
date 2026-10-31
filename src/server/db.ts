import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";

const databasePath = process.env.DATABASE_PATH || "data/asset-living.sqlite";
if (databasePath !== ":memory:") mkdirSync(dirname(resolve(/* turbopackIgnore: true */ databasePath)), { recursive: true });
export const sqlite = new Database(databasePath);
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("journal_mode = WAL");
const engine = (sqlite.prepare("select sqlite_version() as version").get() as { version: string }).version;
const [major, minor, patch] = engine.split(".").map(Number);
if (major < 3 || (major === 3 && (minor < 51 || (minor === 51 && patch < 3)))) {
  throw new Error(`SQLite ${engine} does not meet the patched WAL baseline (3.51.3+).`);
}
export const db = drizzle(sqlite, { schema: { ...schema, ...authSchema } });
export function installResetGuards() {
  sqlite.exec(readFileSync(resolve("drizzle/0001_reset_guards.sql"), "utf8"));
  sqlite.prepare("INSERT OR IGNORE INTO close_migrations(name, applied_at) VALUES (?, ?)").run("0001_reset_guards", new Date().toISOString());
}
export function initializeDatabase() {
  sqlite.transaction(() => {
    sqlite.exec(readFileSync(resolve("drizzle/0000_close.sql"), "utf8"));
    sqlite.exec(authSchema.authTablesSql);
    sqlite.prepare("INSERT OR IGNORE INTO close_migrations(name, applied_at) VALUES (?, ?)").run("0000_close", new Date().toISOString());
    installResetGuards();
  }).immediate();
}
export function getDatabaseVersion() { return engine; }
