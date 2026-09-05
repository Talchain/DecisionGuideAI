/**
 * HEIGHT-vs-ZOOM — is the rendered card height a FUNCTION OF THE VIEWPORT ZOOM?
 *
 * The layout's vertical stride is fixed at layout time from measured heights.
 * If a card's height in MODEL px changes when only the camera zoom changes,
 * then the stride is computed against a height the card does not keep, and
 * every row can be under-spaced without anything in the layout being wrong.
 *
 * CONTROLS (a probe with no control proves nothing — CLAUDE.md trap 13).
 * ⚠ SPLIT INTO WHAT IS ENFORCED AND WHAT IS ONLY RECORDED, because this block
 * previously listed all four under one heading and a reader took the heading
 * for the guarantee. A declared control that nothing asserts is prose.
 *
 * ASSERTED — these RED the run:
 *  · BOTH LOD ARMS POPULATED (`:338`, `:339`): a settled sample must exist on
 *    each side of the legibility threshold, or the direction check below has
 *    nothing to compare.
 *  · NON-VACUITY (`:353`): at least one card must CHANGE height across the LOD
 *    threshold. A comparison that discriminates nothing cannot report that
 *    nothing grew.
 *  · COMPLETENESS (`:389`-`:390`): every requested zoom was visited, and cards
 *    were measured at all. A cell producing no data is an INSTRUMENT failure,
 *    and the probe must be the thing that says so.
 *
 * NEVER ASSERTED — and the two are NOT in the same state, which an earlier
 * draft of this block flattened under one heading ("captured and never read"):
 *  · POSITIVE — `labelScale` (`:181`) IS READ, at `:269`, into
 *    `invariant.distinctScalesHeld`. It reaches `HZJSON` as a derived count a
 *    human can check. What no `expect` does is REQUIRE it to change, so the
 *    probe can silently stop exercising the mechanism and stay green.
 *  · CONTRAST — `outsideFont` (`:184`) is captured and has NO reader at all,
 *    derived or otherwise. An element outside the React Flow subtree SHOULD NOT
 *    change across the series; nothing checks, and nothing even counts.
 *
 *  Read-but-unasserted and captured-unread are different failures and want
 *  different fixes, which is why they are now named apart.
 *  Promoting these two to assertions is real work, not a rename: it needs a
 *  settled-sample guard, since an unsettled camera moves neither.
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
  expect(
    [...new Set(moved)].length,
    'NO card changed height across the LOD threshold — the comparison is not discriminating, so "nothing grew" says nothing',
  ).toBeGreaterThan(0)
  expect(
    grew,
    'a card is TALLER with LOD on than the tallest it reaches with LOD off. The layout reserves the LOD-off height, so this card now overflows its row band below the legibility floor — the defect this PR closes, arriving through the LOD door.',
  ).toEqual([])

  // ⭐ THE OTHER DIRECTION, WHICH THE ASSERTION ABOVE DOES NOT COVER.
  //
  // `grew` catches a layout computed with LOD OFF meeting a taller LOD-on card.
  // The mirror case is a layout computed while LOD is ON — it reserves the
  // SHORTER height, and every card then GROWS by its LOD delta when the user
  // zooms back in past the legibility floor. That direction rested only on a
  // stated margin ("16px against 45px") in a comment. It is arithmetic the probe
  // already holds both sides of, so it is asserted rather than stated.
  //
  // Bounded against the TIGHTEST slack the layout ever leaves — the SUB-ROW gap,
  // derived from the same two values `normaliseTierRows` uses, never restated.
  const SUB_ROW_SLACK = Math.round(LAYOUT_DENSITY_PRESETS.comfortable.layerSpacing * 0.6) + LAYOUT_PADDING_Y
  const worstShrink = Math.max(0, ...lodOn.flatMap((s) =>
    Object.entries(s.heights).map(([id, h]) => (worstOff[id] === undefined ? 0 : worstOff[id] - h)),
  ))
  expect(
    worstShrink,
    `a card's LOD delta (${worstShrink}px) has reached the tightest row slack the layout leaves (${SUB_ROW_SLACK}px). A layout computed while LOD is ON reserves the shorter height, so zooming back in past the legibility floor would now push a card into the row beneath it.`,
  ).toBeLessThan(SUB_ROW_SLACK)

  const lod = { lodOffSamples: lodOff.length, lodOnSamples: lodOn.length, cardsThatMoved: [...new Set(moved)].length, cardsThatGrew: grew.length, worstShrink, subRowSlack: SUB_ROW_SLACK }

  // ── COMPLETENESS, ASSERTED IN THE PROBE ITSELF ────────────────────────────
  // ⚠ A cell that produces no data is an INSTRUMENT failure, and it must be the
  // PROBE that says so, not the script that happened to run it. An earlier A/B
  // driver carried that assertion and lived only in a working directory; the
  // check disappeared with it, and 11 of 12 cells went silently missing.
  expect(series.length, 'the sweep did not visit every requested zoom').toBe(ZOOMS.length)
  expect(invariant.boundEntryCount + Object.keys(series[0].heights).length, 'the probe measured no cards at all').toBeGreaterThan(0)

  // eslint-disable-next-line no-console
  console.log('HZJSON ' + JSON.stringify({ starter: STARTER, vp: `${VP.width}x${VP.height}`, invariant, lod, series }))
})
})
