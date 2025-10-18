// e2e/prod-safe.spec.ts
import { test, expect } from '@playwright/test'

const ORIGIN = process.env.E2E_ORIGIN ?? 'http://localhost:4173'
const SAFE_FALLBACK_MS = 1200

test.describe.configure({ mode: 'serial' })

test('A) happy path: app mounts, safe screen hidden, no shim errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  await page.goto(`${ORIGIN}/#/canvas`, { waitUntil: 'domcontentloaded' })

  // Wait for React to mount and hide safe screen
  await page.waitForSelector('#poc-safe[data-visible="false"], #poc-safe:not([data-visible="true"])', { timeout: 10000 })

  const safeVisible = await page.locator('#poc-safe[data-visible="true"]').isVisible().catch(() => false)
  expect(safeVisible).toBeFalsy()

  expect(errors.filter((e) => e.includes('use-sync-external-store')).length).toBe(0)
})

test('B) forced safe: safe screen shows, app bundle not requested, no shim errors', async ({ page }) => {
  const errors: string[] = []
  let appRequested = false

  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  page.on('request', (req) => {
    const url = req.url()
    if (/reactApp.*\.js/.test(url) || /AppPoC|main\..*\.js/.test(url)) appRequested = true
  })

  await page.goto(`${ORIGIN}/?forceSafe=1#/canvas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)

  const safeVisible = await page.locator('#poc-safe[data-visible="true"]').isVisible()
  expect(safeVisible).toBeTruthy()

  expect(appRequested).toBeFalsy()
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

  await page.waitForTimeout(SAFE_FALLBACK_MS + 250)

  const safeVisible = await page.locator('#poc-safe[data-visible="true"]').isVisible()
  expect(safeVisible).toBeTruthy()

  expect(Date.now() - start).toBeGreaterThanOrEqual(SAFE_FALLBACK_MS)

  expect(errors.filter((e) => e.includes('use-sync-external-store')).length).toBe(0)
})
