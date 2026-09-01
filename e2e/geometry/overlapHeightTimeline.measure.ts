/**
 * WHERE DOES THE ~138 px ROW PITCH COME FROM?
 *
 * The founder measured a CONSTANT 138-139 model-px row pitch while cards
 * render 152-284 tall, and asked which constant produces it. The answer this
 * probe tests: NO constant does. The pitch is produced by the heights the cards
 * had at layout-commit time, which are smaller than the heights they finish at,
 * and no pass re-runs afterwards.
 *
 * It samples every card's height by id from immediately after seeding, so the
 * transient smaller height is measured rather than inferred.
 */
import { test } from '@playwright/test'
import { openCanvas, preparePage, clearNotifications, minimiseFloatingOlumiPanel, readStarterDraft } from '../visual/harness'

test('HEIGHT TIMELINE pricing-model @1440x900', async ({ page }) => {
  await preparePage(page, { width: 1440, height: 900 })
  await openCanvas(page)
  await clearNotifications(page)
  await minimiseFloatingOlumiPanel(page)

  const payload = readStarterDraft('pricing-model')

  const timeline = await page.evaluate(async (draft) => {
    const modulePath = '/src/canvas/utils/applyDraftResult.ts'
    const mod = (await import(/* @vite-ignore */ modulePath)) as { applyDraftResult: (p: unknown) => unknown }
    const w = window as unknown as {
      useCanvasStore: { getState: () => { layoutVersion: number; nodes: Array<{ id: string; position: { x: number; y: number } }> } }
    }

    const samples: Array<{ t: number; lv: number; heights: Record<string, number>; pitches: number[] }> = []
    const t0 = performance.now()
    mod.applyDraftResult(draft)

    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 150))
      const st = w.useCanvasStore.getState()
      const heights: Record<string, number> = {}
      for (const el of [...document.querySelectorAll('.react-flow__node[data-id]')] as HTMLElement[]) {
        heights[el.dataset.id!] = el.offsetHeight
      }
      const ys = [...new Set(st.nodes.map((n) => Math.round(n.position.y)))].sort((a, b) => a - b)
      samples.push({
        t: Math.round(performance.now() - t0),
        lv: st.layoutVersion,
        heights,
        pitches: ys.slice(1).map((y, k) => y - ys[k]),
      })
    }
    return samples
  }, payload)

  // Report only the transitions, keyed by node id.
  const seen: string[] = []
  let prev: string | null = null
  for (const s of timeline) {
    const key = JSON.stringify({ lv: s.lv, pitches: s.pitches, h: s.heights })
    if (key !== prev) {
      seen.push(
        `t=${s.t}ms lv=${s.lv} pitches=${JSON.stringify(s.pitches)} ` +
          `sample=${JSON.stringify(Object.fromEntries(Object.entries(s.heights).filter(([k]) => !k.startsWith('__ghost')).slice(0, 5)))}`,
      )
      prev = key
    }
  }
  // eslint-disable-next-line no-console
  console.log('TIMELINE\n' + seen.join('\n'))
})
