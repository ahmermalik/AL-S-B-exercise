import { unlinkSync, existsSync, mkdirSync } from "node:fs";
const ownedPath = "data/e2e/workspace.sqlite";
if (process.env.DATABASE_PATH !== ownedPath) throw new Error("The workflow test server requires its isolated database.");
mkdirSync("data/e2e", { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) if (existsSync(ownedPath + suffix)) unlinkSync(ownedPath + suffix);
void import("./dev");
