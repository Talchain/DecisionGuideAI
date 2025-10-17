// e2e/safe-screen.spec.ts
// Regression tests for safe screen isolation

import { test, expect } from '@playwright/test'
import { attachConsoleGuard, CONSOLE_GUARDS } from './utils/consoleGuard'

test('happy path: canvas loads, no safe screen, no sync-external-store errors', async ({ page }) => {
  // Use console guard to detect disallowed patterns
  const getHits = attachConsoleGuard(page, [
    CONSOLE_GUARDS.SYNC_EXTERNAL_STORE,
    CONSOLE_GUARDS.SAFE_SCREEN_EARLY
  ])

  await page.goto('/#/canvas')
  
  // Wait for React app to mount (multiple possible selectors)
  await Promise.race([
    page.waitForSelector('[data-testid="app-root"]', { timeout: 15000 }).catch(() => null),
    page.waitForSelector('.react-flow', { timeout: 15000 }).catch(() => null),
    page.waitForSelector('[data-testid="panel-root"]', { timeout: 15000 }).catch(() => null)
  ])
  
  // Give it a moment to settle
  await page.waitForTimeout(1000)

  // Safe screen should NOT be visible (element exists but display:none)
  const safeScreen = page.locator('[data-testid="safe-screen"]')
  await expect(safeScreen).toBeHidden({ timeout: 2000 })

  // No disallowed console messages
  const hits = getHits()
  expect(hits, `Unexpected console issues:\n${hits.join('\n')}`).toHaveLength(0)
})

test('forced safe: safe screen renders without importing React (no sync-external-store errors)', async ({ page }) => {
  // Use console guard to detect sync-external-store errors
  const getHits = attachConsoleGuard(page, [
    CONSOLE_GUARDS.SYNC_EXTERNAL_STORE
  ])

  // Query params go before the hash in SPAs
  await page.goto('/?forceSafe=1#/canvas')
  
  // Safe screen should be visible
  const safeScreen = page.locator('[data-testid="safe-screen"]')
  await expect(safeScreen).toBeVisible({ timeout: 5000 })

  // Wait a bit to ensure no delayed errors
  await page.waitForTimeout(2000)

  // No sync-external-store errors in safe mode
  const hits = getHits()
  expect(hits, `Safe path must not trigger sync-external-store errors:\n${hits.join('\n')}`).toHaveLength(0)
  
  // Verify safe screen content
  await expect(safeScreen).toContainText('PoC HTML Safe Screen')
})

test('safe screen shows on timeout if React fails to mount', async ({ page }) => {
  // Block React from loading to simulate failure
  await page.route('**/main.tsx', route => route.abort())
  await page.route('**/src/main.tsx', route => route.abort())
  
  // Use console guard
  const getHits = attachConsoleGuard(page, [
    CONSOLE_GUARDS.SYNC_EXTERNAL_STORE
  ])

  await page.goto('/#/canvas')
  
  // Safe screen should appear after timeout (1200ms)
  const safeScreen = page.locator('[data-testid="safe-screen"]')
  await expect(safeScreen).toBeVisible({ timeout: 3000 })
  
  // Even in failure case, should not have sync-external-store errors
  // (because safe screen doesn't import React)
  const hits = getHits()
  expect(hits, `Safe screen on timeout should not have sync-external-store errors:\n${hits.join('\n')}`).toHaveLength(0)
})
