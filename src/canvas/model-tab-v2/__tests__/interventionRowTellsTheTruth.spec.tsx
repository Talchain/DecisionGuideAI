/**
 * ⭐ THE INTERVENTION ROW SAYS WHICH OF THREE THINGS HAPPENED.
 *
 * Before this, `commitIntervention` discarded the authority's outcome and closed
 * the row unconditionally. With no wire carrier that was harmless — the local
 * write always succeeded. Now the gesture is a turn, and closing on a REFUSAL
 * tells the user their edit went through when nothing was sent, while closing on
 * a DISPATCH claims the model holds a number the server has not acknowledged.
 * Both are the same lie in opposite directions.
 *
 * An independent review named this as the reason a flag flip alone would not be
 * delivery. These are the states that make the flip honest, asserted at the
 * consumer that renders them.
 *
 * ⚠ ASSERTED AT `ModelDetailRegion`, NOT AT THE PANEL, and the reason is stated
 * rather than worked around: the panel gates every intervention handler on
 * `OPTION_INTERVENTION_CONNECTED`, which is still false, so a mounted-panel test
 * could not reach this row at all. The end-to-end assertion arrives with the
 * flip; this is the rendering contract that flip depends on.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ModelDetailRegion } from '../ModelDetailRegion'
import type { ModelRowDetail } from '../types'

const FACTOR = 'fac_capex'

function detail(): ModelRowDetail {
  return {
    rowId: 'opt_leeds',
    description: null,
    secondaryValues: [],
    basis: null,
    adjustments: [],
    affects: [],
    interventions: [
      { factorId: FACTOR, factorLabel: 'Capital expenditure', value: '0.2', numericValue: 0.2 },
    ],
    advanced: [],
  } as unknown as ModelRowDetail
}

function renderRow(interventionEdit: Record<string, unknown> | null) {
  return render(
    <ModelDetailRegion
      rowId="opt_leeds"
      detail={detail()}
      interventionEdit={interventionEdit as never}
      onBeginInterventionEdit={vi.fn()}
      onInterventionDraftChange={vi.fn()}
      onCommitIntervention={vi.fn()}
      onDiscardInterventionEdit={vi.fn()}
    />,
  )
}

describe('the three honest states', () => {
  it('EDITING — the input is offered and nothing claims to be saved', () => {
    renderRow({ factorId: FACTOR, draft: '0.6', phase: 'editing' })
    expect(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-input`)).toBeInTheDocument()
    expect(
      screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-pending`),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-notice`),
    ).not.toBeInTheDocument()
  })

  it('PENDING — "sent, not saved yet", with no Save left to press', () => {
    renderRow({ factorId: FACTOR, draft: '0.6', phase: 'pending' })
    const pending = screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-pending`)
    expect(pending).toHaveTextContent('0.6')
    expect(pending.textContent ?? '').toMatch(/sent, not saved yet/i)
    // ⚠ The row must NOT be back in its read-only display state either: that is
    // what "closed on dispatch" looked like, and it reads as saved.
    expect(screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-save`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-input`)).not.toBeInTheDocument()
  })

  it('REFUSED — the row stays open and says why, beside the number it is about', () => {
    renderRow({
      factorId: FACTOR,
      draft: '0.6',
      phase: 'editing',
      notice: 'Not sent yet — I need to re-sync with the saved model first.',
    })
    const notice = screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-notice`)
    expect(notice).toHaveTextContent('Not sent yet')
    // Still editable: the user can correct and retry without reopening the row.
    expect(screen.getByTestId(`model-detail-v2-intervention-${FACTOR}-input`)).toBeInTheDocument()
  })

  it('POSITIVE CONTROL — a row with no edit in flight shows none of the three', () => {
    // Without this, every assertion above could pass against a row that renders
    // its testids unconditionally.
    renderRow(null)
    expect(screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-input`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-pending`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-notice`)).not.toBeInTheDocument()
  })

  it('the states are bound to THIS factor, never to the list position', () => {
    // A notice or a pending mark on the wrong row is the worst failure available
    // here — confident, wrong, and indistinguishable from correct.
    renderRow({ factorId: 'fac_someone_else', draft: '0.9', phase: 'pending' })
    expect(screen.queryByTestId(`model-detail-v2-intervention-${FACTOR}-pending`)).not.toBeInTheDocument()
  })
})
