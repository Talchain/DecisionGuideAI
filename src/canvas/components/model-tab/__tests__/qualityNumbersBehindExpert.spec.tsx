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

  it('⭐ EXPERT shows the dimensions that were always present and never rendered', () => {
    at(true)
    const pill = screen.getByTestId('tier-label')
    expect(pill).toHaveTextContent('coverage 10')
    expect(pill).toHaveTextContent('structure 8')
    expect(pill).toHaveTextContent('safety 8')
  })

  it('⛔ EXPERT does not reduce them to one bare "/ 10" verdict', () => {
    at(true)
    expect(screen.getByTestId('tier-label').textContent ?? '').not.toMatch(/^\s*9(\.0)?\s*\/\s*10\s*$/)
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
