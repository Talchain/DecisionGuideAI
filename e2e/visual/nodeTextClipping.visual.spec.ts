/**
 * NO TEXT INSIDE A CANVAS NODE IS CLIPPED WITH NOWHERE TO RECOVER IT.
 *
 * WHY THIS EXISTS
 * ---------------
 * Measured on deployed staging (`384a2b4f`, 29 Aug 2026, headcount-allocation
 * at 1280x800), the decision card's triage line rendered:
 *
 *     "Top gap: validate Platform Engineer Headco…"
 *
 * against a full string of "Top gap: validate Platform Engineer Headcount
 * Added" — 37% of it hidden, on a `white-space: nowrap` + `text-overflow:
 * ellipsis` container. That string occurred EXACTLY ONCE in the DOM and there
 * was no unclipped instance anywhere, before or after opening the node's
 * details: no `title`, no `aria-label` carrying it, no popover restating it.
 *
 * The sentence matters more than most: `DecisionNode.tsx`'s own comment above
 * the code that builds it says it "is the product TELLING THE USER WHICH FACTOR
 * TO GO AND FIX". A next-step instruction cut before it names the thing to fix
 * is the product's most action-guiding line, unreadable.
 *
 * The governing rule (Paul, 29 Aug): do not hide what is weak — caveat it.
 * An ellipsis WITH somewhere to recover the text is a caveat. An ellipsis with
 * nowhere to go is hiding, and this was the latter.
 *
 * WHAT THIS ASSERTS, AND WHAT IT DELIBERATELY DOES NOT
 * ---------------------------------------------------
 * It asserts that no text-bearing leaf inside a `.react-flow__node` overflows
 * its own box horizontally. It does NOT assert anything about strings the
 * product shortens in JAVASCRIPT before rendering (`truncateAtWord`), because
 * those are a content decision that belongs to the session owning generated
 * text — they render complete, and this measures rendering.
 *
 * jsdom cannot prove any of this: `getByText` matches on the full node text
 * whether or not a single character of it is visible.
 */

import { test, expect } from '@playwright/test'
import {
  preparePage, openCanvas, seedStarterDraft, clearNotifications,
  freezeMotion, waitForVisualQuiescence, VIEWPORTS, type StarterId,
} from './harness'

/** The shipped starters, named so a starter that stops being covered is a compile error. */
const STARTERS: StarterId[] = [
  'headcount-allocation',
  'build-vs-buy',
  'vendor-selection',
]

interface Clip { full: string; visibleWidth: number; neededWidth: number; pctHidden: number }

test.describe('canvas node text is not clipped', () => {
  for (const starter of STARTERS) {
    test(`no node text is horizontally clipped — ${starter} [${VIEWPORTS[0].name}]`, async ({ page }) => {
      await preparePage(page, VIEWPORTS[0])
      await openCanvas(page)
      await seedStarterDraft(page, starter)
      await clearNotifications(page)
      await freezeMotion(page)
      await waitForVisualQuiescence(page)

      const result = await page.evaluate(() => {
        const scan = (): Clip[] => {
          const out: Clip[] = []
          for (const node of document.querySelectorAll('.react-flow__node')) {
            for (const el of node.querySelectorAll('*')) {
              const he = el as HTMLElement
              const r = he.getBoundingClientRect()
              if (r.width < 4 || r.height < 4) continue
              const cs = getComputedStyle(he)
              if (cs.visibility === 'hidden' || cs.display === 'none') continue
              if (/auto|scroll/.test(cs.overflowX + cs.overflowY)) continue
              const txt = (he.textContent ?? '').trim()
              if (!txt) continue
              // leaves only — a wrapper's scrollWidth reports its children's
              if ([...he.children].some(c => (c.textContent ?? '').trim())) continue
              const lost = he.scrollWidth - he.clientWidth
              if (lost > 1) {
                out.push({
                  full: txt.slice(0, 90),
                  visibleWidth: he.clientWidth,
                  neededWidth: he.scrollWidth,
                  pctHidden: Math.round((100 * lost) / he.scrollWidth),
                })
              }
            }
          }
          return out
        }

        // POSITIVE CONTROL — inject a definitely-clipped element INSIDE a node.
        // Without this, a scan that silently matched nothing (a changed node
        // class, a renderer swap) would report a clean pass for every starter,
        // which is exactly the shape of a guard agreeing with itself.
        const host = document.querySelector('.react-flow__node')
        let controlSeen = false
        if (host) {
          const probe = document.createElement('div')
          probe.textContent = 'ZZZ_CLIP_CONTROL_THIS_STRING_IS_FAR_TOO_LONG_TO_FIT_IN_THE_BOX'
          probe.style.cssText = 'width:30px;height:16px;overflow:hidden;white-space:nowrap'
          host.appendChild(probe)
          controlSeen = scan().some(c => c.full.includes('ZZZ_CLIP_CONTROL'))
          probe.remove()
        }

        return { hostFound: !!host, controlSeen, clips: scan() }
      })

      expect(result.hostFound, 'no .react-flow__node mounted — nothing was measured').toBe(true)
      expect(
        result.controlSeen,
        'the positive control was NOT detected — the scan cannot see a clipped element, ' +
          'so a clean result from it would mean nothing',
      ).toBe(true)

      const report = result.clips
        .sort((a, b) => b.pctHidden - a.pctHidden)
        .map(c => `    ${String(c.pctHidden).padStart(3)}% hidden  ${c.visibleWidth}/${c.neededWidth}px  "${c.full}"`)
        .join('\n')

      expect(
        result.clips,
        `node text is clipped with no way to recover it on ${starter}:\n${report}`,
      ).toEqual([])
    })
  }
})
