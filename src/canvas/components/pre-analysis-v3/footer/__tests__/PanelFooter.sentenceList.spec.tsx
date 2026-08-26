/**
 * THE FOOTER RENDERS THE PRODUCER'S SENTENCES ONE PER LINE.
 *
 * Every blocker CEE names arrived joined by spaces into one `panelMeta` line —
 * the join is UNBOUNDED and nothing truncates it. Nothing is truncated
 * or summarised: the SAME bytes render one per line.
 *
 * ⚠ THE ONE-BLOCKER TWIN IS PART OF THE CONTRACT. A list of one renders a
 * bullet where prose belonged — a regression in the common small case bought
 * with a fix for the rare large one. It is asserted here, not assumed.
 */
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { PanelFooter } from '../PanelFooter'

const REAL = [
  'Choose the missing effect value for "keep what we have" on "Current CRM Capability Gap".',
  'Choose the missing effect value for "migrate to Salesforce instead" on "Salesforce Switching Cost".',
]

const renderShut = (sentences?: readonly string[]) =>
  render(
    <PanelFooter
      // The RESTING value only. `deriveReadinessDisplay` overrides it entirely
      // while the gate is shut, which is the state under test — so this must not
      // be mistaken for the source of the subline being asserted below.
      footer={{ dot: 'success', headline: 'Ready', subline: 'resting' }}
      onAnalyse={() => {}}
      isAnalysing={false}
      canRun={false}
      blockedReason={(sentences ?? REAL).join(' ')}
      blockedSentences={sentences}
    />,
  )

describe('PanelFooter — producer sentences render as a list', () => {
  it('PRECONDITION: the fixture is multi-sentence, so a list is the right shape', () => {
    expect(REAL.length).toBeGreaterThan(1)
  })

  it('renders ONE LIST ITEM PER PRODUCER SENTENCE', () => {
    renderShut(REAL)
    const list = screen.getByTestId('pre-analysis-v3-footer-subline-list')
    expect(list.querySelectorAll('li')).toHaveLength(REAL.length)
  })

  it('EVERY ITEM IS BYTE-IDENTICAL to a sentence the producer wrote', () => {
    renderShut(REAL)
    const items = Array.from(
      screen.getByTestId('pre-analysis-v3-footer-subline-list').querySelectorAll('li'),
    ).map(li => li.textContent)
    expect(items).toEqual([...REAL])
  })

  it('THE UNION IS EXACT — joining the rendered items reproduces the joined string', () => {
    renderShut(REAL)
    const items = Array.from(
      screen.getByTestId('pre-analysis-v3-footer-subline-list').querySelectorAll('li'),
    ).map(li => li.textContent ?? '')
    expect(items.join(' ')).toBe(REAL.join(' '))
  })

  it('THE ONE-BLOCKER TWIN: a single sentence renders as prose, NOT a list of one', () => {
    renderShut([REAL[0]])
    expect(screen.queryByTestId('pre-analysis-v3-footer-subline-list')).toBeNull()
    expect(screen.getByText(REAL[0])).toBeInTheDocument()
  })

  it('NO SENTENCES SUPPLIED: today’s single paragraph, unchanged', () => {
    renderShut(undefined)
    expect(screen.queryByTestId('pre-analysis-v3-footer-subline-list')).toBeNull()
    expect(screen.getByText(REAL.join(' '))).toBeInTheDocument()
  })
})
