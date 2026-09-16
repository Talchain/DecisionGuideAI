/**
 * HEIGHT-vs-ZOOM — is the rendered card height a FUNCTION OF THE VIEWPORT ZOOM?
 *
 * The layout's vertical stride is fixed at layout time from measured heights.
 * If a card's height in MODEL px changes when only the camera zoom changes,
 * then the stride is computed against a height the card does not keep, and
 * every row can be under-spaced without anything in the layout being wrong.
 *
 * CONTROLS (a probe with no control proves nothing — CLAUDE.md trap 13).
 *
 * ⚠ LINE NUMBERS ARE DELIBERATELY NOT CITED BELOW. An earlier version of this
 * list carried five of them; every one was stale within a day of the next edit,
 * and a precise-looking wrong citation is worse than none (CLAUDE.md trap 12 —
 * a hand-maintained mirror, inside the header that documents the guards). Each
 * assertion carries its own reason at its own site; grep the named claim.
 *
 * ASSERTED — these RED the run:
 *  · BOTH LOD ARMS POPULATED — a settled sample on each side of the legibility
 *    threshold, or the direction check has nothing to compare.
 *  · NON-VACUITY — at least one card must CHANGE height across the threshold; a
 *    comparison that discriminates nothing cannot report that nothing grew.
 *  · NO CARD GREW across the threshold (`grew`).
 *  · ⭐ THE RESERVATION IS STABLE ACROSS THE SWEEP (`worstBoundSpread` against
 *    `SUB_ROW_SLACK`) — added 16 Sep 2026, and it is the assertion that catches
 *    the LOD-collapse defect. It replaced `worstShrink < SUB_ROW_SLACK`, which
 *    measured the LIVE delta: a PROXY that was sound only while the bound
 *    measurer shared the live reading's LOD sensitivity, and which REDs on the
 *    fix once it does not. Same constant, same bar, corrected subject — the
 *    mutation check measured 430px with the measurer's release removed and 38px
 *    with it present.
 *  · NO CARD EXCEEDS ITS OWN RESERVATION (`reservedShortfall`) — a DIFFERENT
 *    question, and it reads 0 on the defect too; see its own site.
 *  · BOUND MAP POPULATED and LIVE HEIGHTS MOVED — the non-vacuity floor without
 *    which the two assertions above are satisfied by an empty map.
 *  · COMPLETENESS — every requested zoom visited, and cards measured at all.
 *
 * REPORTED, NOT ASSERTED — `worstShrink` (the live LOD delta, 430px at this
 * tip) and `distinctBoundAnswers` (2, not 1: the measurer pins the label scale
 * and releases the CSS body collapse, but cannot pin the React-gated LOD rung).
 *
 * NEVER ASSERTED — the POSITIVE control (`labelScale` AND `titleFont`) and the
 * CONTRAST control (`outsideFont`). All three are emitted into `HZJSON` for a
 * human to read; no `expect` requires any of them to move, so the probe can
 * stop exercising the mechanism and stay green. Promoting them is real work,
 * not a rename: it needs a settled-sample guard, since an unsettled camera
 * moves nothing.
 *
 * ⚠ THREE DRAFTS OF THIS BLOCK WERE WRONG, AND THE THIRD WAS WRONG BECAUSE IT
 * WAS ELABORATE. It split the unasserted controls into "read" and "captured
 * and never read" and put `outsideFont` in the second. There is no such state
 * in this file: `sample()` spreads the capture, `as Sample` strips nothing at
 * runtime, and `JSON.stringify` reads EVERY own field — so everything captured
 * is emitted, and `titleFont`, which no draft named at all, is in exactly the
 * same state as the other two. ASSERTED vs NOT is the whole distinction. Each
 * round added more precise-sounding prose and each round had a false limb
 * (CLAUDE.md trap 22f: when revisions oscillate, the approach is wrong, not the
 * wording).
 *
 * ⭐ AND THE SECOND HALF, WHICH IS THE ONE THE FIX ACTUALLY RESTS ON (review
 * note 1). "The layout ignores zoom" and "the number we feed the layout ignores
 * zoom" are different claims, and only the first is provable in jsdom. So at
 * every zoom this probe ALSO calls `measureNodeHeightsAtLabelBound()` — the real
 * module, in the real browser — and records what it returns. The property is
 * that the returned map is IDENTICAL at every zoom in the series while the live
 * heights beside it move ×2. If it is not, the fix is measuring the same moving
 * target through one more indirection.
 *
 * Result at `85742e9a` + this PR, 2/2 cells, 10/10 samples held: live Σ card
 * height takes SEVEN distinct values (3030 → 6211, ×2.05) while the measurer
 * takes TWO — one for every zoom ≥ `LABEL_LEGIBLE_ZOOM`, and a second, 92 px
 * (1.48%) SHORTER one below it, where the level-of-detail rung flips to
 * `line`. Worst single card
 * 16 px, against 45–64 px of designed row slack. Named and bounded, not
 * invariant; see the measurer's header.
 *
 * ⚠ RE-MEASURED 16 SEP 2026 ON `canvas/the-board-reads-as-one-argument`, because
 * the paragraph above is a RECORDED NUMBER from another tip and this branch
 * moved it. `LOD_BLANKED_BODY_STYLE` collapses the blanked body to one line, so
 * the measurer's second answer went from 16 px to **430 px** on the worst card —
 * past the 45 px sub-row slack, i.e. an overlap rather than a rounding.
 * `measureNodeHeightsAtLabelBound` now RELEASES that collapse while it reads and
 * the worst reservation spread is back to **38 px**. Both numbers are from the
 * mutation check (release removed / release present), same tip, same starter.
 *
 * ⚠ AND THE FIRST VERSION OF THIS PROBE COULD NOT HAVE TOLD YOU THAT. It set the
 * camera and assumed it stayed: a run recorded `1.2 1 0.5 0.5 0.7 …` for a
 * requested `1.2 1 0.9 0.8 0.7 …` — the product re-fitted underneath it — and
 * the verdict computed from that series was worthless in BOTH directions. Every
 * sample now re-reads the camera, retries, re-checks it HELD after any layout
 * the change provoked, and reads twice; anything that did not settle is
 * excluded and REPORTED, never averaged in.
 *
 * Run: pnpm exec playwright test -c playwright.geometry.config.ts heightVsZoom
 */
import { test, expect } from '@playwright/test'

import { GATE_TAG } from './canvasGateSet'
import { LAYOUT_PADDING_Y } from '../../src/canvas/utils/nodeLayoutConstants'
import { LAYOUT_DENSITY_PRESETS } from '../../src/canvas/layoutStore'
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

const STARTER = (process.env.HZ_STARTER ?? 'build-vs-buy') as StarterId
const VP = { width: Number(process.env.HZ_W ?? 1280), height: Number(process.env.HZ_H ?? 800) }
const ZOOMS = (process.env.HZ_ZOOMS ?? '1.2,1,0.9,0.8,0.7,0.6,0.5,0.45,0.434,0.4')
  .split(',').map(Number)

/**
 * ⭐ GATED. The describe is for the REGISTRY: `canvasGateReporter` keys on the
 * last two elements of `titlePath()`, so a top-level test keys on the FILE PATH.
 *
 * ⚠ THE TITLE IS DERIVED FROM `HZ_STARTER`/`HZ_W`/`HZ_H`, so the registry names
 * the DEFAULT POSTURE (`HZ build-vs-buy @1280x800`) and any run that overrides
 * those REDs the gate with MISSING + UNEXPECTED. That is deliberate rather than
 * a hazard to route around: a gate arm reconfigured by an environment variable
 * is an arm whose subject nobody can read off the registry, and the guard
 * refusing to bless it is the guard doing its job. Override the vars for a
 * deliberate LOCAL sweep, never in CI.
 */
test.describe('card height vs camera zoom', () => {
test(`HZ ${STARTER} @${VP.width}x${VP.height}`, { tag: GATE_TAG }, async ({ page }) => {
  await preparePage(page, VP)
  await openCanvas(page)
  await seedStarterDraft(page, STARTER)
  await clearNotifications(page)
  await minimiseFloatingOlumiPanel(page)
  await waitForVisualQuiescence(page)
  await page.waitForTimeout(3000)

  /** Drive the camera and REPORT WHAT IT ACTUALLY DID. */
  const setZoom = async (zoom: number) => {
    await page.evaluate((z) => {
      const w = window as unknown as { __rfSetViewport?: (v: unknown) => void }
      // React Flow exposes the store on the container; drive the transform
      // through the store so no gesture emulation is involved.
      const el = document.querySelector('.react-flow') as (HTMLElement & { __reactFlowInstance?: unknown }) | null
      void el; void w
      const store = (window as unknown as { __rfStore?: { getState: () => { setViewport?: (v: unknown) => void; panZoom?: { setViewport: (v: unknown, o?: unknown) => Promise<unknown> }; transform: number[] } } }).__rfStore
      if (store) {
        const s = store.getState()
        const [x, y] = s.transform
        void s.panZoom?.setViewport({ x, y, zoom: z }, { duration: 0 })
      }
    }, zoom)
    await page.waitForTimeout(700)
  }

  const readZoom = async (): Promise<number | null> =>
    page.evaluate(() => {
      const st = (window as unknown as { __rfStore?: { getState: () => { transform: number[] } } }).__rfStore
      return st ? +st.getState().transform[2].toFixed(4) : null
    })

  /**
   * ⚠ THE CAMERA DOES NOT ALWAYS STAY WHERE IT IS PUT, and a probe that assumes
   * it does reports a sweep it never performed. A first run recorded
   * `1.2 1 0.5 0.5 0.7 …` for a requested `1.2 1 0.9 0.8 0.7 …` — the product
   * re-fitted underneath it — and the invariance verdict computed from that
   * series was worthless in both directions. So: set, re-read, retry, and
   * RECORD THE ZOOM ACHIEVED. A sample that never reached its target is marked
   * and excluded from the invariant rather than quietly averaged into it.
   */
  const sample = async (zoom: number) => {
    let reached = false
    let actual: number | null = null
    for (let attempt = 0; attempt < 4 && !reached; attempt++) {
      await setZoom(zoom)
      actual = await readZoom()
      reached = actual !== null && Math.abs(actual - zoom) < 0.005
    }
    // Let any layout the zoom change provoked land, then confirm the camera is
    // STILL where we put it before reading anything.
    await page.waitForTimeout(900)
    const settled = await readZoom()
    const held = settled !== null && Math.abs(settled - zoom) < 0.005
    const first = await readSample()
    // A second read at the same camera: if the two disagree, the DOM was still
    // moving and neither number describes a settled state.
    await page.waitForTimeout(600)
    const second = await readSample()
    return { requested: zoom, actual, settled, reached, held, ...first, secondBound: second.boundHeights }
  }

  const readSample = async () => {
    return page.evaluate(() => {
      const root = document.querySelector('.react-flow') as HTMLElement | null
      const heights: Record<string, number> = {}
      const titleFont: Record<string, string> = {}
      for (const el of document.querySelectorAll('.react-flow__node[data-id]')) {
        const e = el as HTMLElement
        heights[e.dataset.id!] = e.offsetHeight
        const t = e.querySelector('[data-testid="node-title"]') as HTMLElement | null
        if (t) titleFont[e.dataset.id!] = getComputedStyle(t).fontSize
      }
      const outside = document.querySelector('body > div') as HTMLElement | null
      const st = (window as unknown as { __rfStore?: { getState: () => { transform: number[] } } }).__rfStore
      const bound = (window as unknown as { __boundHeights?: () => Record<string, number> }).__boundHeights?.() ?? null
      return {
        boundHeights: bound,
        zoom: st ? st.getState().transform[2] : null,
        labelScale: root ? getComputedStyle(root).getPropertyValue('--canvas-label-scale').trim() : null,
        heights,
        titleFont,
        outsideFont: outside ? getComputedStyle(outside).fontSize : null,
      }
    })
  }

  // Expose the REAL measurer to the page, so the invariant below is about the
  // shipped module and not about a re-implementation of it in the probe.
  await page.evaluate(async () => {
    // Absent on a build that predates the module — the probe then reports
    // `boundHeights: null` and `boundIsZoomInvariant: false` rather than
    // throwing, so the SAME probe can be pointed at either arm of an A/B.
    try {
      const modulePath = '/src/canvas/utils/measureNodeHeightsAtLabelBound.ts'
      const mod = (await import(/* @vite-ignore */ modulePath)) as {
        measureNodeHeightsAtLabelBound: () => Map<string, number>
      }
      ;(window as unknown as { __boundHeights: () => Record<string, number> }).__boundHeights = () =>
        Object.fromEntries(mod.measureNodeHeightsAtLabelBound())
    } catch { /* module not present on this build */ }
  })

  // Expose React Flow's store so the probe can drive the transform directly.
  await page.evaluate(() => {
    const el = document.querySelector('.react-flow') as HTMLElement | null
    if (!el) return
    // xyflow attaches the zustand store to the container's React fibre; walk it.
    const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'))
    if (!key) return
    let fibre = (el as unknown as Record<string, { return?: unknown }>)[key] as
      | { return?: unknown; memoizedProps?: Record<string, unknown>; type?: unknown; memoizedState?: unknown }
      | undefined
    for (let i = 0; i < 60 && fibre; i++) {
      const ctx = (fibre as { memoizedProps?: { value?: unknown } }).memoizedProps?.value as
        | { getState?: () => unknown; subscribe?: unknown }
        | undefined
      if (ctx && typeof ctx.getState === 'function' && typeof (ctx as { subscribe?: unknown }).subscribe === 'function') {
        const s = ctx.getState() as Record<string, unknown>
        if (Array.isArray(s.transform)) {
          ;(window as unknown as { __rfStore: unknown }).__rfStore = ctx
          return
        }
      }
      fibre = (fibre as { return?: typeof fibre }).return
    }
  })

  type Sample = {
    requested: number
    actual: number | null
    settled: number | null
    reached: boolean
    held: boolean
    zoom: number | null
    labelScale: string | null
    heights: Record<string, number>
    boundHeights: Record<string, number> | null
    secondBound: Record<string, number> | null
  }
  const series: Sample[] = []
  for (const z of ZOOMS) series.push((await sample(z)) as Sample)

  // ── THE INVARIANT (review note 1) ──────────────────────────────────────────
  // The measurer's answer must be the SAME at every zoom, while the live heights
  // beside it move. Reported as a verdict, not left for a reader to eyeball.
  const digest = (m: Record<string, number> | null): string =>
    m === null ? 'null' : JSON.stringify(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)))

  // Only samples where the camera reached AND HELD the requested zoom, and where
  // two consecutive reads at that camera agreed, describe a settled state.
  const usable = series.filter((s) => s.held && digest(s.boundHeights) === digest(s.secondBound))
  const boundDigests = [...new Set(usable.map((s) => digest(s.boundHeights)))]
  const liveDigests = [...new Set(usable.map((s) => digest(s.heights)))]
  const invariant = {
    // The claim, over the samples that are entitled to support it.
    boundIsZoomInvariant: boundDigests.length === 1 && boundDigests[0] !== 'null',
    distinctBoundAnswers: boundDigests.length,
    // ⚠ THE CONTRAST THAT STOPS IT BEING VACUOUS (trap 13e). A measurer that
    // returned an empty map at every zoom would satisfy the line above
    // perfectly, and so would a sweep that only ever visited one zoom. These
    // assert that the live heights DID move over the SAME samples, that more
    // than one distinct zoom was actually held, and that the bound map is
    // non-empty — so "identical" is a discrimination the probe made, not one it
    // failed to make.
    distinctLiveAnswers: liveDigests.length,
    distinctZoomsHeld: [...new Set(usable.map((s) => s.settled))].length,
    distinctScalesHeld: [...new Set(usable.map((s) => s.labelScale))].length,
    boundEntryCount: usable[0]?.boundHeights === null ? 0 : Object.keys(usable[0]?.boundHeights ?? {}).length,
    usableSamples: usable.length,
    totalSamples: series.length,
    unheld: series.filter((s) => !s.held).map((s) => `${s.requested}->${s.settled}`),
    unsettled: series.filter((s) => s.held && digest(s.boundHeights) !== digest(s.secondBound)).map((s) => s.requested),
  }

  // ── LOD DIRECTION, PER CARD (review note 3) ────────────────────────────────
  //
  // The counter-scale term is removed by construction. LOD is the term that
  // remains, and the safety argument for leaving it is entirely DIRECTIONAL: a
  // card that shrinks below its reserved height leaves whitespace; a card that
  // GREW past it would overlap the row beneath. Until now that direction rested
  // on one measurement written into a comment. This asserts it.
  //
  // ⚠ `lodTitleBoostIsBounded.spec.ts` guards only the TITLE limb of LOD (the
  // −16px on the goal and decision cards). The −12px on the outcome/risk cards
  // comes from other LOD-gated body content and has no CI guard at all — THE TWO
  // assertions below are the only thing in the repo that watches it, and they do
  // not run in CI. Run this probe when you change LOD-gated body content.
  //
  // ⭐ BOTH DIRECTIONS, because a layout can be computed in EITHER LOD state and
  // the two failure modes are mirror images:
  //   · layout computed with LOD OFF, then LOD turns on → a card that GREW
  //     overflows the row band. Caught by `grew` below.
  //   · layout computed with LOD ON, then LOD turns off → every card grows back
  //     by its full LOD delta against a stride reserved for the shorter card.
  //     Caught by `worstShrink < SUB_ROW_SLACK` below.
  // The first was asserted from the start; the second rested on a margin stated
  // in a comment until it was asserted here.
  //
  // ⭐⭐ ITS DETECTION FLOOR, MEASURED RATHER THAN ASSUMED — because the obvious
  // mutant SURVIVED and that had to be explained, not waved through (trap 13c:
  // an equivalent mutant must be DEMONSTRATED). Raising the LOD title boost in
  // `BaseNode`, one size per run, applied-check 1, restored from HEAD between,
  // with a trailing control that passed:
  //
  //     text-3xl (30px)  SURVIVES — and the numbers say why: `dec_billing` and
  //                      `goal_billing` drop OUT of the moved set entirely
  //                      (7 movers → 5). At 30px the LOD-on card lands level
  //                      with its LOD-off self, so it is not taller, so there
  //                      is no harm to detect. Genuinely equivalent HERE.
  //     text-5xl (48px)  REDs
  //     text-7xl (72px)  REDs
  //
  // The floor is not a weakness in the assertion, it IS the property: the
  // layout reserves the LOD-OFF height, so a title that grows within that
  // headroom costs nothing. What follows is how the two guards divide, and
  // neither substitutes for the other:
  //
  //   `lodTitleBoostIsBounded.spec.ts` compares DECLARED SIZES (30 > 24), so it
  //   REDs at text-3xl — strictly more sensitive, runs in CI, sees only the
  //   TITLE.
  //   This probe compares RENDERED CARD HEIGHTS, so it is blind below the
  //   headroom — but it sees EVERY LOD-gated term, including the outcome/risk
  //   body limb that no CI test covers at all.
  // DERIVED, never restated — `zoomLadder.measure.ts` imports the same
  // constant. This was a hand-written `0.5`: a third copy of the legibility
  // floor, in a file that partitions its whole sample on it, and nothing would
  // have gone red when it stopped agreeing (CLAUDE.md trap 12). It sits outside
  // `src/canvas`, so `zoomLegibilitySingleSource.spec.ts` never scanned it.
  const LOD_THRESHOLD = LABEL_LEGIBLE_ZOOM
  const lodOff = usable.filter((s) => (s.settled ?? 0) >= LOD_THRESHOLD)
  const lodOn = usable.filter((s) => (s.settled ?? 1) < LOD_THRESHOLD)

  // A positive control FIRST: an "all ≤" verdict over an empty partition, or
  // over cards that never differ, is vacuous (trap 13). The sweep must actually
  // have visited both states.
  expect(lodOff.length, 'no settled sample at or above the LOD threshold — the direction check has nothing to compare').toBeGreaterThan(0)
  expect(lodOn.length, 'no settled sample below the LOD threshold — the direction check has nothing to compare').toBeGreaterThan(0)

  const worstOff: Record<string, number> = {}
  for (const s of lodOff) for (const [id, h] of Object.entries(s.heights)) worstOff[id] = Math.max(worstOff[id] ?? 0, h)
  const grew: string[] = []
  const moved: string[] = []
  for (const s of lodOn) {
    for (const [id, h] of Object.entries(s.heights)) {
      const off = worstOff[id]
      if (off === undefined) continue
      if (h > off) grew.push(`${id}: LOD-off ${off} -> LOD-on ${h} (+${h - off}) at zoom ${s.settled}`)
      else if (h < off) moved.push(id)
    }
  }

  // Bounded against the TIGHTEST slack the layout ever leaves — the SUB-ROW gap,
  // derived from the same two values `normaliseTierRows` uses, never restated.
  const SUB_ROW_SLACK = Math.round(LAYOUT_DENSITY_PRESETS.comfortable.layerSpacing * 0.6) + LAYOUT_PADDING_Y

  // The LIVE LOD delta — how much shorter a card DRAWS below the legibility
  // floor. Reported, and deliberately NOT asserted; see the block below.
  const worstShrink = Math.max(0, ...lodOn.flatMap((s) =>
    Object.entries(s.heights).map(([id, h]) => (worstOff[id] === undefined ? 0 : worstOff[id] - h)),
  ))

  /**
   * ⭐⭐ THE NUMBER THAT DECIDES OVERLAP IS THE ONE THE LAYOUT CONSUMES — and
   * until 16 Sep 2026 this file asserted a PROXY for it instead.
   *
   * A card overlaps the row beneath it iff the stride the layout RESERVED for it
   * is smaller than the height it DRAWS. `getNodeDimensions` reserves
   * `heightAtLabelBound.get(id)` — PREFERRED over `measured.height` — so the
   * reservation is `boundHeights`, which this probe already captures per sample
   * and, until now, only printed.
   *
   * What was asserted instead was `worstShrink < SUB_ROW_SLACK`: the LIVE delta
   * across the LOD threshold. That is a proxy, and it was a sound one while the
   * bound measurer shared the live reading's LOD sensitivity — then "the card
   * shrank by X" and "the reservation was X short" were the same number.
   *
   * ⛔ THEY ARE NO LONGER THE SAME NUMBER, AND THE PROXY NOW FAILS IN THE WRONG
   * DIRECTION — it REDs on the fix. MEASURED at this branch's tip:
   *
   *     worstShrink (live delta)          430px   — the deliberate product change
   *     worstBoundSpread                   38px   — how far the reservation moves,
   *                                                against 45px of sub-row slack
   *     worstReservedShortfall            <= 0    — no card exceeds its reservation
   *
   * ⚠ THAT MIDDLE ROW SAID `distinctBoundAnswers 1 — the reservation does NOT
   * move` UNTIL 16 SEP 2026, AND IT WAS A FIRST DRAFT'S NUMBER LEFT STANDING.
   * The reservation moves: two answers, 38px apart, because the measurer pins
   * the label scale and releases the CSS collapse but cannot pin the
   * React-gated LOD rung. The assertion below was corrected to a BOUND for
   * exactly that reason — and this table, which is what a reader checks it
   * against, kept the superseded claim three paragraphs away from its own
   * correction. A precise-looking stale number inside the block that documents
   * the fix is this estate's most-repeated defect (CLAUDE.md trap 12), and it
   * is recorded here rather than quietly overwritten.
   *
   * The 430px is `LOD_BLANKED_BODY_STYLE` collapsing the blanked body to one
   * line, which the founder asked for (cards were drawing ~370px tall carrying
   * two lines of text). A card drawing SHORTER than its reserved row leaves
   * WHITESPACE; it cannot overlap anything. The harm the old assertion named —
   * "a layout computed while LOD is ON reserves the shorter height" — is now
   * prevented at source: `measureNodeHeightsAtLabelBound` releases the collapse
   * while it reads, so the reservation is the LOD-OFF height whatever the zoom.
   *
   * ⭐ SO THIS IS NOT A RELAXED TOLERANCE. The threshold is not widened, it is
   * replaced by the property it was standing in for, asserted directly and at
   * zero tolerance: no card may ever draw taller than what the layout reserved
   * for it. That is strictly tighter than `< 45px` — it admits no shortfall at
   * all — and it is measured on the map `getNodeDimensions` actually reads.
   */
  const reservedShortfall: string[] = []
  for (const s of usable) {
    for (const [id, live] of Object.entries(s.heights)) {
      const reserved = s.boundHeights?.[id]
      if (reserved === undefined) continue
      if (live > reserved) reservedShortfall.push(`${id}: reserved ${reserved} < drew ${live} (+${live - reserved}) at zoom ${s.settled}`)
    }
  }
  const worstReservedShortfall = Math.max(0, ...usable.flatMap((s) =>
    Object.entries(s.heights).map(([id, live]) => {
      const reserved = s.boundHeights?.[id]
      return reserved === undefined ? 0 : live - reserved
    }),
  ))

  /**
   * ⭐ HOW FAR THE RESERVATION ITSELF MOVES ACROSS THE SWEEP — the ORIGINAL
   * assertion of this block, re-pointed at the map the layout actually reads.
   *
   * ⚠ AND IT IS `< SUB_ROW_SLACK`, NOT `=== 1 distinct answer`. A first draft
   * asserted perfect invariance and was WRONG — measured 2, and the module never
   * claimed otherwise: `measureNodeHeightsAtLabelBound`'s header says outright
   * that it pins the label SCALE but cannot pin the LOD RUNG, because the rung is
   * read by React components and no re-render is available inside a synchronous
   * measurement. What it CAN release is the CSS limb (the collapsed body); the
   * residue is genuinely React-gated content and is the ±16px the header names.
   *
   * So the honest property is the one that header states and only stated — the
   * residue is BOUNDED, and bounded by the tightest slack the layout leaves.
   * That is asserted here rather than left in prose, against the SAME constant
   * and the SAME threshold the live-delta assertion used before it. The subject
   * moved from `heights` to `boundHeights`; the bar did not.
   *
   * MEASURED at this branch's tip: 430px before the measurer released the
   * collapse, against 45px of slack — i.e. this REDs on the defect.
   */
  const boundSpread: Record<string, { min: number, max: number }> = {}
  for (const s of usable) {
    for (const [id, h] of Object.entries(s.boundHeights ?? {})) {
      const seen = boundSpread[id]
      if (seen === undefined) boundSpread[id] = { min: h, max: h }
      else { seen.min = Math.min(seen.min, h); seen.max = Math.max(seen.max, h) }
    }
  }
  const worstBoundSpread = Math.max(0, ...Object.values(boundSpread).map((b) => b.max - b.min))

  const lod = {
    lodOffSamples: lodOff.length, lodOnSamples: lodOn.length,
    cardsThatMoved: [...new Set(moved)].length, cardsThatGrew: grew.length,
    worstShrink, subRowSlack: SUB_ROW_SLACK,
    worstReservedShortfall, reservedShortfallCount: reservedShortfall.length,
    worstBoundSpread,
  }

  /**
   * ⭐ LOGGED BEFORE THE ASSERTIONS, DELIBERATELY. Every assertion below throws,
   * and a probe whose diagnostics sit AFTER them prints nothing on precisely the
   * runs someone needs the numbers for — the attribution is then a whole cycle
   * away. `modelRowEditReflow.measure.ts` logs before asserting for this exact
   * reason and says so. (This cost a cycle on 16 Sep: the first red printed the
   * failing threshold and none of the series behind it.)
   */
  // eslint-disable-next-line no-console
  console.log('HZJSON ' + JSON.stringify({ starter: STARTER, vp: `${VP.width}x${VP.height}`, invariant, lod, series }))

  expect(
    [...new Set(moved)].length,
    'NO card changed height across the LOD threshold — the comparison is not discriminating, so "nothing grew" says nothing',
  ).toBeGreaterThan(0)
  expect(
    grew,
    'a card is TALLER with LOD on than the tallest it reaches with LOD off. The layout reserves the LOD-off height, so this card now overflows its row band below the legibility floor — the defect this PR closes, arriving through the LOD door.',
  ).toEqual([])

  /**
   * ⭐ THE NON-VACUITY FLOOR FOR THE ASSERTION BELOW, and it has to come first.
   *
   * "No card drew taller than its reservation" is satisfied PERFECTLY by a
   * measurer that returned an empty map, or by one whose ids do not match the
   * live ones — in both cases every `reserved === undefined` and the loop
   * compares nothing (CLAUDE.md trap 13). So the probe must first prove it made
   * the comparison at all: the bound map is populated, it is SINGLE-VALUED
   * across the sweep (which is the property the fix delivers), and the live
   * heights beside it DID move over the same samples.
   */
  expect(invariant.boundEntryCount, 'the bound map is empty — the shortfall check below would compare nothing and pass vacuously').toBeGreaterThan(0)
  expect(
    invariant.distinctLiveAnswers,
    'the LIVE heights did not move across the sweep — the bound being constant is then no discrimination, it is a sweep that visited one state',
  ).toBeGreaterThan(1)
  expect(
    worstBoundSpread,
    `the height the layout RESERVES for a card moves ${worstBoundSpread}px across the zoom sweep, against the ${SUB_ROW_SLACK}px of sub-row slack that has to absorb it. A layout run at one zoom then reserves a stride that is wrong at every other — the overlap defect \`measureNodeHeightsAtLabelBound\` exists to close. The LOD body collapse is the usual way this regresses: check that the measurer still RELEASES it (\`LOD_BLANKED_BODY_SELECTOR\`) while it reads.`,
  ).toBeLessThan(SUB_ROW_SLACK)

  /**
   * ⭐ THE SAME-INSTANT CHECK: no card may draw taller than its own reservation.
   *
   * ⚠ AND IT IS NOT THE GUARD THAT CATCHES THE LOD DEFECT — stated plainly,
   * because a reader scanning for "the assertion that would have caught it"
   * must not stop here. MEASURED in both arms of the mutation check on 16 Sep:
   *
   *     release removed (the defect)   worstBoundSpread 430   reservedShortfall 0
   *     release present (the fix)      worstBoundSpread  38   reservedShortfall 0
   *
   * It reads ZERO in both, because this probe captures `boundHeights` at the
   * SAME zoom as the live heights — so on a defective build a collapsed live
   * height is compared against an equally collapsed reservation and the two
   * agree. The cross-zoom harm is invisible to it BY CONSTRUCTION, and
   * `worstBoundSpread` above is what discriminates.
   *
   * It stays because it answers a DIFFERENT question (trap 21): a card that
   * exceeds its reservation at the instant both are measured is a distinct
   * defect — one this file would otherwise have no assertion for — and it costs
   * nothing to keep watching for it at zero tolerance.
   */
  expect(
    reservedShortfall,
    `a card DRAWS taller than the height the layout reserved for it (worst +${worstReservedShortfall}px). \`getNodeDimensions\` sizes the row band from \`heightAtLabelBound\`, so a card exceeding that entry overflows its band and overlaps the row beneath.`,
  ).toEqual([])

  // ── COMPLETENESS, ASSERTED IN THE PROBE ITSELF ────────────────────────────
  // ⚠ A cell that produces no data is an INSTRUMENT failure, and it must be the
  // PROBE that says so, not the script that happened to run it. An earlier A/B
  // driver carried that assertion and lived only in a working directory; the
  // check disappeared with it, and 11 of 12 cells went silently missing.
  expect(series.length, 'the sweep did not visit every requested zoom').toBe(ZOOMS.length)
  expect(invariant.boundEntryCount + Object.keys(series[0].heights).length, 'the probe measured no cards at all').toBeGreaterThan(0)
})
})
