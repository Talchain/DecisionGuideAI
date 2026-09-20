/**
 * FIRST-VIEWPORT CENSUS — the check that catches what per-component tests cannot.
 *
 * ⭐ WHY THIS FILE EXISTS, MEASURED NOT THEORISED. On a real completed run the
 * first viewport of Analysis (New) said the same three things twice, roughly
 * 120px apart:
 *
 *     glance verdict   "Sensitive — small changes could flip this result"
 *     key insight #1   "This result is sensitive to uncertainty /
 *                       small changes could flip this result"
 *
 * …and the same again for the leader sentence and the hinge. Ninety tests were
 * green at the time, and NONE of them could see it: every one rendered a single
 * section, and duplication is a property of the COMPOSITION. It was found by
 * looking at a screenshot.
 *
 * This is the automated form of that look. It renders the whole surface and
 * asserts a property of the assembled thing rather than of any part: no
 * sentence the user reads is repeated.
 *
 * ⚠ WHAT IT DELIBERATELY DOES NOT DO. It makes no claim about pixels, layout,
 * the fold or visual hierarchy — jsdom cannot support one (trap 3), and a
 * spec that pretended otherwise would be worse than none. Height and width are
 * witnessed in a real browser; what is mechanised here is TEXT REDUNDANCY,
 * which jsdom is authoritative about.
 *
 * ⚠⚠ WHAT THIS GUARD IS AND IS NOT VALIDATED BY — corrected after measuring it,
 * because the first version of this note claimed the wrong evidence.
 *
 * It was written believing a mutant that restores the de-duplication would turn
 * it RED. IT DOES NOT, at any threshold. The original defect was closed by
 * DELETING the robustness and comparative insight branches outright, so no
 * input reachable through the adapter can reproduce it — the mutant that
 * disables `dedupeAgainstGlance` is caught by that function's own unit test,
 * and this census stays green throughout. A guard whose stated justification is
 * a state the code can no longer enter is decoration (trap 13b).
 *
 * What it IS validated against is the FORWARD risk, which is the one that
 * matters now: a section restating the glance's producer prose. Mutated so a
 * key insight's implication carries the glance verdict's reason, this file goes
 * RED by name. That is a realistic regression — the deleted branches are not.
 *
 * Stated precisely, so the next session inherits the scope and not the
 * generalisation: this census proves NO SECTION RESTATES ANOTHER'S PROSE on the
 * assembled surface. It proves nothing about the defect that prompted it, which
 * is now unreachable by construction.
 *
 * ── ⛔⛔ AND THAT SCOPE WAS STILL TOO WIDE, MEASURED 20 SEP 2026 ─────────────
 *
 * The sentence above says "the assembled surface". Until today this file could
 * only see the DEFAULT-OPEN part of it, because:
 *
 *   1. `SectionShell` UNMOUNTS a closed region (`SectionShell.tsx:298`,
 *      `{open ? <div…>{children}</div> : null}`), so prose behind a collapsed
 *      section is ABSENT from the DOM, not merely hidden; and
 *   2. the census below never opened one — no click, no `defaultOpen`, anywhere.
 *
 * On a completed run most of the panel is collapsed at rest, so most of the
 * assembled surface was outside the guard while the guard's own note claimed
 * it. Paul found the duplicate the same way the original was found — by
 * looking at a screenshot — and the repeated sentence
 * (`COPY.checks.leader_not_assessed.meaning`) renders in the options-comparison
 * caveat AND in `WhatWeChecked`, both behind collapsed sections.
 *
 * `EVERY SECTION OPEN` below closes that gap. It is the same census over the
 * whole surface rather than the visible slice, and it carries its own
 * precondition assertion: it fails if it did not actually open anything, so it
 * cannot quietly decay back into the viewport-only check it replaces.
 *
 * ⛔ AND THE SCOPE OF *THAT* CLOSURE, STATED BEFORE ANYONE INHERITS IT AS MORE:
 * the expanded arm runs GREEN on `decisionWithLeaderWithheldAndReason`, which is
 * Paul's state — so IT DOES NOT YET CATCH HIS INSTANCE, and this file does not
 * claim to. Measured reason: `WhatWeChecked.meaningFor()` returns
 * `${base} ${cause}` in ONE element while the comparison caveat renders the same
 * `base` on its own, so the two occurrences are a CONTAINMENT relationship, not
 * an equality — and every census here compares whole normalised strings.
 * Catching it needs a containment pass, which is a different instrument with a
 * different false-positive profile (every short claim is a substring of
 * something) and is not smuggled in here.
 *
 * What this change DOES deliver: the collapsed half of the surface is now inside
 * the guard at all, with a discriminating pair proving the detector fires across
 * sections and stays silent on a section's own per-row caption.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import {
  decisionWithLeaderWithheldAndReason,
  genuineDecision,
  highUncertainty,
  openStrategicChallenge,
} from './analysisNewFixtures'

afterEach(() => cleanup())

const renderSurface = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_census"
    />,
  )

/**
 * Sentences a user actually reads, normalised.
 *
 * ⚠ ONLY LEAF ELEMENTS. Taking `textContent` from every node would count each
 * sentence once per ancestor and make the duplicate check fire on everything —
 * a guard that always fails is as useless as one that never does.
 */
function visibleSentences(root: HTMLElement): string[] {
  const out: string[] = []
  root.querySelectorAll('p, span, h3, li, dd, dt, button').forEach((el) => {
    if (el.querySelector('p, span, h3, li, dd, dt, button')) return
    const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    // ⚠ CENSUS CLAIMS, NOT LABELS — corrected at a real mounted run.
    //
    // Length alone was the wrong discriminator. On a run with a single non-zero
    // driver, "Peak Season Demand Pressure" (27 chars) appears in the glance's
    // "what matters most" AND as the row of its own Drivers section — and that
    // is CORRECT: the second occurrence carries new content ("Structural
    // influence 100%; lowers the outcome") and the repeated label is how a
    // reader connects a summary to its detail. Cross-referencing a name is not
    // restating a claim.
    //
    // The defect this census exists for was always a SENTENCE said twice. A
    // claim needs a subject and a predicate, so it runs to five words or more;
    // a label is a noun phrase. "Cost Efficiency Achieved is the hinge" (six
    // words) stays in scope, which is the case that matters — a headline IS a
    // claim even without a full stop.
    if (t.length >= 25 && t.split(' ').length >= 5) out.push(t.toLowerCase())
  })
  return out
}

describe('no claim is stated twice on the assembled surface', () => {
  for (const [name, make] of Object.entries({
    'a genuine decision': genuineDecision,
    'an open strategic challenge': openStrategicChallenge,
    'a high-uncertainty run': highUncertainty,
  })) {
    it(`states each sentence once — ${name}`, () => {
      const { container } = renderSurface(make())
      const sentences = visibleSentences(container.querySelector('[data-testid="analysis-new-tab-body"]')!)

      // POSITIVE CONTROL: an empty census would pass this trivially, and that is
      // exactly how a composition guard rots (trap 13).
      // ⚠ FLOOR LOWERED 2 -> 1 (30 Aug 2026). The first viewport was rebuilt to
      // carry its meaning in typography and visual encoding rather than in
      // sentences, so the prose count legitimately fell to 2. The guard's job is
      // to stop an EMPTY census passing trivially; it is not a prose quota.
      expect(sentences.length, 'the surface rendered almost no prose — this census is vacuous').toBeGreaterThan(1)

      const seen = new Map<string, number>()
      for (const s of sentences) seen.set(s, (seen.get(s) ?? 0) + 1)
      const repeated = [...seen.entries()].filter(([, n]) => n > 1).map(([s]) => s)
      expect(repeated, `these sentences appear more than once on one surface:\n${repeated.join('\n')}`).toEqual([])
    })
  }
})

describe('the glance and the sections below it do not restate each other', () => {
  it('no key insight repeats the glance headline or its trust line', () => {
    // The EXACT defect that shipped, bound to the two surfaces by testid so a
    // future change that reintroduces it fails here by name.
    renderSurface(genuineDecision())
    const glance = screen.getByTestId('analysis-new-glance').textContent ?? ''
    const insights = screen.queryByTestId('analysis-new-key-insights')?.textContent ?? ''

    /**
     * ⛔ THE HEADLINE LIMB IS RETIRED, THE TRUST-LINE LIMB IS NOT. Paul ruled
     * 18 Sep 2026 that the conclusion is deleted, so "a key insight repeats the
     * glance headline" is no longer reachable — there is no headline to repeat.
     * Asserting its absence here instead keeps the case honest rather than
     * leaving a limb that passes because its subject vanished.
     */
    expect(screen.queryByTestId('analysis-new-glance-headline')).toBeNull()

    const trust = screen.getByTestId('analysis-new-glance-verdict').textContent ?? ''
    // The producer's reason is the part most likely to be echoed below.
    const reason = trust.split('—').pop()?.trim() ?? ''
    expect(reason.length, 'no reason in the trust line — this assertion would be vacuous').toBeGreaterThan(10)
    expect(insights).not.toContain(reason)
    expect(glance).toContain(reason)
  })

  it('the census can actually detect a repeat', () => {
    // ⭐ The discriminating half. Without it, "no duplicates found" could mean
    // the detector is broken rather than the surface being clean.
    const el = document.createElement('div')
    el.innerHTML =
      '<p>This result is sensitive to uncertainty and could flip.</p>' +
      '<p>This result is sensitive to uncertainty and could flip.</p>'
    const s = visibleSentences(el)
    const seen = new Map<string, number>()
    for (const x of s) seen.set(x, (seen.get(x) ?? 0) + 1)
    expect([...seen.values()].some((n) => n > 1)).toBe(true)
  })
})

/**
 * EVERY SECTION OPEN — the same census over the WHOLE surface.
 *
 * ⛔ WHY THIS IS A SEPARATE DESCRIBE AND NOT A WIDER `visibleSentences`. The
 * blind spot is not in the reader, it is in the DOM: a closed `SectionShell`
 * renders `null` for its children, so there is nothing for any reader to miss.
 * Widening the selector would change nothing. The only fix is to OPEN the
 * sections and census what is then mounted.
 *
 * ⚠ IT PINS ITS OWN PRECONDITION. `expandEverything` returns how many toggles
 * it actually pressed, and each case asserts that number is non-zero. Without
 * that, a future change that flattens the sections, renames the toggle testid
 * or default-opens everything would leave these cases passing while testing the
 * identical slice the viewport census already covers — a guard agreeing with
 * its sibling (trap 13b), and invisible because the expected result is the same
 * either way.
 *
 * ⚠ FIXPOINT, NOT ONE PASS. Sections nest — `How this was worked out` contains
 * `What we checked`, which is itself a `SectionShell`. Opening the outer one
 * MOUNTS the inner toggle, which did not exist a moment earlier. The loop runs
 * until a pass presses nothing, with a hard iteration cap so a toggle that
 * fails to latch fails loudly instead of hanging the shard.
 */
function expandEverything(root: HTMLElement): number {
  let pressed = 0
  for (let pass = 0; pass < 12; pass += 1) {
    // ⛔ BOUND BY IDENTITY, NOT BY A PREDICATE OTHER OBJECTS SATISFY (trap 19).
    // The first version of this selected every `button[aria-expanded="false"]`
    // and never reached a fixpoint: this surface also carries expandable
    // controls that are NOT `SectionShell`s and do not latch open from a
    // synthetic click, so the loop pressed them forever. `SectionShell` stamps
    // `data-testid={`${testId}-toggle`}` (`SectionShell.tsx:233`) and that is
    // the thing this function is about.
    const closed = [
      ...root.querySelectorAll<HTMLButtonElement>('button[data-testid$="-toggle"][aria-expanded="false"]'),
    ]
    if (closed.length === 0) return pressed
    closed.forEach((b) => {
      fireEvent.click(b)
      pressed += 1
    })
  }
  throw new Error(
    'expandEverything did not reach a fixpoint in 12 passes — a toggle is not latching open',
  )
}

/**
 * Which SECTION a sentence belongs to — the id of the nearest `SectionShell`
 * region above it, or `'root'` for prose outside every section.
 */
function owningSection(el: Element): string {
  const region = el.closest('[data-testid$="-region"]')
  return region?.getAttribute('data-testid') ?? 'root'
}

/**
 * Sentences with their owning section, for the CROSS-SECTION census.
 */
function sentencesBySection(root: HTMLElement): Array<{ text: string; section: string }> {
  const out: Array<{ text: string; section: string }> = []
  root.querySelectorAll('p, span, h3, li, dd, dt, button').forEach((el) => {
    if (el.querySelector('p, span, h3, li, dd, dt, button')) return
    const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (t.length >= 25 && t.split(' ').length >= 5) out.push({ text: t.toLowerCase(), section: owningSection(el) })
  })
  return out
}

/**
 * ⛔⛔ CROSS-SECTION, NOT PER-SURFACE — AND THAT NARROWING IS EVIDENCE-LED, NOT
 * A CONVENIENCE. The first version of this case asserted no sentence appears
 * twice anywhere on the expanded surface. Run, it went RED on
 *
 *     "Grounded in Olumi’s structural influence score."
 *
 * which is a PER-ROW provenance caption: the drivers section states each row’s
 * grounding on that row, so N rows from one source legitimately carry it N
 * times. That is the same case this file already adjudicated one level down
 * for LABELS — *"Cross-referencing a name is not restating a claim"* — and
 * banning it would be the census demanding the product stop attributing rows.
 *
 * The defect the guard is named for is a SECTION restating ANOTHER SECTION’s
 * prose. Paul’s 20 Sep instance is exactly that shape:
 * `COPY.checks.leader_not_assessed.meaning` renders in the options-comparison
 * caveat AND in `What we checked`. Two sections, one sentence. A repeat inside
 * one section is that section’s own grammar and is out of scope here.
 *
 * ⚠ THE PER-SURFACE CASE IS NOT DELETED — its sibling above still runs it over
 * the default-open slice, where a repeat cannot be a per-row caption because no
 * row lists are mounted. The two arms answer different questions and neither
 * supersedes the other (trap 21).
 */
describe('no section restates another section\'s prose once every section is open', () => {
  for (const [name, make] of Object.entries({
    'a genuine decision': genuineDecision,
    'an open strategic challenge': openStrategicChallenge,
    'a high-uncertainty run': highUncertainty,
    /**
     * ⭐ PAUL'S 20 SEP RUN. The other three fixtures all name a leader, so none
     * of them mounts the withheld-leader caveat — which is the state the
     * duplicate was witnessed in. Without this member the arm above is a wider
     * census over a state the defect cannot occur in.
     */
    'a run whose leader is withheld with a reason': decisionWithLeaderWithheldAndReason,
  })) {
    it(`states each sentence once with every section expanded — ${name}`, () => {
      const { container } = renderSurface(make())
      const body = container.querySelector<HTMLElement>('[data-testid="analysis-new-tab-body"]')!

      const before = visibleSentences(body).length
      const pressed = expandEverything(body)

      // ⭐ THE PRECONDITION. This case is only a wider census than its sibling
      // if something was actually collapsed and is now open.
      expect(pressed, 'nothing was collapsed — this case is a duplicate of the viewport census').toBeGreaterThan(0)

      const rows = sentencesBySection(body)
      expect(
        rows.length,
        'expanding every section revealed no additional prose — the expansion did not mount anything',
      ).toBeGreaterThan(before)

      // ⭐ THE INSTRUMENT'S OWN PRECONDITION: the expansion must have mounted
      // prose in MORE THAN ONE section, or "no sentence spans two sections" is
      // true for want of a second section rather than for want of a repeat.
      const sections = new Set(rows.map((r) => r.section))
      expect(sections.size, 'prose landed in fewer than two sections — this census cannot discriminate').toBeGreaterThan(1)

      const where = new Map<string, Set<string>>()
      for (const r of rows) {
        const set = where.get(r.text) ?? new Set<string>()
        set.add(r.section)
        where.set(r.text, set)
      }
      const acrossSections = [...where.entries()]
        .filter(([, s]) => s.size > 1)
        .map(([text, s]) => `${text}  [${[...s].join(' + ')}]`)
      expect(
        acrossSections,
        `these sentences are stated in more than one section:\n${acrossSections.join('\n')}`,
      ).toEqual([])
    })
  }
})

/**
 * ⭐ THE DISCRIMINATING PAIR for the cross-section census — without it, the
 * three green cases above could mean the detector is broken rather than the
 * surface being clean, and a guard that cannot fail is the thing this file was
 * written to hunt (trap 13).
 *
 * ⚠ IT IS A PAIR, NOT A SINGLE MUTANT. One case proves it FIRES when two
 * sections share a sentence; the other proves it STAYS SILENT when one section
 * repeats its own per-row caption. A single biting case would prove sensitivity
 * to *something*; only the pair proves sensitivity to the named thing, and only
 * the second stops a future "tighten the census" change quietly re-banning the
 * per-row attribution this arm was deliberately scoped to permit.
 */
describe('the cross-section census discriminates', () => {
  const twoSections = (a: string, b: string) => {
    const el = document.createElement('div')
    el.innerHTML =
      `<div data-testid="alpha-region"><p>${a}</p></div>` +
      `<div data-testid="beta-region"><p>${b}</p></div>`
    return el
  }
  const across = (root: HTMLElement) => {
    const where = new Map<string, Set<string>>()
    for (const r of sentencesBySection(root)) {
      const s = where.get(r.text) ?? new Set<string>()
      s.add(r.section)
      where.set(r.text, s)
    }
    return [...where.entries()].filter(([, s]) => s.size > 1).map(([t]) => t)
  }

  const CLAIM = 'Olumi could not confirm which option is most likely on this run.'

  it('FIRES when two sections state the same sentence', () => {
    expect(across(twoSections(CLAIM, CLAIM))).toEqual([CLAIM.toLowerCase()])
  })

  it('STAYS SILENT when one section repeats its own per-row caption', () => {
    const el = document.createElement('div')
    const caption = "Grounded in Olumi's structural influence score."
    el.innerHTML =
      '<div data-testid="drivers-region">' +
      `<p>${caption}</p><p>${caption}</p><p>${caption}</p>` +
      '</div>'
    expect(across(el)).toEqual([])
  })
})
