/**
 * DOES THE CHAT INPUT PANEL COVER MODEL CONTENT?
 *
 * Witnessed on the DEPLOYED build (staging 5d3f195f) at 1730x900: a white input
 * panel sits over the left of the graph with node cards behind it. This measures
 * the overlap by AREA against every rendered node, so the same run answers both
 * "does it overlap" and "how much", and can be pointed at two trees to attribute
 * the defect rather than assume it.
 *
 * ⚠ VIEWPORT IS NAMED IN EVERY READING. A second geometry claim at an unnamed
 * width would be conflated with the live 1600-1668 panel-composition ruling.
 */
import { test } from '@playwright/test'
import { preparePage, openCanvas, seedStarterDraft, clearNotifications, freezeMotion, waitForVisualQuiescence } from '../visual/harness'

const VPS = [
  { name: '1730x900', width: 1730, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
]

for (const vp of VPS) {
  test(`PANEL OCCLUSION vendor-selection @${vp.name}`, async ({ page }) => {
    await preparePage(page, vp)
    await openCanvas(page)
    await seedStarterDraft(page, 'vendor-selection')
    await clearNotifications(page)
    await freezeMotion(page)
    await waitForVisualQuiescence(page)

    const m = await page.evaluate(async (vpName) => {
      // ASSERT THE INSTRUMENT FIRST — a dead render loop produced four false
      // readings in this estate tonight.
      const t0 = performance.now(); let frames = 0
      await new Promise<void>(res => { (function tick(){ frames++; performance.now()-t0 < 600 ? requestAnimationFrame(tick) : res() })() })
      const fps = +(frames / ((performance.now()-t0)/1000)).toFixed(1)

      const PANELS = ['[data-testid="floating-olumi-panel"]', '[data-testid="outputs-dock"]']
      const nodes = [...document.querySelectorAll('.react-flow__node')]
      const overlapOf = (a: DOMRect, b: DOMRect) =>
        Math.max(0, Math.min(a.right,b.right)-Math.max(a.left,b.left)) *
        Math.max(0, Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top))

      const out: Array<{panel:string; coveredNodes:number; totalPx2:number; worstNodePct:number}> = []
      for (const sel of PANELS) {
        const el = document.querySelector(sel) as HTMLElement | null
        if (!el) { out.push({panel:sel+' (ABSENT)', coveredNodes:0, totalPx2:0, worstNodePct:0}); continue }
        const pr = el.getBoundingClientRect()
        if (pr.width === 0) { out.push({panel:sel+' (ZERO RECT)', coveredNodes:0, totalPx2:0, worstNodePct:0}); continue }
        let covered = 0, total = 0, worst = 0
        for (const n of nodes) {
          const nr = n.getBoundingClientRect()
          if (nr.width === 0) continue
          const ov = overlapOf(pr, nr)
          if (ov > 0) { covered++; total += ov; worst = Math.max(worst, ov/(nr.width*nr.height)*100) }
        }
        out.push({panel:sel, coveredNodes:covered, totalPx2:Math.round(total), worstNodePct:+worst.toFixed(1)})
      }
      return { vp: vpName, fps, nodes: nodes.length, panels: out }
    }, vp.name)

    console.log('OCCLUSION ' + JSON.stringify(m))
  })
}
