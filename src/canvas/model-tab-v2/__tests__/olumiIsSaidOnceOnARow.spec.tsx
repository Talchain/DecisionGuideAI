/**
 * ⭐ C5 — "Olumi:" is not printed where the row already SHOWS it is Olumi's.
 *
 * Audit row #8, market-entry render: factor rows read
 *   "Not set" "Olumi: Not pursued" [AI estimate] [No value set] [Estimate not yet confirmed]
 * — the `Sparkles` "AI estimate" mark and the word "Olumi:" say the same thing on
 * the same row. They co-occurred on 3 of 3 such rows.
 *
 * ⚠ ONLY WHEN THE MARK IS REALLY THERE. `ValueProvenanceMark.tsx` records that the
 * hint text and the value's provenance are owned INDEPENDENTLY, so a row can
 * carry Olumi's estimate text with no AI mark. On such a row the word is the only
 * attribution and it stays visible (the contrast case below).
 *
 * ⚠ THE WORDS ARE KEPT for assistive tech (a screen-reader-only prefix) and on
 * hover (`title`), so nothing is lost; only the visible duplicate goes.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModelRowView } from '../ModelRowView'
import type { ModelRow } from '../types'

const ESTIMATE = 'Moderate (0.5)'

const row = (over: Partial<ModelRow> & Pick<ModelRow, 'id'>): ModelRow => ({
  kind: 'factor',
  group: 'factors',
  label: `Label ${over.id}`,
  primaryValue: null,
  estimateText: ESTIMATE,
  attention: ['no-value'],
  editable: true,
  ...over,
})

/** The text a sighted reader sees: the element's text minus any `sr-only` span. */
function visibleText(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.sr-only').forEach((n) => n.remove())
  return clone.textContent ?? ''
}

describe('C5 · the "Olumi:" prefix is dropped where the AI mark already says it', () => {
  it('with the AI estimate mark on the row, the hint shows only the estimate', () => {
    render(
      <ModelRowView row={row({ id: 'f-1', provenanceSource: 'cee_inference' })} tier="plain" onBeginEdit={vi.fn()} />,
    )
    // PRECONDITION: the mark really is on this row, as Sparkles.
    const mark = screen.getByTestId('model-row-v2-f-1-provenance-mark')
    expect(mark).toHaveAttribute('data-provenance-kind', 'ai')
    expect(mark.querySelector('svg.lucide-sparkles')).not.toBeNull()

    const hint = screen.getByTestId('model-row-v2-f-1-value-estimate')
    expect(visibleText(hint)).toBe(ESTIMATE)
    // The words survive for assistive tech and on hover.
    expect(hint.textContent).toBe(`Olumi: ${ESTIMATE}`)
    expect(hint).toHaveAttribute('title', `Olumi: ${ESTIMATE}`)
  })

  it('the read-only arm follows the same rule', () => {
    render(<ModelRowView row={row({ id: 'f-2', provenanceSource: 'cee_inference', editable: false })} tier="plain" />)
    expect(visibleText(screen.getByTestId('model-row-v2-f-2-value-estimate'))).toBe(ESTIMATE)
  })

  it('CONTRAST: with NO AI mark on the row, "Olumi:" is the only attribution and stays visible', () => {
    render(<ModelRowView row={row({ id: 'f-3' })} tier="plain" onBeginEdit={vi.fn()} />)
    expect(screen.queryByTestId('model-row-v2-f-3-provenance-mark')).toBeNull()
    expect(visibleText(screen.getByTestId('model-row-v2-f-3-value-estimate'))).toBe(`Olumi: ${ESTIMATE}`)
  })

  it('CONTRAST: a mark that is NOT Olumi\'s (from brief) does not license dropping the word', () => {
    render(
      <ModelRowView row={row({ id: 'f-4', provenanceSource: 'brief_extraction' })} tier="plain" onBeginEdit={vi.fn()} />,
    )
    expect(screen.getByTestId('model-row-v2-f-4-provenance-mark')).toHaveAttribute('data-provenance-kind', 'brief')
    expect(visibleText(screen.getByTestId('model-row-v2-f-4-value-estimate'))).toBe(`Olumi: ${ESTIMATE}`)
  })
})
