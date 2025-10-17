// e2e/safe-screen.spec.ts
// Regression tests for safe screen isolation

import { test, expect } from '@playwright/test'

test('happy path: canvas loads, no safe screen, no sync-external-store errors', async ({ page }) => {
  const errors: string[] = []
  const warnings: string[] = []
  
  page.on('console', (msg) => {
    const text = msg.text()
    
    if (msg.type() === 'error') {
      // Capture errors related to sync-external-store or safe screen
      if (text.includes('use-sync-external-store') || 
          text.includes('POC_HTML_SAFE: showing (early-error)')) {
        errors.push(text)
      }
    }
    
    if (msg.type() === 'warning') {
      if (text.includes('use-sync-external-store')) {
        warnings.push(text)
      }
    }
  })

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

  // No sync-external-store errors
  expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toHaveLength(0)
  expect(warnings, `Unexpected console warnings:\n${warnings.join('\n')}`).toHaveLength(0)
})

test('forced safe: safe screen renders without importing React (no sync-external-store errors)', async ({ page }) => {
  const errors: string[] = []
  const warnings: string[] = []
  
  page.on('console', (msg) => {
    const text = msg.text()
    
    if (msg.type() === 'error') {
      if (text.includes('use-sync-external-store')) {
        errors.push(text)
      }
    }
    
    if (msg.type() === 'warning') {
      if (text.includes('use-sync-external-store')) {
        warnings.push(text)
      }
    }
  })

  // Query params go before the hash in SPAs
  await page.goto('/?forceSafe=1#/canvas')
  
  // Safe screen should be visible
  const safeScreen = page.locator('[data-testid="safe-screen"]')
  await expect(safeScreen).toBeVisible({ timeout: 5000 })

  // Wait a bit to ensure no delayed errors
  await page.waitForTimeout(2000)

  // No sync-external-store errors in safe mode
  expect(errors, `Safe path must not trigger sync-external-store errors:\n${errors.join('\n')}`).toHaveLength(0)
  expect(warnings, `Safe path must not trigger sync-external-store warnings:\n${warnings.join('\n')}`).toHaveLength(0)
  
  // Verify safe screen content
  await expect(safeScreen).toContainText('PoC HTML Safe Screen')
})

test('safe screen shows on timeout if React fails to mount', async ({ page }) => {
  // Block React from loading to simulate failure
  await page.route('**/main.tsx', route => route.abort())
  await page.route('**/src/main.tsx', route => route.abort())
  
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' && msg.text().includes('use-sync-external-store')) {
      errors.push(msg.text())
    }
  })

  await page.goto('/#/canvas')
  
  // Safe screen should appear after timeout (1200ms)
  const safeScreen = page.locator('[data-testid="safe-screen"]')
  await expect(safeScreen).toBeVisible({ timeout: 3000 })
  
  // Even in failure case, should not have sync-external-store errors
  // (because safe screen doesn't import React)
  expect(errors, `Safe screen on timeout should not have sync-external-store errors:\n${errors.join('\n')}`).toHaveLength(0)
})
