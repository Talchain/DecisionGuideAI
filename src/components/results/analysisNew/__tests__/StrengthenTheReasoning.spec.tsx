/**
 * Analysis (New) — "Strengthen the reasoning" presentation, and the science-
 * grounding rule that governs it (brief §14, §15).
 *
 * The rule under test is the one most easily broken by good intentions: a
 * recommendation is NOT scientifically grounded because it sounds like a
 * recognised technique. Only the producer's own DSK attestation licenses the
 * grounding line, presence IS the attestation, and the ids ride as `data-*`
 * rather than as sentences.
 */

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StrengthenTheReasoning } from '../sections/StrengthenTheReasoning'
import type { Recommendation } from '../../strengthen/strengthenTypes'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { openAskOlumi } from '../../coaching/askOlumiStore'
import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'

const rec = (over: Partial<Recommendation> & { id: string }): Recommendation =>
  ({
    helpType: 'challenge',
    title: 'Run a premortem on this plan',
    signal: 'One factor carries most of the influence.',
    whyNow: 'The conclusion rests almost entirely on it.',
    tryThis: 'Imagine it is six months on and this failed. Write down why.',
    sourceLine: 'From the influence concentration check.',
    action: { kind: 'ai-dialogue', label: 'Work through a premortem', prompt: 'Run a premortem' },
    targetId: 'f_leadtime',
    priority: 1,
    ...over,
  }) as Recommendation

describe('what / why / do it (§14)', () => {
  it('renders all three, from the engine’s own fields', () => {
    render(<StrengthenTheReasoning interventions={[rec({ id: 'strengthen:phase3:g1' })]} />)
    expect(screen.getByText('Run a premortem on this plan')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-new-strengthen-why')).toHaveTextContent(
      'One factor carries most of the influence. The conclusion rests almost entirely on it.',
    )
    expect(screen.getByTestId('analysis-new-strengthen-try')).toHaveTextContent(
      'Imagine it is six months on and this failed.',
    )
    expect(screen.getByTestId('analysis-new-strengthen-action')).toHaveTextContent(
      'Work through a premortem',
    )
  })

  it('routes the primary action through the existing Ask-Olumi drawer, prefilled and NOT auto-sent', () => {
    render(<StrengthenTheReasoning interventions={[rec({ id: 'strengthen:phase3:g1' })]} />)
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-action'))
    expect(openAskOlumi).toHaveBeenCalledWith(
      expect.objectContaining({
        // The ENGINE's strings, so what the user sends is what the engine
        // recommended — not a paraphrase composed here.
        draft: 'Run a premortem',
        label: 'Work through a premortem',
        targetId: 'f_leadtime',
      }),
    )
  })

  it('routes canvas focus through the existing fail-closed helper', () => {
    render(<StrengthenTheReasoning interventions={[rec({ id: 'strengthen:phase3:g1' })]} />)
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-focus'))
    expect(focusModelTarget).toHaveBeenCalledWith('f_leadtime')
  })
})

describe('science grounding (§15) — the producer attests, or nothing does', () => {
  const item = rec({ id: 'strengthen:phase3:g1' })

  it('renders the grounding line ONLY when the producer attested a claim for THIS row', () => {
    render(
      <StrengthenTheReasoning
        interventions={[item]}
        scienceGrounding={{
          'strengthen:phase3:g1': { claimId: 'DSK-B-003', protocolId: 'DSK-P-002', strength: 'strong' },
        }}
      />,
    )
    const line = screen.getByTestId('analysis-new-strengthen-science-grounding')
    expect(line).toHaveTextContent('Grounded in the decision-science knowledge base · Strong evidence.')
    // Ids are PROVENANCE FOR AN AUDITOR, not copy for a reader.
    expect(line).toHaveAttribute('data-dsk-claim-id', 'DSK-B-003')
    expect(line).toHaveAttribute('data-dsk-protocol-id', 'DSK-P-002')
    expect(line.textContent).not.toContain('DSK-B-003')
  })

  it('renders NOTHING when the producer attested nothing — no default, no inferred strength', () => {
    // The discriminating half. The row's title literally says "premortem", so a
    // surface that labelled grounding from the WORDING rather than from the
    // attestation would pass the case above and fail this one.
    render(<StrengthenTheReasoning interventions={[item]} scienceGrounding={{}} />)
    expect(screen.queryByTestId('analysis-new-strengthen-science-grounding')).toBeNull()
  })

  it('does not borrow another row’s attestation', () => {
    render(
      <StrengthenTheReasoning
        interventions={[item]}
        scienceGrounding={{ 'strengthen:phase3:SOMEONE_ELSE': { claimId: 'DSK-B-999' } }}
      />,
    )
    expect(screen.queryByTestId('analysis-new-strengthen-science-grounding')).toBeNull()
  })

  it('drops an unrecognised strength token rather than passing it through as copy', () => {
    render(
      <StrengthenTheReasoning
        interventions={[item]}
        scienceGrounding={{ 'strengthen:phase3:g1': { claimId: 'DSK-B-003', strength: 'wildly_conclusive' } }}
      />,
    )
    const line = screen.getByTestId('analysis-new-strengthen-science-grounding')
    expect(line).toHaveTextContent('Grounded in the decision-science knowledge base.')
    expect(line.textContent).not.toContain('wildly_conclusive')
  })
})

describe('the empty state (§19)', () => {
  it('states what was not found, and makes no claim that the reasoning is sound', () => {
    render(<StrengthenTheReasoning interventions={[]} />)
    const empty = screen.getByTestId('analysis-new-strengthen-empty')
    expect(empty).toHaveTextContent('No high-priority reasoning intervention identified yet.')
    expect(empty.textContent).not.toMatch(/solid|healthy|good|no issues|looks fine/i)
  })
})
