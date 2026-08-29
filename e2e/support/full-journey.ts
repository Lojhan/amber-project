import { resolve } from "node:path";
import { type APIRequestContext, expect, type Page } from "@playwright/test";

const apiBaseUrl = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "3101"}`;

const reloadAt = async (page: Page, text: string) => {
  await page.reload();
  await expect(page.locator("[data-hydrated='true']")).toBeVisible();
  await expect(page.getByText(text)).toBeVisible({ timeout: 30_000 });
};

export const uploadAndInterpretWithCopilot = async (page: Page) => {
  await page
    .getByLabel("Buying priorities")
    .fill("Prioritize lead time over cost; max lead time 30 days");
  await page
    .getByLabel("XLSX quotation")
    .setInputFiles(resolve(process.cwd(), "quotation_3.xlsx"));
  await page.getByRole("button", { name: "Upload and continue" }).click();
  const scenarios = page.getByRole("radio", { name: /Quote/ });
  await expect(scenarios).toHaveCount(2, { timeout: 30_000 });
  expect(new URL(page.url()).searchParams.get("workspace")).toMatch(
    /^[0-9a-f-]{36}$/,
  );
  await page.reload();
  await expect(scenarios).toHaveCount(2, { timeout: 30_000 });
  await page.getByRole("button", { name: /Procurement copilot/ }).click();
  await page
    .getByRole("textbox", { name: "Ask the procurement copilot" })
    .fill("Which quotation scenario should I review?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByText("Which quotation scenario should I review?"),
  ).toBeVisible();
  await expect(
    page.getByText("I’m reviewing the available quotation scenarios."),
  ).toBeVisible();
  await expect(page.getByText("Use Quote 2")).toBeVisible();
  await page.getByRole("button", { name: "Review and apply" }).click();
  await page.getByRole("button", { name: "Close procurement copilot" }).click();
};

export const reviewAndNegotiate = async (page: Page) => {
  await expect(
    page.getByRole("heading", { name: "Review product matches" }),
  ).toBeVisible();
  await reloadAt(page, "Review product matches");
  await expect(page.getByLabel("Catalog match")).toContainText("AQ009-0BS-XS");
  await page.getByRole("button", { name: /Use this product for/ }).click();
  await page.getByRole("button", { name: "Prepare buying priorities" }).click();
  await expect(page.getByText(/Delivery speed 35%/)).toBeVisible();
  await expect(page.getByText("30 days maximum")).toBeVisible();
  await page.getByRole("button", { name: "Use these priorities" }).click();
  await page
    .getByRole("button", { name: "Start supplier negotiation" })
    .click();
  await expect(page.getByText("Recommended supplier")).toBeVisible({
    timeout: 30_000,
  });
  await reloadAt(page, "Recommended supplier");
  await expect(page.getByText(/only 60% of the order/)).toBeVisible();
  await page.getByText("View negotiation audit (4)").click();
  await expect(page.getByText(/Brand → Supplier 2/).first()).toBeVisible();
  await expect(
    page.getByText(/revised proposal reflects the 60% capacity limit/),
  ).toBeVisible();
};

const expectPersistedOrder = async (request: APIRequestContext) => {
  const orders = await request.get(`${apiBaseUrl}/api/v1/purchase-orders`);
  expect(orders.ok()).toBeTruthy();
  const list = (await orders.json()) as { items?: Array<{ id: string }> };
  const orderId = list.items?.at(-1)?.id;
  expect(orderId).toBeTruthy();
  const detail = await request.get(
    `${apiBaseUrl}/api/v1/purchase-orders/${orderId}`,
  );
  expect(detail.ok()).toBeTruthy();
};

export const issueRestartAndReset = async (
  page: Page,
  request: APIRequestContext,
) => {
  await page.getByRole("button", { name: "Preview purchase order" }).click();
  await expect(page.getByText("Commitment preview")).toBeVisible();
  await page
    .getByRole("button", { name: "Approve and issue purchase order" })
    .click();
  await page.getByRole("button", { name: "Confirm and issue" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Purchase order PO-E2E-0001 issued",
  );
  await page.getByRole("button", { name: /Issued orders/ }).click();
  await expect(
    page.getByRole("heading", { name: "Issued purchase orders" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /PO-E2E-0001/ }).click();
  await expect(page.getByText(/33% order/)).toBeVisible();
  await expect(page.getByText("AQ009-0BS-XS").first()).toBeVisible();
  await expectPersistedOrder(request);
  await page.getByRole("button", { name: "Back to orders" }).click();
  await page.getByRole("button", { name: "Start again" }).click();
  expect(new URL(page.url()).searchParams.has("workspace")).toBe(false);
  await expect(page.getByRole("button", { name: /PO-E2E-0001/ })).toBeVisible();
  await page.getByRole("button", { name: /PO-E2E-0001/ }).click();
  await expect(page.getByText(/33% order/)).toBeVisible();
  await expectPersistedOrder(request);
  await page.getByRole("button", { name: "Reset challenge" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Reset challenge" })
    .click();
  const orders = await request.get(`${apiBaseUrl}/api/v1/purchase-orders`);
  await expect(orders.json()).resolves.toEqual({ items: [] });
};
