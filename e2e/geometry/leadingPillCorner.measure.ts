/**
 * LEADING-OPTION PILL — does it overlap the corner stack and the option ordinal?
 *
 * WHY THIS EXISTS. The defect is a PIXEL OVERLAP, and jsdom performs no layout,
 * so the unit suite beside it (`OptionNode.leadingPillCornerStack.spec.tsx`) can
 * only pin STRUCTURE — one positioned container, distinct static flex siblings.
 * "Does the pill actually cover the ordinal?" is a question only a real browser
 * can answer, and answering it is the difference between fixing a witnessed
 * defect and tidying a code smell.
 *
 * ⚠⚠ STATE CLASS: SEEDED, AND THE ANALYSIS REPORT IS HAND-WRITTEN. This is the
 * honest limit of this instrument and it must not be overstated (CLAUDE.md trap
 * 16 — a fixture you wrote yourself is not evidence about the wire). No
 * committed capture can produce a leading option on any committed starter: the
 * captures' option ids are effectively disjoint from the starters' (best
 * overlap 2 of 4), `deriveDecisionVerdict` returns UNKNOWN below two comparable
 * options, and the one near-overlapping capture carries
 * `near_tie.is_tie: true` / `band: 'very_close'`, both of which route to
 * `hasLeadingOption: false`. `e2e/visual/states.visual.spec.ts` already
 * documents this and excludes `completed-analysis` for the same reason.
 *
 * So this measures RENDERING GEOMETRY given a state, and claims nothing about
 * how often that state occurs on the wire. That is sufficient for the question
 * asked — two boxes' rectangles — and insufficient for any claim about
 * frequency.
 *
 * WHAT IT MEASURES, per starter option that carries the pill:
 *   - the pill's rect, the ordinal's rect, and every corner-stack sibling's
 *   - the pairwise intersection AREA of pill x ordinal and pill x each sibling
 *   - `--canvas-label-scale`, because the pill's type counter-scales when the
 *     canvas is zoomed out while the ordinal badge's `h-4` box does NOT — which
 *     is the mechanism by which the pill grows down over the header row
 *
 * Run BOTH arms to read it (the numbers mean nothing alone):
 *   pnpm exec playwright test -c playwright.geometry.config.ts \
 *     e2e/geometry/leadingPillCorner.measure.ts
 *
 * ⚠ HOW TO GET THE PRE-MIGRATION ARM, because "run both arms" is useless
 * without it and a PARTIAL revert silently measures a third thing that is
 * neither arm. Revert BOTH product files together — `src/canvas/nodes/
 * OptionNode.tsx` AND `src/canvas/nodes/BaseNode.tsx` — to their state before
 * this PR, in a throwaway worktree, and re-run the identical command.
 *
 * The reason is a general one about this corner and it has already bitten the
 * sibling migration (#1177): an absolutely-positioned child of an
 * absolutely-positioned stack resolves against THE STACK, not against the node.
 * So a tree with the caller reverted but the container still carrying the slot
 * — or the reverse — lays the pill out from a different origin than either real
 * arm, and the intersection areas it reports are numbers about a state that has
 * never shipped. #1177's reviewer measured exactly this and got 100% overlap
 * where the true pre-fix figure was 60%.
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

// Cold Vite dependency-optimise can exceed openCanvas's wait on a loaded
// machine. A cell that never loaded must never read as "no overlap found"
// (CLAUDE.md trap 13) — retry rather than silently shrink the measured set.
test.describe.configure({ retries: 2 })

test(`LEADPILL build-vs-buy @${VP.width}x${VP.height}`, async ({ page }) => {
  await preparePage(page, VP)
  await openCanvas(page)
  await seedStarterDraft(page, 'build-vs-buy')
  await clearNotifications(page)
  await minimiseFloatingOlumiPanel(page)

  // Seed a COMPLETED run whose producer signal names one leader.
  //
  // `isRecommended` needs all four of: isResultsMode, a non-null winRate for
  // THIS node, verdict.hasLeadingOption, and verdict.leaderId === this id.
  // `near_tie.top_option_id` is the field the verdict checks identity against
  // (ROADMAP 1.223 deleted the argmax fallback, so a report with no producer
  // signal yields hasLeadingOption:false and this measure would see no pill at
  // all) — which is exactly why the seed carries one.
  const seeded = await page.evaluate(() => {
    const w = window as unknown as {
      useCanvasStore: {
        getState: () => {
          results: Record<string, unknown>
          nodes: Array<{ id: string; type?: string; data?: { type?: string } }>
          optionNumbering?: Record<string, number>
          registerOptionNumbering: (ids: readonly string[]) => void
        }
        setState: (p: Record<string, unknown>) => void
      }
    }
    const state = w.useCanvasStore.getState()
    const optionIds = state.nodes
      .filter((n) => n.type === 'option' || n.data?.type === 'option')
      .map((n) => n.id)

    // Descending win probabilities over the REAL canvas option ids, so the
    // verdict's `visibleOptionIds` filter keeps every one of them and the
    // comparable set is the whole row (it returns UNKNOWN below two).
    const leader = optionIds[0]
    const option_probabilities: Record<string, { win_probability: number }> = {}
    optionIds.forEach((id, i) => {
      option_probabilities[id] = { win_probability: i === 0 ? 0.62 : (0.38 / (optionIds.length - 1)) }
    })

    // ⚠ THE ORDINAL HAS TO BE SEEDED SEPARATELY, AND FINDING OUT WHY IS HALF
    // THE RESULT. `optionNumbering` has exactly ONE production writer —
    // `registerOptionNumbering`'s only product caller, in
    // `useResultsSectionData.ts` — and its membership is
    // `recommendation.allOptions`, i.e. the options present in the ANALYSIS,
    // registered when the RESULTS PANEL mounts. Seeding a completed run into
    // the store does not go near it, so the first arm of this measure reported
    // `optionNumbering: {}` and `ordinalFound: false` — no ordinal to overlap
    // with, in either arm. Registering it here is what makes the overlap
    // question askable at all; without it this measure would report a
    // comfortable zero while measuring nothing (CLAUDE.md trap 13).
    w.useCanvasStore.setState({
      results: {
        ...state.results,
        status: 'complete',
        progress: 100,
        report: {
          option_probabilities,
          robustness: {
            recommended_option_id: leader,
            near_tie: { is_tie: false, top_option_id: leader, gap: 0.44 },
          },
        },
      },
    })
    const before = state.optionNumbering ?? null
    w.useCanvasStore.getState().registerOptionNumbering(optionIds)
    return {
      optionIds,
      leader,
      optionNumberingBeforeRegister: before,
      optionNumberingAfterRegister: w.useCanvasStore.getState().optionNumbering ?? null,
    }
  })

  await waitForVisualQuiescence(page)

  const measure = async (forcedScale: string | null) => await page.evaluate(
    ({ leaderId, forcedScale }: { leaderId: string; forcedScale: string | null }) => {
    // `--canvas-label-scale` = 1/min(1, max(zoom, floor)), i.e. 1 at zoom >= 1
    // rising to a 2x cap as the user zooms OUT. It multiplies the pill's type
    // (`edgeLabel` = calc(10px * var)) while the ordinal badge's `h-4` box is a
    // FIXED 16px that does not counter-scale — so the pill grows downward over
    // the header row while its target stays put. Forcing the var is a synthetic
    // INPUT to the real renderer, not a synthetic measurement: it is the same
    // variable the zoom writes, and 2 is its documented cap.
    //
    // ⚠ THE FIRST VERSION OF THIS WROTE THE VAR ON `documentElement` AND THE
    // TWO ARMS CAME BACK BYTE-IDENTICAL — same pill rect to the decimal at
    // "scale 1" and "scale 2". That is not a finding that scale does not
    // matter; it is an instrument that stopped discriminating (CLAUDE.md trap
    // 20: when two inputs that must differ return the same answer, suspect the
    // probe). `CanvasLabelScaleSync` writes the var on the `.react-flow` ROOT,
    // so a `:root` write is shadowed and read back as brand.css's default 1.
    // The arms are now asserted to differ below rather than trusted.
    const rfRoot = document.querySelector('.react-flow') as HTMLElement | null
    if (forcedScale != null) rfRoot?.style.setProperty('--canvas-label-scale', forcedScale)
    const rect = (el: Element | null) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }
    }
    type R = { x: number; y: number; w: number; h: number }
    const overlapArea = (a: R | null, b: R | null) => {
      if (!a || !b) return null
      const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      return dx > 0 && dy > 0 ? +(dx * dy).toFixed(1) : 0
    }

    const pillEl = document.querySelector(`[data-testid="leading-option-pill-${leaderId}"]`)
      // Pre-migration the pill carried no test id — find it by its exact text so
      // BOTH arms of the comparison can address the same element. Without this
      // the pristine arm would report "no pill" and read as a clean result.
      ?? Array.from(document.querySelectorAll('span')).find(
        (s) => s.textContent?.trim() === 'Leading option',
      ) ?? null

    const stackEl = document.querySelector(`[data-testid="node-corner-stack-${leaderId}"]`)
    const ordinalEl = document.querySelector(`[data-testid="option-stable-number-${leaderId}"]`)

    const pill = rect(pillEl)
    const ordinal = rect(ordinalEl)

    const siblings = stackEl
      ? Array.from(stackEl.children)
          .filter((c) => c !== pillEl)
          .map((c) => ({
            testid: c.getAttribute('data-testid'),
            rect: rect(c),
            overlapWithPill: overlapArea(pill, rect(c)),
          }))
      : []

    return {
      // Read where it is WRITTEN, and read it as the pill actually resolves it.
      labelScaleOnRoot: rfRoot
        ? getComputedStyle(rfRoot).getPropertyValue('--canvas-label-scale').trim()
        : null,
      pillFontSizePx: pillEl ? getComputedStyle(pillEl).fontSize : null,
      pillFound: pillEl != null,
      pillInStack: stackEl != null && pillEl != null && stackEl.contains(pillEl),
      pillClass: pillEl?.getAttribute('class') ?? null,
      pill,
      ordinal,
      ordinalFound: ordinalEl != null,
      pillOverlapsOrdinalPx2: overlapArea(pill, ordinal),
      stack: rect(stackEl),
      // The decisive number, computed HERE from measured rects rather than
      // reasoned about afterwards from CSS classes.
      stackOriginInsidePill: (() => {
        const s2 = rect(stackEl)
        if (!s2 || !pill) return null
        return s2.x >= pill.x && s2.x <= pill.x + pill.w
          && s2.y >= pill.y && s2.y <= pill.y + pill.h
      })(),
      siblings,
    }
  }, { leaderId: seeded.leader, forcedScale })

  // Natural fit-view first — and the measure's own first run established that
  // this IS the worst case: `--canvas-label-scale` reads 2 (its cap) at the
  // zoom the canvas settles on, so the pill's type is already at 20px while the
  // ordinal's `h-4` box does not counter-scale. The contrast arm forces the var
  // DOWN to 1 (zoomed-in) so the probe is provably discriminating rather than
  // reporting one state twice.
  const atNaturalZoom = await measure(null)
  const atLabelScale1 = await measure('1')

  // eslint-disable-next-line no-console
  console.log('LEADPILL_RESULT ' + JSON.stringify({ seeded, atNaturalZoom, atLabelScale1 }, null, 2))

  // ⭐ THE DISCRIMINATION CHECK, and it is the reason this measure can be
  // believed at all. The forced-scale arm must actually MOVE the pill; if the
  // two arms return the same font size, the override did not take and a "no
  // overlap at 2x" line would be a statement about a probe that never changed
  // its input (CLAUDE.md trap 20 — keep one probe whose expected answer
  // DIFFERS from the others). Fail loudly rather than report a comfortable
  // zero. The first run of this measure failed exactly here.
  if (atNaturalZoom.pillFontSizePx === atLabelScale1.pillFontSizePx) {
    throw new Error(
      `label-scale override did not discriminate: both arms report pill font-size ` +
      `${atNaturalZoom.pillFontSizePx} (root var: ${atNaturalZoom.labelScaleOnRoot} vs ` +
      `${atLabelScale1.labelScaleOnRoot}). The contrast arm proves nothing — fix the probe.`,
    )
  }
  // ⚠ THE STACK IS EMPTY IN *THESE* ARMS, AND THAT IS A STATED LIMIT, NOT A PASS.
  // `siblings: []` means the pill-vs-sibling overlap numbers below are measured
  // against nothing and must not be read as "no collision" (CLAUDE.md trap 13).
  //
  // ⭐ BUT THE OCCUPANT *CAN* BE SEEDED, AND WAS — this comment claimed the
  // opposite until 2026-09-04 and the claim was false. A review of this PR
  // seeded the coaching marker directly via
  // `await import('/src/canvas/stores/guidanceStore.ts')` and measured the
  // pill x coaching-marker intersection at **120px^2 pre-migration -> 0px^2
  // post-migration** — full containment of the corner's only INTERACTIVE
  // element, closed to zero. That is the strongest evidence this change has,
  // and it is a real co-occupancy measurement rather than an inference.
  // ⚠ RUNG: that number is the REVIEWER's, taken on their run; this lane did
  // not re-execute the browser arm, so it is recorded here as reported, not as
  // reproduced. Re-run it before quoting it as this suite's own output.
  //
  // The two limits that DID hold: the sensitivity rank is computed for FACTORS
  // and so cannot appear on an option card at all, and writing
  // `editedSinceRunNodeIds` directly is undone by the effect that recomputes it
  // against the run snapshot (`setEditedSinceRunNodes` in `canvas/store.ts`).
  //
  // What carries the collision claim *within this file* is
  // `stackOriginInsidePill`, which this probe MEASURES: pre-migration the stack
  // renders 0x0 at the corner, and its origin is the point every child is laid
  // out from. If that point is inside the pill's rectangle, a child rendered
  // there is under the pill. That last step is an inference — a stated one —
  // about where a child WOULD land, not an observation of one; the unit suite
  // pins the containment, and the seeded measurement above observes it.
  //
  // ⚠ AND THE MARGIN IS THIN, SO QUOTE IT WITH THE NUMBER ATTACHED. On the
  // build-vs-buy run the pill's x-range is 317.5–392.0 and the stack's origin
  // is x=391.5 — inside by 0.5px, which is within sub-pixel rounding at this
  // zoom. Read `stackOriginInsidePill` as CONSISTENT with a shared origin, not
  // as independent proof of one. The proof that does not depend on any pixel is
  // that both boxes declared `absolute -top-2 -right-2 z-10` against the same
  // positioned parent, which resolves to one origin by construction.
  if (!atNaturalZoom.pillFound || !atNaturalZoom.ordinalFound) {
    throw new Error(
      `precondition lost: pillFound=${atNaturalZoom.pillFound} ` +
      `ordinalFound=${atNaturalZoom.ordinalFound}. An overlap of 0 between elements ` +
      `that are not both on screen is not a measurement.`,
    )
  }
})
