import { test, expect } from '@playwright/test';

test.describe('Maritime AI Control Tower Navigation & Parity E2E Tests', () => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    failedRequests.length = 0;

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore favicon or benign browser noise, catch real runtime JS exceptions
        if (!text.includes('favicon.ico')) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('requestfailed', (req) => {
      const url = req.url();
      if (
        (url.includes('localhost') || url.includes('/maritime-operations-ai/')) &&
        !url.endsWith('favicon.ico')
      ) {
        failedRequests.push(`${req.method()} ${url} - ${req.failure()?.errorText}`);
      }
    });
  });

  test.afterEach(async () => {
    expect(
      consoleErrors,
      `Unexpected browser console errors detected:\n${consoleErrors.join('\n')}`
    ).toEqual([]);
    expect(
      failedRequests,
      `Failed local asset/data requests detected:\n${failedRequests.join('\n')}`
    ).toEqual([]);
  });

  test('loads Executive Dashboard with KPIs, map, and alert list', async ({ page }) => {
    await page.goto('#/dashboard');
    await expect(page.locator('h1')).toContainText('Maritime Operations Control Tower');
    await expect(page.locator('text=Active vessels')).toBeVisible();
    await expect(page.locator('text=Critical alerts')).toBeVisible();
    await expect(page.locator('svg').first()).toBeVisible();
  });

  test('navigates to Fleet Overview, updates status, persists in localStorage, and tests Reset Demo', async ({
    page,
  }) => {
    await page.goto('#/fleet');
    await expect(page.locator('h1')).toContainText('Fleet Overview');
    await expect(page.locator('text=Update operational status:')).toBeVisible();

    // Select status via the adjacent sibling of the status label
    const statusSelect = page.locator('label:has-text("Update operational status:") + select');
    await statusSelect.scrollIntoViewIfNeeded();
    await statusSelect.selectOption('Under Maintenance');

    const applyBtn = page.locator('button:has-text("Apply vessel status")');
    await applyBtn.scrollIntoViewIfNeeded();
    await applyBtn.click({ force: true });
    await expect(page.locator('.banner-success')).toBeVisible();

    // Verify localStorage persistence by reloading the page
    await page.reload();
    await expect(page.locator('table')).toContainText('Under Maintenance');

    // Test Reset Demo restores pristine state
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    const resetBtn = page.locator('header button:has-text("Reset Demo")').first();
    await resetBtn.click({ force: true, noWaitAfter: true });
    await page.waitForTimeout(600);
    await page.reload();

    // Verify restored state after page reload triggered by reset (MV Horizon Star original status: Underway)
    await expect(page.locator('h1')).toContainText('Fleet Overview');
    await expect(page.locator('table')).toContainText('Underway');
  });

  test('navigates to Anomaly Detection and exercises operator action workflow', async ({ page }) => {
    await page.goto('#/anomalies');
    await expect(page.locator('h1')).toContainText('Anomaly Detection');
    await expect(page.locator('text=Selected Anomaly Detail')).toBeVisible();

    // Select an anomaly row
    const anomalyRow = page.locator('table tr').filter({ has: page.locator('td', { hasText: /^ANOM-001$/ }) }).first();
    if (await anomalyRow.isVisible()) {
      await anomalyRow.click({ force: true });
    }

    // Enter comment and acknowledge
    const commentInput = page.locator('input[placeholder*="Optional action comment"]');
    await commentInput.fill('Operator acknowledged deviation during E2E verification');

    const ackBtn = page.locator('button:has-text("Acknowledge")');
    await ackBtn.scrollIntoViewIfNeeded();
    await ackBtn.click({ force: true });

    // Verify state update and flash message
    await expect(page.locator('.banner-success')).toBeVisible();
    await expect(page.locator('.banner-success')).toContainText('Acknowledge completed');

    // Verify Action History has recorded the action
    await expect(page.locator('h3:has-text("Action History")')).toBeVisible();
    await expect(page.locator('table:has-text("Action")')).toContainText('Acknowledge');
  });

  test('navigates to Predictive Maintenance and exercises simulated work order creation', async ({
    page,
  }) => {
    await page.goto('#/maintenance');
    await expect(page.locator('h1')).toContainText('Predictive Maintenance');
    await expect(page.locator('text=Asset Health Register')).toBeVisible();

    // Select asset row
    const assetRow = page.locator('table tr:has-text("Main Engine 01")').first();
    if (await assetRow.isVisible()) {
      await assetRow.click({ force: true });
    }

    // Fill work order comment
    const commentInput = page.locator('input[placeholder*="Optional action comment"]');
    await commentInput.fill('Automated simulated work order creation');

    // Click Create Work Order
    const createWoBtn = page.locator('button:has-text("Create Work Order")');
    await createWoBtn.scrollIntoViewIfNeeded();
    await createWoBtn.click({ force: true });

    // Verify flash message
    await expect(page.locator('.banner-success')).toBeVisible();
    await expect(page.locator('.banner-success')).toContainText('Create work order completed');

    // Verify the work order is registered in Session Work-Order Register
    await expect(page.locator('h3:has-text("Session Work-Order Register")')).toBeVisible();
    await expect(
      page.locator('table:has-text("WO Reference") tr:has-text("WO-")').first()
    ).toBeVisible();
  });

  test('navigates to Voyage & Fuel, adjusts interactive simulator, and verifies calculated output changes', async ({
    page,
  }) => {
    await page.goto('#/voyage');
    await expect(page.locator('h1')).toContainText('Voyage & Fuel Optimisation');
    await expect(page.locator('text=Interactive Scenario Simulator')).toBeVisible();

    // Locate the User Adjusted row in the Scenario Comparison Table
    const userRow = page.locator('tr:has-text("User adjusted")');
    await expect(userRow).toBeVisible();
    const initialFuel = await userRow.locator('td').nth(2).innerText();

    // Adjust the speed slider to a new value
    const speedSlider = page.locator('input[type="range"]').first();
    await speedSlider.evaluate((el: HTMLInputElement) => {
      el.value = '19.0';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Verify calculated output actually changes in real time
    await expect(userRow.locator('td').nth(2)).not.toHaveText(initialFuel);
  });

  test('navigates to Safety Monitoring and executes corrective action workflow', async ({ page }) => {
    await page.goto('#/safety');
    await expect(page.locator('h1')).toContainText('Safety Monitoring');
    await expect(page.locator('text=Safety Event Register')).toBeVisible();

    // Select a safety event
    const eventRow = page.locator('table tr').filter({ has: page.locator('td', { hasText: /^SAF-001$/ }) }).first();
    if (await eventRow.isVisible()) {
      await eventRow.click({ force: true });
    }

    // Trigger Corrective Action
    const correctiveBtn = page.locator('button:has-text("Corrective Action")');
    await correctiveBtn.scrollIntoViewIfNeeded();
    await correctiveBtn.click({ force: true });

    // Verify state update
    await expect(page.locator('.banner-success')).toBeVisible();
    await expect(page.locator('.banner-success')).toContainText('completed');
  });

  test('navigates to Operational Automation Centre and verifies high-risk task approval guard', async ({
    page,
  }) => {
    await page.goto('#/automation');
    await expect(page.locator('h1')).toContainText('Operational Automation Centre');
    await expect(page.locator('text=Automation Task Register')).toBeVisible();

    // Select high-risk task AUT-0003 via its specific cell
    const taskCell = page.locator('td:text-is("AUT-0003")').first();
    await taskCell.scrollIntoViewIfNeeded();
    await taskCell.click({ force: true });
    await expect(page.locator('h3:has-text("Task Detail: AUT-0003")')).toBeVisible();

    // 1. Attempt Execute before approval -> Verify execution is blocked
    const executeBtn = page.locator('button:has-text("Execute")');
    await executeBtn.scrollIntoViewIfNeeded();
    await executeBtn.click({ force: true });

    // 2. Verify error message appears specifically
    const actionBlockedError = page.locator('.banner-error').filter({ hasText: 'Action blocked' });
    await expect(actionBlockedError).toBeVisible();
    await expect(actionBlockedError).toContainText('Action blocked');

    // 3. Approve task
    const approveBtn = page.locator('button:has-text("Approve")');
    await approveBtn.scrollIntoViewIfNeeded();
    await approveBtn.click({ force: true });
    await expect(page.locator('.banner-success')).toContainText('Approve completed');

    // 4. Execute again -> Verify execution success
    await executeBtn.scrollIntoViewIfNeeded();
    await executeBtn.click({ force: true });
    await expect(page.locator('.banner-success')).toContainText(
      'Execute simulated action completed'
    );
  });

  test('navigates to Application Assurance Centre and verifies WARNING state and findings', async ({
    page,
  }) => {
    await page.goto('#/assurance');
    await expect(page.locator('h1')).toContainText('Application Assurance Centre');

    // Assert that status is WARNING (not falsely displayed as PASSED)
    await expect(page.locator('text=● WARNING')).toBeVisible();
    await expect(page.locator('text=ADVISORY').first()).toBeVisible();

    // Verify findings register shows software supply chain dependencies
    await expect(page.locator('h3:has-text("Findings Register")')).toBeVisible();
    await expect(page.locator('table tr:has-text("Software Supply Chain")').first()).toBeVisible();

    // Expand finding and verify percentage confidence representation (e.g. 95%, not 0.95%)
    const detailBtn = page.locator('table button').first();
    await detailBtn.scrollIntoViewIfNeeded();
    await detailBtn.click({ force: true });
    await expect(page.locator('text=Confidence:')).toBeVisible();
    await expect(page.locator('text=Confidence: 95%').first()).toBeVisible();
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
