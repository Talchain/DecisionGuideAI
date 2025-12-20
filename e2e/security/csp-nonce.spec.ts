/**
 * CSP Nonce Regression E2E Tests
 *
 * Verifies Content Security Policy nonce injection is working correctly.
 * These tests prevent silent CSP regressions that could allow XSS attacks.
 *
 * IMPORTANT: CSP nonce injection is handled by Netlify Edge Functions.
 * These tests require:
 * - A production build with netlify dev OR
 * - Running against a deployed environment (staging/production)
 *
 * In CI, these tests run against the deployed preview.
 * Locally, run: netlify dev (not vite dev) to test CSP headers.
 */

import { test, expect } from '@playwright/test'

test.describe('CSP Security', () => {
  // Skip in dev mode since CSP nonce requires Netlify Edge Functions
  test.skip(({ }, testInfo) => {
    // These tests only work with Netlify-deployed environments
    // or when running `netlify dev` locally
    const baseUrl = testInfo.project.use.baseURL || ''
    const isLocalDev = baseUrl.includes('localhost:5173') || baseUrl.includes('localhost:5174')
    return isLocalDev
  }, 'CSP nonce tests require Netlify Edge Functions (not vite dev)')

  test('should have CSP header with nonce', async ({ page }) => {
    const response = await page.goto('/')
    expect(response).not.toBeNull()

    const cspHeader = response!.headers()['content-security-policy']

    // CSP header should exist
    expect(cspHeader).toBeDefined()
    expect(cspHeader).toBeTruthy()

    // Should contain script-src directive
    expect(cspHeader).toContain('script-src')

    // Should NOT contain 'unsafe-inline' in script-src
    // (Edge function should have replaced it with nonce)
    const scriptSrcMatch = cspHeader.match(/script-src[^;]+/)
    const scriptSrc = scriptSrcMatch?.[0] || ''
    expect(scriptSrc).not.toContain("'unsafe-inline'")

    // Should contain a nonce
    expect(cspHeader).toMatch(/nonce-[A-Za-z0-9+/=]+/)
  })

  test('inline scripts should have matching nonce attribute', async ({ page }) => {
    const response = await page.goto('/')
    expect(response).not.toBeNull()

    // Extract nonce from CSP header
    const cspHeader = response!.headers()['content-security-policy'] || ''
    const nonceMatch = cspHeader.match(/nonce-([A-Za-z0-9+/=]+)/)
    const expectedNonce = nonceMatch?.[1]

    // Skip if no nonce in header (edge function not active)
    if (!expectedNonce) {
      test.skip(true, 'No nonce found in CSP header - edge function may not be active')
      return
    }

    // Get all inline scripts (those without src attribute)
    const scriptNonces = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script:not([src])')
      return Array.from(scripts).map(s => ({
        hasNonce: s.hasAttribute('nonce'),
        nonce: s.getAttribute('nonce'),
        content: s.textContent?.slice(0, 50) || '',
      }))
    })

    // All inline scripts should have nonces
    for (const script of scriptNonces) {
      expect(script.hasNonce).toBe(true)
      expect(script.nonce).toBe(expectedNonce)
    }
  })

  test('should not have unsafe-inline in script-src directive', async ({ page }) => {
    const response = await page.goto('/')
    expect(response).not.toBeNull()

    const cspHeader = response!.headers()['content-security-policy'] || ''

    // Extract just the script-src directive
    const scriptSrcMatch = cspHeader.match(/script-src[^;]+/)
    const scriptSrc = scriptSrcMatch?.[0] || ''

    // Should never have 'unsafe-inline' in production
    expect(scriptSrc).not.toContain("'unsafe-inline'")
  })

  test('nonce should be unique per request', async ({ page }) => {
    // Make two requests and verify nonces are different
    const response1 = await page.goto('/')
    const csp1 = response1?.headers()['content-security-policy'] || ''
    const nonce1Match = csp1.match(/nonce-([A-Za-z0-9+/=]+)/)
    const nonce1 = nonce1Match?.[1]

    // Navigate to a different page and back
    await page.goto('/canvas')
    const response2 = await page.goto('/')
    const csp2 = response2?.headers()['content-security-policy'] || ''
    const nonce2Match = csp2.match(/nonce-([A-Za-z0-9+/=]+)/)
    const nonce2 = nonce2Match?.[1]

    // If both nonces exist, they should be different
    if (nonce1 && nonce2) {
      expect(nonce1).not.toBe(nonce2)
    }
  })

  test('nonce should be base64 encoded (128 bits)', async ({ page }) => {
    const response = await page.goto('/')
    expect(response).not.toBeNull()

    const cspHeader = response!.headers()['content-security-policy'] || ''
    const nonceMatch = cspHeader.match(/nonce-([A-Za-z0-9+/=]+)/)
    const nonce = nonceMatch?.[1]

    // Skip if no nonce found
    if (!nonce) {
      test.skip(true, 'No nonce found in CSP header')
      return
    }

    // Nonce should be valid base64
    // 16 bytes = 128 bits = ~22-24 base64 characters (depending on padding)
    expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(nonce.length).toBeGreaterThanOrEqual(20)
    expect(nonce.length).toBeLessThanOrEqual(24)
  })
})
