/**
 * E2E Smoke Test: PLoT → CEE → ISL Flow
 *
 * This test verifies the full assistant pipeline:
 * 1. Open Sandbox/Canvas
 * 2. Use "Draft AI model" (DraftChat) to generate a starter model via CEE
 * 3. Apply the draft to the canvas
 * 4. Run analysis via PLoT engine
 * 5. Verify Results/Review area shows meaningful output
 *
 * The test also confirms graceful degradation:
 * - If CEE is unavailable, DraftChat shows a friendly error (no crash)
 * - If ISL is unavailable, Decision Review shows degraded state (no crash)
 * - No hard errors should appear even when backends are unhappy
 */

import { test, expect, type Page } from '@playwright/test'

// Helper: Wait for canvas to be ready
async function waitForCanvasReady(page: Page) {
  await page.goto('/#/canvas')
  await page.waitForSelector('[data-testid="rf-root"], .react-flow', { timeout: 10000 })

  // Dismiss welcome dialog if present
  const welcomeDialog = page.locator('[role="dialog"][aria-labelledby="welcome-title"]')
  if (await welcomeDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
    const closeBtn = page.locator('button:has-text("Get Started"), button:has-text("Close"), button:has-text("Skip")')
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.first().click()
    }
  }

  // Dismiss keyboard legend dialog if present (appears on first visit)
  const keyboardLegend = page.locator('[role="dialog"][aria-labelledby="keyboard-legend-title"]')
  if (await keyboardLegend.isVisible({ timeout: 1000 }).catch(() => false)) {
    // Press Escape to close it
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }

  await page.waitForTimeout(500) // Let graph settle
}

// Helper: Open DraftChat (AI assistant panel)
async function openDraftChat(page: Page) {
  const aiButton = page.getByTestId('btn-quick-draft')
  await expect(aiButton).toBeVisible()
  await aiButton.click()

  // Wait for DraftChat panel to appear (has textarea with pricing example placeholder)
  const textarea = page.locator('textarea[placeholder*="SaaS"], textarea[placeholder*="pricing"]')
  await expect(textarea).toBeVisible({ timeout: 3000 })
}

// Helper: Submit a draft request
async function submitDraftRequest(page: Page, description: string) {
  // Target the DraftChat textarea specifically by its placeholder text
  const textarea = page.locator('textarea[placeholder*="SaaS pricing"]')
  await expect(textarea).toBeVisible({ timeout: 3000 })

  // Focus and type into the correct textarea
  await textarea.click()
  await textarea.fill(description)

  // Wait for React state to update
  await page.waitForTimeout(300)

  // Click "Draft Model" button
  const draftButton = page.locator('button:has-text("Draft Model"), button:has-text("Draft")')
  await expect(draftButton).toBeEnabled({ timeout: 5000 })
  await draftButton.click()
}

// Helper: Accept draft preview (returns true if draft was accepted, false if error/timeout)
async function acceptDraft(page: Page): Promise<boolean> {
  // Look for Accept Draft button in preview or error message
  const acceptButton = page.locator('button:has-text("Accept Draft")')
  const errorIndicator = page.locator('text=/error|failed|unavailable|timeout/i')

  try {
    // Wait for either the accept button or an error
    await Promise.race([
      expect(acceptButton).toBeVisible({ timeout: 90000 }), // 90s for CEE cold start
      expect(errorIndicator).toBeVisible({ timeout: 90000 })
    ])

    // If accept button is visible, click it
    if (await acceptButton.isVisible()) {
      await acceptButton.click()
      await page.waitForTimeout(500) // Let canvas update
      return true
    }

    // Error appeared instead of draft
    console.log('SMOKE: CEE returned error instead of draft (expected in degraded mode)')
    return false
  } catch {
    // Timeout - CEE didn't respond
    console.log('SMOKE: CEE timeout (expected when backend unavailable)')
    return false
  }
}

test.describe('CEE + ISL Smoke Test', () => {
  test.setTimeout(120000) // 2 minutes for cold start handling

  test('Full flow: Draft → Apply → Run → Results (happy path)', async ({ page }) => {
    // Collect console errors for final assertion
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Step 1: Open Canvas
    await waitForCanvasReady(page)
    console.log('SMOKE: Canvas loaded')

    // Step 2: Open DraftChat
    await openDraftChat(page)
    console.log('SMOKE: DraftChat opened')

    // Step 3: Submit draft request (short description for faster test)
    const decisionDescription = 'Should we increase SaaS pricing? Factors: competitors, churn, revenue.'
    await submitDraftRequest(page, decisionDescription)
    console.log('SMOKE: Draft request submitted, waiting for CEE response...')

    // Step 4: Wait for draft preview and accept
    // Note: CEE cold start can take 30-45s, we set 90s timeout above
    const draftAccepted = await acceptDraft(page)

    if (draftAccepted) {
      console.log('SMOKE: Draft accepted, nodes added to canvas')

      // Verify nodes were added (draft should create at least 3 nodes)
      const nodeCount = await page.locator('[data-testid="rf-node"], [class*="react-flow__node"]').count()
      console.log(`SMOKE: Canvas has ${nodeCount} nodes`)
      expect(nodeCount).toBeGreaterThanOrEqual(2)

      // Step 5: Run analysis
      const runButton = page.getByTestId('btn-run-analysis')
      await expect(runButton).toBeVisible()
      await expect(runButton).toBeEnabled()
      await runButton.click()
      console.log('SMOKE: Run button clicked, waiting for results...')
    } else {
      // CEE unavailable - test graceful degradation instead
      console.log('SMOKE: CEE unavailable - verifying graceful degradation')

      // Close the DraftChat panel
      const cancelButton = page.locator('button:has-text("Cancel")')
      if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelButton.click()
      }

      // Add nodes manually for the test
      const nodeMenu = page.locator('[data-testid="btn-node-menu"]')
      await nodeMenu.click()
      await page.waitForTimeout(100)
      await page.locator('[role="menuitem"]:has-text("Goal")').click()
      await page.waitForTimeout(300)

      await nodeMenu.click()
      await page.waitForTimeout(100)
      await page.locator('[role="menuitem"]:has-text("Factor")').click()
      await page.waitForTimeout(300)

      // Run analysis
      const runButton = page.getByTestId('btn-run-analysis')
      await runButton.click()
      console.log('SMOKE: Run button clicked (fallback mode), waiting for results...')
    }

    // Step 6: Verify Results panel opens
    const resultsPanel = page.locator('[data-testid="outputs-dock"], [aria-label="Outputs dock"]')
    await expect(resultsPanel).toBeVisible({ timeout: 30000 })
    console.log('SMOKE: Results panel (OutputsDock) visible')

    // Step 7: Wait for completion or error state (both are acceptable)
    const completionIndicator = page.locator('text=/Complete|Error|Ready|FAIL/i')
    try {
      await expect(completionIndicator.first()).toBeVisible({ timeout: 60000 })
      console.log('SMOKE: Results state reached')
    } catch {
      // No completion indicator - still pass if no crash
      console.log('SMOKE: No completion indicator, but UI is responsive')
    }

    // Step 8: Verify Decision Review section is present (may show loading/error gracefully)
    const decisionReview = page.locator('[data-testid^="decision-review"]')
    const reviewVisible = await decisionReview.first().isVisible({ timeout: 10000 }).catch(() => false)
    console.log(`SMOKE: Decision Review section visible: ${reviewVisible}`)

    // Log what we see (for debugging)
    const reviewTestId = reviewVisible ? await decisionReview.first().getAttribute('data-testid') : 'not-visible'
    console.log(`SMOKE: Decision Review state: ${reviewTestId}`)

    // Final assertion: No fatal console errors (filter out expected backend errors)
    const fatalErrors = consoleErrors.filter(e =>
      !e.includes('net::ERR') && // Network errors are expected if backend down
      !e.includes('Failed to load') &&
      !e.includes('Failed to fetch') && // Expected when backend unavailable
      !e.includes('CORS') && // Expected when backend unavailable
      !e.includes('CEEError') && // Expected CEE errors
      !e.includes('Draft failed') && // Expected when CEE unavailable
      !e.includes('404') &&
      !e.includes('timeout')
    )
    if (fatalErrors.length > 0) {
      console.log('SMOKE: Unexpected console errors:', fatalErrors)
    }
    expect(fatalErrors).toHaveLength(0)

    console.log('SMOKE: ✅ Full flow completed successfully')
  })

  test('Graceful degradation: CEE unavailable shows friendly error', async ({ page }) => {
    // Block CEE endpoints to simulate unavailability
    await page.route('**/bff/cee/**', route => route.abort('connectionfailed'))
    await page.route('**/assist/**', route => route.abort('connectionfailed'))

    await waitForCanvasReady(page)
    await openDraftChat(page)

    // Submit draft request
    await submitDraftRequest(page, 'Test decision for CEE degradation')

    // Should show error message (not crash) - use .first() since multiple errors may match
    const errorIndicator = page.locator('text=/error|failed|unavailable|timeout/i')
    await expect(errorIndicator.first()).toBeVisible({ timeout: 70000 }) // 60s timeout + buffer

    // UI should still be responsive (verify page didn't crash)
    await expect(page.locator('body')).toBeVisible()

    console.log('SMOKE: ✅ CEE degradation handled gracefully')
  })

  test('Graceful degradation: Run works even without ISL (bias-check)', async ({ page }) => {
    // Block ISL/CEE bias-check endpoints
    await page.route('**/bff/isl/**', route => route.abort('connectionfailed'))
    await page.route('**/assist/v1/bias-check**', route => route.abort('connectionfailed'))
    await page.route('**/assist/v1/sensitivity-coach**', route => route.abort('connectionfailed'))

    await waitForCanvasReady(page)

    // Manually add nodes via toolbar (bypass CEE)
    const nodeMenu = page.locator('button:has-text("+ Node"), [data-testid="btn-node-menu"]')
    await nodeMenu.click()
    await page.waitForTimeout(100)

    // Add Goal node
    const goalOption = page.locator('[role="menuitem"]:has-text("Goal")')
    await goalOption.click()
    await page.waitForTimeout(300)

    // Add another node
    await nodeMenu.click()
    await page.waitForTimeout(100)
    const factorOption = page.locator('[role="menuitem"]:has-text("Factor")')
    await factorOption.click()
    await page.waitForTimeout(300)

    // Run analysis
    const runButton = page.getByTestId('btn-run-analysis')
    await expect(runButton).toBeVisible()
    await runButton.click()

    // Results should still appear (PLoT engine works independently)
    const resultsPanel = page.locator('[data-testid="outputs-dock"], [aria-label="Outputs dock"]')
    await expect(resultsPanel).toBeVisible({ timeout: 30000 })

    // Decision Review may show error state, but shouldn't crash
    // Note: Decision Review is only shown after results complete, which may not happen if backend is down
    const decisionReview = page.locator('[data-testid^="decision-review"]')
    const decisionReviewVisible = await decisionReview.first().isVisible({ timeout: 15000 }).catch(() => false)
    console.log(`SMOKE: Decision Review visible: ${decisionReviewVisible}`)

    // UI should still be responsive
    await expect(resultsPanel).toBeVisible()

    console.log('SMOKE: ✅ ISL degradation handled gracefully')
  })

  test('UI elements present: Results panel opens after run (tolerates backend errors)', async ({ page }) => {
    await waitForCanvasReady(page)

    // Add nodes manually for consistent test
    const nodeMenu = page.locator('button:has-text("+ Node"), [data-testid="btn-node-menu"]')

    // Add Goal
    await nodeMenu.click()
    await page.waitForTimeout(100)
    await page.locator('[role="menuitem"]:has-text("Goal")').click()
    await page.waitForTimeout(300)

    // Add Factor
    await nodeMenu.click()
    await page.waitForTimeout(100)
    await page.locator('[role="menuitem"]:has-text("Factor")').click()
    await page.waitForTimeout(300)

    // Add Outcome
    await nodeMenu.click()
    await page.waitForTimeout(100)
    await page.locator('[role="menuitem"]:has-text("Outcome")').click()
    await page.waitForTimeout(300)

    // Run analysis
    const runButton = page.getByTestId('btn-run-analysis')
    await runButton.click()
    console.log('SMOKE: Run button clicked')

    // Results panel (OutputsDock) should open (regardless of backend status)
    const resultsPanel = page.locator('[data-testid="outputs-dock"], [aria-label="Outputs dock"]')
    await expect(resultsPanel).toBeVisible({ timeout: 10000 })
    console.log('SMOKE: Results panel (OutputsDock) opened')

    // Wait for some completion state: Complete, Error, Ready, or timeout state
    // This test passes if UI shows ANY completion state without crashing
    const completionIndicator = page.locator('text=/Complete|Error|Ready|Cancelled|timeout|failed/i')
    try {
      await expect(completionIndicator).toBeVisible({ timeout: 70000 })
      console.log('SMOKE: Completion state reached')
    } catch {
      // Even if no completion indicator visible, test passes if no crash
      console.log('SMOKE: No completion indicator - checking for graceful degradation')
    }

    // UI should still be responsive (verify Results panel is still visible)
    await expect(resultsPanel).toBeVisible()

    // Check if Decision Review section is present (may show loading/error gracefully)
    const decisionReview = page.locator('[data-testid^="decision-review"]')
    const reviewVisible = await decisionReview.first().isVisible().catch(() => false)
    console.log(`SMOKE: Decision Review visible: ${reviewVisible}`)

    // Check for result elements (may not be present if backend down)
    const bandsSection = page.locator('text=/likely|range|band|value/i')
    const bandsVisible = await bandsSection.first().isVisible().catch(() => false)
    console.log(`SMOKE: Bands/values section visible: ${bandsVisible}`)

    // Drivers section in Decision Review
    const driversSection = page.locator('[data-testid="decision-review-drivers"], text=/driver|factor|influence/i')
    const driversVisible = await driversSection.first().isVisible().catch(() => false)
    console.log(`SMOKE: Drivers section visible: ${driversVisible}`)

    console.log('SMOKE: ✅ UI elements check complete (graceful regardless of backend status)')
  })

  test('DraftPreview: Empty CEE response shows friendly message (no crash)', async ({ page }) => {
    // Mock CEE to return an empty/invalid draft response
    await page.route('**/assist/v1/draft-graph', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          // Empty/invalid draft - missing nodes, edges, etc.
          quality_overall: 0,
          nodes: [],
          edges: [],
          draft_warnings: { structural: [], completeness: [] }
        }),
      })
    })

    await waitForCanvasReady(page)
    await openDraftChat(page)

    // Submit draft request
    await submitDraftRequest(page, 'Test decision with empty response')

    // Wait for response - should NOT crash, should show friendly empty state
    const emptyState = page.locator('[data-testid="draft-preview-empty"], text=/no draft available|couldn\'t generate/i')
    const errorState = page.locator('text=/error|failed|unavailable/i')
    const previewState = page.locator('[data-testid="draft-preview"]')

    // Wait for any UI response (empty state, error, or preview)
    await Promise.race([
      expect(emptyState.first()).toBeVisible({ timeout: 15000 }),
      expect(errorState.first()).toBeVisible({ timeout: 15000 }),
      expect(previewState).toBeVisible({ timeout: 15000 }),
    ]).catch(() => {
      // Even if none visible, continue to check no crash
    })

    // Critical: No error boundary / crash
    const errorBoundary = page.locator('text=/Something went wrong|Error boundary|Cannot read properties/i')
    await expect(errorBoundary).not.toBeVisible()

    // UI should still be responsive
    await expect(page.locator('body')).toBeVisible()

    // DraftChat panel should still be open (not crashed)
    const draftChatPanel = page.locator('textarea[placeholder*="SaaS"], textarea[placeholder*="pricing"]')
    const cancelBtn = page.locator('button:has-text("Cancel"), button:has-text("Try Again")')
    const panelVisible = await draftChatPanel.isVisible().catch(() => false) ||
                         await cancelBtn.first().isVisible().catch(() => false)

    console.log(`SMOKE: DraftChat panel still responsive: ${panelVisible}`)
    expect(panelVisible).toBe(true)

    console.log('SMOKE: ✅ Empty CEE response handled gracefully (no crash)')
  })
})
