/**
 * One chip, two acts — and neither its NAME nor its HANDLER may be the other's.
 *
 * ⛔ WHY THIS EXISTS. Routing relationship rows through the existing Confirm chip
 * inherited an accessible name that asserts the estimate is CORRECT. For a
 * relationship strength that is the wrong claim: the act changes no number, it
 * stamps provenance — CEE admits the write only when strength and direction are
 * deep-equal to before. The person is adopting Olumi's estimate as their own
 * judgement, not certifying it. A confirmation reading as a validation is the
 * same class of untrue-about-authorship defect the canvas provenance fixes just
 * closed, one aria-label wide.
 *
 * ⚠ AND THE HANDLER ROUTING WAS THE HAZARD I NAMED AND LEFT UNTESTED. A factor
 * row's id is a NODE id and a relationship row's is an EDGE id; they go to
 * different slots of the edit authority, and an edge id in the node slot
 * addresses nothing — silently. Each arm below asserts BOTH that the right
 * handler fired and that the WRONG one did not; either alone would pass against
 * a component that called both.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModelRowView } from '../ModelRowView'
import type { ModelRow } from '../types'

const row = (over: Partial<ModelRow> & Pick<ModelRow, 'id'>): ModelRow => ({
  kind: 'factor',
  group: 'factors',
  label: `Label ${over.id}`,
  primaryValue: '0.45',
  attention: ['unconfirmed-estimate'],
  editable: true,
  ...over,
})

describe('confirming a RELATIONSHIP records judgement, never correctness', () => {
  it('⛔ never says the estimate "is correct" on a relationship row', () => {
    render(
      <ModelRowView
        row={row({ id: 'e-1', kind: 'relationship', group: 'relationships', label: 'Demand → Revenue' })}
        tier="plain"
        onConfirmRelationshipAsIs={vi.fn()}
      />,
    )
    const chip = screen.getByTestId('model-row-v2-e-1-confirm-as-is')
    expect(chip.getAttribute('aria-label')).not.toMatch(/is correct/i)
    // ⚠ 23 Sep 2026: the chip is now the shared icon button, whose hover text is
    // the panel's `Tooltip` rather than a native `title`. Same claim, read where
    // it now lives — and asserted PRESENT first, so a missing tooltip cannot pass.
    expect(chip.getAttribute('title')).toBeNull()
    fireEvent.mouseEnter(chip)
    const tip = screen.getByRole('tooltip').textContent ?? ''
    expect(tip).toMatch(/your own judgement/i)
    expect(tip).not.toMatch(/is correct/i)
    // ⭐ And it says what the act actually does — the producer's own vocabulary.
    expect(chip.getAttribute('aria-label')).toMatch(/your own judgement/i)
    expect(chip.getAttribute('aria-label')).toContain('Demand → Revenue')
  })

  it('⭐ DISCRIMINATING PAIR: the factor arm keeps its own name, so this is a per-kind claim', () => {
    // Without this, a blanket rename would satisfy the assertion above while
    // saying nothing about the row KIND being what decides.
    render(<ModelRowView row={row({ id: 'f-1' })} tier="plain" onConfirmValueAsIs={vi.fn()} />)
    expect(screen.getByTestId('model-row-v2-f-1-confirm-as-is').getAttribute('aria-label'))
      .toMatch(/is correct/i)
  })

  it('⭐ a relationship row calls the RELATIONSHIP handler, and never the value one', () => {
    const onValue = vi.fn()
    const onRelationship = vi.fn()
    render(
      <ModelRowView
        row={row({ id: 'e-2', kind: 'relationship', group: 'relationships' })}
        tier="plain"
        onConfirmValueAsIs={onValue}
        onConfirmRelationshipAsIs={onRelationship}
      />,
    )
    fireEvent.click(screen.getByTestId('model-row-v2-e-2-confirm-as-is'))
    expect(onRelationship).toHaveBeenCalledWith('e-2')
    expect(onValue).not.toHaveBeenCalled()
  })

  it('⭐ a factor row calls the VALUE handler, and never the relationship one', () => {
    const onValue = vi.fn()
    const onRelationship = vi.fn()
    render(
      <ModelRowView row={row({ id: 'f-2' })} tier="plain"
        onConfirmValueAsIs={onValue} onConfirmRelationshipAsIs={onRelationship} />,
    )
    fireEvent.click(screen.getByTestId('model-row-v2-f-2-confirm-as-is'))
    expect(onValue).toHaveBeenCalledWith('f-2')
    expect(onRelationship).not.toHaveBeenCalled()
  })

  it('withholds the chip on a relationship when the host passes no relationship handler', () => {
    // Connectivity is the HOST's decision; the row must not invent it. The value
    // handler being present must not mount a relationship confirmation.
    render(
      <ModelRowView row={row({ id: 'e-3', kind: 'relationship', group: 'relationships' })}
        tier="plain" onConfirmValueAsIs={vi.fn()} />,
    )
    expect(screen.queryByTestId('model-row-v2-e-3-confirm-as-is')).toBeNull()
  })
})
