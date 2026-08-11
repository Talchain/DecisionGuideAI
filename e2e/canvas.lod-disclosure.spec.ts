/**
 * REAL-BROWSER WITNESS — "Fit to view" must not leave the user with silently
 * blank labels. (Link-track round 2, item 4b.)
 *
 * WHY THIS IS AN e2e SPEC AND NOT A jsdom ONE. The claim is about LEGIBILITY at
 * a chosen zoom, and jsdom has no layout: `visibility: hidden` and a perfectly
 * readable label are the same thing to it (CLAUDE.md trap 3). Every number below
 * is read out of real Chromium — the viewport transform, and
 * `getComputedStyle(...).visibility` on the node titles a user is looking at.
 *
 * WHAT THE FIRST RUN OF THIS SPEC ESTABLISHED, before anything was changed.
 * The product's own "Customer Data Platform Selection" example (19 nodes), the
 * real "Fit to view" control:
 *
 *   viewport      fit zoom   titles hidden   LOD   disclosed?
 *   1920x1080      0.802         0 / 19      off      —
 *   1440x900       0.668         0 / 19      off      —
 *   1280x800       0.595         0 / 19      off      —
 *   1024x768       0.543         0 / 19      off      —
 *   834x1112       0.344        17 / 19      ON      **no**
 *
 * Two things follow, and both mattered to the fix:
 *   1. The reported "18 of 20 labels blank" is REAL but VIEWPORT-CONDITIONAL —
 *      it does not reproduce at a desktop width, which is why it read as
 *      intermittent. A laptop with the AI panel and inspector open has the same
 *      narrow canvas as the 834px column.
 *   2. The product disclosed the state at ZERO of five viewports.
 *
 * The fix is (2), not (1): `src/canvas/utils/zoomLegibility.ts` carries a
 * reasoned doctrine that explicit user gestures stay unfloored and that the
 * label-less view is "the honest, intended rendering". Flooring the fit would
 * crop the model the user just asked to see whole — a worse lie. So the canvas
 * now says which view you are in.
 *
 * The viewport list is the assertion's discriminator: a notice that always
 * rendered would satisfy the 834px case while measuring nothing, so the four
 * legible viewports must show NO notice.
 */
import { test, expect, type Page } from '@playwright/test'

const EXAMPLE = 'Customer Data Platform Selection'

const VIEWPORTS = [
  { width: 1920, height: 1080, note: 'large desktop', expectLod: false },
  { width: 1440, height: 900, note: 'MacBook Pro 14', expectLod: false },
  { width: 1280, height: 800, note: 'common laptop', expectLod: false },
  { width: 1024, height: 768, note: 'small laptop / split screen', expectLod: false },
  { width: 834, height: 1112, note: 'narrow canvas — panels open, or tablet', expectLod: true },
] as const

const readZoom = (page: Page) =>
  page.evaluate(() => {
    const vp = document.querySelector('.react-flow__viewport')
    return vp ? new DOMMatrixReadOnly(getComputedStyle(vp).transform).a : null
  })

/**
 * ⚠ WAIT FOR THE CAMERA TO STOP MOVING, OR THIS SPEC MEASURES THE WRONG FIT.
 *
 * `useFitViewOnLayoutVersion` runs its OWN fit whenever `layoutVersion` bumps,
 * and that one IS floored at `LABEL_LEGIBLE_ZOOM`. ELK layout settles
 * asynchronously after the example loads, so a spec that clicks "Fit to view"
 * too early gets its gesture overwritten by the floored auto-fit moments later.
 *
 * That is not a hypothesis — it is what the first version of this file did. It
 * reported **0.5 exactly** at both 1024px and 834px and passed all five cases.
 * `0.5` is `LABEL_LEGIBLE_ZOOM` to the digit, and the manual fit never passes a
 * `minZoom`, so the only thing that can produce it is the auto-fit. The spec was
 * green while measuring a camera move the user never made — and the same graph
 * measured with a proper settle lands at 0.344 with 17 of 19 titles hidden.
 * A suspiciously round number is evidence about your instrument (trap 20).
 */
async function waitForCameraToSettle(page: Page): Promise<void> {
  let last: number | null = null
  for (let i = 0; i < 40; i++) {
    const z = await readZoom(page)
    if (last !== null && z !== null && Math.abs(z - last) < 1e-6) return
    last = z
    await page.waitForTimeout(400)
  }
}

async function measureAfterFit(page: Page) {
  return page.evaluate(() => {
    const vp = document.querySelector('.react-flow__viewport')
    const zoom = vp ? new DOMMatrixReadOnly(getComputedStyle(vp).transform).a : null
    const titles = Array.from(document.querySelectorAll('[data-testid="node-title"]'))
    const hiddenTitles = titles.filter((e) => getComputedStyle(e as HTMLElement).visibility === 'hidden').length
    return {
      zoom,
      titles: titles.length,
      hiddenTitles,
      noticePresent: !!document.querySelector('[data-testid="canvas-lod-notice"]'),
    }
  })
}

for (const v of VIEWPORTS) {
  test(`fit to view at ${v.width}x${v.height} (${v.note}) — labels are legible, or the canvas says they are not`, async ({ page }) => {
    await page.setViewportSize({ width: v.width, height: v.height })

    await page.addInitScript(() => {
      // Match the deployed flag posture (`netlify.toml` sets this true on
      // staging) so the canvas this spec measures is the canvas users get.
      try { localStorage.setItem('feature.aiPanelV2', 'true') } catch { /* storage-less context */ }
    })

    await page.goto('/#/canvas')
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 30_000 })

    // A real, product-shipped 19-node model — not a fixture this spec authored.
    // A self-authored graph would encode the author's idea of a decision model
    // rather than the product's (CLAUDE.md trap 16-inverse).
    await page.getByText(EXAMPLE, { exact: false }).first().click()
    await expect(page.locator('[data-testid="node-title"]').first()).toBeVisible({ timeout: 30_000 })

    // Let the layout-driven auto-fit finish BEFORE the gesture, so what we
    // measure is the gesture.
    await waitForCameraToSettle(page)
    const zoomBeforeGesture = await readZoom(page)

    await page.getByRole('button', { name: /fit to view/i }).first().click()
    await waitForCameraToSettle(page)

    const m = await measureAfterFit(page)
    // eslint-disable-next-line no-console
    console.log(`[fit ${v.width}x${v.height}] settled-before=${zoomBeforeGesture} after-gesture=${m.zoom}`)
    // eslint-disable-next-line no-console
    console.log(`[fit ${v.width}x${v.height}] zoom=${m.zoom} hiddenTitles=${m.hiddenTitles}/${m.titles} notice=${m.noticePresent}`)

    expect(m.titles, 'the example must render node titles, or this measures nothing').toBeGreaterThan(0)

    // THE PROPERTY, bound to the measurement rather than to a fixed expectation
    // about zoom: blank labels are allowed (that is the ratified doctrine), and
    // silence about them is not.
    if (m.hiddenTitles > 0) {
      expect(
        m.noticePresent,
        `${m.hiddenTitles} of ${m.titles} node titles are computed visibility:hidden at zoom ${m.zoom} and the ` +
          'canvas said nothing — a screen of blank rectangles is indistinguishable from a broken render',
      ).toBe(true)
    } else {
      expect(
        m.noticePresent,
        'the canvas claimed labels were hidden while every one of them is rendering — a notice that is always on ' +
          'is a notice the user learns to ignore',
      ).toBe(false)
    }
  })
}
