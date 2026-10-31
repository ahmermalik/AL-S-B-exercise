import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const imports = sqliteTable("close_imports", {
  id: text("id").primaryKey(), hash: text("hash").notNull().unique(),
  createdAt: text("created_at").notNull(), summary: text("summary").notNull(), payload: text("payload").notNull(),
});
export const cases = sqliteTable("close_cases", {
  id: text("id").primaryKey(), importId: text("import_id").notNull().references(() => imports.id),
  propertyId: text("property_id").notNull(), kind: text("kind").notNull(),
  revision: integer("revision").notNull(), data: text("data").notNull(),
});
export const jobs = sqliteTable("close_runs", {
  id: text("id").primaryKey(), importId: text("import_id").notNull().references(() => imports.id),
  status: text("status").notNull(), createdAt: text("created_at").notNull(),
  leaseOwner: text("lease_owner"), leaseUntil: integer("lease_until"), data: text("data").notNull(),
});
export const packages = sqliteTable("close_packages", {
  id: text("id").primaryKey(), importId: text("import_id").notNull().references(() => imports.id),
  propertyId: text("property_id").notNull(), version: integer("version").notNull(),
  fingerprint: text("fingerprint").notNull(), data: text("data").notNull(),
});
