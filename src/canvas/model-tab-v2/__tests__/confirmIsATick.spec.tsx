/**
 * ⭐ C1 — "Confirm" on every relationship row becomes a TICK, and keeps its words.
 *
 * Paul, 23 Sep 2026: text that repeats per row, especially clickable text like
 * "Confirm", should be an icon from the established iconography. Measured on the
 * captured market-entry draft: the word "Confirm" rendered on 21 of 21
 * relationship rows (19 of 19 on build-vs-buy), and at a 280px dock it was the
 * largest overlap class with the value (17 pairs).
 *
 * The rulings this binds (R4): the confirm ACT is `Check`; the confirmed STATUS
 * stays `CheckCircle`. The green `confirm` variant is not used, because
 * `text-success` measures 2.02:1 on the panel, under SC 1.4.11's 3:1.
 *
 * ⚠ BOUND BY IDENTITY: the button is found by ROLE + its EXACT accessible name,
 * then proved to be the same node as the row's own `-confirm-as-is` testid, so a
 * sibling button cannot satisfy it. The glyph is bound by lucide's own class
 * (`lucide-check`), which `lucide-check-circle` does not match as a class token.
 *
 * ⚠ THE ACCESSIBLE NAME IS THE OLD ONE, UNCHANGED. It was never the bare word
 * "Confirm": the 13 Sep ruling (`confirmIsJudgementNotValidation.spec`) made the
 * relationship name say what the act does. Only the VISIBLE word moves, into the
 * tooltip, which leads with it.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
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

const RELATIONSHIP_NAME = 'Adopt Olumi’s estimate for Demand → Revenue as your own judgement'

function renderRelationship(onSelect = vi.fn(), onConfirm = vi.fn()) {
  render(
    <ModelRowView
      row={row({ id: 'e-1', kind: 'relationship', group: 'relationships', label: 'Demand → Revenue' })}
      tier="plain"
      onSelect={onSelect}
      onConfirmRelationshipAsIs={onConfirm}
    />,
  )
  return { onSelect, onConfirm }
}

describe('C1 · a relationship row confirms with a tick, not the word', () => {
  it('the confirm control is ONE button, named by its old accessible name, with no visible text', () => {
    renderRelationship()
    const button = screen.getByRole('button', { name: RELATIONSHIP_NAME })
    expect(button).toBe(screen.getByTestId('model-row-v2-e-1-confirm-as-is'))
    expect(button.textContent?.trim()).toBe('')
  })

  it('it draws the ACTION glyph `Check`, never the STATUS glyph `CheckCircle`', () => {
    renderRelationship()
    const button = screen.getByTestId('model-row-v2-e-1-confirm-as-is')
    expect(button.querySelector('svg.lucide-check')).not.toBeNull()
    expect(button.querySelector('svg.lucide-check-circle')).toBeNull()
  })

  it('its tooltip leads with the word it replaced', () => {
    renderRelationship()
    const button = screen.getByTestId('model-row-v2-e-1-confirm-as-is')
    fireEvent.mouseEnter(button)
    const tip = screen.getByRole('tooltip')
    expect(tip.textContent).toMatch(/^Confirm\b/)
    // And it keeps the 13 Sep ruling: judgement, never correctness.
    expect(tip.textContent).toMatch(/your own judgement/i)
    expect(tip.textContent).not.toMatch(/is correct/i)
  })

  it('it is the SHARED icon button: 28px visual, 44px touch target, never the green variant', () => {
    renderRelationship()
    const cls = screen.getByTestId('model-row-v2-e-1-confirm-as-is').className
    expect(cls).toMatch(/\bw-7\b/)
    expect(cls).toMatch(/\bh-7\b/)
    expect(cls).toContain('before:inset-[-8px]')
    expect(cls).not.toMatch(/\btext-success\b/)
  })

  it('pressing it confirms THIS row and does not also select the row', () => {
    const { onSelect, onConfirm } = renderRelationship()
    fireEvent.click(screen.getByTestId('model-row-v2-e-1-confirm-as-is'))
    expect(onConfirm).toHaveBeenCalledWith('e-1')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('DISCRIMINATING PAIR: the value arm is the same tick with its own name', () => {
    render(<ModelRowView row={row({ id: 'f-1' })} tier="plain" onConfirmValueAsIs={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Confirm Label f-1 is correct' })
    expect(button).toBe(screen.getByTestId('model-row-v2-f-1-confirm-as-is'))
    expect(button.textContent?.trim()).toBe('')
    expect(button.querySelector('svg.lucide-check')).not.toBeNull()
  })

  it('CONTRAST: the word "Confirm" is no longer drawn anywhere in the row', () => {
    renderRelationship()
    const rowEl = screen.getByTestId('model-row-v2-e-1-confirm-as-is').closest('[role="option"]')
    expect(rowEl).not.toBeNull()
    expect(within(rowEl as HTMLElement).queryByText('Confirm')).toBeNull()
  })
})
