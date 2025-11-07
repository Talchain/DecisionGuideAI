/**
 * Share Hash Allowlist E2E Tests
 *
 * Tests validateShareHashAllowlist function with feature flag control.
 *
 * Feature flag: VITE_FEATURE_SHARE_ALLOWLIST
 */

import { test, expect } from '@playwright/test'

test.describe('Share Hash Allowlist', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).__E2E = '1'
    })
  })

  test('should allow all hashes when feature flag is disabled (default)', async ({ page }) => {
    await page.goto('/#/canvas?e2e=1')

    // Test validateShareHashAllowlist in browser context
    const result = await page.evaluate(async () => {
      const { validateShareHashAllowlist } = await import('/src/canvas/utils/sanitize.ts')
      return await validateShareHashAllowlist('abc123xyz')
    })

    expect(result).toBe(true)
  })

  test('should reject invalid hash formats when feature is enabled', async ({ page }) => {
    // Enable feature flag
    await page.addInitScript(() => {
      Object.defineProperty(import.meta, 'env', {
        value: { VITE_FEATURE_SHARE_ALLOWLIST: '1' },
        writable: false
      })
    })

    await page.goto('/#/canvas?e2e=1')

    // Test with too-short hash
    const shortHashResult = await page.evaluate(async () => {
      const { validateShareHashAllowlist } = await import('/src/canvas/utils/sanitize.ts')
      return await validateShareHashAllowlist('abc')
    })

    expect(shortHashResult).toBe(false)

    // Test with empty hash
    const emptyHashResult = await page.evaluate(async () => {
      const { validateShareHashAllowlist } = await import('/src/canvas/utils/sanitize.ts')
      return await validateShareHashAllowlist('')
    })

    expect(emptyHashResult).toBe(false)
  })

  test('should use local allowlist when provided (backward compatibility)', async ({ page }) => {
    await page.goto('/#/canvas?e2e=1')

    // Test with local allowlist
    const result = await page.evaluate(async () => {
      const { validateShareHashAllowlist } = await import('/src/canvas/utils/sanitize.ts')

      const allowlist = new Set(['allowed-hash-1', 'allowed-hash-2'])

      return {
        allowed: validateShareHashAllowlist('allowed-hash-1', allowlist),
        rejected: validateShareHashAllowlist('not-in-list', allowlist)
      }
    })

    expect(result.allowed).toBe(true)
    expect(result.rejected).toBe(false)
  })
})
