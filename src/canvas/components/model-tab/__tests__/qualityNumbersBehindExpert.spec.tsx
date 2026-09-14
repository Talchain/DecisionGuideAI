/**
 * ⭐⭐ "9.0 / 10" BESIDE A HEADING CALLED "MODEL CARD" READS AS A VERDICT ON THE
 * MODEL. IT IS NOT ONE.
 *
 * Measured on deployed `3b2df4ce`, guest, saved example, pre-run:
 *     ceeQuality = { coverage: 10, structure: 8, safety: 8, overall: 9 }
 * — CEE's STRUCTURAL read. On that same screen the goal had no target, all five
 * outcomes read "Not set yet", and 7 of 8 factors were Olumi's estimates rather
 * than the user's. The number is not false; alone and unlabelled it answers a
 * question the reader did not ask and silences the ones they should.
 *
 * Paul's ruling (9 Sep 2026): *"the bare numbers should be under easy-to-access
 * progressive disclosure, so they don't scare the average user"*, on the expert
 * toggle *"I think we've built before"* — and it exists: `olumi.expertMode`
 * (`OutputsDock.tsx:1150`, persisted), provided as `DetailToggleContext` at
 * `ModelTabBody.tsx:955`. Nothing new is introduced here.
 *
 * ⛔ NO NEW SCORE, AND NO WORD STANDING IN FOR ONE. Deriving "Good"/"Fair" from
 * `overall` would be a second score wearing plain clothes.
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModelHealthSection } from '../ModelHealthSection'
import { DetailToggleContext } from '../DetailToggleContext'

vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('../../../../components/results/Accordion', () => ({
  Accordion: ({ children, title, tierLabel, tierTitle, testId }: {
    children: React.ReactNode; title: string; tierLabel?: string; tierTitle?: string; testId?: string
  }) => (
    <div data-testid={testId}>
      <span>{title}</span>
      {tierLabel && <span data-testid="tier-label" title={tierTitle}>{tierLabel}</span>}
      {children}
    </div>
  ),
}))

/** The live figures, not invented ones. */
const LIVE = { coverage: 10, structure: 8, safety: 8, overall: 9 }

const at = (showDetail: boolean) =>
  render(
    <DetailToggleContext.Provider value={{ showDetail }}>
      <ModelHealthSection ceeQuality={LIVE} />
    </DetailToggleContext.Provider>,
  )

describe('⭐ the bare number is expert-only', () => {
  it('⛔ PLAIN shows no score in the header', () => {
    at(false)
    expect(screen.queryByTestId('tier-label')).toBeNull()
  })

  /**
   * ⭐⭐ EXPERT STILL SEES `overall` — "behind the toggle", not "gone".
   *
   * ⚠⚠ THIS CASE REPLACES ONE THAT PINNED THE WRONG BEHAVIOUR. It asserted the
   * pill showed `coverage 10 · structure 8 · safety 8`, and review showed that
   * shipped two defects: experts saw those three dimensions TWICE (the
   * sub-scores block below renders Structure / Causality / Coverage / Safety
   * under the same `showDetail`), and `overall` — which
   * `ceeQualityDimensions.ts` calls "the only score CEE always sends" —
   * rendered for NOBODY, because its `||` fallback fires only when all three
   * optionals are absent.
   *
   * Neuter the header expression and this REDs. It is the assertion that stops
   * "move it behind the toggle" quietly becoming "delete it".
   */
  it('⭐⭐ EXPERT sees the overall score — moved behind the toggle, not deleted', () => {
    at(true)
    expect(screen.getByTestId('tier-label')).toHaveTextContent('9.0 / 10')
  })

  /**
   * ⭐ AND SEES IT ONCE. The previous version of this case read
   * `not.toMatch(/^9 \/ 10$/)` against a fixture supplying ALL THREE optionals —
   * so the `/ 10` branch it named was UNREACHABLE from that fixture and the
   * assertion could not fail for the stated reason (trap 13: a test that cannot
   * fail). It is now a positive pair that bites in both directions.
   */
  it('⛔ EXPERT does not see the sub-scores TWICE — the pill is not a second copy', () => {
    at(true)
    const pill = screen.getByTestId('tier-label').textContent ?? ''
    expect(pill.toLowerCase()).not.toContain('coverage')
    expect(pill.toLowerCase()).not.toContain('structure')
    expect(pill.toLowerCase()).not.toContain('safety')

    /*
     * ⚠ THE PRECONDITION, PINNED IN-TEST. Three absences are only about
     * DUPLICATION if the dimensions are genuinely rendered somewhere — otherwise
     * this case would pass just as happily on a build that had deleted the
     * sub-score block, which is the opposite of what is wanted.
     */
    expect(screen.getByTestId('quality-row-coverage')).toHaveTextContent('Coverage')
    expect(screen.getByTestId('quality-row-structure')).toHaveTextContent('Structure')
    expect(screen.getByTestId('quality-row-safety')).toHaveTextContent('Safety')
  })

  /**
   * ⚠ AND THE SUB-SCORES ARE EXPERT-ONLY TOO, so Plain is not merely missing the
   * pill while showing the same digits ten lines lower — which would make the
   * whole change cosmetic.
   */
  it('⛔ PLAIN sees no sub-score rows either', () => {
    at(false)
    expect(screen.queryByTestId('quality-row-coverage')).toBeNull()
    expect(screen.queryByTestId('quality-row-structure')).toBeNull()
    expect(screen.queryByTestId('quality-row-safety')).toBeNull()
  })

  it('CONTROL: the card itself is still there for everyone', () => {
    at(false)
    expect(screen.getByText('Model card')).toBeInTheDocument()
  })
})

describe('⛔ the pill explains ITSELF, not another quantity', () => {
  it('⭐ names what it measures — and does NOT claim factor confidence', () => {
    at(true)
    const title = screen.getByTestId('tier-label').getAttribute('title') ?? ''
    expect(title.length).toBeGreaterThan(20)
    // The shared Accordion used to hardcode this sentence for EVERY caller.
    // On the measured model every factor's `confidence` is null, so it explained
    // the number by a field that is empty everywhere.
    expect(title).not.toMatch(/confidence levels of your key factors/i)
  })

  it('⭐ and says what it does NOT cover, so 9 is not read as a verdict', () => {
    at(true)
    const title = screen.getByTestId('tier-label').getAttribute('title') ?? ''
    expect(title.toLowerCase()).toContain('does not')
  })
})

describe('⛔ absence is still absence', () => {
  it('no quality signal shows no pill, in either tier', () => {
    const { unmount } = render(
      <DetailToggleContext.Provider value={{ showDetail: true }}>
        <ModelHealthSection ceeQuality={null} />
      </DetailToggleContext.Provider>,
    )
    expect(screen.queryByTestId('tier-label')).toBeNull()
    unmount()
    at(false)
    expect(screen.queryByTestId('tier-label')).toBeNull()
  })
})
