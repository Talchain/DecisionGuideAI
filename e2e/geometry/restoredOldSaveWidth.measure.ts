/**
 * ⭐⭐ THE OLD-SAVE ARM, IN A REAL BROWSER — the one arm the existing restore
 * probe cannot reach, and the one the repair exists for.
 *
 * `restoreHeightDelta.measure.ts` reloads a board that was laid out by THIS
 * build, so its saved positions already carry the per-tier stride. That proves
 * the widths survive a reload; it says nothing about a board saved BEFORE
 * per-tier widths existed, which is every board a returning user already has.
 *
 * ⛔ THE DEFECT THIS PINS, found by independent review (Codex, 16 Sep 2026) and
 * measured twice at module level. `useRestoredLayoutWidth` derives card widths on
 * restore; an unbounded derivation returns the width a FRESH layout would use —
 * wider than the uniform one an old board was laid out at — so the hook that
 * exists to REPAIR overlap causes it:
 *
 *     3 options, saved uniform 336, stride 392   restored at 440  ->  gap -48
 *
 * ⚠ HOW THE OLD BOARD IS MADE, AND WHY IT IS NOT A FICTION. The starter is laid
 * out by the product, then every row is RE-SPACED to the uniform stride a
 * pre-per-tier layout produced (`OLD_UNIFORM_W + OLD_GAP`), keeping each card's
 * y. That is exactly the geometry those boards carry: the positions are the
 * product's own, only the stride is rolled back.
 *
 * ⭐ THE ASSERTION IS ZERO OVERLAPPING PAIRS AFTER RELOAD, and the sample is
 * taken at `layoutVersion === 0` — pinned in-test, because a board that has been
 * re-laid-out is not on the restore path at all and would pass vacuously.
 */
import { test, expect } from '@playwright/test'
import { GATE_TAG } from './canvasGateSet'
import {
  openCanvas, preparePage, seedStarterDraft, clearNotifications,
  minimiseFloatingOlumiPanel, waitForVisualQuiescence, type StarterId,
} from '../visual/harness'

const STARTER = (process.env.ROS_STARTER ?? 'build-vs-buy') as StarterId
const VP = { width: Number(process.env.ROS_W ?? 1280), height: Number(process.env.ROS_H ?? 800) }

/** The uniform card width and gap a pre-per-tier layout produced. */
const OLD_UNIFORM_W = 336
const OLD_GAP = 56

const SNAP = () => {
  const w = window as unknown as {
    useCanvasStore: { getState: () => { nodes: Array<{ id: string; type?: string; position: { x: number; y: number } }>; layoutVersion: number } }
  }
  const st = w.useCanvasStore.getState()
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
  const widthByType: Record<string, number[]> = {}
  for (const n of nodes) { const t = n.type ?? '?'; (widthByType[t] ??= []).push(n.w) }
  return { lv: st.layoutVersion, pairs, nodes: nodes.length, worst: worst.slice(0, 5), widthByType, nodeList: nodes }
}

test.describe('a restored board keeps its own stride', () => {
test(`ROS ${STARTER} @${VP.width}x${VP.height}`, { tag: GATE_TAG }, async ({ page }) => {
  await preparePage(page, VP)
  await openCanvas(page)
  await seedStarterDraft(page, STARTER)
  await clearNotifications(page)
  await minimiseFloatingOlumiPanel(page)
  await waitForVisualQuiescence(page)
  await page.waitForTimeout(4000)

  // Roll the stride back to what a pre-per-tier layout produced.
  const rolledBack = await page.evaluate(({ oldW, oldGap }) => {
    const w = window as unknown as {
      useCanvasStore: {
        getState: () => { nodes: Array<{ id: string; type?: string; position: { x: number; y: number } }> }
        setState: (partial: unknown) => void
      }
    }
    const st = w.useCanvasStore.getState()
    const stride = oldW + oldGap
    // Group by rounded y, then re-space each row left-to-right on the old stride
    // from its own leftmost card, so nothing about the board moves except the
    // spacing the per-tier change introduced.
    const rows = new Map<number, typeof st.nodes>()
    for (const n of st.nodes) {
      const y = Math.round(n.position.y)
      const r = rows.get(y)
      if (r === undefined) rows.set(y, [n]) ; else r.push(n)
    }
    let moved = 0
    const next = st.nodes.map((n) => ({ ...n, position: { ...n.position } }))
    const byId = new Map(next.map((n) => [n.id, n]))
    for (const [, row] of rows) {
      const sorted = [...row].sort((a, b) => a.position.x - b.position.x)
      const x0 = sorted[0].position.x
      sorted.forEach((n, i) => {
        const t = byId.get(n.id)!
        const nx = x0 + i * stride
        if (t.position.x !== nx) moved++
        t.position.x = nx
      })
    }
    w.useCanvasStore.setState({ nodes: next })
    return { moved, rows: rows.size, stride }
  }, { oldW: OLD_UNIFORM_W, oldGap: OLD_GAP })

  // ⛔ PRECONDITION PINNED IN-TEST: if nothing was re-spaced, the board never
  // became an "old save" and every assertion below would pass vacuously.
  expect(rolledBack.moved, 'no card was re-spaced — the fixture is not an old-save board').toBeGreaterThan(0)

  await page.waitForTimeout(1500)
  const before = await page.evaluate(SNAP)

  const flushed = await page.evaluate(async () => {
    const modulePath = '/src/canvas/persist/crashFlush.ts'
    const mod = (await import(/* @vite-ignore */ modulePath)) as { flushWorkToAutosave: () => boolean }
    return mod.flushWorkToAutosave()
  })
  expect(flushed, 'the autosave flush did not report success — the reload would restore the wrong board').toBe(true)

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
  await page.waitForTimeout(6000)

  const after = await page.evaluate(SNAP)

  // eslint-disable-next-line no-console
  console.log('ROSJSON ' + JSON.stringify({ starter: STARTER, vp: `${VP.width}x${VP.height}`, rolledBack, before, after }))

  /**
   * ⛔⛔ THE POSITIVE CONTROL, AND WITHOUT IT THIS WHOLE TEST IS VACUOUS.
   *
   * "Zero overlaps after reload" is satisfied perfectly by a fixture that never
   * overlapped in the first place — and the roll-back above could stop
   * reproducing for many reasons (a stride change, a width change, a different
   * starter). So the board must be shown to ACTUALLY OVERLAP before the restore
   * path is asked to fix it.
   *
   * MEASURED at `5a825c1e0`: 3 overlapping pairs, each 48px wide — the same
   * figure the independent review derived at module level, arrived at here
   * through the product in a real browser.
   */
  expect(
    before.pairs,
    'the rolled-back board does NOT overlap, so "zero overlaps after reload" proves nothing — the fixture has stopped reproducing the defect',
  ).toBeGreaterThan(0)

  // ⛔ NON-VACUITY FIRST. A zero-node canvas reports zero overlapping pairs,
  // which reads exactly like success; and a board that has been re-laid-out is
  // not on the restore path this test exists for.
  expect(after.nodes, 'the restored canvas rendered no cards — zero overlaps would be vacuous').toBeGreaterThan(0)
  expect(after.lv, 'a layout ran after the reload, so this is not the restore path').toBe(0)

  expect(
    after.pairs,
    `a board saved at the OLD uniform width overlaps after reopening: ${JSON.stringify(after.worst)}. The restore path widened cards past the stride their own saved positions leave.`,
  ).toBe(0)
})
})
