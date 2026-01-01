import { expect, test } from "@playwright/test";

// E2E tests using form configuration (v1) with debug mode enabled
test.describe("Form builder (debug mode)", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/?debug=true");
	});

	test("loads the debug configuration", async ({ page }) => {
		await expect(page.getByText("Purpose").first()).toBeVisible();
	});

	test("navigates to the next step", async ({ page }) => {
		const initialTitle = await page.locator('[aria-current="step"] .step-title').first().textContent();
		await page.getByRole("button", { name: "Next step" }).click();
		const nextTitle = await page.locator('[aria-current="step"] .step-title').first().textContent();
		expect(nextTitle).not.toEqual(initialTitle);
	});

	test("accepts input on a field", async ({ page }) => {
		const field = page.getByLabel("Purpose");
		await field.fill("Playwright input");
		await expect(field).toHaveValue("Playwright input");
	});
});
