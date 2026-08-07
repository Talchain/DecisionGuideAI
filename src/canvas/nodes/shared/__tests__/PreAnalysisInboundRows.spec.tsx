/**
 * PreAnalysisDrivenByLine / PreAnalysisInboundRows — F4's SPOKEN claim.
 *
 * The finding was prose, not a pill: `OutcomeNode` / `RiskNode` said
 * *"Driven by 3 factors. Strongest: Price at 30%."* pre-analysis, where the
 * 30% is `USER_EDGE_DEFAULTS.weight`. Prose is a stronger claim than a number
 * — a bare "30%" can read as a placeholder, a sentence naming a winner cannot.
 *
 * Tested at the component rather than through the node's hover popover
 * deliberately: the popover positions itself with `requestAnimationFrame`
 * inside a portal, so driving it under fake timers tests the popover, not the
 * rule. Here the rule is the whole subject.
 *
 * Every absence assertion is paired with a PRESENCE assertion in the same
 * block (trap 13) — the sentence must be provably renderable before "it is
 * absent" means anything.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PreAnalysisDrivenByLine, PreAnalysisInboundRows } from '../PreAnalysisInboundRows'
import type { PreAnalysisInboundItem } from '../../../hooks/usePreAnalysisInbound'

const SET: PreAnalysisInboundItem = { edgeId: 'e1', nodeLabel: 'Unit price', strengthPct: 42 }
const UNSET: PreAnalysisInboundItem = { edgeId: 'e2', nodeLabel: 'Churn rate', strengthPct: null }

describe('PreAnalysisDrivenByLine — "Strongest" is a measurement, "Driven by" is a count', () => {
  it('POSITIVE CONTROL: speaks the whole sentence when a strength was set', () => {
    render(<PreAnalysisDrivenByLine items={[SET]} topSetItem={{ ...SET, strengthPct: 42 }} />)
    expect(screen.getByText(/Driven by 1 factor\./)).toBeDefined()
    expect(screen.getByText(/Strongest: Unit price at 42%\./)).toBeDefined()
  })

  it('keeps the count but DROPS the "Strongest" clause when nothing was set', () => {
    render(<PreAnalysisDrivenByLine items={[UNSET, { ...UNSET, edgeId: 'e3' }]} topSetItem={null} />)
    // The count is still true — the user really drew two edges.
    expect(screen.getByText(/Driven by 2 factors\./)).toBeDefined()
    // The comparative claim is gone entirely — not "unknown%", not "0%".
    expect(screen.queryByText(/Strongest/)).toBeNull()
    expect(screen.queryByText(/30%/)).toBeNull()
  })

  it('pluralises on the edge count, not on the set count', () => {
    render(<PreAnalysisDrivenByLine items={[SET, UNSET]} topSetItem={{ ...SET, strengthPct: 42 }} />)
    expect(screen.getByText(/Driven by 2 factors\./)).toBeDefined()
  })
})

describe('PreAnalysisInboundRows — an unset strength renders the disclosure, never a number', () => {
  it('POSITIVE CONTROL: renders the percentage for a set strength', () => {
    render(<PreAnalysisInboundRows items={[SET]} />)
    expect(screen.getByText('Unit price')).toBeDefined()
    expect(screen.getByText('42%')).toBeDefined()
    expect(screen.queryByTestId('pre-analysis-strength-unset-e1')).toBeNull()
  })

  it('renders the label AND an explicit "Not set" for an unset strength', () => {
    render(<PreAnalysisInboundRows items={[UNSET]} />)
    // The relationship is real and stays visible…
    expect(screen.getByText('Churn rate')).toBeDefined()
    // …only the number is withheld, with an announced disclosure.
    const marker = screen.getByTestId('pre-analysis-strength-unset-e2')
    expect(marker.textContent).toBe('Not set')
    expect(marker.getAttribute('aria-label')).toBe('Link strength not set')
  })

  it('mixes both states in one list without leaking the unset one as 0%', () => {
    render(<PreAnalysisInboundRows items={[SET, UNSET]} />)
    expect(screen.getByText('42%')).toBeDefined()
    expect(screen.getByTestId('pre-analysis-strength-unset-e2')).toBeDefined()
    expect(screen.queryByText('0%')).toBeNull()
  })
})
