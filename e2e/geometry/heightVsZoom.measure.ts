/**
 * HEIGHT-vs-ZOOM — is the rendered card height a FUNCTION OF THE VIEWPORT ZOOM?
 *
 * The layout's vertical stride is fixed at layout time from measured heights.
 * If a card's height in MODEL px changes when only the camera zoom changes,
 * then the stride is computed against a height the card does not keep, and
 * every row can be under-spaced without anything in the layout being wrong.
 *
 * CONTROLS (a probe with no control proves nothing — CLAUDE.md trap 13):
 *  · POSITIVE: the `--canvas-label-scale` custom property on the React Flow
 *    root, and the computed font-size of a node title, MUST change across the
 *    zoom series. If they do not, the probe never exercised the mechanism.
 *  · CONTRAST: an element OUTSIDE the React Flow subtree must NOT change its
 *    font-size across the same series. A probe that reports "everything moved"
 *    is measuring a page re-render, not this mechanism.
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
 * (1.48%) SHORTER one below it, where `lodActive` flips. Worst single card
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
import { test } from '@playwright/test'
import {
  openCanvas,
  preparePage,
  seedStarterDraft,
  clearNotifications,
  minimiseFloatingOlumiPanel,
  waitForVisualQuiescence,
  type StarterId,
} from '../visual/harness'

const STARTER = (process.env.HZ_STARTER ?? 'build-vs-buy') as StarterId
const VP = { width: Number(process.env.HZ_W ?? 1280), height: Number(process.env.HZ_H ?? 800) }
const ZOOMS = (process.env.HZ_ZOOMS ?? '1.2,1,0.9,0.8,0.7,0.6,0.5,0.45,0.434,0.4')
  .split(',').map(Number)

test(`HZ ${STARTER} @${VP.width}x${VP.height}`, async ({ page }) => {
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

  // eslint-disable-next-line no-console
  console.log('HZJSON ' + JSON.stringify({ starter: STARTER, vp: `${VP.width}x${VP.height}`, invariant, series }))
})
