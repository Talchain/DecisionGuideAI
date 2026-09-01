/**
 * RESTORE HEIGHT DELTA — what does a reloaded model's geometry disagree with?
 *
 * ARM 2 of `overlapSequence` proved the reload path is deterministic and that
 * all three corrective branches are unreachable there. This probe answers the
 * next question: after #1117 fixed the WIDTH, what is the RESIDUAL made of?
 *
 * It captures, on BOTH sides of a real reload through the product's own write
 * path: the camera zoom, the `--canvas-label-scale`, every card's rendered
 * height and width, and every persisted position. Then it computes, per
 * vertically-adjacent pair, the gap the layout intended (LAYOUT_PADDING_Y +
 * effectiveLayerSpacing) against the gap on screen.
 *
 * CONTROLS:
 *  · CONTRAST — the ghost nodes carry no counter-scaled label text, so their
 *    height must NOT move when the scale does. If everything moves, the probe
 *    is reporting a re-render.
 *  · CAUSAL — after the series, force a re-layout (`applyLayout`) at the
 *    post-reload heights. If overlap goes to zero, the persisted geometry is
 *    inconsistent with the heights the cards now have; if it does not, the
 *    diagnosis is wrong and must be discarded.
 *  · SERIES — 20 samples over 30s, so a transient cannot be reported as
 *    terminal (`waitForVisualQuiescence` settles faster than a corrective pass).
 */
import { test } from '@playwright/test'
import {
  openCanvas, preparePage, seedStarterDraft, clearNotifications,
  minimiseFloatingOlumiPanel, waitForVisualQuiescence, type StarterId,
} from '../visual/harness'

const STARTER = (process.env.RH_STARTER ?? 'build-vs-buy') as StarterId
const VP = { width: Number(process.env.RH_W ?? 1280), height: Number(process.env.RH_H ?? 800) }
const TRIALS = Number(process.env.RH_TRIALS ?? 1)

const SNAP = () => {
  const w = window as unknown as {
    useCanvasStore: { getState: () => { nodes: Array<{ id: string; type?: string; position: { x: number; y: number } }>; layoutVersion: number } }
  }
  const st = w.useCanvasStore.getState()
  const root = document.querySelector('.react-flow') as HTMLElement | null
  const vp = document.querySelector('.react-flow__viewport') as HTMLElement | null
  const m = vp ? new DOMMatrixReadOnly(getComputedStyle(vp).transform) : null
  const box: Record<string, [number, number]> = {}
  for (const el of document.querySelectorAll('.react-flow__node[data-id]')) {
    const e = el as HTMLElement
    box[e.dataset.id!] = [e.offsetWidth, e.offsetHeight]
  }
  const nodes = st.nodes.filter((n) => box[n.id]).map((n) => ({
    id: n.id, type: n.type ?? null,
    x: Math.round(n.position.x), y: Math.round(n.position.y),
    w: box[n.id][0], h: box[n.id][1],
  }))
  let pairs = 0
  const worst: Array<{ a: string; b: string; ox: number; oy: number }> = []
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const A = nodes[i], B = nodes[j]
    const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x)
    const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y)
    if (ox > 0 && oy > 0) { pairs++; worst.push({ a: A.id, b: B.id, ox: +ox.toFixed(1), oy: +oy.toFixed(1) }) }
  }
  // Tightest vertical gap between cards that share horizontal extent.
  const gaps: Array<{ a: string; b: string; gap: number; ox: number }> = []
  for (let i = 0; i < nodes.length; i++) for (let j = 0; j < nodes.length; j++) {
    if (i === j) continue
    const A = nodes[i], B = nodes[j]
    if (A.y + A.h > B.y) continue // A must sit above B
    const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x)
    if (ox <= 0) continue
    gaps.push({ a: A.id, b: B.id, gap: +(B.y - (A.y + A.h)).toFixed(1), ox: +ox.toFixed(1) })
  }
  gaps.sort((p, q) => p.gap - q.gap)
  return {
    lv: st.layoutVersion,
    zoom: m ? +m.a.toFixed(4) : null,
    labelScale: root ? getComputedStyle(root).getPropertyValue('--canvas-label-scale').trim() : null,
    pairs,
    worst: worst.sort((a, b) => b.ox * b.oy - a.ox * a.oy).slice(0, 5),
    tightestGaps: gaps.slice(0, 8),
    nodes,
  }
}

for (let trial = 1; trial <= TRIALS; trial++) {
test(`RH ${STARTER} @${VP.width}x${VP.height} #${trial}`, async ({ page }) => {
  await preparePage(page, VP)
  await openCanvas(page)
  await seedStarterDraft(page, STARTER)
  await clearNotifications(page)
  await minimiseFloatingOlumiPanel(page)
  await waitForVisualQuiescence(page)
  await page.waitForTimeout(4000)

  // ── ARM B: the last layout ran at a DIFFERENT ZOOM from the one the model is
  // later viewed at. `RH_LAYOUT_ZOOM` sets the camera and then calls
  // `applyLayout` exactly as the context menu's Auto-arrange does
  // (`contextMenu/useMenuItems.ts:268` — a DIRECT call, so it never enters
  // `useMeasureThenLayout`'s gate and never records `laidOutHeightsRef`).
  const LAYOUT_ZOOM = process.env.RH_LAYOUT_ZOOM ? Number(process.env.RH_LAYOUT_ZOOM) : null
  let armB: unknown = null
  if (LAYOUT_ZOOM !== null) {
    await page.evaluate((z) => {
      const el = document.querySelector('.react-flow') as HTMLElement | null
      if (!el) return
      const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'))
      if (!key) return
      let fibre = (el as unknown as Record<string, unknown>)[key] as { return?: unknown; memoizedProps?: { value?: unknown } } | undefined
      for (let i = 0; i < 60 && fibre; i++) {
        const ctx = fibre.memoizedProps?.value as { getState?: () => Record<string, unknown> } | undefined
        if (ctx && typeof ctx.getState === 'function') {
          const st = ctx.getState()
          if (Array.isArray(st.transform)) {
            const t = st.transform as number[]
            const pz = st.panZoom as { setViewport: (v: unknown, o?: unknown) => Promise<unknown> } | undefined
            void pz?.setViewport({ x: t[0], y: t[1], zoom: z }, { duration: 0 })
            return
          }
        }
        fibre = (fibre as { return?: typeof fibre }).return
      }
    }, LAYOUT_ZOOM)
    await page.waitForTimeout(1200)
    const atZoom = await page.evaluate(SNAP)
    await page.evaluate(async () => {
      const w = window as unknown as { useCanvasStore: { getState: () => { applyLayout: (o?: unknown) => Promise<unknown> } } }
      await w.useCanvasStore.getState().applyLayout()
    })
    await page.waitForTimeout(4000)
    const afterArrange = await page.evaluate(SNAP)
    armB = { layoutZoom: LAYOUT_ZOOM, atZoom, afterArrange }
  }

  const before = await page.evaluate(SNAP)

  const flushed = await page.evaluate(async () => {
    // Indirect specifier: a literal here is resolved statically by tsc and the
    // typecheck gate REDs on it (TS2307). `overlapSequence.measure.ts` uses the
    // same variable form for the same reason.
    const modulePath = '/src/canvas/persist/crashFlush.ts'
    const mod = (await import(/* @vite-ignore */ modulePath)) as { flushWorkToAutosave: () => boolean }
    return mod.flushWorkToAutosave()
  })
  const persisted = await page.evaluate(() => {
    const out: Record<string, string> = {}
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; out[k] = localStorage.getItem(k) ?? '' }
    return out
  })
  await page.addInitScript((entries: Record<string, string>) => {
    try { for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v) } catch { /* ignore */ }
  }, persisted)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.react-flow__node[data-id]', { timeout: 60_000 })

  const series: unknown[] = []
  for (let k = 0; k < 20; k++) {
    series.push(await page.evaluate(() => {
      const w = window as unknown as { useCanvasStore: { getState: () => { nodes: Array<{ id: string; position: { x: number; y: number } }>; layoutVersion: number } } }
      const st = w.useCanvasStore.getState()
      const box = new Map<string, [number, number]>()
      for (const el of document.querySelectorAll('.react-flow__node[data-id]')) {
        const e = el as HTMLElement; box.set(e.dataset.id!, [e.offsetWidth, e.offsetHeight])
      }
      const ns = st.nodes.filter((n) => box.has(n.id)).map((n) => ({ x: n.position.x, y: n.position.y, w: box.get(n.id)![0], h: box.get(n.id)![1] }))
      let pairs = 0
      for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
        const A = ns[i], B = ns[j]
        if (Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x) > 0 && Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y) > 0) pairs++
      }
      const vp = document.querySelector('.react-flow__viewport') as HTMLElement | null
      const m = vp ? new DOMMatrixReadOnly(getComputedStyle(vp).transform) : null
      return { t: Math.round(performance.now()), lv: st.layoutVersion, pairs, zoom: m ? +m.a.toFixed(4) : null }
    }))
    if (k < 19) await page.waitForTimeout(1500)
  }

  const after = await page.evaluate(SNAP)

  // ── CAUSAL: re-lay out at the post-reload heights. If the persisted geometry
  // is simply inconsistent with today's heights, this must go to zero pairs.
  const causal = await page.evaluate(async () => {
    const w = window as unknown as { useCanvasStore: { getState: () => { applyLayout: (o: unknown) => Promise<unknown> } } }
    await w.useCanvasStore.getState().applyLayout({ skipHistory: true })
    return true
  })
  await page.waitForTimeout(3500)
  const afterRelayout = await page.evaluate(SNAP)

  // eslint-disable-next-line no-console
  console.log('RHJSON ' + JSON.stringify({ starter: STARTER, vp: `${VP.width}x${VP.height}`, trial, flushed, armB, before, series, after, causal, afterRelayout }))
})
}
