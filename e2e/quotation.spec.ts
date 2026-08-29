import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  issueRestartAndReset,
  reviewAndNegotiate,
  uploadAndInterpretWithCopilot,
} from "./support/full-journey.js";

const suppliedFile = (name: string) => resolve(process.cwd(), name);
const apiBaseUrl = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "3101"}`;

const reloadAndExpectVisible = async (page: Page, locator: Locator) => {
  await page.reload();
  await expect(page.locator("[data-hydrated='true']")).toBeVisible();
  await expect(locator).toBeVisible({ timeout: 30_000 });
};

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-hydrated='true']")).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByRole("heading", { name: "Upload quotation" }),
  ).toBeVisible();
});

test("designs every initial empty state and keeps downstream gates closed", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Upload quotation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Confirm the spreadsheet layout" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Review the recommendation" }),
  ).toHaveCount(0);
});

test("executes quotation 3 from workbook upload through PO commitment", async ({
  page,
  request,
}) => {
  const health = await request.get(`${apiBaseUrl}/api/v1/health`);
  expect(health.ok()).toBeTruthy();
  await uploadAndInterpretWithCopilot(page);
  await reviewAndNegotiate(page);
  await issueRestartAndReset(page, page.context().request);
});

test("persists buyer-provided quantities when the workbook omits them", async ({
  page,
}) => {
  await page
    .getByLabel("XLSX quotation")
    .setInputFiles(suppliedFile("quotation_2.xlsx"));
  await page.getByRole("button", { name: "Upload and continue" }).click();
  const interpretation = page.getByRole("radio").last();
  await expect(interpretation).toBeVisible({ timeout: 30_000 });
  await interpretation.click();
  await expect(
    page.getByRole("heading", { name: "Add requested quantities" }),
  ).toBeVisible();
  await page.getByLabel("Requested quantity").fill("10");
  await page
    .getByRole("button", { name: "Save quantities and continue" })
    .click();
  await expect(
    page.getByRole("button", { name: "Prepare buying priorities" }),
  ).toBeVisible();
  await reloadAndExpectVisible(
    page,
    page.getByRole("button", { name: "Prepare buying priorities" }),
  );
  await expect(
    page.getByRole("heading", { name: "Add requested quantities" }),
  ).toHaveCount(0);
});

test("keeps quotation 4 blocked until field roles are resolved", async ({
  page,
}) => {
  await page
    .getByLabel("XLSX quotation")
    .setInputFiles(suppliedFile("quotation_4.xlsx"));
  await page.getByRole("button", { name: "Upload and continue" }).click();
  const interpretation = page.getByRole("radio").last();
  await expect(interpretation).toBeVisible({ timeout: 30_000 });
  await interpretation.click();
  await expect(
    page.getByText(/could not be interpreted safely/i),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Exclude line" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start supplier negotiation" }),
  ).toHaveCount(0);
});

test("has no critical accessibility violations on the authoritative workspace", async ({
  page,
}) => {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((item) => item.impact === "critical"),
  ).toEqual([]);
});

test("rejects a non-XLSX file locally without starting the workflow", async ({
  page,
}) => {
  await page
    .getByLabel("XLSX quotation")
    .setInputFiles(suppliedFile("products.csv"));
  await page.getByRole("button", { name: "Upload and continue" }).click();

  await expect(page.getByRole("alert")).toContainText("Only .xlsx");
  await expect(
    page.getByRole("heading", { name: "Upload quotation" }),
  ).toBeVisible();
});

test("returns a typed Hono problem for an unknown API route", async ({
  request,
}) => {
  const response = await request.get(`${apiBaseUrl}/api/v1/not-a-route`);

  expect(response.status()).toBe(404);
  await expect(response.json()).resolves.toMatchObject({
    code: "route-not-found",
    status: 404,
  });
});

test("renders an intentional recovery path for an unknown web route", async ({
  page,
}) => {
  await page.goto("/not-a-workspace-route");

  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Return to the workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Upload quotation" }),
  ).toBeVisible();
});

test("remains usable without horizontal overflow on a narrow Chrome viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", {
      name: "Upload quotation",
    }),
  ).toBeVisible();
  const dimensions = await page.evaluate(() => {
    const client = document.documentElement.clientWidth;
    const overflow = [...document.querySelectorAll("body *")]
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: element.getAttribute("class"),
          left: bounds.left,
          right: bounds.right,
          width: bounds.width,
        };
      })
      .filter((element) => element.left < -1 || element.right > client + 1)
      .slice(0, 8);

    return {
      client,
      scroll: document.documentElement.scrollWidth,
      overflow,
    };
  });

  expect(
    dimensions.scroll,
    JSON.stringify(dimensions.overflow),
  ).toBeLessThanOrEqual(dimensions.client);
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (item) => item.impact === "critical" || item.impact === "serious",
    ),
  ).toEqual([]);
});
