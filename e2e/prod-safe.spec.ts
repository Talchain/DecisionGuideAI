// e2e/prod-safe.spec.ts
import { test, expect } from '@playwright/test'

const ORIGIN = process.env.E2E_ORIGIN ?? 'http://localhost:4173'
const SAFE_FALLBACK_MS = 2000 // Updated from 1200ms

test.describe.configure({ mode: 'serial' })

test('A) happy path: app mounts, safe screen hidden, no shim errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  await page.goto(`${ORIGIN}/#/canvas`, { waitUntil: 'domcontentloaded' })

  // Allow transient safe screen in first 2s (production bundle load), but must be hidden by 2.5s
  await page.waitForTimeout(2500)
  
  // Safe screen must be hidden by now and stay hidden
  const safeVisible = await page.locator('#poc-safe[data-visible="true"]').isVisible().catch(() => false)
  expect(safeVisible).toBeFalsy()
  
  // Verify it stays hidden
  await page.waitForTimeout(500)
  const stillVisible = await page.locator('#poc-safe[data-visible="true"]').isVisible().catch(() => false)
  expect(stillVisible).toBeFalsy()

  expect(errors.filter((e) => e.includes('use-sync-external-store')).length).toBe(0)
})

test('B) forced safe: safe screen shows, app bundle not requested, no shim errors', async ({ page }) => {
  const errors: string[] = []
  const reactRequests: string[] = []

  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  // Network spy: track any React-ecosystem chunk requests
  page.on('request', (req) => {
    const url = req.url()
    // Fail if any React/shim/app chunks are requested (use hyphens for Vite chunks)
    if (
      /react-.*\.js/.test(url) ||
      /react-dom-.*\.js/.test(url) ||
      /use-sync-external-store.*\.js/.test(url) ||
      /main-.*\.js/.test(url) ||       // ✅ FIXED: hyphen pattern for Vite
      /reactApp-.*\.js/.test(url) ||
      /react-vendor-.*\.js/.test(url) ||
      /AppPoC-.*\.js/.test(url)
    ) {
      reactRequests.push(url)
    }
  })

  await page.goto(`${ORIGIN}/?forceSafe=1#/canvas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)

  const safeVisible = await page.locator('#poc-safe[data-visible="true"]').isVisible()
  expect(safeVisible).toBeTruthy()

  // Assert no React chunks were requested
  expect(reactRequests).toHaveLength(0)
  expect(errors.filter((e) => e.includes('use-sync-external-store')).length).toBe(0)
})

test('C) abort app: safe screen appears after fallback, no shim errors', async ({ page, context }) => {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  await context.route(/reactApp.*\.js/, (route) => route.abort())

  const start = Date.now()
  await page.goto(`${ORIGIN}/#/canvas`, { waitUntil: 'domcontentloaded' })

  // Wait for safe screen to appear (should be by 2.2s with quiet window gate)
  await page.waitForTimeout(SAFE_FALLBACK_MS + 200)

  const safeVisible = await page.locator('#poc-safe[data-visible="true"]').isVisible()
  expect(safeVisible).toBeTruthy()

  // Timing should respect the fallback delay
  expect(Date.now() - start).toBeGreaterThanOrEqual(SAFE_FALLBACK_MS)

  expect(errors.filter((e) => e.includes('use-sync-external-store')).length).toBe(0)
})
