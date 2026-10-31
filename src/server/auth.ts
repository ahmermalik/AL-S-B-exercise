import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "./db";
import * as schema from "./auth-schema";

const baseURL = process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000";
export const auth = betterAuth({
  appName: "Asset Living Close",
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  user: { additionalFields: { role: { type: "string", defaultValue: "accountant", input: false } } },
  trustedOrigins: [baseURL, "http://127.0.0.1:3000", "http://localhost:3000"],
  session: { expiresIn: 60 * 60 * 24, updateAge: 60 * 60 },
});
