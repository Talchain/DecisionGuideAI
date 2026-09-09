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

/**
 * ⚠ `editConnected`, NOT `editConnected`. The latter is DERIVED inside the
 * component (`row.editable && editConnected && typeof onBeginEdit === 'function'`,
 * ModelRowView.tsx:280) and is not a prop. Passing it typechecked green under
 * vitest — which does not typecheck — and was caught by CI. `onBeginEdit` is
 * included for the same reason: without it the derivation is false.
 */
const handlers = () => ({
  onBeginEdit: vi.fn(),
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
    render(<ModelRowView row={edgeRow()} tier="plain" commit={editing('0.5')} editConnected {...h} />)
    expect(screen.getByTestId('model-row-v2-e-0-value-band-weak')).toBeDefined()
    expect(screen.getByTestId('model-row-v2-e-0-value-band-moderate')).toBeDefined()
    expect(screen.getByTestId('model-row-v2-e-0-value-band-strong')).toBeDefined()
  })

  it('clicking a band proposes THAT band\'s midpoint, by id', () => {
    const h = handlers()
    render(<ModelRowView row={edgeRow()} tier="plain" commit={editing('0.5')} editConnected {...h} />)
    fireEvent.click(screen.getByTestId('model-row-v2-e-0-value-band-strong'))
    expect(h.onDraftChange).toHaveBeenCalledWith('e-0', '0.7')
  })

  /*
   * ⭐ THE PILL MUST HAND THE KEYBOARD BACK — a defect measured on the DEPLOYED
   * build `0a0a8113`, hours after this feature merged.
   *
   * A real mouse click on a <button> focuses it. So the pill set the draft
   * correctly and then swallowed the keyboard: `Enter` — the only thing that
   * proposes an edit — re-pressed the pill instead of committing. Witnessed on
   * two rows: after the click `document.activeElement` was the pill, the draft
   * was right, and `Enter` left the editor open with nothing proposed.
   *
   * ⚠⚠ AND NOTE WHY THE SUITE COULD NOT SEE IT. `fireEvent.click` (and
   * `HTMLElement.click()`) DO NOT MOVE FOCUS. Every existing case here clicks
   * that way, so in all of them focus never left the field and `Enter` would
   * have worked — the suite was green about a path a real pointer cannot take.
   * These cases therefore assert the FOCUS RESTORATION ITSELF rather than
   * simulating the browser's focus, because the restoration is the fix and it
   * is the only half a jsdom test can honestly observe.
   */
  it('⭐ a band click leaves focus ON THE FIELD, so the keyboard still reaches it', () => {
    const h = handlers()
    render(<ModelRowView row={edgeRow()} tier="plain" commit={editing('0.5')} editConnected {...h} />)
    const field = screen.getByTestId('model-row-v2-e-0-value-input')
    // PRECONDITION PINNED IN-TEST: focus is genuinely moved AWAY first, so a
    // pass below is the pill restoring it and not focus that never left.
    const pill = screen.getByTestId('model-row-v2-e-0-value-band-strong')
    pill.focus()
    expect(document.activeElement).toBe(pill)

    fireEvent.click(pill)
    expect(document.activeElement).toBe(field)
  })

  it('⭐ and Enter then proposes, which is the whole point of restoring focus', () => {
    const h = handlers()
    render(<ModelRowView row={edgeRow()} tier="plain" commit={editing('0.5')} editConnected {...h} />)
    const pill = screen.getByTestId('model-row-v2-e-0-value-band-strong')
    pill.focus()
    fireEvent.click(pill)
    expect(h.onDraftChange).toHaveBeenCalledWith('e-0', '0.7')

    // Sent to whatever actually holds focus — which is the assertion. If the
    // pill kept it, this reaches the pill and proposes nothing.
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
    expect(h.onProposeEdit).toHaveBeenCalledWith('e-0')
  })

  it('the restored field is SELECTED, so typing an exact number replaces it', () => {
    const h = handlers()
    render(<ModelRowView row={edgeRow()} tier="plain" commit={editing('0.5')} editConnected {...h} />)
    const field = screen.getByTestId('model-row-v2-e-0-value-input') as HTMLInputElement
    fireEvent.click(screen.getByTestId('model-row-v2-e-0-value-band-strong'))
    // The advanced half of Paul's ruling: the pill gets you close, the number
    // stays immediately editable rather than needing to be cleared first.
    expect(field.selectionStart).toBe(0)
    expect(field.selectionEnd).toBe(field.value.length)
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
    render(<ModelRowView row={edgeRow()} tier="plain" commit={editing('-0.2')} editConnected {...h} />)
    fireEvent.click(screen.getByTestId('model-row-v2-e-0-value-band-moderate'))
    expect(h.onDraftChange).toHaveBeenCalledWith('e-0', '-0.4')
  })

  it('marks the band the CURRENT DRAFT falls in, and only that one', () => {
    const h = handlers()
    render(<ModelRowView row={edgeRow()} tier="plain" commit={editing('0.65')} editConnected {...h} />)
    expect(screen.getByTestId('model-row-v2-e-0-value-band-strong').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('model-row-v2-e-0-value-band-weak').getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('model-row-v2-e-0-value-band-moderate').getAttribute('aria-pressed')).toBe('false')
  })

  it('names the band of the DRAFT, so the number is never abstract', () => {
    const h = handlers()
    render(<ModelRowView row={edgeRow()} tier="plain" commit={editing('0.65')} editConnected {...h} />)
    expect(screen.getByTestId('model-row-v2-e-0-value-band-readback').textContent).toBe('strong')
  })

  it('says nothing rather than guessing when the draft is not a number', () => {
    const h = handlers()
    render(<ModelRowView row={edgeRow()} tier="plain" commit={editing('')} editConnected {...h} />)
    expect(screen.getByTestId('model-row-v2-e-0-value-band-readback').textContent).toBe('—')
  })

  /**
   * ⭐⭐ ONE PARSER, PROVEN WITH THE REVIEWER'S OWN COUNTEREXAMPLES.
   *
   * The read-back used `Number` while the commit path uses `parseFloat`
   * (`ModelTabV2Panel.tsx:495`), so the screen and the write disagreed on real
   * input. A comment in the source claimed they were "one derivation" — which is
   * precisely what stopped anyone checking.
   */
  it.each([
    // draft      what parseFloat commits   what the band must therefore say
    ['0x10',      0,                        'negligible'],
    ['0.7abc',    0.7,                      'strong'],
    ['  0.3  ',   0.3,                      'moderate'],
  ])('the band for %s describes the value that would actually be committed', (draft, committed, band) => {
    // PRECONDITION: pin what the commit path really does with this string, so
    // the expectation is derived from the producer rather than from my reading.
    expect(parseFloat(draft as string)).toBe(committed)
    const h = handlers()
    render(<ModelRowView row={edgeRow()} tier="plain" commit={editing(draft as string)} editConnected {...h} />)
    expect(screen.getByTestId('model-row-v2-e-0-value-band-readback').textContent).toBe(band)
  })

  /**
   * ⭐⭐ THE READ-BACK REFUSES WHAT THE EMITTER REFUSES.
   *
   * `buildEdgeStrengthEditEvent` rejects `magnitude > 1` rather than clamping —
   * deliberately, because a clamped 1.5 → 1 sends a number the user never
   * stated. `getStrengthBand` has no domain guard, so 1.5 read as "strong" and
   * promised a write that silently never happened.
   */
  it.each(['1.5', '-2', '99'])('%s is named out of range, not banded', (draft) => {
    const h = handlers()
    render(<ModelRowView row={edgeRow()} tier="plain" commit={editing(draft)} editConnected {...h} />)
    expect(screen.getByTestId('model-row-v2-e-0-value-band-readback').textContent).toBe('out of range')
    // ...and no pill claims to be the active one for a value that cannot be sent.
    for (const b of ['weak', 'moderate', 'strong']) {
      expect(screen.getByTestId(`model-row-v2-e-0-value-band-${b}`).getAttribute('aria-pressed')).toBe('false')
    }
  })

  /**
   * ⭐ THE PILLS ARE NOT INSIDE THE NO-WRAP CELL.
   *
   * That cell is contractually `shrink-0 whitespace-nowrap` because it hosts a
   * text input that must not be squeezed. Three pills inline in an 80px cell on a
   * 414px dock came to ~330px. This pins the structural fix — pills on their own
   * line — so a later tidy-up cannot quietly move them back inside.
   */
  it('the pills sit OUTSIDE the value cell, on their own wrapping line', () => {
    const h = handlers()
    render(<ModelRowView row={edgeRow()} tier="plain" commit={editing('0.5')} editConnected {...h} />)
    const cell = screen.getByTestId('model-row-v2-e-0-value')
    const bands = screen.getByTestId('model-row-v2-e-0-value-bands')
    expect(cell.className).toContain('whitespace-nowrap')
    expect(cell.contains(bands)).toBe(false)
    expect(bands.className).toContain('flex-wrap')
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
        editConnected
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
