import { test, expect } from '@playwright/test'
import { gotoSandbox, installFakeEventSource, waitForPanel } from '../_helpers'
import { mkdir, stat } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import path from 'node:path'

// @evidence Capture real UI screenshots for the UI pack
//
// ⚠ THIS SPEC IS AN EVIDENCE PRODUCER, AND THAT IS EXACTLY WHY IT HAS TO
// ASSERT. Its output is not thrown away at the end of the run: it writes into
// `docs/evidence/ui-pack/`, which `tools/gen-ui-evidence-pack.mjs` zips and
// `tools/unified-pack/compose.mjs` folds into the unified pack. A blank or
// half-painted capture therefore does not fail here and vanish — it is
// PUBLISHED, and downstream it is indistinguishable from a real one.
//
// Until 27 Aug 2026 this file imported `expect` and never called it, so the
// only way it could fail was for Playwright itself to throw. `waitForPanel`
// swallows its first three waits in `try/catch` and only throws if BOTH
// `panel-root` and `start-btn` are missing — so a run in which `panel-root`
// never mounted, or mounted collapsed to zero size, sailed through and shipped
// a screenshot of nothing.
//
// The guard below is the repo's strongest available shape
// (e2e/visual/shellLayout.visual.spec.ts:268-271): bind by IDENTITY (the
// testid, never a value predicate another element could satisfy), then assert
// the bounding box is non-null AND has real width AND real height.
//
// ⚠ MEASURED, NOT ASSUMED — the honest scope of that claim. Collapsing
// `panel-root` to a true 0×0 and re-running gives `count=1`, `isVisible=false`,
// `box={width:0,height:0}`. So a `toHaveCount(1)` check does NOT catch this,
// and `toBeVisible()` DOES. The width/height assertions are not here because
// `toBeVisible()` would miss a true 0×0 — it would not. They are here because
// they name WHICH dimension collapsed in the failure message, and because
// binding count + box together states the whole precondition for the capture
// being meaningful. The thing that actually caught nothing was the previous
// version of this file, which asserted nothing at all: run under that same
// 0×0 mutation it PASSED and wrote a 53 KB screenshot of a collapsed panel
// into the pack. A byte-size floor would not have caught it either — the
// viewport chrome still renders. Only the DOM assertion does.

/**
 * Assert that the sandbox surface we are about to photograph is actually
 * PAINTED, and that the file we then wrote is actually a file.
 *
 * Bound to `panel-root` by testid. `waitForPanel` treats `start-btn` as an
 * acceptable fallback, so reaching this point does NOT imply the panel
 * mounted — that gap is the whole reason this assertion exists.
 */
async function assertSurfacePainted(page: Page, label: string): Promise<void> {
  const panel = page.locator('[data-testid="panel-root"]')

  await expect(
    panel,
    `${label}: panel-root never mounted, so the captured screenshot is not of the ` +
      'sandbox surface. waitForPanel accepts start-btn as a fallback and will not ' +
      'have caught this.',
  ).toHaveCount(1)

  const box = await panel.boundingBox()
  expect(
    box,
    `${label}: panel-root is mounted but has NO bounding box — it is display:none or ` +
      'detached, and the screenshot about to be written is blank.',
  ).not.toBeNull()
  expect(
    box!.width,
    `${label}: panel-root collapsed to zero width — the evidence PNG is blank, and a ` +
      'count-based check (count is still 1) would not have noticed.',
  ).toBeGreaterThan(0)
  expect(
    box!.height,
    `${label}: panel-root collapsed to zero height — the evidence PNG is blank, and a ` +
      'count-based check (count is still 1) would not have noticed.',
  ).toBeGreaterThan(0)
}

/**
 * The capture is only evidence once it is on disk. A `page.screenshot()` that
 * resolves having written nothing usable would otherwise be invisible.
 */
async function assertCaptureWritten(filePath: string, label: string): Promise<void> {
  const info = await stat(filePath).catch(() => null)
  expect(info, `${label}: no file was written at ${filePath}`).not.toBeNull()
  expect(
    info!.size,
    `${label}: the capture at ${filePath} is zero bytes — an empty artefact would still ` +
      'be zipped into the UI pack and read downstream as a real screenshot.',
  ).toBeGreaterThan(0)
}

test.describe('@evidence ui-pack screenshots', () => {
  test('desktop and <=480px mobile list-view', async ({ page, browser }) => {
    await installFakeEventSource(page)
    await page.addInitScript(() => {
      try {
        localStorage.setItem('feature.sseStreaming', '1')
        localStorage.setItem('feature.listView', '1')
        ;(window as any).__E2E = 1
      } catch {}
    })
    await gotoSandbox(page)
    await waitForPanel(page)

    const outDir = path.join(process.cwd(), 'docs/evidence/ui-pack')
    await mkdir(outDir, { recursive: true })

    // Assert BEFORE the write: a blank capture must never reach the pack.
    await assertSurfacePainted(page, 'desktop')
    const desktopPath = path.join(outDir, 'screenshot.desktop.png')
    await page.screenshot({ path: desktopPath, fullPage: false })
    await assertCaptureWritten(desktopPath, 'desktop')

    const mobile = await browser.newContext({ viewport: { width: 480, height: 800 }, deviceScaleFactor: 2 })
    try {
      const m = await mobile.newPage()
      await installFakeEventSource(m as any)
      await m.addInitScript(() => {
        try {
          localStorage.setItem('feature.sseStreaming', '1')
          localStorage.setItem('feature.listView', '1')
          ;(window as any).__E2E = 1
        } catch {}
      })
      await gotoSandbox(m as any)
      await waitForPanel(m as any)

      // The mobile capture is its own artefact in the pack and gets its own
      // guard — the desktop one proves nothing about a <=480px layout.
      await assertSurfacePainted(m, 'mobile<=480px')
      const mobilePath = path.join(outDir, 'screenshot.mobile.png')
      await m.screenshot({ path: mobilePath, fullPage: false })
      await assertCaptureWritten(mobilePath, 'mobile<=480px')
    } finally {
      await mobile.close()
    }
  })
})
