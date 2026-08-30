/**
 * ANALYSIS (NEW) HOLDS ITS LAYOUT AT EVERY DOCK WIDTH THE SHELL CAN PRODUCE.
 *
 * WHY THIS EXISTS
 * ---------------
 * `ANALYSIS-NEW-HANDOVER-2026-08-28.md` §6.4 records the gap in its own words:
 * "**Zero visual-regression and zero e2e coverage** for `analysisNew`." The
 * surface shipped ungated to every user with no instrument that renders it.
 *
 * WHY THIS IS AN ASSERTION SPEC AND NOT A PIXEL REFERENCE — and the reasoning
 * matters more than the choice. The same §6.4 records that the pixel harness is
 * "self-declaring as unreliable" on staging, with a measured noise floor of
 * 0.0425 against a 0.0005 tolerance, so its output is untrustworthy IN BOTH
 * DIRECTIONS. Adding a reference capture here would have added coverage to a
 * broken instrument and reported it as coverage. These assertions are
 * deterministic and independent of that harness: they measure geometry the
 * browser computed, not pixels a comparator diffed.
 *
 * WHAT IT ASSERTS
 * ---------------
 *  1. The tab MOUNTS. `AnalysisNewTabBody` is the only thing that paints
 *     `analysis-new-tab-body`, so this fails loud if a flag or a refactor
 *     stops mounting the surface rather than silently measuring another
 *     screen (traps 3b and 19).
 *  2. NOTHING IS HORIZONTALLY CLIPPED. Same predicate as
 *     `nodeTextClipping.visual.spec.ts`, carried onto the dock: a text leaf
 *     whose `scrollWidth` exceeds its `clientWidth` is hiding characters.
 *  3. NOTHING OVERFLOWS THE DOCK. A child wider than its container is the
 *     defect a 280px dock produces and a 416px dock hides.
 *  4. The EXISTING Analysis tab is untouched by any of this — Paul's hard
 *     constraint on the whole experiment, asserted rather than assumed.
 *
 * THE WIDTHS ARE DERIVED, NOT CHOSEN. `dockWidth.ts` makes the dock responsive
 * between DOCK_MIN_WIDTH 280 and DOCK_RESPONSIVE_MAX_WIDTH 416, with a
 * persisted user drag overriding both up to 480. 280 is where text runs out of
 * room, so it is the width that finds defects.
 *
 * ⚠ STATE CLASS: this is the PRE-RUN state. The harness is hermetic (its dev
 * server points every service at the discard port), so no analysed model is
 * reachable from it and the populated states are NOT covered here. That is a
 * named gap, not a silent one — see the assertion on `analysis-new-status-pre-run`,
 * which pins WHICH state was measured so a future reader cannot mistake this
 * for coverage of the analysed surface.
 */

import { test, expect, type Page } from '@playwright/test'
import {
  preparePage, openCanvas, seedStarterDraft, clearNotifications,
  freezeMotion, waitForVisualQuiescence, VIEWPORTS,
} from './harness'

/** Derived from `dockWidth.ts`: min, responsive max, drag ceiling. */
const DOCK_WIDTHS = [280, 416, 480] as const

interface Overflow { tag: string; testid: string; text: string; visible: number; needed: number }

async function scanDock(page: Page) {
  return page.evaluate(() => {
    const dock = document.querySelector('[data-testid="outputs-dock"]') as HTMLElement | null
    if (!dock) return { dockFound: false, controlSeen: false, clipped: [] as Overflow[], wider: [] as Overflow[] }
    const dockRight = dock.getBoundingClientRect().right

    const scan = () => {
      const clipped: Overflow[] = []
      const wider: Overflow[] = []
      for (const el of dock.querySelectorAll('*')) {
        const he = el as HTMLElement
        const r = he.getBoundingClientRect()
        if (r.width < 4 || r.height < 4) continue
        const cs = getComputedStyle(he)
        if (cs.visibility === 'hidden' || cs.display === 'none') continue
        const rec = {
          tag: he.tagName.toLowerCase(),
          testid: he.getAttribute('data-testid') ?? '',
          text: (he.textContent ?? '').trim().slice(0, 70),
          visible: Math.round(he.clientWidth),
          needed: Math.round(he.scrollWidth),
        }
        // (3) escapes the dock's right edge — 1px for sub-pixel rounding
        if (r.right > dockRight + 1) wider.push(rec)
        // (2) clipped text leaf
        if (/auto|scroll/.test(cs.overflowX + cs.overflowY)) continue
        const txt = (he.textContent ?? '').trim()
        if (!txt) continue
        if ([...he.children].some(c => (c.textContent ?? '').trim())) continue
        if (he.scrollWidth - he.clientWidth > 1) clipped.push(rec)
      }
      return { clipped, wider }
    }

    // POSITIVE CONTROL. Without it, a scan that matched nothing — a renamed
    // testid, a surface that stopped mounting — reports a clean pass for every
    // width, which is a guard agreeing with itself.
    const probe = document.createElement('div')
    probe.textContent = 'ZZZ_DOCK_CLIP_CONTROL_THIS_STRING_IS_FAR_TOO_LONG_TO_FIT'
    probe.style.cssText = 'width:24px;height:16px;overflow:hidden;white-space:nowrap'
    dock.appendChild(probe)
    const controlSeen = scan().clipped.some(c => c.text.includes('ZZZ_DOCK_CLIP_CONTROL'))
    probe.remove()

    return { dockFound: true, controlSeen, ...scan() }
  })
}

const report = (rows: Overflow[]) =>
  rows.map(r => `    ${r.visible}/${r.needed}px  <${r.tag} ${r.testid}>  "${r.text}"`).join('\n')

test.describe('Analysis (New) holds its layout', () => {
  for (const width of DOCK_WIDTHS) {
    test(`no clipped or overflowing content at dock ${width}px [${VIEWPORTS[0].name}]`, async ({ page }) => {
      await preparePage(page, VIEWPORTS[0])
      await openCanvas(page)
      await seedStarterDraft(page, 'build-vs-buy')
      await clearNotifications(page)

      // Set the dock width through the store the shell itself reads, so this
      // exercises the real responsive path rather than a CSS override.
      await page.evaluate((w) => {
        const win = window as unknown as { useUIStore?: { getState: () => Record<string, unknown> } }
        const s = win.useUIStore?.getState() as { setDockWidth?: (n: number) => void } | undefined
        s?.setDockWidth?.(w)
      }, width)

      const tab = page.getByTestId('outputs-dock-tab-analysisNew')
      await expect(tab, 'the Analysis (New) tab is not mounted — nothing was measured').toBeVisible({ timeout: 20_000 })
      await tab.click()

      const body = page.getByTestId('analysis-new-tab-body')
      await expect(body, 'the tab did not mount its body').toBeVisible({ timeout: 20_000 })

      // PIN THE STATE CLASS IN-TEST. A seeded draft with no analysis is the
      // PRE-RUN surface; if this ever stops being pre-run, these results are
      // about a different screen and must not be read as this one's.
      await expect(
        page.getByTestId('analysis-new-status-pre-run'),
        'expected the PRE-RUN state — this spec makes no claim about the analysed surface',
      ).toBeVisible()

      await freezeMotion(page)
      await waitForVisualQuiescence(page)

      const res = await scanDock(page)
      expect(res.dockFound, 'no outputs dock in the DOM').toBe(true)
      expect(
        res.controlSeen,
        'the positive control was NOT detected — the scan cannot see a clipped element, so a clean result means nothing',
      ).toBe(true)

      expect(res.clipped, `text is clipped in Analysis (New) at dock ${width}px:\n${report(res.clipped)}`).toEqual([])
      expect(res.wider, `content escapes the dock's right edge at ${width}px:\n${report(res.wider)}`).toEqual([])
    })
  }

  test('switching to Analysis (New) leaves the existing Analysis tab mounted and intact', async ({ page }) => {
    // Paul's hard constraint on the experiment: "Do not edit, replace, delete,
    // rename or behaviourally change the existing Analysis tab in any way."
    await preparePage(page, VIEWPORTS[0])
    await openCanvas(page)
    await seedStarterDraft(page, 'build-vs-buy')
    await clearNotifications(page)

    const existing = page.getByTestId('outputs-dock-tab-results')
    await expect(existing).toBeVisible({ timeout: 20_000 })
    const labelBefore = (await existing.textContent())?.trim()

    await page.getByTestId('outputs-dock-tab-analysisNew').click()
    await expect(page.getByTestId('analysis-new-tab-body')).toBeVisible()

    await expect(existing, 'the existing Analysis tab stopped being reachable').toBeVisible()
    expect((await existing.textContent())?.trim(), 'the existing Analysis tab was renamed').toBe(labelBefore)

    await existing.click()
    await expect(
      page.getByTestId('analysis-new-tab-body'),
      'Analysis (New) content survived switching back to Analysis',
    ).toBeHidden()
  })
})
