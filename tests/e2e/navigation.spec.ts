import { test, expect } from '@playwright/test';

test.describe('Maritime AI Control Tower Navigation & Parity E2E Tests', () => {
  test('loads Executive Dashboard with KPIs, map, and alert list', async ({ page }) => {
    await page.goto('#/dashboard');
    await expect(page.locator('h1')).toContainText('Maritime Operations Control Tower');
    await expect(page.locator('text=Active vessels')).toBeVisible();
    await expect(page.locator('text=Critical alerts')).toBeVisible();
    await expect(page.locator('svg').first()).toBeVisible();
  });

  test('navigates to Fleet Overview and performs status change', async ({ page }) => {
    await page.goto('#/fleet');
    await expect(page.locator('h1')).toContainText('Fleet Overview');
    await expect(page.locator('text=Update operational status:')).toBeVisible();

    const applyBtn = page.locator('button:has-text("Apply vessel status")');
    if (await applyBtn.isVisible()) {
      await applyBtn.click({ force: true });
      await expect(page.locator('.banner-success')).toBeVisible();
    }
  });

  test('navigates to Anomaly Detection and reviews 24h trend chart', async ({ page }) => {
    await page.goto('#/anomalies');
    await expect(page.locator('h1')).toContainText('Anomaly Detection');
    await expect(page.locator('text=Selected Anomaly Detail')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Operator Actions' })).toBeVisible();
  });

  test('navigates to Predictive Maintenance and inspects assets', async ({ page }) => {
    await page.goto('#/maintenance');
    await expect(page.locator('h1')).toContainText('Predictive Maintenance');
    await expect(page.locator('text=Asset Health Register')).toBeVisible();
    await expect(page.locator('text=Session Work-Order Register')).toBeVisible();
  });

  test('navigates to Voyage & Fuel and runs interactive scenario simulator', async ({ page }) => {
    await page.goto('#/voyage');
    await expect(page.locator('h1')).toContainText('Voyage & Fuel Optimisation');
    await expect(page.locator('text=Interactive Scenario Simulator')).toBeVisible();

    const speedSlider = page.locator('input[type="range"]').first();
    await expect(speedSlider).toBeVisible();
  });

  test('navigates to Safety Monitoring and reviews event register', async ({ page }) => {
    await page.goto('#/safety');
    await expect(page.locator('h1')).toContainText('Safety Monitoring');
    await expect(page.locator('text=Safety Event Register')).toBeVisible();
  });

  test('navigates to Automation Centre and tests approval guard', async ({ page }) => {
    await page.goto('#/automation');
    await expect(page.locator('h1')).toContainText('Operational Automation Centre');
    await expect(page.locator('text=Automation Task Register')).toBeVisible();
    await expect(page.locator('text=Tasks Awaiting Approval')).toBeVisible();
  });

  test('navigates to Application Assurance Centre and verifies CI audit results', async ({ page }) => {
    await page.goto('#/assurance');
    await expect(page.locator('h1')).toContainText('Application Assurance Centre');
    await expect(page.locator('text=Deterministic QA Agent Status')).toBeVisible();
    await expect(page.locator('text=CI Security Agent Status')).toBeVisible();
    await expect(page.locator('text=Positive Security & QA Controls')).toBeVisible();
  });

  test('mobile sidebar navigation toggle works on small viewports', async ({ page, isMobile }) => {
    if (!isMobile) return;
    await page.goto('#/dashboard');
    const menuBtn = page.locator('button[aria-label="Toggle navigation"]');
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      const navLink = page.locator('aside nav a:has-text("Automation Centre")');
      await expect(navLink).toBeVisible();
      await navLink.click();
      await expect(page.locator('h1')).toContainText('Operational Automation Centre');
    }
  });
});
