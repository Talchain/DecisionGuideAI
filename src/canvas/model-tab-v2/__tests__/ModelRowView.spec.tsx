/**
 * Model tab v2 — the row's HONESTY PROPERTIES (design §4.2, §5.1).
 *
 * Every assertion here binds to its object by IDENTITY — `model-row-v2-<id>` —
 * never by a value predicate another row could satisfy. Several tests therefore
 * render TWO rows whose values are deliberately confusable, so a query that
 * matched the wrong element would fail rather than pass quietly.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModelRowView } from '../ModelRowView'
import type { ModelRow } from '../types'

function row(over: Partial<ModelRow> & Pick<ModelRow, 'id'>): ModelRow {
  return {
    kind: 'factor',
    group: 'factors',
    label: `Label ${over.id}`,
    primaryValue: '45 days',
    attention: [],
    editable: true,
    ...over,
  }
}

describe('ModelRowView — renders the model, never its own opinion of it', () => {
  it('renders THIS row\'s value, bound by id, when a confusable sibling is present', () => {
    render(
      <>
        <ModelRowView row={row({ id: 'f1', primaryValue: '45 days' })} tier="plain" />
        <ModelRowView row={row({ id: 'f2', primaryValue: '90 days' })} tier="plain" />
      </>,
    )
    expect(screen.getByTestId('model-row-v2-f1-value')).toHaveTextContent('45 days')
    expect(screen.getByTestId('model-row-v2-f2-value')).toHaveTextContent('90 days')
  })

  it('renders the label verbatim and does not reformat the value', () => {
    render(<ModelRowView row={row({ id: 'f1', primaryValue: '0.40', label: 'Win rate' })} tier="plain" />)
    expect(screen.getByTestId('model-row-v2-f1-label')).toHaveTextContent('Win rate')
    // Not "0.4" — the producer decided how this reads; the row does not re-derive it.
    expect(screen.getByTestId('model-row-v2-f1-value')).toHaveTextContent('0.40')
  })
})

describe('⭐ Confirm ✓ is offered by the ATTENTION REASON alone — no second value guard', () => {
  /*
   * ⚠⚠ THIS EXISTS BECAUSE A MUTANT BIT ONLY A SOURCE SCAN (measured, 19 Aug
   * 2026). Re-adding `&& row.primaryValue !== null` here failed exactly ONE
   * assertion — the textual guard saying the competitor is gone — and NOTHING
   * behavioural. A scan proves the line is absent; only a render proves the
   * chip appears on the row that needs it (trap 13b — presence of a control is
   * not coverage of the branch).
   *
   * The row below is the wire-real shape the old guard hid: a capped factor
   * carrying `observedState.value` and NO `raw_value`, so it has a value to
   * CONFIRM and none to DISPLAY. `primaryValue` is null and the chip must still
   * render, because the write authority accepts it.
   */
  it('⚠ renders Confirm on a row with a confirmable value and NO displayable one', () => {
    const onConfirmValueAsIs = vi.fn()
    render(
      <ModelRowView
        row={row({
          id: 'f_model_scale',
          primaryValue: null,
          attention: ['no-value', 'unconfirmed-estimate'],
        })}
        tier="plain"
        onConfirmValueAsIs={onConfirmValueAsIs}
      />,
    )
    // Bound by IDENTITY — the testid carries the row id, so a sibling row's
    // chip cannot satisfy this (trap 19).
    const chip = screen.getByTestId('model-row-v2-f_model_scale-confirm-as-is')
    expect(chip).toBeInTheDocument()
    fireEvent.click(chip)
    expect(onConfirmValueAsIs).toHaveBeenCalledWith('f_model_scale')
  })

  it('⚠ DISCRIMINATING TWIN — a row WITHOUT the reason gets no chip, same props', () => {
    // Without this, the assertion above would be satisfied by a chip that
    // renders unconditionally. The two rows differ in exactly one field.
    render(
      <ModelRowView
        row={row({ id: 'f_confirmed', primaryValue: null, attention: ['no-value'] })}
        tier="plain"
        onConfirmValueAsIs={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('model-row-v2-f_confirmed-confirm-as-is')).toBeNull()
  })
})

describe('ModelRowView — F9: a factor with no value can still be given one', () => {
  it('offers an EDITOR affordance for a null value, not inert text', () => {
    const onBeginEdit = vi.fn()
    render(
      <ModelRowView
        row={row({ id: 'f1', primaryValue: null })}
        tier="plain"
        onBeginEdit={onBeginEdit}
      />,
    )
    const cell = screen.getByTestId('model-row-v2-f1-value')
    // The defect being closed: today this slot is static text, so the value can
    // never be supplied. Here it is a live control.
    expect(cell.tagName).toBe('BUTTON')
    expect(cell).toBeEnabled()
    expect(cell).toHaveTextContent('Not set')
  })

  it('a non-editable row renders text, not a control', () => {
    render(<ModelRowView row={row({ id: 'a1', editable: false, primaryValue: '2,485' })} tier="plain" />)
    expect(screen.getByTestId('model-row-v2-a1-value').tagName).not.toBe('BUTTON')
  })
})

describe('ModelRowView — the disabled-affordance rule (the lane boundary)', () => {
  it('with NO write authority the editor is disabled and says why in words', () => {
    render(<ModelRowView row={row({ id: 'f1' })} tier="plain" />)
    const cell = screen.getByTestId('model-row-v2-f1-value')
    expect(cell).toBeDisabled()
    // The label must EXPLAIN, not merely be absent. A silently dead control is
    // indistinguishable from a broken one.
    expect(cell.getAttribute('title')).toMatch(/not connected yet/i)
  })

  it('with an authority wired the editor is enabled and reports the row id it was clicked for', () => {
    const onBeginEdit = vi.fn()
    render(
      <>
        <ModelRowView row={row({ id: 'f1' })} tier="plain" onBeginEdit={onBeginEdit} />
        <ModelRowView row={row({ id: 'f2' })} tier="plain" onBeginEdit={onBeginEdit} />
      </>,
    )
    screen.getByTestId('model-row-v2-f2-value').click()
    // Identity, not call count: a handler wired to the wrong row still fires once.
    expect(onBeginEdit).toHaveBeenCalledWith('f2')
  })
})

describe('ModelRowView — provenance absence is rendered as absence', () => {
  it('renders NO provenance chip when nothing states a source', () => {
    render(<ModelRowView row={row({ id: 'f1', provenanceSource: undefined })} tier="plain" />)
    expect(screen.queryByTestId('model-row-v2-f1-provenance')).toBeNull()
    // Positive control: the row DID render, so the absence above is about the
    // chip and not about a failed render (trap 13).
    expect(screen.getByTestId('model-row-v2-f1')).toBeInTheDocument()
  })

  it('classifies the raw stamp through the shared classifier, not a local map', () => {
    render(<ModelRowView row={row({ id: 'f1', provenanceSource: 'user_confirmed' })} tier="plain" />)
    // `user_confirmed` → "Confirmed by you". A local literal map would be the
    // mirror defect that once rendered "Not set" over a confirmed value.
    expect(screen.getByTestId('model-row-v2-f1-provenance')).toHaveTextContent('Confirmed by you')
  })
})

describe('ModelRowView — attention markers match the row exactly', () => {
  it('renders one marker per reason and none for a clean row', () => {
    render(
      <>
        <ModelRowView
          row={row({ id: 'f1', attention: ['no-value', 'unconfirmed-estimate'] })}
          tier="plain"
        />
        <ModelRowView row={row({ id: 'f2', attention: [] })} tier="plain" />
      </>,
    )
    expect(screen.getByTestId('model-row-v2-f1-attention-no-value')).toBeInTheDocument()
    expect(screen.getByTestId('model-row-v2-f1-attention-unconfirmed-estimate')).toBeInTheDocument()
    // The clean row must not inherit its neighbour's markers.
    expect(screen.queryByTestId('model-row-v2-f2-attention-no-value')).toBeNull()
  })

  it('every marker carries a worded label, not a bare glyph', () => {
    render(<ModelRowView row={row({ id: 'f1', attention: ['fragile'] })} tier="plain" />)
    expect(screen.getByTestId('model-row-v2-f1-attention-fragile')).toHaveAttribute(
      'aria-label',
      'Could flip the result',
    )
  })
})

describe('ModelRowView — the three-beat states tell the truth (design §5.1)', () => {
  it('APPLIED renders the RECEIPT\'s value, not the value the row already had', () => {
    render(
      <ModelRowView
        row={row({ id: 'f1', primaryValue: '45 days' })}
        tier="plain"
        commit={{ phase: 'applied', value: '60 days', provenanceSource: 'user' }}
      />,
    )
    // The whole point of the union: `applied` is reachable only from a receipt,
    // and what it shows is what the authority stored — never the optimistic echo.
    expect(screen.getByTestId('model-row-v2-f1-value')).toHaveTextContent('60 days')
    expect(screen.getByTestId('model-row-v2-f1-value')).not.toHaveTextContent('45 days')
  })

  it('PROPOSED keeps the old value on screen and says nothing has changed yet', () => {
    render(
      <ModelRowView
        row={row({ id: 'f1' })}
        tier="plain"
        commit={{ phase: 'proposed', from: '45 days', to: '60 days' }}
      />,
    )
    expect(screen.getByTestId('model-row-v2-f1-value-from')).toHaveTextContent('45 days')
    expect(screen.getByTestId('model-row-v2-f1-value-to')).toHaveTextContent('60 days')
    expect(screen.getByTestId('model-row-v2-f1-value')).toHaveTextContent(/nothing has changed yet/i)
  })

  it('REFUSED shows the value reverted AND states the reason', () => {
    render(
      <ModelRowView
        row={row({ id: 'f1' })}
        tier="plain"
        commit={{
          phase: 'refused',
          from: '45 days',
          attempted: '60 days',
          reason: 'The server would not accept this value.',
        }}
      />,
    )
    expect(screen.getByTestId('model-row-v2-f1-value-reverted')).toHaveTextContent('45 days')
    expect(screen.getByTestId('model-row-v2-f1-value-refusal')).toHaveTextContent(
      'The server would not accept this value.',
    )
  })

  it('a refusal is NOT rendered as a success: the attempted value is not shown as the value', () => {
    render(
      <ModelRowView
        row={row({ id: 'f1' })}
        tier="plain"
        commit={{ phase: 'refused', from: '45 days', attempted: '60 days', reason: 'Declined.' }}
      />,
    )
    const cell = screen.getByTestId('model-row-v2-f1-value')
    expect(cell).toHaveTextContent('45 days')
    // If '60 days' appeared as the value, a declined edit would look applied —
    // the exact failure the `refused` state exists to make impossible.
    expect(cell).not.toHaveTextContent('60 days')
  })

  it('the row exposes its phase for the outline to reason about', () => {
    render(
      <ModelRowView row={row({ id: 'f1' })} tier="plain" commit={{ phase: 'inflight', from: '45', to: '60' }} />,
    )
    expect(screen.getByTestId('model-row-v2-f1')).toHaveAttribute('data-phase', 'inflight')
  })
})

describe('ModelRowView — the tier switches CONTENT only (design §4.3 rule 1)', () => {
  it('shows the element id in Advanced and not in Plain', () => {
    const { rerender } = render(<ModelRowView row={row({ id: 'f1' })} tier="plain" />)
    expect(screen.queryByTestId('model-row-v2-f1-id')).toBeNull()

    rerender(<ModelRowView row={row({ id: 'f1' })} tier="advanced" />)
    expect(screen.getByTestId('model-row-v2-f1-id')).toHaveTextContent('f1')
  })

  it('does not change the label, the value or the provenance chip between tiers', () => {
    const r = row({ id: 'f1', primaryValue: '45 days', provenanceSource: 'cee_inference' })
    const { rerender } = render(<ModelRowView row={r} tier="plain" />)
    const plain = {
      label: screen.getByTestId('model-row-v2-f1-label').textContent,
      value: screen.getByTestId('model-row-v2-f1-value').textContent,
      prov: screen.getByTestId('model-row-v2-f1-provenance').textContent,
    }

    rerender(<ModelRowView row={r} tier="advanced" />)
    expect(screen.getByTestId('model-row-v2-f1-label').textContent).toBe(plain.label)
    expect(screen.getByTestId('model-row-v2-f1-value').textContent).toBe(plain.value)
    expect(screen.getByTestId('model-row-v2-f1-provenance').textContent).toBe(plain.prov)
  })
})
