/**
 * DOCK CONTENT AT THE RULED WIDTH — a photograph and a census, no assertions.
 *
 * `shell-conformance.spec.ts` pins that the content budget tracks the width
 * authority, and says plainly that it CANNOT SEE FORMATTING. #719 was reverted
 * because tab formatting broke at a similar cut, so a green suite is not
 * evidence here. This looks.
 */
import { test } from '@playwright/test'
import {
  openCanvas, preparePage, seedStarterDraft, clearNotifications,
  minimiseFloatingOlumiPanel, waitForVisualQuiescence, type StarterId,
} from '../visual/harness'

test('DOCKCONTENT pricing-model @1600x1000', async ({ page }) => {
  await preparePage(page, { width: 1600, height: 1000 })
  await openCanvas(page)
  await seedStarterDraft(page, 'pricing-model' as StarterId)
  await clearNotifications(page)
  await minimiseFloatingOlumiPanel(page)
  await waitForVisualQuiescence(page)

  const report = await page.evaluate(() => {
    const root = document.documentElement
    const declared = getComputedStyle(root).getPropertyValue('--dock-right-expanded').trim()
    const aside = document.querySelector('aside') as HTMLElement | null
    const dock = aside?.getBoundingClientRect()

    // Tab strip: how many ROWS does it wrap onto? That is what broke at #719.
    const tabs = Array.from(document.querySelectorAll('[role="tab"]')) as HTMLElement[]
    const tabRows = new Set(tabs.map(t => Math.round(t.getBoundingClientRect().top)))

    // Anything inside the dock overflowing its own box horizontally.
    const overflowing: string[] = []
    if (aside) {
      for (const el of Array.from(aside.querySelectorAll('*')) as HTMLElement[]) {
        if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
          const t = (el.textContent ?? '').trim().slice(0, 40)
          if (t) overflowing.push(`${el.tagName.toLowerCase()}[${el.scrollWidth}>${el.clientWidth}] ${t}`)
        }
      }
    }
    return {
      declaredCssVar: declared,
      dockWidth: dock ? Math.round(dock.width) : null,
      dockLeft: dock ? Math.round(dock.left) : null,
      tabCount: tabs.length,
      tabRows: tabRows.size,
      tabLabels: tabs.map(t => (t.textContent ?? '').trim()),
      overflowingCount: overflowing.length,
      overflowing: overflowing.slice(0, 8),
    }
  })
  console.log('DOCKCONTENT ' + JSON.stringify(report))

  // Anything painted ON TOP of a card's own text — the shape a reader sees as
  // doubled or smeared copy.
  const overlaps = await page.evaluate(() => {
    const out: string[] = []
    const cards = Array.from(document.querySelectorAll('.react-flow__node')) as HTMLElement[]
    const labels = Array.from(document.querySelectorAll('.react-flow__edge-textwrapper, .react-flow__edgelabel-renderer > *')) as HTMLElement[]
    const hit = (a: DOMRect, b: DOMRect) =>
      a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
    for (const c of cards) {
      const cr = c.getBoundingClientRect()
      const title = (c.querySelector('[data-testid="node-title"]')?.textContent ?? '').trim().slice(0, 30)
      for (const l of labels) {
        const lr = l.getBoundingClientRect()
        if (lr.width < 2 || lr.height < 2) continue
        if (hit(cr, lr)) out.push(`EDGELABEL "${(l.textContent ?? '').trim().slice(0, 28)}" over CARD "${title}"`)
      }
      for (const c2 of cards) {
        if (c2 === c) continue
        const r2 = c2.getBoundingClientRect()
        if (hit(cr, r2)) {
          const t2 = (c2.querySelector('[data-testid="node-title"]')?.textContent ?? '').trim().slice(0, 30)
          if (title < t2) out.push(`CARD id=${c.getAttribute('data-id')} cls="${c.className.slice(0, 60)}" text="${(c.textContent ?? '').trim().slice(0, 50)}" rect=${Math.round(cr.left)},${Math.round(cr.top)},${Math.round(cr.width)}x${Math.round(cr.height)} OVERLAPS id=${c2.getAttribute('data-id')} "${t2}" rect=${Math.round(r2.left)},${Math.round(r2.top)},${Math.round(r2.width)}x${Math.round(r2.height)}`)
        }
      }
    }
    return out
  })
  console.log('OVERLAPS ' + JSON.stringify({ count: overlaps.length, items: overlaps.slice(0, 10) }))
  await page.screenshot({ path: 'test-results/dock-at-300.png', fullPage: false })
})
