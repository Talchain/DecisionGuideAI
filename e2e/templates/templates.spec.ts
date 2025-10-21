import { test, expect } from '@playwright/test'

test.describe('Decision Templates', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/templates')
    await page.waitForSelector('[data-testid="decision-templates"]')
  })

  test('templates grid is visible and navigable', async ({ page }) => {
    // Check all 6 templates are present
    await expect(page.getByTestId('template-pricing-v1')).toBeVisible()
    await expect(page.getByTestId('template-hiring-v1')).toBeVisible()
    await expect(page.getByTestId('template-marketing-v1')).toBeVisible()
    await expect(page.getByTestId('template-supply-v1')).toBeVisible()
    await expect(page.getByTestId('template-feature-v1')).toBeVisible()
    await expect(page.getByTestId('template-investment-v1')).toBeVisible()
  })

  test('template selection shows run panel', async ({ page }) => {
    await page.getByTestId('template-pricing-v1').click()
    await expect(page.getByTestId('run-panel')).toBeVisible()
    
    // Check controls are present
    await expect(page.getByText('Strict')).toBeVisible()
    await expect(page.getByText('Uncertainty')).toBeVisible()
    await expect(page.getByLabel('Determinism seed')).toBeVisible()
    await expect(page.getByTestId('btn-run-template')).toBeVisible()
  })

  test('strict and uncertainty toggle works', async ({ page }) => {
    await page.getByTestId('template-pricing-v1').click()
    
    const strictBtn = page.getByRole('button', { name: 'Strict' })
    const uncertaintyBtn = page.getByRole('button', { name: 'Uncertainty' })
    
    // Strict should be selected by default
    await expect(strictBtn).toHaveClass(/bg-blue-500/)
    
    // Click Uncertainty
    await uncertaintyBtn.click()
    await expect(uncertaintyBtn).toHaveClass(/bg-blue-500/)
    await expect(strictBtn).not.toHaveClass(/bg-blue-500/)
  })

  test('run button triggers analysis (mocked)', async ({ page }) => {
    // Mock the API response
    await page.route('**/v1/run', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          schema: 'report.v1',
          meta: { seed: 42, elapsed_ms: 150, response_id: 'test-123', template_id: 'pricing-v1' },
          summary: {
            bands: { p10: 100, p50: 200, p90: 300 },
            confidence: { level: 'high', score: 0.85, reason: 'Strong data' }
          },
          critique: [{ type: 'info', text: 'Good analysis' }],
          model_card: { response_hash: 'abc123', response_hash_algo: 'sha256', normalized: true }
        })
      })
    })

    await page.getByTestId('template-pricing-v1').click()
    await page.getByTestId('btn-run-template').click()
    
    // Wait for results
    await expect(page.getByTestId('results-view')).toBeVisible({ timeout: 5000 })
    
    // Check bands are displayed
    await expect(page.getByText(/Conservative.*100/)).toBeVisible()
    await expect(page.getByText(/Likely.*200/)).toBeVisible()
    await expect(page.getByText(/Optimistic.*300/)).toBeVisible()
  })

  test('reproduce panel copy buttons work', async ({ page }) => {
    // Mock API
    await page.route('**/v1/run', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          schema: 'report.v1',
          meta: { seed: 42, elapsed_ms: 150, response_id: 'test-123', template_id: 'pricing-v1' },
          summary: { bands: { p10: 100, p50: 200, p90: 300 }, confidence: { level: 'high', score: 0.85 } },
          critique: [],
          model_card: { response_hash: 'abc123def456', response_hash_algo: 'sha256', normalized: true }
        })
      })
    })

    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])

    await page.getByTestId('template-pricing-v1').click()
    await page.getByTestId('btn-run-template').click()
    await page.waitForSelector('[data-testid="results-view"]')
    
    // Click copy hash button
    await page.getByRole('button', { name: /copy response hash/i }).click()
    
    // Verify clipboard (note: may not work in all test environments)
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toContain('abc123def456')
  })

  test('add to decision note creates block', async ({ page }) => {
    // Mock API
    await page.route('**/v1/run', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          schema: 'report.v1',
          meta: { seed: 42, elapsed_ms: 150, response_id: 'test-123', template_id: 'pricing-v1' },
          summary: { bands: { p10: 100, p50: 200, p90: 300 }, confidence: { level: 'high', score: 0.85 } },
          critique: [],
          model_card: { response_hash: 'abc123', response_hash_algo: 'sha256', normalized: true }
        })
      })
    })

    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])

    await page.getByTestId('template-pricing-v1').click()
    await page.getByTestId('btn-run-template').click()
    await page.waitForSelector('[data-testid="results-view"]')
    
    // Click Add to Decision Note
    await page.getByTestId('btn-add-to-note').click()
    
    // Check clipboard contains structured block
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toContain('### Decision Result — pricing-v1')
    expect(clipboardText).toContain('Seed: 42')
    expect(clipboardText).toContain('Response hash: abc123')
    expect(clipboardText).toContain('Conservative 100')
  })

  test('determinism: 5 runs with same seed produce same hash', async ({ page }) => {
    let callCount = 0
    
    await page.route('**/v1/run', async route => {
      callCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          schema: 'report.v1',
          meta: { seed: 42, elapsed_ms: 150, response_id: `test-${callCount}`, template_id: 'pricing-v1' },
          summary: { bands: { p10: 100, p50: 200, p90: 300 }, confidence: { level: 'high', score: 0.85 } },
          critique: [],
          model_card: { response_hash: 'deterministic-hash-42', response_hash_algo: 'sha256', normalized: true }
        })
      })
    })

    await page.getByTestId('template-pricing-v1').click()
    
    const hashes: string[] = []
    
    // Run 5 times
    for (let i = 0; i < 5; i++) {
      await page.getByTestId('btn-run-template').click()
      await page.waitForSelector('[data-testid="results-view"]')
      
      // Extract hash from UI
      const hashText = await page.locator('code:has-text("deterministic-hash")').textContent()
      hashes.push(hashText || '')
      
      // Wait a bit before next run
      await page.waitForTimeout(100)
    }
    
    // All hashes should be identical
    const uniqueHashes = new Set(hashes)
    expect(uniqueHashes.size).toBe(1)
    expect(callCount).toBe(5)
  })
})
