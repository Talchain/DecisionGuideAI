/**
 * PLoT V1 Streaming E2E Tests
 *
 * Tests streaming functionality with SSE events:
 * - Happy path (started → progress → complete)
 * - ESC key cancellation
 * - Route change cancellation
 * - 429 rate limit handling
 * - Network error recovery
 *
 * Requires: VITE_FEATURE_PLOT_STREAM=1
 */

import { test, expect, Page } from '@playwright/test'
import { installFakeEventSource } from './_helpers'

async function gotoPlot(page: Page) {
  // Install streaming shim before navigation
  await installFakeEventSource(page)

  // Enable streaming feature flag
  await page.addInitScript(() => {
    try { localStorage.setItem('feature.plotStream', '1') } catch {}
    ;(window as any).__E2E = 1
  })

  await page.goto('/?e2e=1#/plot', { waitUntil: 'domcontentloaded' })

  // Wait for PLC canvas to mount
  await expect(page.locator('[data-testid="plc-canvas-adapter"]')).toBeVisible({ timeout: 10000 })
}

async function triggerRun(page: Page) {
  // Click Run Analysis button (or equivalent trigger)
  // Note: Adjust selector based on actual implementation
  const runBtn = page.getByTestId('run-analysis-btn').or(page.getByRole('button', { name: /run|analyze/i }))
  await runBtn.click()
}

test.describe('PLoT V1 Streaming', { tag: '@streaming' }, () => {
  test.beforeEach(async ({ page }) => {
    await gotoPlot(page)
  })

  test('happy path: started → progress → complete', async ({ page }) => {
    // Mock successful streaming response
    await page.evaluate(() => {
      const FakeES = (window as any).FakeEventSource
      if (!FakeES) throw new Error('FakeEventSource not installed')

      // Intercept SSE connection
      const orig = FakeES
      const instances: any[] = []
      ;(window as any).EventSource = class extends orig {
        constructor(url: string) {
          super(url)
          instances.push(this)

          // Emit streaming events
          setTimeout(() => {
            // Started event
            this.emit('started', { run_id: 'test-run-123' })
          }, 100)

          setTimeout(() => {
            // Progress event
            this.emit('progress', { percent: 50 })
          }, 200)

          setTimeout(() => {
            // Complete event with report
            this.emit('complete', {
              result: {
                schema: 'report.v1',
                results: {
                  summary: {
                    conservative: 100,
                    likely: 150,
                    optimistic: 200,
                    units: 'units'
                  }
                },
                model_card: {
                  response_hash: 'test-hash-123',
                  seed: 42,
                  confidence: 0.85,
                  template_version: '1.0.0'
                },
                explanation: 'Test explanation'
              },
              execution_ms: 500
            })
          }, 300)
        }
      }
      ;(window as any).__streamInstances = instances
    })

    // Trigger run
    await triggerRun(page)

    // Wait for progress indicator
    const progressIndicator = page.locator('[data-testid="streaming-progress"]').or(
      page.locator('[role="progressbar"]')
    )
    await expect(progressIndicator).toBeVisible({ timeout: 5000 })

    // Wait for completion (report should appear)
    const reportDrawer = page.locator('[data-testid="report-drawer"]').or(
      page.locator('[role="region"]').filter({ hasText: /report|results/i })
    )
    await expect(reportDrawer).toBeVisible({ timeout: 5000 })

    // Verify progress indicator is hidden
    await expect(progressIndicator).not.toBeVisible()
  })

  test('ESC key cancels streaming run', async ({ page }) => {
    // Mock streaming that never completes (to test cancel)
    await page.evaluate(() => {
      const FakeES = (window as any).FakeEventSource
      const instances: any[] = []
      ;(window as any).EventSource = class extends FakeES {
        constructor(url: string) {
          super(url)
          instances.push(this)

          // Emit started but never complete
          setTimeout(() => {
            this.emit('started', { run_id: 'test-cancel-123' })
          }, 100)
        }
      }
      ;(window as any).__streamInstances = instances
    })

    // Trigger run
    await triggerRun(page)

    // Wait for streaming to start
    const progressIndicator = page.locator('[data-testid="streaming-progress"]').or(
      page.locator('[role="progressbar"]')
    )
    await expect(progressIndicator).toBeVisible({ timeout: 5000 })

    // Press ESC to cancel
    await page.keyboard.press('Escape')

    // Verify cancel request was sent (check console logs or network)
    const cancelLogs = await page.evaluate(() => {
      return (window as any).__streamInstances?.[0]?.readyState === 2 // CLOSED
    })
    expect(cancelLogs).toBe(true)

    // Verify progress indicator is hidden
    await expect(progressIndicator).not.toBeVisible({ timeout: 2000 })

    // Verify screen reader announcement
    const srAnnouncement = page.locator('[role="status"]').filter({ hasText: /cancel/i })
    await expect(srAnnouncement).toBeVisible({ timeout: 1000 })
  })

  test('route change cancels streaming run', async ({ page }) => {
    // Mock streaming that never completes
    await page.evaluate(() => {
      const FakeES = (window as any).FakeEventSource
      const instances: any[] = []
      ;(window as any).EventSource = class extends FakeES {
        constructor(url: string) {
          super(url)
          instances.push(this)

          setTimeout(() => {
            this.emit('started', { run_id: 'test-route-cancel-123' })
          }, 100)
        }
      }
      ;(window as any).__streamInstances = instances
    })

    // Trigger run
    await triggerRun(page)

    // Wait for streaming to start
    const progressIndicator = page.locator('[data-testid="streaming-progress"]').or(
      page.locator('[role="progressbar"]')
    )
    await expect(progressIndicator).toBeVisible({ timeout: 5000 })

    // Navigate away
    await page.goto('/?e2e=1#/', { waitUntil: 'domcontentloaded' })

    // Verify stream was closed
    await page.goto('/?e2e=1#/plot', { waitUntil: 'domcontentloaded' })
    const streamClosed = await page.evaluate(() => {
      return (window as any).__streamInstances?.[0]?.readyState === 2
    })
    expect(streamClosed).toBe(true)
  })

  test('429 rate limit shows user-friendly error', async ({ page }) => {
    // Mock 429 error response
    await page.evaluate(() => {
      const FakeES = (window as any).FakeEventSource
      ;(window as any).EventSource = class extends FakeES {
        constructor(url: string) {
          super(url)

          // Emit rate limit error
          setTimeout(() => {
            this.emit('error', {
              code: 'RATE_LIMITED',
              error: 'Rate limit exceeded',
              retry_after: 60
            })
          }, 100)
        }
      }
    })

    // Trigger run
    await triggerRun(page)

    // Wait for error banner
    const errorBanner = page.locator('[role="alert"]').filter({ hasText: /rate limit/i })
    await expect(errorBanner).toBeVisible({ timeout: 5000 })

    // Verify retry_after hint is shown
    await expect(errorBanner).toContainText(/60.*second/i)

    // Verify screen reader announcement
    const srError = page.locator('[role="alert"][aria-live="assertive"]')
    await expect(srError).toBeVisible()
  })

  test('network error shows retry option', async ({ page }) => {
    // Mock network error
    await page.evaluate(() => {
      const FakeES = (window as any).FakeEventSource
      ;(window as any).EventSource = class extends FakeES {
        constructor(url: string) {
          super(url)

          // Emit network error
          setTimeout(() => {
            this.emit('error', {
              code: 'NETWORK_ERROR',
              error: 'Connection lost'
            })
          }, 100)
        }
      }
    })

    // Trigger run
    await triggerRun(page)

    // Wait for error banner with retry option
    const errorBanner = page.locator('[role="alert"]').filter({ hasText: /network|connection/i })
    await expect(errorBanner).toBeVisible({ timeout: 5000 })

    // Verify retry button is present
    const retryBtn = page.getByRole('button', { name: /retry|try again/i })
    await expect(retryBtn).toBeVisible()

    // Verify error is announced to screen readers
    const srError = page.locator('[role="alert"][aria-live="assertive"]')
    await expect(srError).toBeVisible()
  })

  test('interim findings update progressively', async ({ page }) => {
    // Mock streaming with interim events
    await page.evaluate(() => {
      const FakeES = (window as any).FakeEventSource
      ;(window as any).EventSource = class extends FakeES {
        constructor(url: string) {
          super(url)

          setTimeout(() => {
            this.emit('started', { run_id: 'test-interim-123' })
          }, 100)

          // First interim batch
          setTimeout(() => {
            this.emit('interim', { findings: ['Risk factor A identified', 'Analyzing dependencies'] })
          }, 200)

          // Second interim batch (cumulative)
          setTimeout(() => {
            this.emit('interim', { findings: ['Risk factor A identified', 'Analyzing dependencies', 'Confidence building'] })
          }, 300)

          // Complete
          setTimeout(() => {
            this.emit('complete', {
              result: {
                schema: 'report.v1',
                results: { summary: { conservative: 100, likely: 150, optimistic: 200, units: 'units' } },
                model_card: { response_hash: 'test-hash', seed: 42, confidence: 0.85, template_version: '1.0.0' },
                explanation: 'Test'
              },
              execution_ms: 500
            })
          }, 400)
        }
      }
    })

    // Trigger run
    await triggerRun(page)

    // Wait for interim findings to appear
    const findingsContainer = page.locator('[data-testid="interim-findings"]').or(
      page.locator('[role="log"]')
    )
    await expect(findingsContainer).toBeVisible({ timeout: 5000 })

    // Verify first finding appears
    await expect(findingsContainer).toContainText('Risk factor A identified')

    // Verify cumulative update (3 items)
    await expect(findingsContainer.locator('li, [role="listitem"]')).toHaveCount(3)

    // Verify findings are cleared after completion
    await expect(findingsContainer).not.toBeVisible({ timeout: 2000 })
  })

  test('progress indicator shows percentage', async ({ page }) => {
    // Mock streaming with progress events
    await page.evaluate(() => {
      const FakeES = (window as any).FakeEventSource
      ;(window as any).EventSource = class extends FakeES {
        constructor(url: string) {
          super(url)

          setTimeout(() => { this.emit('started', { run_id: 'test-progress-123' }) }, 100)
          setTimeout(() => { this.emit('progress', { percent: 25 }) }, 200)
          setTimeout(() => { this.emit('progress', { percent: 50 }) }, 300)
          setTimeout(() => { this.emit('progress', { percent: 75 }) }, 400)
          setTimeout(() => {
            this.emit('complete', {
              result: {
                schema: 'report.v1',
                results: { summary: { conservative: 100, likely: 150, optimistic: 200, units: 'units' } },
                model_card: { response_hash: 'test-hash', seed: 42, confidence: 0.85, template_version: '1.0.0' },
                explanation: 'Test'
              },
              execution_ms: 500
            })
          }, 500)
        }
      }
    })

    // Trigger run
    await triggerRun(page)

    // Wait for progress indicator
    const progressBar = page.locator('[role="progressbar"]')
    await expect(progressBar).toBeVisible({ timeout: 5000 })

    // Verify aria-valuenow updates
    await expect(progressBar).toHaveAttribute('aria-valuenow', '25', { timeout: 1000 })
    await expect(progressBar).toHaveAttribute('aria-valuenow', '50', { timeout: 1000 })
    await expect(progressBar).toHaveAttribute('aria-valuenow', '75', { timeout: 1000 })

    // Verify completion
    await expect(progressBar).not.toBeVisible({ timeout: 2000 })
  })
})
