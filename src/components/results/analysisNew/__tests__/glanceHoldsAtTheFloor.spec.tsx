/**
 * ⭐⭐ TWO LAYOUT DEFECTS THAT NO EXISTING TEST COULD HAVE SEEN, AND THE
 * MECHANISMS THAT FIX THEM.
 *
 * Both were found by driving the panel in a real browser at the 280px dock
 * floor and at 420px, and neither is visible to jsdom, which performs no
 * layout. So these pin the STRUCTURAL CAUSE rather than the pixels — the thing
 * a future edit would have to undo to bring the defect back.
 *
 * ── 1. THE STALENESS RIBBON CRUSHED ITS OWN SENTENCE ──────────────────────
 * Measured at 280px: the "Re-run to be sure" control is 102.7px — 45% of the
 * 230px ribbon — leaving 85.3px for a 51-character sentence, which set it to
 * FOUR lines of two words each. The permission was `min-w-0` on the text: a
 * declaration that it will shrink to nothing, which is exactly what it did.
 * The fix is a wrapping container plus a real floor on the text, so the
 * control drops to its own line precisely when the sentence can no longer
 * afford to share one — and stays inline at 420px, where it can.
 *
 * ── 2. THE QUALIFIER WAS ORPHANED FROM WHAT IT QUALIFIES ──────────────────
 * "On inputs whose source Olumi could not establish" modifies the verdict
 * above it. It rendered as a SIBLING of the verdict inside the section's
 * `space-y-3`, so it sat 12px below the sentence it qualifies and 12px above
 * one it does not — equidistant, in identical typography, with nothing binding
 * it either way. Paul reported it from a manual test as an orphaned fragment,
 * which is precisely what the geometry made it.
 *
 * ⚠ AND THE FIRST FIX DID NOT WORK, WHICH IS WHY THIS TEST PINS STRUCTURE AND
 * NOT A CLASS: `space-y-3` compiles to
 * `.space-y-3 > :not([hidden]) ~ :not([hidden])`, which out-specifies a plain
 * `.-mt-2`. The override changed the file and NOT the render — caught only by
 * re-measuring in the browser. The gap is owned by the PARENT, so the only
 * real fix is to stop telling the parent these are peers. That is a DOM
 * relationship, and a DOM relationship is something jsdom can hold.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { AtAGlance } from '../sections/AtAGlance'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { genuineDecision } from './analysisNewFixtures'

const glanceOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: true,
  }).atAGlance

afterEach(() => cleanup())

describe('the qualifier belongs to the reading it qualifies', () => {
  it('renders the provenance line INSIDE the reading block, not beside it', () => {
    render(<AtAGlance
  isRunning={false} reanalyseBlocked={false}
  reanalyseBlockedReason={null} glance={glanceOf(genuineDecision())} onReanalyse={vi.fn()} />)

    const provenance = screen.getByTestId('analysis-new-glance-input-provenance')
    const reading = screen.getByTestId('analysis-new-glance-reading')
    const verdict = screen.getByTestId('analysis-new-glance-verdict')

    // ⚠ PRECONDITION, PINNED IN-TEST. If this fixture ever stops producing a
    // verdict AND a provenance line together, the containment assertion below
    // would hold vacuously — there would be nothing to group. Assert the pair
    // exists before asserting how they relate.
    expect(verdict).toBeInTheDocument()
    expect(provenance).toBeInTheDocument()

    expect(
      reading.contains(provenance),
      'The provenance line modifies the verdict above it. As a SIBLING inside ' +
        '`space-y-3` it sat equidistant between the sentence it qualifies and ' +
        'one it does not, and read as an orphaned fragment. It must share a ' +
        'container with the verdict so the section spaces the PAIR.',
    ).toBe(true)
    expect(reading.contains(verdict)).toBe(true)
  })
})

describe('the staleness ribbon does not crush its own sentence', () => {
  /**
   * ⚠ `isStale` / `staleKind` are AtAGlance's OWN props, not view-model fields —
   * the ribbon renders from the dock's freshness verdict, not from the run. A
   * first draft of this spec passed them to `buildAnalysisNewViewModel` instead
   * and the ribbon never rendered, so both assertions below would have failed
   * to find their subject rather than testing it.
   */
  const ribbonOf = () => {
    render(
      <AtAGlance
        isRunning={false} reanalyseBlocked={false}
        reanalyseBlockedReason={null}
        glance={glanceOf(genuineDecision())}
        isStale
        staleKind="changed"
        onReanalyse={vi.fn()}
      />,
    )
    return screen.getByTestId('analysis-new-glance-ribbon')
  }

  it('lets the control wrap rather than squeezing the text', () => {
    const ribbon = ribbonOf()
    // ⚠ PRECONDITION: the control must actually be present, or "the text is
    // not squeezed" is true because nothing is competing with it.
    expect(screen.getByTestId('analysis-new-glance-ribbon-reanalyse')).toBeInTheDocument()

    expect(
      ribbon.className,
      'Without wrapping, the control and the sentence compete for one line. At ' +
        'the 280px floor that left the sentence 85px and four lines of two words.',
    ).toContain('flex-wrap')
  })

  /**
   * ⚠ THIS PIN EXISTS BECAUSE THE FIX SILENTLY REVERTED ONCE. Rebuilding this
   * file from the baseline dropped two edits — a script threw before its
   * write — and `actionColourMeansPressable` could not see it, because that
   * guard catches a NON-action wearing the action colour and this is the
   * inverse: an ACTION wearing a status colour. The suite went green with the
   * defect restored.
   *
   * ⚠ AND THE GENERAL RULE IS NOT WRITTEN HERE ON PURPOSE. "No interactive
   * element wears a status colour" sounds right and is not: `ModelStrip`'s
   * verify toggle is a button whose amber IS its subject (a count of things
   * needing attention), and a rule with an exception carved for its only real
   * member is a rule agreeing with itself. This pins the narrow property that
   * was actually broken — inside this ribbon, the control must not be the same
   * colour as the sentence, or the reader cannot tell them apart.
   */
  it('does not paint the control the same colour as the sentence beside it', () => {
    ribbonOf() // rendered for its side effect; this test reads the two atoms directly
    const control = screen.getByTestId('analysis-new-glance-ribbon-reanalyse')
    const sentence = screen.getByTestId('analysis-new-status-stale')

    // PRECONDITION: both must be present, or "they differ" is vacuously true.
    expect(control).toBeInTheDocument()
    expect(sentence).toBeInTheDocument()

    const colourOf = (el: Element) =>
      (el.className.match(/(?:^|\s)(text-(?:info|warning|danger|success|text-[a-z-]+))(?:\s|$)/) ?? [])[1]

    expect(
      colourOf(control),
      'The control must carry the ACTION colour. It was `text-warning` — the ' +
        'same size and colour as the ribbon sentence, separated only by an ' +
        'underline at 11px.',
    ).toBe('text-info')
    expect(colourOf(sentence)).toBe('text-warning')
  })

  it('gives the sentence a real minimum width instead of permission to vanish', () => {
    const ribbon = ribbonOf()
    const text = ribbon.querySelector('span')
    expect(text).not.toBeNull()

    const cls = text!.className
    // The PROPERTY, not a specific value: a declared floor, and no `min-w-0`.
    // `min-w-0` is the declaration that made the defect possible — it says
    // "I will shrink to nothing" — so a future edit reinstating it must RED.
    expect(cls, 'the sentence must declare a minimum width').toMatch(/min-w-\[[^\]]+\]/)
    expect(
      /(^|\s)min-w-0(\s|$)/.test(cls),
      '`min-w-0` is permission to shrink to nothing, which is what let the ' +
        'ribbon squeeze this sentence to 85px at the dock floor.',
    ).toBe(false)
  })
})
