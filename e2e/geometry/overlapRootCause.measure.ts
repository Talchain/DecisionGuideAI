/**
 * ROOT CAUSE probe for the canvas node overlap.
 *
 * Measured correlation across 15 cells (nodeOverlap.measure.ts): layoutVersion
 * === 1 => overlaps (2/2); layoutVersion >= 2 => zero overlaps (13/13). So the
 * defect is "layout committed ONCE against incomplete heights and no
 * corrective pass followed". Both corrective passes in `useMeasureThenLayout`
 * are gated on `allUnlockedNodesMeasured(storeNodes, nodeLookup)`, which
 * iterates the CANVAS STORE's nodes but resolves each in REACT FLOW's
 * nodeLookup. A store node absent from nodeLookup makes it return false
 * FOREVER, which disables both corrections permanently.
 *
 * This probe repeats one cell until it catches the broken state, then reports
 * the set difference between store node ids and rendered DOM node ids, so the
 * claim is measured rather than inferred. Bound by node id throughout.
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

for (const attempt of [1, 2, 3, 4, 5, 6]) {
  test(`ROOTCAUSE pricing-model attempt ${attempt}`, async ({ page }) => {
    const fallbackWarnings: string[] = []
    page.on('console', (msg) => {
      const t = msg.text()
      if (/fallback heights|not yet measured/i.test(t)) fallbackWarnings.push(t.slice(0, 160))
    })
    await preparePage(page, VP)
    await openCanvas(page)
    await seedStarterDraft(page, 'pricing-model')
    await clearNotifications(page)
    await minimiseFloatingOlumiPanel(page)
    await waitForVisualQuiescence(page)

    const m = await page.evaluate(() => {
      const w = window as unknown as {
        useCanvasStore: {
          getState: () => {
            nodes: Array<{ id: string; position: { x: number; y: number }; data?: Record<string, unknown> }>
            layoutVersion: number
          }
        }
      }
      const store = w.useCanvasStore.getState()
      const domIds = new Set(
        [...document.querySelectorAll('.react-flow__node[data-id]')].map(
          (el) => (el as HTMLElement).dataset.id!,
        ),
      )
      const storeIds = store.nodes.map((n) => n.id)

      // A store node with no rendered element cannot have been measured by
      // React Flow, so it pins `allUnlockedNodesMeasured` to false forever.
      const inStoreNotInDom = storeIds.filter((id) => !domIds.has(id))
      const inDomNotInStore = [...domIds].filter((id) => !storeIds.includes(id))

      // Zero-sized rendered nodes are the other way the gate stays false.
      const zeroSized = [...document.querySelectorAll('.react-flow__node[data-id]')]
        .map((el) => ({ id: (el as HTMLElement).dataset.id!, w: (el as HTMLElement).offsetWidth, h: (el as HTMLElement).offsetHeight }))
        .filter((d) => !(d.w > 0) || !(d.h > 0))

      const lockedIds = store.nodes.filter((n) => n.data?.locked === true).map((n) => n.id)

      return {
        layoutVersion: store.layoutVersion,
        storeCount: storeIds.length,
        domCount: domIds.size,
        inStoreNotInDom,
        inDomNotInStore,
        zeroSized,
        lockedIds,
      }
    })

    // eslint-disable-next-line no-console
    console.log('ROOTJSON ' + JSON.stringify({ attempt, ...m, fallbackWarnings }))
  })
}
