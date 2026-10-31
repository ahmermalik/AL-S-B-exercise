import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: ["./src/server/schema.ts", "./src/server/auth-schema.ts"],
  out: "./drizzle/generated",
  dialect: "sqlite",
  dbCredentials: { url: process.env.DATABASE_PATH || "data/asset-living.sqlite" },
});
