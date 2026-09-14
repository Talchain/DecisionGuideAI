/**
 * CARD ANATOMY — a MEASUREMENT instrument, not a gate.
 *
 * It answers one question the source cannot: on a real render, at reading zoom,
 * WHAT IS ACTUALLY ON EACH CARD, in order, per node kind.
 *
 * Source reading cannot answer it because every card's content is gated by
 * store state, analysis presence, view mode and level-of-detail rung — so a
 * slot present in the file is not a slot on the card, and a slot shared by two
 * kinds in the file can still render in a different ORDER on screen.
 *
 * Output: one `ANATOMY {...}` line per node on stdout, plus one PNG per kind.
 *
 * ⚠ RUN IT DELIBERATELY, it is not in any gate:
 *     pnpm exec playwright test -c playwright.geometry.config.ts -g "ANATOMY"
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

const STARTERS: StarterId[] = ['vendor-selection', 'pricing-model', 'build-vs-buy']
const VP = { width: 1600, height: 1000 }

for (const id of STARTERS) {
  test(`ANATOMY ${id} @${VP.width}x${VP.height}`, async ({ page }) => {
    await preparePage(page, VP)
    await openCanvas(page)
    await seedStarterDraft(page, id)
    await clearNotifications(page)
    await minimiseFloatingOlumiPanel(page)
    await waitForVisualQuiescence(page)

    // ⭐ TWO RUNGS, AND THE FIRST ONE IS THE ONE THAT MATTERS.
    //
    // `DEFAULT` is the camera the product parks at with no user gesture — on
    // three of the five starters that is fitZoom 0.3506, permanently below the
    // 0.5 legibility floor, so the level-of-detail system blanks card bodies.
    // THAT is the state a founder opening the app actually looks at, and it is
    // the state this census exists to record. Measuring only at reading zoom
    // describes a card almost nobody sees on those starters.
    //
    // `READING` is reached by six zoom-in gestures and shows the full body.
    const rungs: { name: string; enter: () => Promise<void> }[] = [
      { name: 'DEFAULT', enter: async () => {} },
      {
        name: 'READING',
        enter: async () => {
          for (let i = 0; i < 6; i++) await page.keyboard.press('Equal').catch(() => {})
          await page.waitForTimeout(600)
        },
      },
    ]

    for (const rung of rungs) {
    await rung.enter()

    const rows = await page.evaluate(() => {
      const out: unknown[] = []
      const cards = Array.from(document.querySelectorAll('.react-flow__node'))
      for (const card of cards) {
        const id = card.getAttribute('data-id') ?? '?'
        const group = card.querySelector('[role="group"]')
        if (!group) continue
        const kindAttr = (card.className.match(/react-flow__node-([a-z]+)/) ?? [])[1] ?? '?'
        const r = card.getBoundingClientRect()
        // Visible leaf content, in DOM order, with the tag/role that carries it.
        const leaves: { t: string; role: string; tid: string; text: string; cls: string }[] = []
        const walk = (el: Element) => {
          const st = getComputedStyle(el)
          if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return
          const kids = Array.from(el.children)
          const ownText = Array.from(el.childNodes)
            .filter(n => n.nodeType === 3)
            .map(n => (n.textContent ?? '').trim())
            .join(' ')
            .trim()
          if (ownText) {
            leaves.push({
              t: el.tagName.toLowerCase(),
              role: el.getAttribute('role') ?? '',
              tid: el.getAttribute('data-testid') ?? '',
              text: ownText.slice(0, 60),
              cls: (el.getAttribute('class') ?? '').replace(/\s+/g, ' ').slice(0, 90),
            })
          }
          if (!ownText && kids.length === 0) {
            // Iconography / bars: no text, but real pixels.
            const rect = el.getBoundingClientRect()
            if (rect.width > 1 && rect.height > 1) {
              leaves.push({
                t: el.tagName.toLowerCase(),
                role: el.getAttribute('role') ?? '',
                tid: el.getAttribute('data-testid') ?? '',
                text: '',
                cls: (el.getAttribute('class') ?? '').replace(/\s+/g, ' ').slice(0, 90),
              })
            }
          }
          for (const k of kids) walk(k)
        }
        walk(group)
        out.push({ id, kind: kindAttr, w: Math.round(r.width), h: Math.round(r.height), leaves })
      }
      return out
    })

    const zoom = await page.evaluate(() => {
      const el = document.querySelector('.react-flow__viewport') as HTMLElement | null
      const m = el?.style.transform.match(/scale\(([\d.]+)\)/)
      return m ? Number(m[1]) : null
    })
    for (const r of rows) console.log(`ANATOMY ${rung.name} zoom=${zoom} ` + JSON.stringify(r))
    }
  })
}
