/**
 * DO THE IN-NODE CONTROLS COVER THE CARD'S OWN CONTENT?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT THIS PINS, AND WHY NOTHING ELSE COULD SEE IT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `BaseNode` reserves a bottom band for `NodeQuickActions` by hand:
 * `padding: '12px 12px 24px 12px'`. That `24` is a MIRROR of the row's own
 * geometry — `bottom-1.5` (6px) plus `h-5` (20px) — with nothing deriving one
 * from the other and nothing going red when they disagree (CLAUDE.md trap 12).
 * It was already 2px short before anyone touched it.
 *
 * `#1274` then counter-scaled the row's box, its hit slop and its gap so the
 * targets reach 24 RENDERED px at the zoom a post-draft auto-fit parks at
 * (`LABEL_LEGIBLE_ZOOM` = 0.50, counter-scale 2). It fixed 80 of 117
 * unclickable controls and it is right. But it moved ONE HALF of a two-part
 * geometry: the row grew to `(6 + 20) x 2 = 52` CSS px while the reservation
 * stayed at a literal `24`, so the row began sitting 28px INSIDE the card's own
 * content box — over the value a user hovers the card in order to act on.
 *
 * ⭐ THIS IS INVISIBLE TO EVERY OTHER INSTRUMENT IN THE REPO.
 *   · jsdom performs no layout, so every vitest spec on these components is
 *     structurally incapable of seeing it — `getBoundingClientRect` is 0x0
 *     there, and an overlap computed from zeroes is always zero.
 *   · The Canvas Browser Gate was GREEN on `#1274`'s head (measured: 14 of 16
 *     checks success, the two failures being the standing estate-wide
 *     `Visual Regression` and `Security Audit` reds). So a real-browser gate
 *     that has layout and paint ALREADY RAN and did not discriminate this.
 *   · `Visual Regression` is red estate-wide and discriminates nothing.
 * A new browser-level assertion was therefore the only thing that could pin it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTROLS — a probe with no control proves nothing (CLAUDE.md trap 13)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ASSERTED, and each REDs the run:
 *
 *  · ZOOM HELD. The measurement is taken at `LABEL_LEGIBLE_ZOOM`, which is the
 *    WORST CASE by construction (`MAX_LABEL_COUNTER_SCALE` is reached at
 *    exactly that zoom, and it is where the product's own fit parks). A camera
 *    that drifted would measure a smaller counter-scale and under-report — so
 *    the achieved zoom is re-read and asserted, never assumed. `heightVsZoom`
 *    learned this the expensive way: it once recorded `1.2 1 0.5 0.5 0.7` for a
 *    requested `1.2 1 0.9 0.8 0.7` and computed a verdict from the wrong series.
 *
 *  · NON-VACUITY, IN BOTH LIMBS. A zero here is only meaningful if there were
 *    controls AND content that COULD have collided. So: at least
 *    `MIN_MEASURABLE_CARDS` cards must carry a quick-action row with at least
 *    one button, AND at least one painted text element outside that row. A card
 *    whose row never mounted, or whose text never rendered, reports a perfectly
 *    clean overlap for the excellent reason that there was nothing to overlap.
 *
 *  · CONTRAST CONTROL, whose expected answer DIFFERS from the target's
 *    (CLAUDE.md trap 13e — a blind instrument can fake agreement, but it cannot
 *    fake a discrimination it is not making). The same intersector that must
 *    return ZERO for control-over-text is required to return NON-ZERO for
 *    control-over-its-own-card, on every measured card. The row is inside the
 *    card by construction, so an intersector that had silently started
 *    returning 0 — a wrong rect source, a unit slip, an empty selector — fails
 *    HERE while the headline assertion sails through.
 *
 *  · THE ROW IS A REAL, REVEALED CONTROL. `NodeQuickActions` is `opacity-0` at
 *    rest, so an assertion about it is an assertion about something the user
 *    may never meet. Hovering a card must take its row's computed opacity to 1
 *    — asserted, so this file cannot quietly become a test about an invisible
 *    element. (Geometry is opacity-independent: `getBoundingClientRect` returns
 *    the same box either way, which is why the census below is taken at rest
 *    and is nonetheless a claim about the hovered state too.)
 *
 *  · NO JUMP ON HOVER. The card's own border box must be IDENTICAL before and
 *    after hover, to sub-pixel. This is the third requirement of the brief and
 *    it is also this fix's own failure mode: a reservation that appeared only
 *    on hover would clear the occlusion by moving the thing the user is aiming
 *    at, which is worse than the defect.
 *
 * NOT ASSERTED, stated rather than hidden: the covered AREA in px^2 is emitted
 * for a human and no `expect` requires a particular figure. The verdict is the
 * COUNT of covered text elements, because an area threshold is a number someone
 * would eventually tune, and "no control covers content" is not a budget.
 *
 * ⚠ THE AREA FIGURE OVER-COUNTS NESTED TEXT, ON PURPOSE. It sums
 * (control x text-element) intersections, and `<p>a <span>b</span></p>` yields
 * two text-bearing elements whose boxes overlap. That inflation cannot change
 * the verdict — zero pairs is zero pairs — and de-duplicating it would mean
 * building a polygon union, i.e. a second geometry authority to maintain for a
 * number nothing asserts.
 *
 * Run: pnpm exec playwright test -c playwright.geometry.config.ts nodeControlOcclusion
 */
import { test, expect, type Page } from '@playwright/test'

import { GATE_TAG } from './canvasGateSet'
import {
  openCanvas,
  preparePage,
  seedStarterDraft,
  clearNotifications,
  minimiseFloatingOlumiPanel,
  waitForVisualQuiescence,
  type StarterId,
} from '../visual/harness'
import { LABEL_LEGIBLE_ZOOM } from '../../src/canvas/utils/zoomLegibility'
import { GHOST_ID_PREFIX } from '../../src/canvas/utils/fitTargets'

const VP = { width: 1440, height: 900 }

/**
 * `vendor-selection` because it is the starter the reported defect was
 * SCREENSHOTTED on — its `Budget Headroom` factor is the card whose
 * "Within GBP 120k" value the row covers. Binding the arm to the starter that
 * carries the witnessed instance, rather than to whichever one is convenient.
 */
const STARTER: StarterId = 'vendor-selection'

/**
 * Below this many measurable cards the run is an INSTRUMENT FAILURE, not a pass.
 *
 * `vendor-selection` lays out well over a dozen cards at this viewport and every
 * one of them mounts the shared row above the legibility floor. The floor is set
 * far under that: it is here to catch a harness that seeded nothing, a layout
 * that never ran, or a flag posture that unmounted the row — not to encode the
 * starter's node count, which is a number that would need maintaining.
 */
const MIN_MEASURABLE_CARDS = 5

interface Covered {
  readonly node: string
  readonly control: string
  readonly text: string
  readonly area: number
}

interface Census {
  readonly zoom: number
  readonly cards: number
  readonly cardsWithRow: number
  readonly cardsMeasurable: number
  readonly controls: number
  readonly textElements: number
  readonly covered: readonly Covered[]
  readonly coveredArea: number
  readonly coveredCards: number
  /** CONTRAST CONTROL: cards where row-over-own-card intersects by > 0 px^2. */
  readonly rowInsideCardCards: number
  readonly rowInsideCardArea: number
  readonly rows: ReadonlyArray<{ node: string; w: number; h: number; cardW: number; cardH: number }>
}

/**
 * The census, evaluated in the page.
 *
 * `optNodeId` narrows it to one card — used for the hovered re-measure, so the
 * hover arm asks about the card actually under the pointer rather than about a
 * board-wide average that a single hovered card could not move.
 */
async function census(page: Page, optNodeId?: string): Promise<Census> {
  return page.evaluate(
    ({ ghostPrefix, only }: { ghostPrefix: string; only?: string }) => {
      const painted = (el: Element): boolean => {
        let cur: Element | null = el
        while (cur !== null && cur instanceof HTMLElement) {
          const cs = getComputedStyle(cur)
          if (cs.display === 'none' || cs.visibility === 'hidden') return false
          cur = cur.parentElement
        }
        const r = (el as HTMLElement).getBoundingClientRect()
        return r.width > 0 && r.height > 0
      }

      const overlap = (a: DOMRect, b: DOMRect): number =>
        Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
        Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))

      const name = (el: Element): string => {
        const tid = el.getAttribute('data-testid')
        if (tid) return `[${tid}]`
        const al = el.getAttribute('aria-label')
        if (al) return `${el.tagName}(${al})`
        return el.tagName
      }

      const label = (el: Element): string => (el.textContent ?? '').trim().slice(0, 40)

      const cards = (Array.from(document.querySelectorAll('.react-flow__node')) as HTMLElement[]).filter(
        (el) => !(el.getAttribute('data-id') ?? '').startsWith(ghostPrefix),
      )

      const covered: Array<{ node: string; control: string; text: string; area: number }> = []
      const rows: Array<{ node: string; w: number; h: number; cardW: number; cardH: number }> = []
      let cardsWithRow = 0
      let cardsMeasurable = 0
      let controls = 0
      let textElements = 0
      let coveredArea = 0
      let rowInsideCardCards = 0
      let rowInsideCardArea = 0
      const coveredCards = new Set<string>()

      for (const card of cards) {
        const id = card.getAttribute('data-id') ?? ''
        if (only !== undefined && id !== only) continue

        const row = card.querySelector<HTMLElement>('.node-quick-actions')
        if (!row) continue
        const buttons = Array.from(row.querySelectorAll<HTMLElement>('button')).filter(
          (b) => b.getBoundingClientRect().width > 0,
        )
        if (buttons.length === 0) continue
        cardsWithRow += 1
        controls += buttons.length

        /**
         * The card's own painted box — the `role="group"` div `BaseNode`
         * renders, NOT the React Flow wrapper. The wrapper carries no padding
         * and no background, so measuring it would make the contrast control
         * weaker and the text search wider than the card a user sees.
         */
        const body = card.querySelector<HTMLElement>('[role="group"]') ?? card

        // Text-bearing elements: those with a DIRECT non-empty text child, so a
        // wrapper that merely contains text is not counted as text itself.
        const texts = Array.from(body.querySelectorAll<HTMLElement>('*')).filter((el) => {
          if (row.contains(el)) return false
          if (!Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0))
            return false
          return painted(el)
        })
        if (texts.length === 0) continue
        cardsMeasurable += 1
        textElements += texts.length

        const rowRect = row.getBoundingClientRect()
        const bodyRect = body.getBoundingClientRect()
        rows.push({
          node: id,
          w: +rowRect.width.toFixed(2),
          h: +rowRect.height.toFixed(2),
          cardW: +bodyRect.width.toFixed(2),
          cardH: +bodyRect.height.toFixed(2),
        })

        // CONTRAST CONTROL — the same intersector, on a pair that MUST overlap.
        const inCard = overlap(rowRect, bodyRect)
        if (inCard > 0) rowInsideCardCards += 1
        rowInsideCardArea += inCard

        for (const btn of buttons) {
          const br = btn.getBoundingClientRect()
          for (const t of texts) {
            const a = overlap(br, t.getBoundingClientRect())
            if (a <= 0) continue
            coveredArea += a
            coveredCards.add(id)
            if (covered.length < 40) {
              covered.push({ node: id, control: name(btn), text: `${name(t)} "${label(t)}"`, area: +a.toFixed(1) })
            }
          }
        }
      }

      const vp = document.querySelector('.react-flow__viewport') as HTMLElement
      return {
        zoom: +new DOMMatrixReadOnly(getComputedStyle(vp).transform).a.toFixed(4),
        cards: cards.length,
        cardsWithRow,
        cardsMeasurable,
        controls,
        textElements,
        covered,
        coveredArea: +coveredArea.toFixed(1),
        coveredCards: coveredCards.size,
        rowInsideCardCards,
        rowInsideCardArea: +rowInsideCardArea.toFixed(1),
        rows,
      }
    },
    { ghostPrefix: GHOST_ID_PREFIX, only: optNodeId },
  )
}

/**
 * Read the LIVE zoom off the viewport's own transform matrix.
 *
 * ⚠ NOT off React Flow's internal store. `heightVsZoom` reaches that by walking
 * the container's React fibre for a context value carrying `transform` — 20
 * lines of private-API archaeology that is correct there and would be a SECOND
 * AUTHORITY here (CLAUDE.md trap 21). The rendered transform is the thing the
 * counter-scale is actually a function of, it is public, and the census below
 * already reads it, so there is exactly one answer to "what zoom is this?".
 */
async function readZoom(page: Page): Promise<number> {
  return page.evaluate(() => {
    const vp = document.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!vp) return NaN
    return +new DOMMatrixReadOnly(getComputedStyle(vp).transform).a.toFixed(4)
  })
}

/**
 * Drive the camera with ctrl+wheel over the pane — d3-zoom's OWN input, the
 * gesture a user performs — rather than writing a transform.
 *
 * Same mechanism `nodeMarkCensus.measure.ts` uses, and for the same reason: a
 * written transform can land in a state the product's zoom path never produces,
 * and the whole question here is what the product renders at the zoom it parks
 * at. Returns the zoom ACHIEVED, never the one requested — a camera that
 * refused to move must present as a failed assertion, not as a silent
 * measurement of a different zoom.
 */
async function setZoom(page: Page, target: number): Promise<number> {
  await page.evaluate(async (z: number) => {
    const pane = document.querySelector('.react-flow__pane') as HTMLElement | null
    const vp = document.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!pane || !vp) return
    const zoomNow = () => new DOMMatrixReadOnly(getComputedStyle(vp).transform).a
    const r = pane.getBoundingClientRect()
    for (let i = 0; i < 600; i += 1) {
      const cur = zoomNow()
      if (Math.abs(cur - z) < 0.002) break
      pane.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          clientX: r.left + r.width / 2,
          clientY: r.top + r.height / 2,
          deltaY: cur > z ? 4 : -4,
        }),
      )
      await new Promise((res) => requestAnimationFrame(() => res(null)))
    }
  }, target)
  await page.waitForTimeout(800)
  return readZoom(page)
}

test.describe('in-node control occlusion', () => {
  test(
    `CONTROLS DO NOT COVER CARD CONTENT @${STARTER} ${VP.width}x${VP.height}`,
    { tag: GATE_TAG },
    async ({ page }) => {
      await preparePage(page, VP)
      await openCanvas(page)
      await seedStarterDraft(page, STARTER)
      await clearNotifications(page)
      await minimiseFloatingOlumiPanel(page)
      await waitForVisualQuiescence(page)
      await page.waitForTimeout(2000)

      const settled = await readZoom(page)

      // ── The measurement is taken at the WORST CASE, which is also where the
      //    product's own post-draft fit parks: `MAX_LABEL_COUNTER_SCALE` is
      //    reached at exactly `LABEL_LEGIBLE_ZOOM`.
      const zoom = await setZoom(page, LABEL_LEGIBLE_ZOOM)
      await waitForVisualQuiescence(page)
      await page.waitForTimeout(500)

      const at = await census(page)
      console.log(`OCCLUSIONJSON ${JSON.stringify({ settled, ...at })}`)

      // ── ZOOM HELD. A drifted camera measures a smaller counter-scale and
      //    under-reports; every figure below would be about a zoom the product
      //    does not park at.
      expect(
        Math.abs(zoom - LABEL_LEGIBLE_ZOOM),
        `the camera did not hold ${LABEL_LEGIBLE_ZOOM} (settled ${settled}, achieved ${zoom}) — ` +
          'every figure in this run is about a different zoom than the one under test',
      ).toBeLessThan(0.005)

      // ── NON-VACUITY. Controls AND content had to be present to collide.
      expect(
        at.cardsMeasurable,
        `only ${at.cardsMeasurable} card(s) carried BOTH a quick-action row and painted text ` +
          `(${at.cards} cards, ${at.cardsWithRow} with a row) — a clean overlap here would mean ` +
          'nothing was measured, not that nothing overlapped',
      ).toBeGreaterThanOrEqual(MIN_MEASURABLE_CARDS)
      expect(at.controls, 'no quick-action buttons were found to measure').toBeGreaterThan(0)
      expect(at.textElements, 'no painted text was found on any card to be covered').toBeGreaterThan(0)

      // ── CONTRAST CONTROL: the SAME intersector, on a pair that must overlap.
      expect(
        at.rowInsideCardCards,
        `the intersector returned 0 for the quick-action row against its OWN CARD on ` +
          `${at.cardsMeasurable - at.rowInsideCardCards} of ${at.cardsMeasurable} cards. The row is inside ` +
          'the card by construction, so this is an INSTRUMENT FAILURE and the zero above proves nothing',
      ).toBe(at.cardsMeasurable)
      expect(at.rowInsideCardArea, 'contrast control measured zero area').toBeGreaterThan(0)

      // ── THE PROPERTY.
      expect(
        at.covered.map((c) => `${c.node} ${c.control} covers ${c.text} by ${c.area}px^2`),
        `${at.covered.length} control-over-content overlaps on ${at.coveredCards} of ${at.cardsMeasurable} cards ` +
          `(${at.coveredArea}px^2 of text-element area, over-counting nested text). A user hovers a card to ACT ` +
          'on it; the value they were about to act on must not disappear when they do',
      ).toEqual([])

      // ── THE ROW IS A REAL, REVEALED CONTROL — and hovering does not move the
      //    card. Both are asserted on the same card, in one gesture.
      const target = at.rows[0]!.node
      const before = await page.evaluate((id) => {
        const el = document
          .querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`)
          ?.querySelector('[role="group"]')
        const r = el?.getBoundingClientRect()
        return r ? { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) } : null
      }, target)
      expect(before, 'the card to hover vanished before the hover').not.toBeNull()

      await page.locator(`.react-flow__node[data-id="${target}"]`).hover({ position: { x: 8, y: 8 } })
      await page.waitForTimeout(400)

      const hovered = await page.evaluate((id) => {
        const card = document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`)
        const el = card?.querySelector('[role="group"]')
        const row = card?.querySelector('.node-quick-actions')
        const r = el?.getBoundingClientRect()
        return {
          box: r ? { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) } : null,
          opacity: row ? Number(getComputedStyle(row as HTMLElement).opacity) : null,
        }
      }, target)

      expect(
        hovered.opacity,
        `hovering ${target} did not reveal its quick-action row (opacity ${hovered.opacity}). Every assertion ` +
          'above would then be about an element the user never meets',
      ).toBe(1)

      // ── NO JUMP. A reservation that only appears on hover would clear the
      //    occlusion by moving the target away from the cursor.
      expect(
        hovered.box,
        `the card moved or resized when hovered: ${JSON.stringify(before)} -> ${JSON.stringify(hovered.box)}. ` +
          'A layout that reflows on hover makes the thing you are aiming at move away from you',
      ).toEqual(before)

      // ── AND THE PROPERTY AGAIN, ON THE HOVERED CARD, with the row painted.
      const onHover = await census(page, target)
      console.log(`OCCLUSIONHOVERJSON ${JSON.stringify(onHover)}`)
      expect(
        onHover.covered.map((c) => `${c.node} ${c.control} covers ${c.text} by ${c.area}px^2`),
        'the revealed row covers content on the card under the pointer',
      ).toEqual([])
      expect(
        onHover.rowInsideCardCards,
        'contrast control: the hovered row does not intersect its own card — instrument failure',
      ).toBe(1)
    },
  )
})
