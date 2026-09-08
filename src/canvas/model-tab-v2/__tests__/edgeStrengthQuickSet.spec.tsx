/**
 * ⭐ THE EXPERT NUMBER STOPS BEING THE ONLY WAY IN (Paul's ruling, 8 Sep 2026).
 *
 * Paul: "a really simple, quick, and easy clickable solution AND a more detailed,
 * exact number for advanced users." Measured on deployed `15edd2e2` BEFORE this
 * change: opening a relationship's editor gave a bare text input seeded `0.5` —
 * no bands, no scale, no units. The clickable half existed on `ContestedEdgeCard`
 * (:239) and had never reached the v2 rows.
 *
 * ⚠ WHAT THESE TESTS BIND TO. Every assertion addresses its object by testid
 * (`model-row-v2-<id>-value-band-<band>`), never by visible text another control could
 * carry — "Strong" appears in this product as a strength LABEL too, so a text
 * query would pass on the wrong element (trap 19).
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModelRowView } from '../ModelRowView'
import { STRENGTH_BAND_MIDPOINTS } from '../../components/model-tab/strengthBands'
import type { ModelRow } from '../types'

function edgeRow(over: Partial<ModelRow> = {}): ModelRow {
  return {
    id: 'e-0',
    kind: 'relationship',
    group: 'relationships',
    label: 'Cost → Compliance',
    primaryValue: 'Moderate positive effect',
    attention: [],
    editable: true,
    ...over,
  }
}

const editing = (draft: string) => ({ phase: 'editing' as const, draft })

const handlers = () => ({
  onDraftChange: vi.fn(),
  onProposeEdit: vi.fn(),
  onDiscardEdit: vi.fn(),
})

describe('edge strength — the quick-set bands', () => {
  it('PRECONDITION: the midpoints come from strengthBands, not from this spec', () => {
    // If this ever drifts, the assertions below are testing a private copy.
    expect(STRENGTH_BAND_MIDPOINTS.weak).toBe(0.15)
    expect(STRENGTH_BAND_MIDPOINTS.moderate).toBe(0.4)
    expect(STRENGTH_BAND_MIDPOINTS.strong).toBe(0.7)
  })

  it('a relationship being edited offers all three bands', () => {
    const h = handlers()
    render(<ModelRowView row={edgeRow()} tier="plain" commit={editing('0.5')} editorAvailable {...h} />)
    expect(screen.getByTestId('model-row-v2-e-0-value-band-weak')).toBeDefined()
    expect(screen.getByTestId('model-row-v2-e-0-value-band-moderate')).toBeDefined()
    expect(screen.getByTestId('model-row-v2-e-0-value-band-strong')).toBeDefined()
  })

  it('clicking a band proposes THAT band\'s midpoint, by id', () => {
    const h = handlers()
    render(<ModelRowView row={edgeRow()} tier="plain" commit={editing('0.5')} editorAvailable {...h} />)
    fireEvent.click(screen.getByTestId('model-row-v2-e-0-value-band-strong'))
    expect(h.onDraftChange).toHaveBeenCalledWith('e-0', '0.7')
  })

  /**
   * ⚠⚠ THE ONE THAT MATTERS MOST. The pills set a MAGNITUDE; the SIGN is the
   * user's existing statement about direction and must survive untouched.
   * Losing it would silently flip a negative relationship to positive — a
   * scientific claim the user never made, and the exact defect class
   * `getDirectionalStrengthLabel` takes direction as a REQUIRED argument to
   * prevent (ROADMAP 2.263).
   */
  it('preserves a NEGATIVE direction — a band sets size, never sign', () => {
    const h = handlers()
    render(<ModelRowView row={edgeRow()} tier="plain" commit={editing('-0.2')} editorAvailable {...h} />)
    fireEvent.click(screen.getByTestId('model-row-v2-e-0-value-band-moderate'))
    expect(h.onDraftChange).toHaveBeenCalledWith('e-0', '-0.4')
  })

  it('marks the band the CURRENT DRAFT falls in, and only that one', () => {
    const h = handlers()
    render(<ModelRowView row={edgeRow()} tier="plain" commit={editing('0.65')} editorAvailable {...h} />)
    expect(screen.getByTestId('model-row-v2-e-0-value-band-strong').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('model-row-v2-e-0-value-band-weak').getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('model-row-v2-e-0-value-band-moderate').getAttribute('aria-pressed')).toBe('false')
  })

  it('names the band of the DRAFT, so the number is never abstract', () => {
    const h = handlers()
    render(<ModelRowView row={edgeRow()} tier="plain" commit={editing('0.65')} editorAvailable {...h} />)
    expect(screen.getByTestId('model-row-v2-e-0-value-band-readback').textContent).toBe('strong')
  })

  it('says nothing rather than guessing when the draft is not a number', () => {
    const h = handlers()
    render(<ModelRowView row={edgeRow()} tier="plain" commit={editing('')} editorAvailable {...h} />)
    expect(screen.getByTestId('model-row-v2-e-0-value-band-readback').textContent).toBe('—')
  })

  /**
   * ⭐ THE DISCRIMINATING CASE. Everything above proves the control APPEARS;
   * this proves it is bound to `kind === 'relationship'` and not merely to
   * "a row is being edited". Without it, a mutant that dropped the kind check
   * would leave every assertion above GREEN while shipping band pills onto
   * factors and goals, whose values are days and currency — a scale these
   * bands are meaningless against.
   */
  it('a NON-relationship row being edited offers no bands at all', () => {
    const h = handlers()
    render(
      <ModelRowView
        row={edgeRow({ id: 'f1', kind: 'factor', group: 'factors', label: 'Lead time', primaryValue: '45 days' })}
        tier="plain"
        commit={editing('45')}
        editorAvailable
        {...h}
      />,
    )
    expect(screen.queryByTestId('model-row-v2-f1-value-band-strong')).toBeNull()
    expect(screen.queryByTestId('model-row-v2-f1-value-band-readback')).toBeNull()
    // CONTROL: the row IS in the editing phase — so the absence above is the
    // kind check, not a row that simply failed to render an editor.
    expect(screen.getByTestId('model-row-v2-f1-value-input')).toBeDefined()
  })
})
