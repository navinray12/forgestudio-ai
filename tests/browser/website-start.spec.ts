import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Opt-in only: real local login + OTP, no forged session and no provider calls.
const enabled = process.env.FORGE_TEST_LOCAL_ACCOUNTS === "1";
const base = "http://127.0.0.1:55173";
test.use({ trace: "off", video: "off", screenshot: "off" });
test.describe.configure({ mode: "serial" }); // local OTP delivery file is single-recipient
test.skip(!enabled, "Requires operator-provisioned disposable qualification accounts");

async function login(page: Page, prefix: string, destination: string) {
  const file = process.env.FORGE_LOCAL_CREDENTIALS_FILE;
  const accounts = file ? JSON.parse(readFileSync(file, "utf8")) : {};
  const email = process.env[`${prefix}_EMAIL`] || accounts[prefix]?.email;
  const password = process.env[`${prefix}_PASSWORD`] || accounts[prefix]?.password;
  if (!email || !password) throw new Error("Missing local test credentials");
  await page.goto(`${base}/login`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to Forge", exact: true }).click();
  // Do not leave credentials in a failure accessibility snapshot.
  const passwordField = page.getByLabel("Password", { exact: true });
  if (await passwordField.isVisible()) await passwordField.fill("");
  await expect(page.getByLabel("Verification code")).toBeVisible();
  const delivery = JSON.parse(execFileSync("docker", ["compose", "-p", "forge-ai-qualification", "-f", "docker-compose.yml", "-f", "docker-compose.ai-qualification.yml", "exec", "-T", "api", "cat", "/tmp/forge-local-otp.json"], { encoding: "utf8" }));
  expect(delivery.email).toBe(email);
  await page.getByLabel("Verification code").fill(delivery.code);
  await page.getByRole("button", { name: "Verify and sign in", exact: true }).click();
  await expect(page).toHaveURL(`${base}${destination}`);
}

test("admin signs in to the real admin dashboard", async ({ page }) => {
  await login(page, "FORGE_ADMIN", "/admin");
  const response = await page.request.get("http://127.0.0.1:55000/api/operations/admin/stats");
  expect(response.status()).toBe(200);
});

test("super-admin signs in without bypassing platform step-up", async ({ page }) => {
  await login(page, "FORGE_SUPER_ADMIN", "/super-admin");
  const response = await page.request.post("http://127.0.0.1:55000/api/v1/platform-auth/session", {
    headers: { Origin: base }, data: {},
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).error.code).toBe("STEP_UP_REQUIRED");
});

test("chooser keyboard dismissal and all three real editor destinations", async ({ page }) => {
  test.setTimeout(120000);
  await login(page, "FORGE_BUILDER", "/dashboard");
  const createButton = () => page.getByRole("button", { name: "+ Create New Website", exact: true });
  await createButton().click();
  const chooser = page.getByRole("dialog", { name: "Select a way to get started" });
  await expect(chooser).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(chooser.getByRole("button", { name: /^Blank site/ })).toBeVisible();
  await page.screenshot({ path: "test-results/website-start-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/website-start-desktop.png" });
  await page.keyboard.press("Escape");
  await expect(chooser).toHaveCount(0);
  await expect(createButton()).toBeFocused();
  for (const mode of ["Blank site", "Template", "AI site builder"]) {
    await page.goto(`${base}/dashboard`);
    await createButton().click();
    await chooser.getByRole("button", { name: new RegExp(`^${mode}`) }).click();
    await page.getByPlaceholder("My New Website").fill(`Chooser ${mode} ${Date.now()}`);
    await page.getByRole("button", { name: "Create Website", exact: true }).click();
    await expect(page).toHaveURL(/\/editor\/[a-f0-9-]+/);
    await expect(page.getByRole("button", { name: "Design with AI", exact: true })).toBeVisible({ timeout: 30000 });
    if (mode === "Template") {
      await expect(page.getByRole("heading", { name: /Template Library/ })).toBeVisible();
      const websiteId = new URL(page.url()).pathname.split("/").at(-1);
      const endpoint = `http://127.0.0.1:55000/api/websites/${websiteId}`;
      const before = (await (await page.request.get(endpoint)).json()).website;
      const saved = page.waitForResponse(response => response.url() === endpoint && response.request().method() === "PUT");
      await page.getByRole("button", { name: /^Insert template / }).first().click();
      await page.getByRole("button", { name: "Save", exact: true }).click();
      expect((await saved).status()).toBe(200);
      const after = (await (await page.request.get(endpoint)).json()).website;
      expect(after.documentVersion).toBeGreaterThan(before.documentVersion);
      expect(after.editorData).not.toEqual(before.editorData);
    }
    const designer = page.getByRole("dialog", { name: "Stitch and Claude website designer" });
    if (mode === "AI site builder") {
      await expect(designer).toBeVisible();
      await expect(designer.getByRole("button", { name: "Generate proposal", exact: true })).toBeDisabled();
      await expect(designer.getByRole("status")).toContainText("configure Stitch");
    }
    else await expect(designer).toHaveCount(0);
  }
});
