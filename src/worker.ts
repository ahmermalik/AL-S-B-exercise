import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { initializeDatabase } from "./server/db";
import * as store from "./server/store";
import { processNextRun } from "./server/jobs";

async function main() {
  initializeDatabase();
  const workerId = `worker-${randomUUID()}`;
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  console.info(JSON.stringify({ event: "worker_started", workerId }));
  while (!controller.signal.aborted) {
    try {
      const handled = await processNextRun(store, workerId, { signal: controller.signal });
      if (!handled) await delay(1000, undefined, { signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) break;
      console.error(JSON.stringify({ event: "worker_error", message: error instanceof Error ? error.message : "Worker error" }));
      await delay(2000, undefined, { signal: controller.signal }).catch(() => {});
    }
  }
  console.info(JSON.stringify({ event: "worker_stopped", workerId }));
}

void main().catch(error => { console.error(error instanceof Error ? error.message : "Worker startup failed."); process.exitCode = 1; });
