/**
 * MODEL ROW — ENTERING EDIT MUST NOT MOVE THE LAYOUT.
 *
 * ⚠ WHY THIS EXISTS, AND WHY IT IS A BROWSER TEST.
 *
 * PR #1179 migrated the Model tab onto the panel type scale. The row's IDLE
 * value moved 14px `tabular` -> 12px `panelTabular`; its EDIT input stayed at
 * 14px `tabular`, because DS v5 §2.1 makes 14px the minimum accessible size for
 * a text field and a 12px field at the 280px dock floor is a usability
 * regression (that was itself a blocking review finding, F1).
 *
 * Both decisions are right. Together they mean clicking a value swaps a 12px
 * line box for a 14px input — on the exact datum the PR exists to align into a
 * column. Whether that MOVES anything is a layout question, and:
 *
 *   - `rowAtomsDoNotWrap.spec.tsx:88` says outright "jsdom performs no layout";
 *   - every other spec on this PR asserts className MEMBERSHIP.
 *
 * So the whole existing suite is structurally incapable of observing it, and it
 * passed green while the reflow was live. A className assertion here would be
 * vacuous for the same reason — this measures RENDERED GEOMETRY or it measures
 * nothing.
 *
 * WHAT IS MEASURED, and why these two numbers rather than "the row looks fine":
 *   1. the edited row's own height, and
 *   2. the TOP of the row BELOW it.
 * (1) alone can hide the defect: a row that grows inside a fixed-height
 * container moves nothing. (2) alone can hide it too: a row can grow while the
 * next row is clipped rather than pushed. A reflow the user notices has to move
 * one of the two, so both are asserted.
 *
 * POSITIVE CONTROL, in-test: before asserting the absence of movement, we
 * assert the edit actually HAPPENED (the input exists and is focused). An
 * absence probe that never entered edit mode reports a perfectly still layout
 * for the excellent reason that nothing changed — CLAUDE.md trap 13.
 */
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  openCanvas, preparePage, seedStarterDraft, clearNotifications,
  minimiseFloatingOlumiPanel, freezeMotion, waitForVisualQuiescence,
} from '../visual/harness'

const STARTER = 'build-vs-buy' as const
const VP = { width: 1280, height: 900 }

/** The dock floor, and a width a user would actually sit at. */
const WIDTHS = [280, 416] as const

interface Geom {
  readonly testid: string
  readonly rowHeight: number
  readonly nextRowTop: number
  readonly valueTop: number
  readonly valueFontPx: number
}

async function readGeometry(page: Page, rowId: string): Promise<Geom | null> {
  return page.evaluate((id) => {
    const row = document.querySelector(`[data-testid="model-row-v2-${id}"]`)
    if (!(row instanceof HTMLElement)) return null
    const value = document.querySelector(`[data-testid="model-row-v2-${id}-value"]`)
    // The next SIBLING row, whatever its id — the thing that would be pushed.
    let next: Element | null = row.nextElementSibling
    while (next && !(next instanceof HTMLElement)) next = next.nextElementSibling
    const sized = value instanceof HTMLElement
      ? (value.querySelector('input') ?? value)
      : null
    return {
      testid: `model-row-v2-${id}`,
      rowHeight: Math.round(row.getBoundingClientRect().height * 100) / 100,
      nextRowTop: next instanceof HTMLElement
        ? Math.round(next.getBoundingClientRect().top * 100) / 100
        : -1,
      // ⚠ WITHOUT THIS, "the row did not move" can hide "the text jumped inside
      // a row whose height happens to be reserved". The reserved-height fix is
      // exactly the change that could introduce that, so the assertion that
      // proves the fix must also be able to catch the fix's own failure mode.
      valueTop: value instanceof HTMLElement
        ? Math.round(value.getBoundingClientRect().top * 100) / 100
        : -1,
      valueFontPx: sized
        ? parseFloat(getComputedStyle(sized).fontSize)
        : -1,
    }
  }, rowId)
}

for (const width of WIDTHS) {
  test(`MODEL ROW EDIT REFLOW @dock ${width}px`, async ({ page }) => {
    await preparePage(page, VP)
    await page.addInitScript((w) => {
      try { localStorage.setItem('panel.results.width', String(w)) } catch { /* asserted below */ }
    }, width)

    await openCanvas(page)
    const seeded = await seedStarterDraft(page, STARTER)
    expect(seeded.nodeCount, 'build-vs-buy is 19 nodes; a different count means the fixture drifted').toBe(19)

    await clearNotifications(page)
    await minimiseFloatingOlumiPanel(page)
    await freezeMotion(page)

    await page.click('[data-testid="outputs-dock-tab-diagnostics"]')
    await page.waitForSelector('[data-testid="model-outline-v2"]', { timeout: 20_000 })
    await waitForVisualQuiescence(page)

    // The dock width actually took. If it did not, every number below is about
    // a width nobody asked for.
    const dockW = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="outputs-dock-tablist"]')?.closest('[style*="width"], aside, section')
      return el instanceof HTMLElement ? Math.round(el.getBoundingClientRect().width) : -1
    })

    // Find an EDITABLE row: its value cell is a <button> (the read-only arm is a
    // <span>). Binding by the element's identity, not by "the first row".
    const rowId = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[data-testid^="model-row-v2-"][data-testid$="-value"]'))
      const first = buttons[0]
      if (!(first instanceof HTMLElement)) return null
      const t = first.getAttribute('data-testid') ?? ''
      return t.replace(/^model-row-v2-/, '').replace(/-value$/, '')
    })
    expect(rowId, 'no EDITABLE row value found — the measure would assert about nothing').not.toBeNull()

    const before = await readGeometry(page, rowId as string)
    expect(before, 'row geometry unreadable before edit').not.toBeNull()

    await page.click(`[data-testid="model-row-v2-${rowId}-value"]`)

    // ── POSITIVE CONTROL ──────────────────────────────────────────────────
    // Prove the edit HAPPENED before asserting that nothing moved.
    const input = page.locator(`[data-testid="model-row-v2-${rowId}-value-input"]`)
    await expect(input, 'the click did not open an editor — a still layout here would prove nothing').toBeVisible({ timeout: 10_000 })

    const after = await readGeometry(page, rowId as string)
    expect(after, 'row geometry unreadable during edit').not.toBeNull()

    const b = before as Geom, a = after as Geom

    // The control's own discrimination: the font size MUST have changed, or
    // this test is measuring a transition that did not occur.
    expect(a.valueFontPx, 'the edit input is not 14px — F1 has regressed').toBeCloseTo(14, 1)
    expect(b.valueFontPx, 'the idle value is not 12px — the panel-scale migration has regressed').toBeCloseTo(12, 1)

    const heightDelta = Math.round((a.rowHeight - b.rowHeight) * 100) / 100
    const pushDelta = b.nextRowTop < 0 || a.nextRowTop < 0
      ? 0
      : Math.round((a.nextRowTop - b.nextRowTop) * 100) / 100
    const textDelta = b.valueTop < 0 || a.valueTop < 0
      ? 0
      : Math.round((a.valueTop - b.valueTop) * 100) / 100

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      measure: 'modelRowEditReflow', dockWidth: width, measuredDockW: dockW, rowId,
      idleFontPx: b.valueFontPx, editFontPx: a.valueFontPx,
      rowHeightBefore: b.rowHeight, rowHeightAfter: a.rowHeight, heightDelta,
      nextRowTopBefore: b.nextRowTop, nextRowTopAfter: a.nextRowTop, pushDelta,
      valueTopBefore: b.valueTop, valueTopAfter: a.valueTop, textDelta,
    }))

    expect(heightDelta, `entering edit changed the row's own height by ${heightDelta}px at a ${width}px dock`).toBe(0)
    expect(pushDelta, `entering edit moved the row below by ${pushDelta}px at a ${width}px dock`).toBe(0)
    // A reserved-height fix trades a row jump for a possible text jump. Both are
    // movement the user sees, so both are asserted.
    expect(Math.abs(textDelta), `entering edit moved the value itself by ${textDelta}px at a ${width}px dock`).toBeLessThanOrEqual(1)
  })
}
