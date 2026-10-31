import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { setup } from "./setup";

async function portAvailable(port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") resolve(false);
      else reject(error);
    });
    probe.listen(port, "127.0.0.1", () => {
      probe.close(error => error ? reject(error) : resolve(true));
    });
  });
}

async function main() {
  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a number between 1 and 65535.");
  if (!(await portAvailable(port))) {
    console.error(`Port ${port} is already in use.\nIf Asset Living is already running, open http://127.0.0.1:${port}.\nTo restart it, stop the existing server with Ctrl+C, then run pnpm dev again.`);
    process.exitCode = 1;
    return;
  }
  const nextCli = createRequire(resolve("package.json")).resolve("next/dist/bin/next");
  await setup();
  const children = [
    spawn(process.execPath, [nextCli, "dev", "--hostname", "127.0.0.1", "--port", String(port)], { stdio: "inherit", env: process.env }),
    spawn(process.execPath, ["--env-file-if-exists=.env.local", "--import", "tsx", "src/worker.ts"], { stdio: "inherit", env: process.env }),
  ];
  let stopping = false;
  function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill("SIGTERM"); process.exitCode = code; }
  process.on("SIGINT", () => stop()); process.on("SIGTERM", () => stop());
  children.forEach(child => {
    child.on("exit", code => stop(code || 0));
    child.on("error", error => { console.error(`Unable to start application process: ${error.message}`); stop(1); });
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; });
