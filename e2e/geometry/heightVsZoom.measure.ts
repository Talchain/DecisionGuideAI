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

  const sample = async (zoom: number) => {
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
      return {
        zoom: st ? st.getState().transform[2] : null,
        labelScale: root ? getComputedStyle(root).getPropertyValue('--canvas-label-scale').trim() : null,
        heights,
        titleFont,
        outsideFont: outside ? getComputedStyle(outside).fontSize : null,
      }
    })
  }

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

  const series: unknown[] = []
  for (const z of ZOOMS) series.push(await sample(z))

  // eslint-disable-next-line no-console
  console.log('HZJSON ' + JSON.stringify({ starter: STARTER, vp: `${VP.width}x${VP.height}`, series }))
})
