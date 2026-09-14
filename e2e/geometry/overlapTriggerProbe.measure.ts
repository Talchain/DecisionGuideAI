/**
 * IS THE CORRECTION LOGIC WRONG, OR IS ITS TRIGGER MISSING?
 *
 * `useMeasureThenLayout`'s growth correction re-lays out when a card is taller
 * than the height the committed layout was computed against. In the broken
 * state (layoutVersion 1, overlapping) that correction demonstrably has not
 * fired, yet the fallback warning never printed — so the layout ran via
 * 'run-now', i.e. `allUnlockedNodesMeasured` was TRUE at commit time and the
 * cards grew AFTERWARDS.
 *
 * The effect re-runs only when one of its deps changes. React Flow mutates
 * `nodeLookup` in place, so a height change alone need not produce a new
 * reference — nothing wakes the effect and the growth is never observed.
 *
 * THE DISCRIMINATOR: nudge ONLY the identity of the `nodes` array — same node
 * objects, same positions, same content, no geometry touched. That changes the
 * `storeNodes` dep and nothing else.
 *   - If overlaps vanish, the correction LOGIC IS CORRECT and its TRIGGER is
 *     missing. Fix the trigger.
 *   - If overlaps persist, the correction logic itself is broken. Fix the logic.
 * These have different fixes, so the experiment is run before any code is written.
 */
import { test } from '@playwright/test'
import {
  openCanvas,
  preparePage,
  seedStarterDraft,
  clearNotifications,
  minimiseFloatingOlumiPanel,
  waitForVisualQuiescence,
} from '../visual/harness'

const VP = { width: 1440, height: 900 }

for (const attempt of [1, 2, 3]) {
  test(`TRIGGER pricing-model attempt ${attempt}`, async ({ page }) => {
    await preparePage(page, VP)
    await openCanvas(page)
    await seedStarterDraft(page, 'pricing-model')
    await clearNotifications(page)
    await minimiseFloatingOlumiPanel(page)
    await waitForVisualQuiescence(page)

    const countOverlaps = () =>
      page.evaluate(() => {
        const w = window as unknown as {
          useCanvasStore: { getState: () => { nodes: Array<{ id: string; position: { x: number; y: number } }>; layoutVersion: number } }
        }
        const store = w.useCanvasStore.getState()
        const rendered = new Map<string, { w: number; h: number }>()
        for (const el of [...document.querySelectorAll('.react-flow__node[data-id]')] as HTMLElement[]) {
          rendered.set(el.dataset.id!, { w: el.offsetWidth, h: el.offsetHeight })
        }
        const boxes = store.nodes
          .map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, ...(rendered.get(n.id) ?? { w: 0, h: 0 }) }))
          .filter((b) => b.w > 0 && b.h > 0)
        let pairs = 0
        const worst: string[] = []
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const A = boxes[i], B = boxes[j]
            const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x)
            const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y)
            if (ox > 0 && oy > 0) { pairs++; if (worst.length < 3) worst.push(`${A.id}x${B.id} ${Math.round(ox)}x${Math.round(oy)}`) }
          }
        }
        return { pairs, worst, layoutVersion: store.layoutVersion }
      })

    const before = await countOverlaps()

    // The nudge: a NEW array holding the SAME node objects. No geometry,
    // content or position is touched — only the reference the effect depends on.
    await page.evaluate(() => {
      const w = window as unknown as { useCanvasStore: { getState: () => { nodes: unknown[] }; setState: (p: unknown) => void } }
      const s = w.useCanvasStore.getState()
      w.useCanvasStore.setState({ nodes: [...s.nodes] })
    })
    await page.waitForTimeout(3000)
    await waitForVisualQuiescence(page)

    const after = await countOverlaps()

    // eslint-disable-next-line no-console
    console.log('TRIGGERJSON ' + JSON.stringify({ attempt, before, after }))
  })
}
