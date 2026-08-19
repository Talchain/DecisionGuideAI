/**
 * CAN THE USER CLICK THE DECISION NODE OF THEIR OWN MODEL?
 *
 * Real Chromium, real layout, real `elementFromPoint` hit-testing. jsdom cannot
 * answer this question at all — presence in the DOM is not visibility, and a
 * `getAllByRole(...).toHaveLength(1)` proves neither (CLAUDE.md trap 3). This is
 * the ACCEPTANCE instrument for the fit-then-place placement rule
 * (`FloatingOlumiPanel.graphAwareDefaultPosition`); the pure rule itself is
 * pinned in `FloatingOlumiPanel.graphAwarePlacement.spec.ts`.
 *
 * ⚠ RUN IT DELIBERATELY, it is not in any gate:
 *     pnpm exec playwright test -c playwright.geometry.config.ts decisionNodeHittest
 * The file is `*.measure.ts`, NOT `*.spec.ts`, precisely so the main e2e config
 * (`testDir: 'e2e'`, default testMatch) cannot collect it into a run that has no
 * dev server on its port. Same convention as `canonicalGeometry.measure.ts`.
 *
 * ── THE DEFECT, AS MEASURED AT PRISTINE (staging 3f59325a, 2026-08-19) ───────
 *
 * The interceptor is the floating Olumi panel itself: `position: fixed`,
 * `z-index: 300`, rect [52, 73, 452, 623] — BYTE-IDENTICAL at every viewport
 * from 1024 to 1920, because it is a fixed-size fixed-origin window while the
 * graph's fit box SCALES. Decision-node hittable probes, as-shipped placement:
 *
 *     1200 → 0/49 · 1250 → 0/49 · 1300 → 14 · 1350 → 28 · 1400 → 42 · 1450 → 49
 *
 * ⭐ AND IT IS NOT A 1280 QUIRK — IT IS A THRESHOLD AT THE PANEL'S RIGHT EDGE,
 * which is why this sweeps rather than sampling one laptop width. The node's own
 * hit area is CORRECT, proven by discrimination: the SAME node in the SAME code
 * is 49/49 at 1450 and 0/49 at 1250. A mispositioned hit area would fail at
 * every width.
 *
 * ⭐⭐ AND THE SECOND PATH IS THE ONE A REAL USER REACHES BY REOPENING THE PANEL
 * on a populated canvas (`position: null` → the design's centred default). At
 * pristine that path measured 0/49 at 1440x900 for two starters — i.e. the
 * defect was never confined to small viewports, and an instrument that only
 * walked the seeded path would have reported the healthy half. Both paths are
 * measured here, deliberately.
 *
 * ── WHAT EACH ASSERTION IS FOR ──────────────────────────────────────────────
 *
 * - BIND BY IDENTITY, never by screen position (trap 19): the node under test is
 *   found by the Decision node's STORE ID, and the probe asserts the element it
 *   hit-tested carries that same `data-id`. A different node cannot satisfy it.
 * - NEGATIVE CONTROLS, or the absence assertion is vacuous (trap 13): a point
 *   inside the top bar must attribute to TOPBAR and a point inside the panel must
 *   attribute to OLUMI_PANEL. If `elementFromPoint` stopped discriminating, every
 *   "the node is hittable" reading would pass by measuring nothing.
 * - PLACEMENT-BOUND IS RUN-DEPENDENT (19 Aug 2026). A cell reporting `> 0`
 *   best-possible interception is reporting on THIS RUN's layout draw, which moves
 *   ±13-21px. Two runs of the same commit produced two bound cells and zero bound
 *   cells respectively. Quote a bound cell as a finding about that run; never quote
 *   the COUNT as a property of the product.
 * - STORE/DOM AGREEMENT: the panel's rendered position and the store's model of
 *   it were two authorities for one fact — the store said `position: null` while
 *   the DOM said `left: 52px`, because the placement effect never ran. Pinned
 *   here so a regression in either direction REDs.
 */
import { test, expect, type Page } from '@playwright/test'
import {
  openCanvas,
  preparePage,
  seedStarterDraft,
  clearNotifications,
  waitForVisualQuiescence,
  type StarterId,
} from '../visual/harness'

/** 7x7 = 49 probes per node, inset 2px so the sample includes the near-edges. */
const PROBES = 49

/**
 * The two starters whose Decision node the panel buried worst at pristine
 * (0/49 across 1200-1280). They are the acceptance bar for the sweep; the
 * reopen path below runs all five.
 */
const WORST: StarterId[] = ['pricing-model', 'headcount-allocation']
const ALL: StarterId[] = ['vendor-selection', 'market-entry', 'build-vs-buy', 'headcount-allocation', 'pricing-model']

/** The threshold sweep. 1450 was already clear at pristine and must STAY clear —
 *  a fix that clears 1250 by breaking 1450 has moved the defect, not closed it. */
const SWEEP_WIDTHS = [1200, 1250, 1300, 1350, 1400, 1450]

interface Probe {
  decId: string
  hitElementId: string | null
  /** Probes that landed on the Decision node itself. */
  self: number
  /** What intercepted the rest, by owner. */
  by: Record<string, number>
  /** ⭐ THE LOAD-BEARING NUMBER: probes intercepted by the floating companion. */
  panelIntercepted: number
  /** Probes the panel would intercept at the placement this rule replaces. */
  baselineIntercepted: number
  /**
   * The fewest probes ANY legal placement of the panel could intercept, found by
   * exhaustive scan of the panel's legal top-left rectangle. `0` means a clearing
   * placement exists and the product must find it; `> 0` means no legal placement
   * clears this model at this viewport — a PLACEMENT-BOUND cell.
   *
   * ⚠⚠ PLACEMENT-BOUND IS A PROPERTY OF THE RUN, NOT A GEOMETRIC FACT ABOUT THE
   * CELL — corrected 19 Aug 2026, and #800's own body says otherwise. The author's
   * run reported TWO bound cells; an independent reviewer's run reported ZERO —
   * all 27 cells solvable and fully cleared. The cells are genuinely marginal
   * (at `reopen headcount @1440` the rule clears the anchor by 1.1px), and the
   * layout draw moves by ±13-21px between runs, so which side of the boundary a
   * cell lands on moves with it. The scan is exhaustive over integer positions
   * and conservative, so WHEN a cell reports bound the reading is trustworthy —
   * but the COUNT of bound cells is not reproducible and must never be quoted as
   * one. #800's claim that "it is derived per run, so the layout jitter cannot
   * make it flaky" has the implication backwards: derived per run is exactly WHY
   * the count moves.
   */
  minPossibleIntercepted: number
  /**
   * Positions the scan evaluated. The scan BREAKS the moment it finds a clearing
   * placement, so this equals `legalBoxArea` only when it found none.
   */
  scanned: number
  /** Every integer top-left the panel may legally occupy: the scan's whole domain. */
  legalBoxArea: number
  /** The legal box itself, so the shipped placement can be checked against it. */
  legalBox: { xMin: number; xMax: number; yMin: number; yMax: number }
  /** The panel's ACTUAL top-left, unrounded. `null` when the panel is unplaced. */
  shippedTopLeft: { x: number; y: number } | null
  nodeRect: number[]
  panelRect: number[] | null
  storePos: { x: number; y: number } | null
  ctlTopBar: string
  ctlPanel: string
}

async function probeDecisionNode(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const store = (window as any).useCanvasStore.getState()
    const owner = (el: Element | null): string => {
      let e: Element | null = el
      while (e) {
        const tid = e.getAttribute('data-testid')
        const al = e.getAttribute('aria-label')
        if (tid === 'floating-olumi-panel') return 'OLUMI_PANEL'
        if (tid === 'floating-olumi-panel-side-tab') return 'OLUMI_PANEL_TAB'
        if (e.getAttribute('role') === 'banner') return 'TOPBAR'
        if (al === 'Outputs dock') return 'DOCK'
        if (al === 'Canvas tools') return 'SIDEBAR'
        if (al === 'Viewport controls') return 'VIEWPORT_CONTROLS'
        // SVGElement.className is an SVGAnimatedString, not a string — read the
        // attribute or an SVG occluder's identity silently disappears.
        if ((e.getAttribute('class') || '').includes('react-flow__pane')) return 'PANE'
        e = e.parentElement
      }
      return el ? 'OTHER' : 'NULL'
    }

    // BIND BY IDENTITY: the Decision node's store id, then that exact element.
    const decNode = store.nodes.find((n: any) => n.type === 'decision')
    const el = document.querySelector(`.react-flow__node[data-id="${CSS.escape(decNode.id)}"]`) as HTMLElement
    const r = el.getBoundingClientRect()

    let self = 0
    let hitElementId: string | null = null
    const by: Record<string, number> = {}
    for (let iy = 0; iy < 7; iy++) {
      for (let ix = 0; ix < 7; ix++) {
        const x = r.left + 2 + ((r.width - 4) * ix) / 6
        const y = r.top + 2 + ((r.height - 4) * iy) / 6
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) {
          by.OFFSCREEN = (by.OFFSCREEN || 0) + 1
          continue
        }
        const top = document.elementFromPoint(x, y)
        if (top && (top === el || el.contains(top))) {
          self++
          if (hitElementId === null) {
            hitElementId = ((top as HTMLElement).closest('.react-flow__node') as HTMLElement | null)?.dataset.id ?? null
          }
        } else {
          const o = owner(top)
          by[o] = (by[o] || 0) + 1
        }
      }
    }

    // NEGATIVE CONTROLS — prove elementFromPoint still discriminates.
    const banner = document.querySelector('[role="banner"]')!.getBoundingClientRect()
    const ctlTopBar = owner(document.elementFromPoint(banner.left + 20, banner.top + banner.height / 2))
    const p = document.querySelector('[data-testid="floating-olumi-panel"]')?.getBoundingClientRect()
    const ctlPanel = p
      ? owner(document.elementFromPoint(p.left + p.width / 2, p.top + p.height / 2))
      : 'NO_PANEL'

    const panelEl = document.querySelector('[data-testid="floating-olumi-panel"]') as HTMLElement | null

    /* ── The independent oracle ──────────────────────────────────────────────
     *
     * Everything above measures what the product DID. This measures what the
     * best possible placement COULD have done, by brute force over every legal
     * top-left the panel can occupy — a genuinely independent answer, not the
     * five-candidate heuristic the product runs. It is what lets this instrument
     * distinguish "the rule placed the panel badly" (a defect) from "no placement
     * of a 400x550 window clears this model at this viewport" (arithmetic).
     *
     * The panel is an opaque rectangle at z-300, so rect containment is an exact
     * model of its interception — no hit-testing needed for the hypotheticals.
     */
    const MARGIN = 16
    const SIDE_TAB = 36
    const pw = panelEl ? parseFloat(panelEl.style.width || '400') : 400
    const ph = panelEl ? parseFloat(panelEl.style.height || '550') : 550
    const dockEl = document.querySelector('aside[aria-label="Outputs dock"]') as HTMLElement | null
    // Mirrors `measureDockInset` EXACTLY, zero-size rule included. Without that
    // rule an unmeasured dock would shrink `xMax` below the product's own maxX,
    // and the legal-box containment assertion below would RED on a healthy run.
    const dockRect = dockEl ? dockEl.getBoundingClientRect() : null
    const dockInset =
      dockRect && dockRect.width !== 0 && dockRect.height !== 0
        ? Math.max(0, innerWidth - dockRect.left)
        : 0
    const topbarH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 0
    const topInset = topbarH > 0 ? topbarH + MARGIN : MARGIN
    const xMin = MARGIN + SIDE_TAB
    const xMax = Math.max(xMin, innerWidth - pw - MARGIN - dockInset)
    const yMin = Math.max(MARGIN, topInset)
    const yMax = Math.max(yMin, innerHeight - ph - MARGIN)

    // The same 49 probe points, as coordinates.
    const points: Array<[number, number]> = []
    for (let iy = 0; iy < 7; iy++) {
      for (let ix = 0; ix < 7; ix++) {
        points.push([r.left + 2 + ((r.width - 4) * ix) / 6, r.top + 2 + ((r.height - 4) * iy) / 6])
      }
    }
    // ⚠ MODELS THE PANEL BODY ONLY, DELIBERATELY. The side tab is a 36x104 stub
    // outside the left edge; treating it as a full-height band would OVER-count
    // hypothetical interception and could report "no clearing placement exists"
    // when one does — i.e. it would relax the hard assertion, the one unsafe
    // direction. The tab is instead covered on the MEASURED side: any probe it
    // intercepts is counted into `panelIntercepted` under OLUMI_PANEL_TAB, so a
    // tab interception REDs against a `minPossibleIntercepted` of 0.
    const interceptedAt = (x: number, y: number): number => {
      const rr = x + pw
      const b = y + ph
      let n = 0
      for (const [px, py] of points) if (px >= x && px < rr && py >= y && py < b) n++
      return n
    }

    let minPossibleIntercepted = Infinity
    let scanned = 0
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        scanned++
        const n = interceptedAt(x, y)
        if (n < minPossibleIntercepted) minPossibleIntercepted = n
        if (minPossibleIntercepted === 0) break
      }
      if (minPossibleIntercepted === 0) break
    }

    // The placement the product ACTUALLY chose, read unrounded off the element
    // the hit-test attributed to. Read from the inline style rather than the
    // rect for the same reason `pw`/`ph` are: it is the exact number the
    // placement rule wrote, with no sub-pixel compositing in between.
    const finite = (v: number): number | null => (Number.isFinite(v) ? v : null)
    const shippedX = panelEl ? finite(parseFloat(panelEl.style.left)) : null
    const shippedY = panelEl ? finite(parseFloat(panelEl.style.top)) : null

    // The placement this rule replaces: the clamped centred default.
    const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
    const baseX = clamp(Math.max(MARGIN, Math.floor((innerWidth - dockInset - pw) / 2)), xMin, xMax)
    const baseY = clamp(Math.max(MARGIN, Math.floor((innerHeight - ph) / 2)), yMin, yMax)

    return {
      decId: decNode.id,
      hitElementId,
      self,
      by,
      panelIntercepted: (by.OLUMI_PANEL || 0) + (by.OLUMI_PANEL_TAB || 0),
      baselineIntercepted: interceptedAt(baseX, baseY),
      minPossibleIntercepted: minPossibleIntercepted === Infinity ? 0 : minPossibleIntercepted,
      scanned,
      legalBoxArea: (xMax - xMin + 1) * (yMax - yMin + 1),
      legalBox: { xMin, xMax, yMin, yMax },
      shippedTopLeft: shippedX !== null && shippedY !== null ? { x: shippedX, y: shippedY } : null,
      nodeRect: [r.left, r.top, r.right, r.bottom].map(Math.round),
      panelRect: p ? [p.left, p.top, p.right, p.bottom].map(Math.round) : null,
      storePos: panelEl
        ? { x: Math.round(parseFloat(panelEl.style.left || 'NaN')), y: Math.round(parseFloat(panelEl.style.top || 'NaN')) }
        : null,
      ctlTopBar,
      ctlPanel,
    }
  })
}

/** The store's own record of where the panel is, read from the panel's store. */
async function readStorePosition(page: Page): Promise<{ x: number; y: number } | null> {
  return page.evaluate(async () => {
    const modulePath = '/src/canvas/hooks/useFloatingPanelState.ts'
    const mod = (await import(/* @vite-ignore */ modulePath)) as any
    return mod.useFloatingPanelState.getState().position
  })
}

function assertProbe(label: string, m: Probe): void {
  // VACUITY GUARDS. If `elementFromPoint` stopped discriminating, or the scan
  // evaluated nothing, every reading below would pass by measuring nothing
  // (CLAUDE.md trap 13).
  expect(m.ctlTopBar, `${label} NEGATIVE CONTROL: a point inside the top bar must attribute to TOPBAR`).toBe('TOPBAR')
  expect(m.ctlPanel, `${label} NEGATIVE CONTROL: a point inside the panel must attribute to OLUMI_PANEL`).toBe('OLUMI_PANEL')
  // ⚠ REPLACES A CONTROL THAT COULD NOT FAIL. `expect(m.scanned).toBeGreaterThan(0)`
  // was guaranteed by `xMax = Math.max(xMin, …)` / `yMax = Math.max(yMin, …)`:
  // the loop always runs at least once. A reviewer measured `scanned: 1` in 15 of
  // 27 cells — the early break — and the control read green on every one of them.
  // The scan breaks the instant it finds a clearing placement, so `scanned` is
  // only informative when it did NOT break, and there it must equal the WHOLE
  // legal box: a "no legal placement clears this model" verdict from an under-run
  // scan is an artefact, and that verdict is what downgrades the assertion below.
  if (m.minPossibleIntercepted > 0) {
    expect(
      m.scanned,
      `${label} POSITIVE CONTROL: a scan reporting NO clearing placement must have evaluated every legal position — ` +
        `${m.scanned} of ${m.legalBoxArea} (${JSON.stringify(m.legalBox)})`,
    ).toBe(m.legalBoxArea)
  } else {
    // Broke early, legitimately. What is still checkable is that the loop and the
    // independently-computed area agree about the domain.
    expect(
      m.scanned,
      `${label} POSITIVE CONTROL: the scan cannot have evaluated more positions than the legal box holds — ` +
        `${m.scanned} of ${m.legalBoxArea}`,
    ).toBeLessThanOrEqual(m.legalBoxArea)
  }
  // BIND BY IDENTITY, never by screen position (trap 19).
  expect(m.hitElementId, `${label}: the probes must have landed on the DECISION node, bound by id`).toBe(m.decId)

  const detail =
    `occluders ${JSON.stringify(m.by)} · panel ${JSON.stringify(m.panelRect)} · node ${JSON.stringify(m.nodeRect)} · ` +
    `baseline ${m.baselineIntercepted}/49 · best-possible ${m.minPossibleIntercepted}/49`

  // ⭐ THE LOAD-BEARING ASSERTION. Probes the node loses to the PANE are the
  // node's own hit area (rounded corners / a transparent band) and were present
  // at pristine at every viewport including the healthy ones — asserting a flat
  // 49/49 would fold that pre-existing, panel-independent shortfall into this
  // fix's acceptance bar and make the instrument lie about what it proved.
  // What this fix owns is interception BY THE COMPANION.
  if (m.minPossibleIntercepted === 0) {
    expect(m.panelIntercepted, `${label}: the companion must not intercept ANY probe — ${detail}`).toBe(0)
  } else {
    // PLACEMENT-BOUND: no legal placement of a panel this size clears this model
    // at this viewport. ⚠ RUN-DEPENDENT, NOT A GEOMETRIC FACT about the cell —
    // see `minPossibleIntercepted`'s doc. Reported rather than silently tolerated,
    // and still held to "never worse than the placement it replaces".
    console.log(`PLACEMENT-BOUND (run-dependent) ${label} — ${detail}`)

    // ⭐ AND THE SOFTER BRANCH STILL ASSERTS. Otherwise the instrument's STRICTNESS
    // is decided by the same run-dependent draw as the verdict: a run that happens
    // to place the model lower gets `minPossible > 0`, and with it a `console.log`
    // where the neighbouring run got a hard assertion. What this branch owes is the
    // condition that makes its own verdict mean anything about the PRODUCT: the
    // exhaustive scan searched the box the product is clamped into. If the shipped
    // placement sits outside the scanned box, then "no legal placement clears this
    // model" is a statement about a region the product cannot reach, and the
    // downgrade above was bought with a mis-derived box. Bounds are compared
    // exactly — `clampPositionToViewport` writes `xMin`/`maxX` verbatim, so a
    // sub-pixel placement cannot straddle them.
    expect(
      m.shippedTopLeft,
      `${label}: the panel must be PLACED for a placement-bound verdict to mean anything — ${detail}`,
    ).not.toBeNull()
    const { xMin, xMax, yMin, yMax } = m.legalBox
    const box = `legal box x[${xMin}, ${xMax}] y[${yMin}, ${yMax}]`
    expect(
      m.shippedTopLeft!.x,
      `${label}: the shipped placement must lie inside the box the scan searched, or the scan's verdict is about a region the product cannot use — shipped x ${m.shippedTopLeft!.x}, ${box}`,
    ).toBeGreaterThanOrEqual(xMin)
    expect(
      m.shippedTopLeft!.x,
      `${label}: shipped x ${m.shippedTopLeft!.x} is outside the scanned ${box}`,
    ).toBeLessThanOrEqual(xMax)
    expect(
      m.shippedTopLeft!.y,
      `${label}: shipped y ${m.shippedTopLeft!.y} is outside the scanned ${box}`,
    ).toBeGreaterThanOrEqual(yMin)
    expect(
      m.shippedTopLeft!.y,
      `${label}: shipped y ${m.shippedTopLeft!.y} is outside the scanned ${box}`,
    ).toBeLessThanOrEqual(yMax)
  }
  expect(
    m.panelIntercepted,
    `${label}: the placement must never intercept MORE than the centred default it replaces — ${detail}`,
  ).toBeLessThanOrEqual(m.baselineIntercepted)
  expect(m.self, `${label}: the Decision node must be clickable somewhere — ${detail}`).toBeGreaterThan(0)
  expect(m.self + Object.values(m.by).reduce((a, n) => a + n, 0), `${label}: probe accounting`).toBe(PROBES)
}

/* ── (a) The as-shipped path: seed a real draft, measure what the user gets ── */

for (const w of SWEEP_WIDTHS) {
  for (const id of WORST) {
    test(`AS-SHIPPED ${id} @${w}x800`, async ({ page }) => {
      await preparePage(page, { width: w, height: 800 })
      await openCanvas(page)
      await seedStarterDraft(page, id)
      await clearNotifications(page)
      await waitForVisualQuiescence(page)

      const m = await probeDecisionNode(page)
      console.log(`HITJSON ${JSON.stringify({ path: 'as-shipped', w, id, ...m })}`)
      assertProbe(`as-shipped ${id} @${w}`, m)

      // ONE AUTHORITY FOR ONE FACT. At pristine the store said `position: null`
      // while the DOM said `left: 52px; top: 73px` — the placement effect never
      // ran, and a re-clamp handler read the unset style as 0. If these ever
      // disagree again, one of them is inventing a position.
      const storePos = await readStorePosition(page)
      expect(storePos, `as-shipped ${id} @${w}: the store must know where the panel is`).not.toBeNull()
      expect(storePos, `as-shipped ${id} @${w}: store and DOM must agree on the panel's position`).toEqual(m.storePos)
    })
  }
}

/* ── (b) The reopen path: `position: null` → the design's own default ──────── */

for (const vp of [
  { w: 1280, h: 800 },
  { w: 1440, h: 900 },
  { w: 1512, h: 945 },
]) {
  for (const id of ALL) {
    test(`REOPEN ${id} @${vp.w}x${vp.h}`, async ({ page }) => {
      await preparePage(page, { width: vp.w, height: vp.h })
      await openCanvas(page)
      await seedStarterDraft(page, id)
      await clearNotifications(page)
      await waitForVisualQuiescence(page)

      // Reproduce the state a user reaches by reopening the companion on a
      // populated canvas: the panel re-derives its default placement.
      await page.evaluate(async () => {
        const modulePath = '/src/canvas/hooks/useFloatingPanelState.ts'
        const mod = (await import(/* @vite-ignore */ modulePath)) as any
        mod.useFloatingPanelState.getState().minimise()
      })
      await page.waitForTimeout(150)
      await page.evaluate(async () => {
        const modulePath = '/src/canvas/hooks/useFloatingPanelState.ts'
        const mod = (await import(/* @vite-ignore */ modulePath)) as any
        mod.useFloatingPanelState.setState({
          position: null,
          isMinimised: false,
          isOpen: true,
          source: 'user',
          userRepositioned: false,
        })
      })
      await waitForVisualQuiescence(page)

      const m = await probeDecisionNode(page)
      console.log(`HITJSON ${JSON.stringify({ path: 'reopen', w: vp.w, id, ...m })}`)
      expect(m.panelRect, `reopen ${id} @${vp.w}: the panel must be on screen for this state`).not.toBeNull()
      assertProbe(`reopen ${id} @${vp.w}`, m)
    })
  }
}
