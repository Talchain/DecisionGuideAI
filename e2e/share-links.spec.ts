/**
 * Share Links v2 E2E Tests
 *
 * Tests for ShareDrawer component and deep-link route handler.
 *
 * Coverage:
 * - ShareDrawer UI (open, copy, hash display)
 * - Share URL validation and format
 * - Deep-link route (/#/share/:hash)
 * - Allowlist status indicator (when flag enabled)
 * - Error states (invalid hash, not found, not allowed)
 * - Accessibility (ARIA roles, keyboard navigation)
 */

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const SHARE_HASH_VALID = 'abc123def456' // Valid format: alphanumeric, 8-64 chars
const SHARE_HASH_INVALID_SHORT = 'abc123' // Too short (< 8 chars)
const SHARE_HASH_INVALID_CHARS = 'abc123-def!' // Invalid characters
const SHARE_HASH_NOT_FOUND = 'notfound12345678' // Valid format but not in system

test.describe('Share Links v2', { tag: '@share' }, () => {
  test.describe('ShareDrawer Component', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to PlotWorkspace
      await page.goto('/#/plot')
      await page.waitForLoadState('networkidle')

      // Run a scenario to generate seed & hash
      await page.click('button:has-text("Run Scenario")')
      await page.waitForTimeout(1000) // Wait for run to complete
    })

    test('opens ShareDrawer when Share button clicked', async ({ page }) => {
      // Click Share button
      await page.click('button:has-text("Share")')

      // Verify drawer opens
      const drawer = page.locator('[role="dialog"][aria-label="Share link"]')
      await expect(drawer).toBeVisible({ timeout: 2000 })

      // Verify heading
      await expect(drawer.locator('h2:has-text("Share Analysis")')).toBeVisible()
    })

    test('displays seed and hash from last run', async ({ page }) => {
      // Open share drawer
      await page.click('button:has-text("Share")')

      const drawer = page.locator('[role="dialog"][aria-label="Share link"]')
      await expect(drawer).toBeVisible()

      // Verify seed display
      const seedLabel = drawer.locator('label:has-text("Seed")')
      await expect(seedLabel).toBeVisible()

      // Verify hash display
      const hashLabel = drawer.locator('label:has-text("Response Hash")')
      await expect(hashLabel).toBeVisible()
    })

    test('copy link button copies share URL to clipboard', async ({ page, context }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])

      // Open share drawer
      await page.click('button:has-text("Share")')

      const drawer = page.locator('[role="dialog"][aria-label="Share link"]')
      await expect(drawer).toBeVisible()

      // Click Copy Link button
      await page.click('button:has-text("Copy Link")')

      // Verify button text changes to "Copied!"
      await expect(page.locator('button:has-text("Copied!")')).toBeVisible({ timeout: 1000 })

      // Read clipboard content
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText())

      // Verify clipboard contains share URL with valid format
      expect(clipboardText).toMatch(/.*\/#\/share\/[a-zA-Z0-9]{8,64}/)
    })

    test('open link button opens share URL in new tab', async ({ page, context }) => {
      // Open share drawer
      await page.click('button:has-text("Share")')

      const drawer = page.locator('[role="dialog"][aria-label="Share link"]')
      await expect(drawer).toBeVisible()

      // Listen for new page
      const pagePromise = context.waitForEvent('page')

      // Click Open button
      await page.click('button:has-text("Open")')

      // Verify new page opened with share URL
      const newPage = await pagePromise
      await newPage.waitForLoadState('networkidle')

      expect(newPage.url()).toMatch(/\/#\/share\/[a-zA-Z0-9]{8,64}/)
    })

    test('close button closes drawer', async ({ page }) => {
      // Open share drawer
      await page.click('button:has-text("Share")')

      const drawer = page.locator('[role="dialog"][aria-label="Share link"]')
      await expect(drawer).toBeVisible()

      // Click Close button
      await page.click('button:has-text("Close")')

      // Verify drawer closed
      await expect(drawer).not.toBeVisible({ timeout: 1000 })
    })

    test('clicking backdrop closes drawer', async ({ page }) => {
      // Open share drawer
      await page.click('button:has-text("Share")')

      const drawer = page.locator('[role="dialog"][aria-label="Share link"]')
      await expect(drawer).toBeVisible()

      // Click backdrop (outside drawer)
      await page.locator('[role="dialog"]').click({ position: { x: 10, y: 10 } })

      // Verify drawer closed
      await expect(drawer).not.toBeVisible({ timeout: 1000 })
    })

    test('shows N/A when no hash available', async ({ page }) => {
      // Navigate to fresh workspace (no run)
      await page.goto('/#/plot')
      await page.waitForLoadState('networkidle')

      // Clear workspace to ensure no hash
      await page.click('button:has-text("Clear")')
      await page.click('button:has-text("OK")', { timeout: 500 }).catch(() => {})

      // Open share drawer
      await page.click('button:has-text("Share")')

      const drawer = page.locator('[role="dialog"][aria-label="Share link"]')
      await expect(drawer).toBeVisible()

      // Verify hash shows N/A
      const hashDisplay = drawer.locator('text=N/A').first()
      await expect(hashDisplay).toBeVisible()

      // Verify Copy Link button is disabled
      const copyButton = page.locator('button:has-text("Copy Link")')
      await expect(copyButton).toBeDisabled()
    })

    test('accessibility: zero Axe violations', async ({ page }) => {
      // Open share drawer
      await page.click('button:has-text("Share")')

      const drawer = page.locator('[role="dialog"][aria-label="Share link"]')
      await expect(drawer).toBeVisible()

      // Run Axe on drawer
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[role="dialog"][aria-label="Share link"]')
        .analyze()

      expect(accessibilityScanResults.violations).toEqual([])
    })
  })

  test.describe('Deep-Link Route Handler', () => {
    test('valid hash displays ShareView', async ({ page }) => {
      // Navigate to share URL with valid hash
      await page.goto(`/#/share/${SHARE_HASH_VALID}`)
      await page.waitForLoadState('networkidle')

      // Verify ShareView renders (header with "Shared Analysis")
      await expect(page.locator('h1:has-text("Shared Analysis")')).toBeVisible({ timeout: 3000 })

      // Verify hash display
      await expect(page.locator(`text=Hash: ${SHARE_HASH_VALID}`)).toBeVisible()
    })

    test('invalid hash (too short) shows error', async ({ page }) => {
      // Navigate with invalid hash
      await page.goto(`/#/share/${SHARE_HASH_INVALID_SHORT}`)
      await page.waitForLoadState('networkidle')

      // Verify error screen
      await expect(page.locator('h1:has-text("Invalid Share Link")')).toBeVisible({ timeout: 3000 })
      await expect(page.locator('text=/Hash must be alphanumeric/i')).toBeVisible()
    })

    test('invalid hash (special chars) shows error', async ({ page }) => {
      // Navigate with invalid hash
      await page.goto(`/#/share/${SHARE_HASH_INVALID_CHARS}`)
      await page.waitForLoadState('networkidle')

      // Verify error screen
      await expect(page.locator('h1:has-text("Invalid Share Link")')).toBeVisible({ timeout: 3000 })
    })

    test('not found hash shows not found screen', async ({ page }) => {
      // Navigate with valid format but non-existent hash
      await page.goto(`/#/share/${SHARE_HASH_NOT_FOUND}`)
      await page.waitForLoadState('networkidle')

      // Wait for validation to complete
      await page.waitForTimeout(1000)

      // Verify not found screen
      await expect(page.locator('h1:has-text("Not Found")')).toBeVisible({ timeout: 3000 })
      await expect(page.locator('text=/analysis could not be found/i')).toBeVisible()
    })

    test('"Go to PLoT Workspace" link navigates correctly', async ({ page }) => {
      // Navigate to share URL
      await page.goto(`/#/share/${SHARE_HASH_VALID}`)
      await page.waitForLoadState('networkidle')

      // Click "Go to PLoT Workspace" link
      await page.click('a:has-text("Go to PLoT Workspace")')
      await page.waitForLoadState('networkidle')

      // Verify navigation to /plot
      expect(page.url()).toContain('/#/plot')
    })

    test('query param (template) is sanitized and displayed', async ({ page }) => {
      const templateId = 'pricing_change'

      // Navigate with template query param
      await page.goto(`/#/share/${SHARE_HASH_VALID}?template=${templateId}`)
      await page.waitForLoadState('networkidle')

      // Verify template ID displayed
      await expect(page.locator(`text=Template: ${templateId}`)).toBeVisible({ timeout: 3000 })
    })

    test('malicious query param (XSS attempt) is sanitized', async ({ page }) => {
      const xssAttempt = '<script>alert(1)</script>'

      // Navigate with malicious query param
      await page.goto(`/#/share/${SHARE_HASH_VALID}?template=${encodeURIComponent(xssAttempt)}`)
      await page.waitForLoadState('networkidle')

      // Verify script tag not present in DOM
      const scriptTags = await page.locator('script:has-text("alert")').count()
      expect(scriptTags).toBe(0)

      // Verify sanitized text (no angle brackets)
      const bodyText = await page.textContent('body')
      expect(bodyText).not.toContain('<script>')
    })

    test('accessibility: ShareView has zero Axe violations', async ({ page }) => {
      // Navigate to share URL
      await page.goto(`/#/share/${SHARE_HASH_VALID}`)
      await page.waitForLoadState('networkidle')

      // Run Axe on entire page
      const accessibilityScanResults = await new AxeBuilder({ page })
        .analyze()

      expect(accessibilityScanResults.violations).toEqual([])
    })
  })

  test.describe('Allowlist Status (when flag enabled)', () => {
    test.skip('shows "Checking..." status initially', async ({ page }) => {
      // This test requires VITE_FEATURE_SHARE_ALLOWLIST=1
      // Skip by default, enable when flag is turned on

      await page.goto('/#/plot')
      await page.waitForLoadState('networkidle')

      // Run scenario
      await page.click('button:has-text("Run Scenario")')
      await page.waitForTimeout(1000)

      // Open share drawer
      await page.click('button:has-text("Share")')

      const drawer = page.locator('[role="dialog"][aria-label="Share link"]')
      await expect(drawer).toBeVisible()

      // Verify "Checking..." status appears
      await expect(drawer.locator('text=Checking...')).toBeVisible({ timeout: 500 })
    })

    test.skip('shows "Allowed" status when hash is allowlisted', async ({ page }) => {
      // This test requires VITE_FEATURE_SHARE_ALLOWLIST=1 and mock allowlist response

      await page.goto('/#/plot')
      await page.waitForLoadState('networkidle')

      // Run scenario
      await page.click('button:has-text("Run Scenario")')
      await page.waitForTimeout(1000)

      // Open share drawer
      await page.click('button:has-text("Share")')

      const drawer = page.locator('[role="dialog"][aria-label="Share link"]')
      await expect(drawer).toBeVisible()

      // Wait for allowlist check
      await page.waitForTimeout(600)

      // Verify "Allowed" status
      await expect(drawer.locator('text=✓ Allowed')).toBeVisible({ timeout: 2000 })
    })
  })

  test.describe('Share URL Format', () => {
    test('share URL has correct structure', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])

      await page.goto('/#/plot')
      await page.waitForLoadState('networkidle')

      // Run scenario
      await page.click('button:has-text("Run Scenario")')
      await page.waitForTimeout(1000)

      // Open share drawer and copy link
      await page.click('button:has-text("Share")')
      await page.click('button:has-text("Copy Link")')

      // Get clipboard content
      const url = await page.evaluate(() => navigator.clipboard.readText())

      // Verify URL structure
      const urlObj = new URL(url)
      expect(urlObj.origin).toBeTruthy()
      expect(urlObj.hash).toMatch(/^#\/share\/[a-zA-Z0-9]{8,64}(\?.*)?$/)

      // Verify no sensitive data in URL (no debug, preview, interim params)
      expect(url).not.toContain('debug')
      expect(url).not.toContain('preview')
      expect(url).not.toContain('interim')
    })

    test('hash is deterministic (same run = same hash)', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])

      // Run scenario twice with same seed
      for (let i = 0; i < 2; i++) {
        await page.goto('/#/plot')
        await page.waitForLoadState('networkidle')

        // Set seed to 42
        await page.fill('input[type="number"]', '42')

        // Run scenario
        await page.click('button:has-text("Run Scenario")')
        await page.waitForTimeout(1000)

        // Open share drawer and copy link
        await page.click('button:has-text("Share")')
        await page.click('button:has-text("Copy Link")')

        // Get hash from URL
        const url = await page.evaluate(() => navigator.clipboard.readText())
        const hashMatch = url.match(/#\/share\/([a-zA-Z0-9]+)/)
        const hash = hashMatch ? hashMatch[1] : null

        if (i === 0) {
          // Store first hash for comparison
          await page.evaluate((h) => window.sessionStorage.setItem('firstHash', h || ''), hash)
        } else {
          // Compare second hash with first
          const firstHash = await page.evaluate(() => window.sessionStorage.getItem('firstHash'))
          expect(hash).toBe(firstHash)
        }

        // Close drawer
        await page.click('button:has-text("Close")')
      }
    })
  })
})
