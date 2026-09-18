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
 * text — ~~they render complete~~, and this measures rendering.
 *
 * ⚠⚠ THE STRUCK CLAUSE IS FALSE, AND IT IS WHY THE LARGEST TRUNCATION CLASS ON
 * THIS CANVAS WENT UNSEEN. Corrected 18 Sep 2026 at the bytes of every helper
 * named, on staging `4b9a8fb548d3526706e1268753e9188202ea99c9`:
 *
 *   · `DecisionNode.tsx:207  truncateAtWord`      -> appends `'…'`
 *   · `labelUtils.ts:173     truncateLabelAtWord` -> appends `'…'`
 *   · `nameOrClaim.ts:137    truncateAtWord`      -> appends `'…'`
 *
 * JS-shortened strings do NOT render complete. They render with an ellipsis
 * that is part of the STRING, which is strictly worse than the CSS kind this
 * file measures: `text-overflow` never fires, so `scrollWidth === clientWidth`
 * and the scan below is structurally blind to it, AND there is no overflow for
 * a browser tooltip to recover from either.
 *
 * ⚠ AND THE EXEMPTION IS WRITTEN AS ONE NAME BUT APPLIED AS A CLASS. It names
 * `truncateAtWord`. The differentiator footer on every option card goes through
 * `compactFactorLabel` -> `truncateLabelAtWord` — a DIFFERENT name, which
 * `DecisionNode.tsx:151` already records as an invisible twin ("a DIFFERENT
 * name, invisible to any grep for this one"). Read as a name the exemption
 * never covered that path; read as a class it swallowed it. Nobody had to
 * decide, which is how it was exempted without anyone exempting it.
 *
 * ⚠ THE OTHER, UNSTATED EXEMPTION — SAY IT OUT LOUD. The scan compares
 * `scrollWidth` against `clientWidth`, so it measures HORIZONTAL overflow only.
 * `BaseNode.tsx`'s title is clamped VERTICALLY (`line-clamp-2`) and can never
 * red this guard however much it hides. Measured on the five committed starter
 * captures: the longest label of any kind is 56 characters, against a derived
 * two-line capacity of ~52 at `MAX_LABEL_COUNTER_SCALE` (312px of measure at
 * 12px x 2 x `AVG_CHAR_EM`), so 3 of 87 node labels sit at or over the bound.
 * PLAUSIBLE, not confirmed — a character budget is not a pixel measurement and
 * this one needs a browser. Rowed, not fixed here.
 *
 * ── WHAT IS AND IS NOT NOW COVERED ──────────────────────────────────────────
 *
 * The JS-shortened class is covered at the SOURCE level instead:
 * `src/canvas/nodes/__tests__/everyNodePreviewOpensWithoutHover.spec.ts`
 * asserts that every node mounting a preview wires the tap path and that the
 * hook carries a keyboard path — i.e. that the recovery surface for elided
 * text is reachable without a mouse at all. This file keeps its rendering
 * scope deliberately: a guard that tried to answer both questions would be two
 * questions under one name (CLAUDE.md trap 21).
 *
 * ⚠ THAT SPEC HAS NOT BEEN RUN EITHER — it declares so in its own header, and
 * this pointer would be worth less than nothing if it implied otherwise.
 *
 * ⛔ WHAT IS STILL UNCOVERED, STATED RATHER THAN LEFT TO BE DISCOVERED: no
 * guard here drives a TAP or a Tab against a real browser and asserts the
 * recovery surface opens. That needs touch emulation and a driven gesture in
 * this Playwright harness, which is a larger job than narrowing this comment,
 * and it is left ROWED rather than half-built. The claim this file may now
 * make is: it measures CSS clipping, it says so, and it no longer asserts
 * something false about the class it declines to measure.
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
