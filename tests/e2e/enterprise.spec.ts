import { test, expect } from '@playwright/test';

test.describe('AI Corporate Hierarchy & Enterprise Control Tower E2E Workflows', () => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    failedRequests.length = 0;

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
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

  test('Workflow A: Executive drill-down (Command Centre -> Dept -> Agent -> Task)', async ({ page }) => {
    await page.goto('#/command-centre');
    await expect(page.locator('[data-testid="executive-command-centre"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Executive Command Centre');

    // Verify key executive KPI cards
    await expect(page.locator('[data-testid="kpi-workforce"]')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-active-tasks"]')).toBeVisible();

    // Navigate to Organization Chart
    await page.goto('#/organization');
    await expect(page.locator('[data-testid="organization-page"]')).toBeVisible();

    // Click CEO node to view executive profile drawer
    await page.locator('[data-testid="org-node-ceo"]').click();
    await expect(page.locator('[data-testid="org-entity-drawer"]')).toBeVisible();
    await expect(page.locator('text=Capt. Alexander Vance').first()).toBeVisible();

    // Navigate to Workforce Directory
    await page.goto('#/workforce');
    await expect(page.locator('[data-testid="workforce-page"]')).toBeVisible();

    // Open Profile drawer for Predictive Maintenance Agent
    await page.locator('[data-testid="btn-profile-agt-tec-001"]').click();
    await expect(page.locator('[data-testid="agent-profile-drawer"]')).toBeVisible();
    await expect(page.locator('text=Predictive Maintenance Agent').first()).toBeVisible();

    // Navigate to Task Operations
    await page.goto('#/tasks');
    await expect(page.locator('[data-testid="task-operations-page"]')).toBeVisible();
    await expect(page.locator('text=TSK-MNT-301').first()).toBeVisible();
  });

  test('Workflow B: High-risk approval workflow (approve high-risk task)', async ({ page }) => {
    await page.goto('#/approvals');
    await expect(page.locator('[data-testid="approval-inbox-page"]')).toBeVisible();

    // Locate the pending approval for MV Horizon Star
    const approveBtn = page.locator('[data-testid="btn-approve-app-2026-001"]');
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // Confirm high-risk confirmation modal
    await expect(page.locator('[data-testid="approval-confirm-modal"]')).toBeVisible();
    await page.locator('[data-testid="confirm-decision-btn"]').click();

    // Verify it moved from Pending to Resolved
    await page.locator('[data-testid="tab-resolved"]').click();
    await expect(page.locator('text=APPROVED').first()).toBeVisible();

    // Verify event stream recorded the decision
    await page.goto('#/activity');
    await expect(page.locator('text=APPROVAL_GRANTED').first()).toBeVisible();

    // Verify audit trail recorded immutable entry
    await page.goto('#/governance');
    await page.locator('[data-testid="tab-audit-trail"]').click();
    await expect(page.locator('text=APPROVE_HIGH_RISK').first()).toBeVisible();
  });

  test('Workflow C: Reject workflow (reject approval -> task blocked/rejected)', async ({ page }) => {
    await page.goto('#/approvals');
    await expect(page.locator('[data-testid="approval-inbox-page"]')).toBeVisible();

    const rejectBtn = page.locator('[data-testid="btn-reject-app-2026-003"]');
    await expect(rejectBtn).toBeVisible();
    await rejectBtn.click();

    // Confirm rejection modal
    await expect(page.locator('[data-testid="approval-confirm-modal"]')).toBeVisible();
    await page.locator('[data-testid="confirm-decision-btn"]').click();

    // Verify in resolved tab
    await page.locator('[data-testid="tab-resolved"]').click();
    await expect(page.locator('text=REJECTED').first()).toBeVisible();

    // Verify task operations shows BLOCKED status badge
    await page.goto('#/tasks');
    await expect(page.locator('[data-status="BLOCKED"]').first()).toBeVisible();
  });

  test('Workflow D: Agent pause (pause agent -> PAUSED -> dashboard count update)', async ({ page }) => {
    await page.goto('#/workforce');
    await expect(page.locator('[data-testid="workforce-page"]')).toBeVisible();

    // Open Fleet Monitoring Agent profile drawer
    await page.locator('[data-testid="btn-profile-agt-flt-001"]').click();
    await expect(page.locator('[data-testid="agent-profile-drawer"]')).toBeVisible();

    // Click Pause Agent button
    await page.locator('[data-testid="drawer-pause-btn"]').click();

    // Confirm agent status shows PAUSED badge
    await expect(page.locator('[data-status="PAUSED"]').first()).toBeVisible();

    // Verify Executive Command Centre now displays the paused agent in Needs Attention
    await page.goto('#/command-centre');
    await expect(page.locator('text=Agent Paused by Management').first()).toBeVisible();
  });

  test('Workflow E: Request independent verification on task', async ({ page }) => {
    await page.goto('#/tasks');
    await expect(page.locator('[data-testid="task-operations-page"]')).toBeVisible();

    // Click on task inspect button
    await page.locator('[data-testid="btn-inspect-tsk-mnt-301"]').click();
    await expect(page.locator('text=SUPERVISORY TASK ACTIONS')).toBeVisible();

    // Click Request Verification button
    const verifyBtn = page.locator('[data-testid="task-request-verification-btn"]');
    await expect(verifyBtn).toBeVisible();
    await verifyBtn.click();

    // Verify status updated to VERIFYING badge
    await expect(page.locator('[data-status="VERIFYING"]').first()).toBeVisible();
  });

  test('Workflow F: Capability degradation (toggle capability -> DEGRADED mode)', async ({ page }) => {
    await page.goto('#/governance');
    await expect(page.locator('[data-testid="governance-page"]')).toBeVisible();

    // Toggle Fleet Master capability
    const toggleBtn = page.locator('[data-testid="btn-toggle-cap-fleet_master"]');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click(); // Cycles from AVAILABLE to DEGRADED

    // Verify mode reflects in Workforce Directory
    await page.goto('#/workforce');
    await expect(
      page.locator('[data-status="DEGRADED"]').or(page.locator('[data-status="LIMITED"]')).first()
    ).toBeVisible();
  });

  test('Workflow G: Reset Demo restores original pristine enterprise state', async ({ page }) => {
    // Pause an agent
    await page.goto('#/workforce');
    await page.locator('[data-testid="btn-profile-agt-flt-001"]').click();
    await page.locator('[data-testid="drawer-pause-btn"]').click();
    await expect(page.locator('[data-status="PAUSED"]').first()).toBeVisible();

    // Close profile drawer first so it does not intercept topbar clicks
    await page.locator('[aria-label="Close profile drawer"]').click();

    // Click topbar Reset Demo button
    await page.locator('[data-testid="topbar-reset-demo-btn"]').click();

    // Verify agent is no longer PAUSED, restored to ACTIVE
    await page.goto('#/workforce');
    await page.locator('[data-testid="btn-profile-agt-flt-001"]').click();
    await expect(page.locator('[data-status="ACTIVE"]').first()).toBeVisible();
  });
});
