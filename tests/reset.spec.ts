import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type { Workspace } from "../src/shared/types";

const origin = "http://127.0.0.1:3101";
async function login(page: Page, role: "manager" | "accountant") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(`${role}@assetliving.com`);
  await page.getByLabel("Password", { exact: true }).fill("CloseReview!2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Close workspace", exact: true })).toBeVisible();
}
async function generation(context: BrowserContext) {
  return (await (await context.request.get(`${origin}/api/reset`)).json()).resetGeneration as string;
}
async function post(context: BrowserContext, url: string, body: unknown, epoch?: string) {
  return context.request.post(`${origin}${url}`, { data: body, headers: { Origin: origin, "X-Workspace-Generation": epoch || await generation(context) } });
}
async function openReset(page: Page) {
  await page.getByRole("button", { name: /account menu/ }).click();
  await page.getByRole("menuitem", { name: "Reset walkthrough", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Reset walkthrough?", exact: true })).toBeVisible();
}

test("account reset clears shared work, invalidates old windows and preserves both logins", async ({ browser, page, context }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await login(page, "manager");
  const anonymous = await browser.newContext({ baseURL: origin });
  expect((await anonymous.request.post(`${origin}/api/reset`, { data: { confirmed: true }, headers: { Origin: origin } })).status()).toBe(401);
  await anonymous.close();
  const staff = await browser.newContext({ baseURL: origin }); const staffPage = await staff.newPage();
  staffPage.on("pageerror", error => errors.push(error.message));
  await login(staffPage, "accountant");
  const oldEpoch = await generation(context);
  expect((await post(context, "/api/reset", { confirmed: false }, oldEpoch)).status()).toBe(400);
  await page.evaluate(() => { localStorage.setItem("close-summary:reset-qa", "old manager draft"); localStorage.setItem("close-appearance", "dark"); });
  await staffPage.evaluate(() => localStorage.setItem("close-summary:reset-qa", "old accountant draft"));

  await openReset(page);
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await generation(context)).toBe(oldEpoch);
  await openReset(page);
  await page.getByRole("dialog").getByRole("button", { name: "Reset walkthrough", exact: true }).click();
  await expect.poll(() => generation(context)).not.toBe(oldEpoch);
  await expect(page.getByRole("heading", { name: "Close workspace", exact: true })).toBeVisible();
  const fresh: Workspace = await (await context.request.get(`${origin}/api/workspace`)).json();
  expect(fresh.source?.counts.invoices).toBe(437);
  expect(fresh.cases).toEqual([]); expect(fresh.run).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("close-summary:reset-qa"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("close-appearance"))).toBe("dark");
  await staffPage.bringToFront();
  await expect.poll(() => staffPage.evaluate(() => localStorage.getItem("close-summary:reset-qa")), { timeout: 15_000 }).toBeNull();
  await expect(staffPage.getByRole("heading", { name: "Close workspace", exact: true })).toBeVisible();
  expect((await post(context, "/api/preparation", { action: "start" }, oldEpoch)).status()).toBe(409);
  expect((await (await context.request.get(`${origin}/api/preparation`)).json()).run).toBeNull();

  await page.goto("/prepare");
  await expect(page.getByRole("button", { name: "Start preparation", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start preparation", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open available findings" })).toBeVisible({ timeout: 30_000 });
  const prepared: Workspace = await (await context.request.get(`${origin}/api/workspace`)).json();
  expect(prepared.cases).toHaveLength(67);
  const labor = prepared.cases.find(c => c.propertyId === "P105" && c.title.includes("StaffBridge"))!;
  expect((await post(context, `/api/cases/${labor.id}/actions`, { action: "request", expectedRevision: labor.revision, text: "Please provide source support for reset verification." })).ok()).toBeTruthy();
  const draft = await (await context.request.get(`${origin}/api/packages?propertyId=P105`)).json();
  const saved = await post(context, "/api/packages", { propertyId: "P105", fingerprint: draft.fingerprint, summary: null, acknowledged: true });
  expect(saved.ok()).toBeTruthy(); const snapshot = await saved.json();

  // The staff account exposes the same shared reset; its existing session survives.
  await staffPage.reload(); await openReset(staffPage);
  await staffPage.getByRole("dialog").getByRole("button", { name: "Reset walkthrough", exact: true }).click();
  await expect.poll(() => generation(staff)).not.toBe(prepared.resetGeneration);
  await expect(staffPage.getByRole("heading", { name: "Close workspace", exact: true })).toBeVisible();
  const cleared: Workspace = await (await staff.request.get(`${origin}/api/workspace`)).json();
  expect(cleared.cases).toEqual([]); expect(cleared.run).toBeNull();
  expect(cleared.source?.id).not.toBe(prepared.source?.id);
  expect((await post(context, "/api/preparation", { action: "start", importId: prepared.source?.id })).status()).toBe(409);
  expect((await (await context.request.get(`${origin}/api/preparation`)).json()).run).toBeNull();
  expect((await context.request.get(`${origin}/api/cases/${labor.id}`)).status()).toBe(404);
  expect((await context.request.get(`${origin}/api/packages/${snapshot.id}/export?format=html`)).status()).toBe(404);
  expect((await (await context.request.get(`${origin}/api/packages?propertyId=P105`)).json()).snapshots).toEqual([]);
  expect((await context.request.get(`${origin}/api/session`)).ok()).toBeTruthy();
  await page.reload(); await expect(page.getByRole("heading", { name: "Close workspace", exact: true })).toBeVisible();
  expect(errors).toEqual([]); await staff.close();
});
