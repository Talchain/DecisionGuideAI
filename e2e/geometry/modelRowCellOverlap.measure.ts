/**
 * DO TWO ATOMS IN A MODEL ROW EVER DRAW ON TOP OF EACH OTHER?
 *
 * Paul, 21 Sep, from a manual test: *"The advanced view is a bit of a mess ...
 * This needs to be a premium UI."* The screenshots carry the symptom directly —
 * `"Ren£20,000"` on the Advanced-tier goal row, which is the word **Rename**
 * drawn through the value.
 *
 * ⛔ JSDOM PERFORMS NO LAYOUT, so no unit test in this repo can see this. Every
 * number below comes from `getBoundingClientRect()` in a real Chromium, which is
 * the same instrument `edgeLabelOverlap.measure.ts` uses for the same question
 * one surface along.
 *
 * ## What it asserts, and what it deliberately does not
 *
 * ONE invariant: no two of a row's own atoms intersect. It says nothing about
 * truncation, ellipsis or which atom ought to yield — that is a design decision
 * and it is Paul's, not this file's. The invariant is what any chosen answer
 * has to satisfy, so it is worth pinning before the answer is picked.
 *
 * ## The controls, because a zero here is worthless without them
 *
 * 1. VACUITY. Rows mounted, and atoms-per-row, are asserted non-zero first. A
 *    measure that opened no groups would read "0 overlapping pairs" and look
 *    like a pass — which is exactly how `modelRowEditReflow` went red when the
 *    outline began mounting closed.
 * 2. POSITIVE CONTROL. Two boxes are injected into a mounted row at known,
 *    deliberately intersecting coordinates and the detector must find that pair
 *    and no other. A probe that reports nothing because its selector matches
 *    nothing is byte-identical to a clean surface (trap: "a positive control
 *    proves the probe sees something, never everything").
 * 3. BOTH TIERS. Plain and Advanced are measured separately, so a difference is
 *    attributable to the tier rather than to the dock width.
 *
 * ## THE READING, 21 Sep 2026, 280px dock, 38 rows
 *
 *     tier      atoms   overlapping pairs
 *     plain      190          33
 *     advanced   209          45
 *
 * ⛔⛔ AND IT CORRECTS THE BRIEF IT WAS WRITTEN FOR. Paul's complaint names the
 * ADVANCED view, and the Advanced tier is indeed worse — but **33 of the 45 are
 * present on PLAIN too**. The mess is the row at the dock floor, not the tier.
 * The dominant classes are `value x confirm-as-is` and `rename-start x value`,
 * and both render in Plain. Attributing this to Advanced would have sent a fix
 * to the wrong surface.
 *
 * Controlled experiment below, present -> hidden -> present: **45 -> 33 -> 45**.
 * The Advanced id atom accounts for 12 pairs — 6 it is directly part of, and 6
 * more that stop colliding once its 16.94px is returned to the row. Shedding the
 * debug token is therefore real but PARTIAL (-27%), and it is not a fix.
 *
 * ## ⚠ WHY NO FIX SHIPS WITH THIS MEASURE
 *
 * The residual 33 are the `min-w-[6rem]` value floor meeting the row's controls
 * in a 280px track. That floor is LOAD-BEARING, measured on the live build in an
 * earlier pass: removing it crushed 24 labels to a 26px render. So something has
 * to shed at the floor, and choosing WHICH content disappears is a design
 * decision, not a defect fix. This file pins the invariant that any chosen
 * answer must satisfy, and stops there.
 */
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  openCanvas, preparePage, seedStarterDraft, clearNotifications,
  minimiseFloatingOlumiPanel, freezeMotion, waitForVisualQuiescence,
} from '../visual/harness'

const STARTER = (process.env.STARTER ?? 'build-vs-buy') as 'build-vs-buy'
const VP = { width: 1280, height: 900 }

/**
 * The dock FLOOR only. `modelRowEditReflow` measures 280 and 416 because it is
 * asking a wrapping question, where the wide arm discriminates. Overlap is a
 * floor question: if the atoms fit at 280 they fit at 416, and running the wide
 * arm would double the wall-clock to re-prove the easy case.
 */
const DOCK = Number(process.env.DOCK_PX ?? 280)

/** Sub-pixel: anti-aliased boxes routinely share a hairline without colliding. */
const EPSILON_PX = 0.5

type Tier = 'plain' | 'advanced'

interface Pair { readonly row: string; readonly a: string; readonly b: string; readonly overlapX: number; readonly overlapY: number }
interface Reading { readonly rows: number; readonly atoms: number; readonly pairs: readonly Pair[]; readonly viewport: { w: number; h: number } }

async function mountModelTab(page: Page, tier: Tier): Promise<void> {
  await preparePage(page, VP)
  await page.addInitScript((w) => {
    try { localStorage.setItem('panel.results.width', String(w)) } catch { /* asserted by the dock read below */ }
  }, DOCK)

  await openCanvas(page)
  const seeded = await seedStarterDraft(page, STARTER)
  expect(seeded.nodeCount, `${STARTER} seeded no nodes — the fixture is missing or drifted`).toBeGreaterThan(0)

  await clearNotifications(page)
  await minimiseFloatingOlumiPanel(page)
  await freezeMotion(page)

  await page.click('[data-testid="outputs-dock-tab-diagnostics"]')
  await page.waitForSelector('[data-testid="model-outline-v2"]', { timeout: 20_000 })

  // ⚠ THE TIER IS SET BEFORE THE GROUPS OPEN. Advanced mounts an extra atom per
  // row; opening first and switching after would measure rows that had already
  // laid out without it.
  await page.click(`[data-testid="model-tab-v2-tier-${tier}"]`)
  await expect(page.locator(`[data-testid="model-tab-v2-tier-${tier}"]`)).toHaveAttribute('aria-pressed', 'true')

  // Open every group. Iterating a fixed count rather than re-querying a live
  // list, so a toggle that refuses to open cannot spin this forever.
  const toggles = page.locator('[data-testid^="model-group-v2-"][data-testid$="-toggle"]')
  const count = await toggles.count()
  expect(count, 'no outline groups found — the model tab did not mount').toBeGreaterThan(0)
  for (let i = 0; i < count; i++) {
    const t = toggles.nth(i)
    if ((await t.getAttribute('aria-expanded')) === 'false') await t.click()
  }
  await waitForVisualQuiescence(page)
}

/**
 * Every pair of a row's OWN atoms that intersect.
 *
 * ⚠ AN ATOM IS A `model-row-v2-<rowid>-<part>` TESTID, never "any descendant".
 * Nesting makes containment universal — a parent always intersects its child —
 * so a naive descendant sweep reports a screenful of overlaps and measures the
 * DOM's shape rather than the layout's. Ancestor pairs are dropped for exactly
 * that reason, and only for that reason.
 */
async function readOverlaps(page: Page, eps: number): Promise<Reading> {
  return page.evaluate((EPS) => {
    // ⚠ THE ROW CONTAINER HAS NO SUFFIX — it is `model-row-v2-<id>`, and every
    // atom inside it shares that prefix. So a row is derived structurally: a
    // prefixed element with no prefixed ancestor. Selecting on a `-row` suffix
    // read ZERO rows, which the vacuity control caught on the first run.
    const prefixed = Array.from(document.querySelectorAll('[data-testid^="model-row-v2-"]'))
    const rows = prefixed.filter((el) => {
      const parent = el.parentElement?.closest('[data-testid^="model-row-v2-"]')
      return parent === null || parent === undefined
    })
    const pairs: { row: string; a: string; b: string; overlapX: number; overlapY: number }[] = []
    let atoms = 0
    for (const row of rows) {
      const rowId = row.getAttribute('data-testid') ?? '?'
      const cells = Array.from(row.querySelectorAll('[data-testid]')).filter((el) => {
        if (!(el instanceof HTMLElement)) return false
        const r = el.getBoundingClientRect()
        // Zero-area and display:none atoms cannot collide with anything.
        return r.width > 0 && r.height > 0
      }) as HTMLElement[]
      atoms += cells.length
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          const A = cells[i]; const B = cells[j]
          if (A.contains(B) || B.contains(A)) continue
          const a = A.getBoundingClientRect(); const b = B.getBoundingClientRect()
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          if (ox > EPS && oy > EPS) {
            pairs.push({
              row: rowId,
              a: A.getAttribute('data-testid') ?? '?',
              b: B.getAttribute('data-testid') ?? '?',
              overlapX: Math.round(ox * 100) / 100,
              overlapY: Math.round(oy * 100) / 100,
            })
          }
        }
      }
    }
    return { rows: rows.length, atoms, pairs, viewport: { w: window.innerWidth, h: window.innerHeight } }
  }, eps)
}

test.describe('model row cell overlap', () => {
  /**
   * ⚠ NOT CARRYING `GATE_TAG`, and that is a decision rather than an oversight.
   * `canvasGateSet.ts` admits a new arm only on evidence it does not have yet —
   * *"show it GREEN at the base, twice"* — and this arm is expected RED at the
   * base on the Advanced tier, which is the whole reason it was written. It is
   * registered in `DELIBERATE_EXCLUSIONS` until the shedding decision lands.
   */
  for (const tier of ['plain', 'advanced'] as const) {
    test(`MODEL ROW CELL OVERLAP @dock ${DOCK}px tier=${tier}`, async ({ page }) => {
      await mountModelTab(page, tier)
      const reading = await readOverlaps(page, EPSILON_PX)

      // ── VACUITY CONTROL ──────────────────────────────────────────────────
      /**
       * ⛔⛔ THE VIEWPORT FIRST, AND THIS ONE COST A RETRACTED FINDING.
       *
       * 21 Sep 2026: I measured this surface through a browser pane reporting
       * `innerWidth = 0`. A 0x0 viewport makes the whole layout degenerate —
       * `getBoundingClientRect()` still returns numbers, the dock still reported
       * a plausible 361px, and the probe returned **0 overlapping pairs** on a
       * model the harness reads 8 for. Nothing in that output said "this is not
       * a rendered page", so I published it as a correction to a TRUE finding
       * and took a real defect off the board with an argument attached.
       *
       * A layout measurement's first vacuity control is its own viewport. Rows
       * and atoms being non-zero does not cover it: both were correct (36/189)
       * in the degenerate reading.
       */
      expect(
        Math.min(reading.viewport.w, reading.viewport.h),
        `viewport is ${reading.viewport.w}x${reading.viewport.h} — a degenerate layout cannot be measured`,
      ).toBeGreaterThan(0)
      expect(reading.rows, 'no rows mounted — a zero overlap count would be vacuous').toBeGreaterThan(0)
      expect(reading.atoms, 'rows mounted but no atoms inside them — the selector is wrong').toBeGreaterThan(reading.rows)

      // ── POSITIVE CONTROL ─────────────────────────────────────────────────
      // Two boxes at known intersecting coordinates inside a real mounted row.
      const injected = await page.evaluate(() => {
        const row = document.querySelector('[data-testid^="model-row-v2-"]')
        if (!(row instanceof HTMLElement)) return false
        const mk = (id: string, left: number) => {
          const d = document.createElement('div')
          d.setAttribute('data-testid', id)
          d.style.cssText = `position:fixed;top:400px;left:${left}px;width:60px;height:20px;`
          row.appendChild(d)
        }
        mk('overlap-probe-a', 100)
        mk('overlap-probe-b', 130) // 30px of intersection, both axes
        return true
      })
      expect(injected, 'could not inject the positive control').toBe(true)
      const withProbe = await readOverlaps(page, EPSILON_PX)
      const probePair = withProbe.pairs.find(
        (p) => [p.a, p.b].includes('overlap-probe-a') && [p.a, p.b].includes('overlap-probe-b'),
      )
      expect(probePair, 'the detector did not see a deliberately overlapped pair — it cannot see anything').toBeTruthy()
      expect(probePair?.overlapX, 'the detector read the wrong magnitude').toBeCloseTo(30, 0)
      await page.evaluate(() => {
        for (const id of ['overlap-probe-a', 'overlap-probe-b']) document.querySelector(`[data-testid="${id}"]`)?.remove()
      })

      // ── THE READING ──────────────────────────────────────────────────────
      const report = reading.pairs
        .map((p) => `      ${p.row}: ${p.a} x ${p.b}  (${p.overlapX} x ${p.overlapY}px)`)
        .join('\n')
      console.log(
        `MODELROWOVERLAP ${JSON.stringify({ tier, dock: DOCK, rows: reading.rows, atoms: reading.atoms, overlappingPairs: reading.pairs.length })}` +
        (report ? `\n${report}` : ''),
      )

      expect(
        reading.pairs.length,
        `atoms drawing on top of each other at a ${DOCK}px dock, tier=${tier}:\n${report}`,
      ).toBe(0)
    })
  }

  /**
   * ⭐ THE CONTROLLED EXPERIMENT — attribute the Advanced tier's EXTRA collisions
   * to a cause rather than inferring one from the CSS.
   *
   * Advanced differs from Plain by exactly one atom per row: `-id`, the raw node
   * token. `ModelRowView` already calls it *"an Advanced-tier debug token, last
   * in the yield ladder"* — i.e. the estate has ALREADY ruled what should shed
   * first here. This measures whether shedding it is sufficient.
   *
   * ⚠ THE ATOM IS HIDDEN AT RUNTIME, NOT DELETED FROM THE SOURCE. The question
   * is whether the id CAUSES the extra pairs, and a source edit would change the
   * build as well as the layout. `display:none` removes it from layout and from
   * this detector's zero-area filter in one act.
   */
  test(`CONTROLLED EXPERIMENT: the Advanced id atom, present -> hidden -> present @dock ${DOCK}px`, async ({ page }) => {
    await mountModelTab(page, 'advanced')

    const before = await readOverlaps(page, EPSILON_PX)
    expect(before.rows, 'vacuity: no rows mounted').toBeGreaterThan(0)
    const idPairsBefore = before.pairs.filter((p) => p.a.endsWith('-id') || p.b.endsWith('-id')).length
    expect(idPairsBefore, 'precondition: the id atom is colliding at the base, or there is nothing to attribute').toBeGreaterThan(0)

    const hide = async (on: boolean) => {
      await page.evaluate((hidden) => {
        const ID = 'overlap-experiment-style'
        document.getElementById(ID)?.remove()
        if (!hidden) return
        const st = document.createElement('style')
        st.id = ID
        st.textContent = '[data-testid$="-id"]{display:none !important}'
        document.head.appendChild(st)
      }, on)
      await waitForVisualQuiescence(page)
    }

    await hide(true)
    const hidden = await readOverlaps(page, EPSILON_PX)

    await hide(false)
    const after = await readOverlaps(page, EPSILON_PX)

    console.log(`MODELROWOVERLAP_EXPERIMENT ${JSON.stringify({
      dock: DOCK,
      present: before.pairs.length,
      hidden: hidden.pairs.length,
      restored: after.pairs.length,
      idPairsPresent: idPairsBefore,
      idPairsHidden: hidden.pairs.filter((p) => p.a.endsWith('-id') || p.b.endsWith('-id')).length,
      residualWhenHidden: hidden.pairs.length,
    })}`)

    // ⚠ THE RESTORE IS THE HALF THAT MAKES IT AN EXPERIMENT. Without it, a drop
    // could be anything that happened between the two reads.
    expect(after.pairs.length, 'the reading did not restore — the delta is not attributable to the id').toBe(before.pairs.length)
    expect(hidden.pairs.length, 'hiding the id did not reduce the collisions at all').toBeLessThan(before.pairs.length)
  })
})
