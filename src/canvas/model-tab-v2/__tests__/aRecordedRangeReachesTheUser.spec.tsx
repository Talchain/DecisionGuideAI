/**
 * A17 AUDIT — A FACTOR WITH A RECORDED PRIOR RANGE READ "Not set", THE SAME
 * BARE STRING AS A FACTOR THE PRODUCT KNOWS NOTHING ABOUT AT ALL.
 *
 * `resolveFactorValueAdmission` already reads `data.prior.{range_min,
 * range_max}` — the range PLoT itself samples when it runs — and carries it
 * onto the row as `valueAdmission`, for the EDITOR to judge a typed number
 * against. Nothing read it for DISPLAY: a factor with no value and no CEE
 * `display_value` fell through to the bare "Not set" this tab already
 * reserves for a factor recording nothing whatsoever, silently treating
 * "nobody has told us anything" and "we have a declared range and are
 * waiting on a value" as the same fact.
 *
 * ── THE CONSTRAINT THIS SPEC EXISTS TO HOLD ───────────────────────────────
 * `recordedRangeText` is the FALLBACK: CEE's own `display_value`
 * (`estimateText`) always wins when both are present, a supplied value
 * suppresses it entirely (mirroring `estimateText`'s own rule), and it
 * never invents a bound.
 *
 * ── REVIEW 2039: ONE DISPLAY AUTHORITY ──────────────────────────────────────
 * The first cut printed `resolveFactorValueAdmission`'s numbers — the EDITOR'S
 * GUARD, on the normalised MODEL scale, which deliberately does not ask
 * `isUnquantifiedPrior`. So an ignorance prior read "Range 0–1" and a £ factor
 * whose card reads "£20,000 to £80,000" read "Range 0.2–0.8". The text is now
 * the line `resolveFactorPriorRange` returns — the owner the card's "Range:"
 * line reads — plus ", not measured", so its grammar is the card's
 * ("Range: 0.2 to 0.6", not "Range 0.2–0.6"). That owner displays a prior for
 * EXTERNAL factors only, so every fixture that expects a range declares
 * `category: 'external'`.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { toModelRows } from '../adapters'
import { ModelOutline } from '../ModelOutline'
import { resolveFactorValueAdmission } from '../../conversation/factorValueEdit'
import {
  resolveFactorPriorRange,
  resolveFactorPriorRangeEnds,
} from '../../nodes/shared/factorPriorRange'

const node = (
  id: string,
  label: string,
  opts: {
    prior?: { range_min?: unknown; range_max?: unknown; prior_is_unquantified?: boolean } | number
    observedState?: unknown
    displayValue?: string
    category?: string
  } = {},
) => ({
  id,
  type: 'factor',
  data: {
    label,
    kind: 'factor',
    ...(opts.category === undefined ? {} : { category: opts.category }),
    ...(opts.prior === undefined ? {} : { prior: opts.prior }),
    ...(opts.observedState === undefined ? {} : { observedState: opts.observedState }),
    ...(opts.displayValue === undefined ? {} : { display_value: opts.displayValue }),
  },
})

function rowsFor(nodes: unknown[]) {
  return toModelRows({ nodes, edges: [] } as never)
}

/** The display owner, called the way the row calls it (no value to dedupe). */
function ownerInputs(n: { data: Record<string, unknown> }) {
  return {
    data: n.data,
    nodeCategory: n.data.category as string | undefined,
    observedState: n.data.observedState as { unit?: string | null; cap?: number | null } | undefined,
    valueDisplay: null,
  }
}

const EXTERNAL_RANGE = { category: 'external', prior: { range_min: 0.2, range_max: 0.6 } } as const

describe('a recorded prior range reaches the user instead of a bare "Not set"', () => {
  it('PRECONDITION — the fixture declares an external range and nothing else', () => {
    const n = node('f1', 'Churn sensitivity', EXTERNAL_RANGE)
    expect((n.data as Record<string, unknown>).prior).toEqual({ range_min: 0.2, range_max: 0.6 })
    expect((n.data as Record<string, unknown>).category).toBe('external')
    expect((n.data as Record<string, unknown>).display_value).toBeUndefined()
    expect((n.data as Record<string, unknown>).observedState).toBeUndefined()
  })

  it('⭐ RED-FIRST: the row carries "Range: 0.2 to 0.6, not measured" — the display owner\'s own line', () => {
    const n = node('f1', 'Churn sensitivity', EXTERNAL_RANGE)
    const line = resolveFactorPriorRange(ownerInputs(n))
    expect(line).toBe('Range: 0.2 to 0.6')
    const rows = rowsFor([n])
    expect(rows[0].primaryValue).toBeNull()
    expect(rows[0].estimateText).toBeUndefined()
    expect(rows[0].recordedRangeText).toBe(`${line}, not measured`)
    // The fact "a range is recorded" and the fact "no range is recorded" are
    // opposites — this row must not carry both.
    expect(rows[0].declaresNoRange).toBeUndefined()
  })

  it('⛔ DISCRIMINATING — no range text at all when the factor declares no range', () => {
    // Without this, "always compute something" would satisfy the case above
    // while inventing a bound on a factor that records none.
    const rows = rowsFor([node('f2', 'Bare factor', { category: 'external' })])
    expect(rows[0].recordedRangeText).toBeUndefined()
    expect(rows[0].declaresNoRange).toBe(true)
    render(<ModelOutline rows={rows} tier="plain" />)
    expect(screen.queryByTestId('model-row-v2-f2-value-recorded-range')).toBeNull()
  })

  it("⛔ CEE's own words still win — a display_value suppresses the range fallback", () => {
    // Not external: the only category whose valueless row carries CEE's words
    // as `estimateText` (the formatter returns null for a valueless external).
    const rows = rowsFor([
      node('f3', 'Adoption friction', {
        prior: { range_min: 0.2, range_max: 0.6 },
        displayValue: 'Moderate (0.4)',
      }),
    ])
    expect(rows[0].estimateText).toBe('Moderate (0.4)')
    expect(rows[0].recordedRangeText).toBeUndefined()
    // External: CEE's words reach the row through the display owner's line,
    // exactly as they reach the card — never the normalised "0.2 to 0.6".
    const ext = node('f3x', 'Adoption friction', { ...EXTERNAL_RANGE, displayValue: '20% to 60%' })
    const extRows = rowsFor([ext])
    expect(extRows[0].estimateText).toBeUndefined()
    expect(extRows[0].recordedRangeText).toBe(`${resolveFactorPriorRange(ownerInputs(ext))}, not measured`)
    expect(extRows[0].recordedRangeText).toBe('Range: 20% to 60%, not measured')
  })

  it('⛔ A SUPPLIED VALUE SUPPRESSES IT TOO — the fallback is only for an unset value', () => {
    const rows = rowsFor([
      node('f4', 'Ramp time', {
        ...EXTERNAL_RANGE,
        observedState: { raw_value: 0.4 },
      }),
    ])
    expect(rows[0].primaryValue).not.toBeNull()
    expect(rows[0].recordedRangeText).toBeUndefined()
  })

  it('BOTH AXES, EDITOR ARM — the range sits beside "Not set", never instead of it', () => {
    const rows = rowsFor([node('f1', 'Churn sensitivity', EXTERNAL_RANGE)])
    render(
      <ModelOutline
        rows={rows}
        tier="plain"
        editConnectedIds={new Set(['f1'])}
        onBeginEdit={() => {}}
      />,
    )
    const control = screen.getByTestId('model-row-v2-f1-value')
    expect(control.tagName).toBe('BUTTON')
    expect(control.textContent).toContain('Not set')
    expect(screen.getByTestId('model-row-v2-f1-value-recorded-range').textContent).toBe(
      'Range: 0.2 to 0.6, not measured',
    )
  })

  it('BOTH AXES, READ-ONLY ARM — the range still reaches the user', () => {
    const rows = rowsFor([node('f1', 'Churn sensitivity', EXTERNAL_RANGE)])
    render(<ModelOutline rows={rows} tier="plain" />)
    expect(screen.getByTestId('model-row-v2-f1-value').tagName).not.toBe('BUTTON')
    expect(screen.getByTestId('model-row-v2-f1-value-recorded-range').textContent).toBe(
      'Range: 0.2 to 0.6, not measured',
    )
  })

  it('never carries the "Olumi:" attribution — a recorded range is the node\'s own declared support', () => {
    const rows = rowsFor([node('f1', 'Churn sensitivity', EXTERNAL_RANGE)])
    render(<ModelOutline rows={rows} tier="plain" />)
    const el = screen.getByTestId('model-row-v2-f1-value-recorded-range')
    expect(el.textContent).not.toMatch(/^Olumi:/)
  })
  it('⛔ REVIEW 2039 (a) — an ignorance prior (`prior_is_unquantified`) shows NO range, never "Range 0–1"', () => {
    const n = node('f5', 'Market sentiment', {
      category: 'external',
      prior: { range_min: 0, range_max: 1, prior_is_unquantified: true },
    })
    // CONTRAST: the editor's guard still resolves a range for this prior —
    // which is exactly why its numbers must never be the display text.
    expect(resolveFactorValueAdmission(n.data)).not.toBeNull()
    // The display owner suppresses it.
    expect(resolveFactorPriorRange(ownerInputs(n))).toBeNull()
    expect(resolveFactorPriorRangeEnds(ownerInputs(n))).toBeNull()
    const rows = rowsFor([n])
    expect(rows[0].primaryValue).toBeNull()
    expect(rows[0].recordedRangeText).toBeUndefined()
    render(<ModelOutline rows={rows} tier="plain" />)
    expect(screen.queryByTestId('model-row-v2-f5-value-recorded-range')).toBeNull()
  })

  it('⛔ REVIEW 2039 (b) — a £ factor with a cap reads in the user\'s units, as its card does, never "0.2–0.8"', () => {
    const n = node('f6', 'Contract value', {
      category: 'external',
      prior: { range_min: 0.2, range_max: 0.8 },
      observedState: { unit: '£', cap: 100000 },
    })
    // CONTRAST: the guard's numbers are the normalised model-scale 0.2 / 0.8.
    const admission = resolveFactorValueAdmission(n.data)
    expect(admission).not.toBeNull()
    expect([admission!.priorMin, admission!.priorMax]).toEqual([0.2, 0.8])
    // The display owner's own output — bound, not hand-typed.
    const line = resolveFactorPriorRange(ownerInputs(n))
    expect(line).not.toBeNull()
    expect(resolveFactorPriorRangeEnds(ownerInputs(n))).toEqual(['£20,000', '£80,000'])
    const rows = rowsFor([n])
    expect(rows[0].primaryValue).toBeNull()
    expect(rows[0].estimateText).toBeUndefined()
    expect(rows[0].recordedRangeText).toBe(`${line}, not measured`)
    expect(rows[0].recordedRangeText).toContain('£20,000')
    expect(rows[0].recordedRangeText).toContain('£80,000')
    expect(rows[0].recordedRangeText).not.toContain('0.2–0.8')
    render(<ModelOutline rows={rows} tier="plain" />)
    const el = screen.getByTestId('model-row-v2-f6-value-recorded-range')
    expect(el.textContent).toContain('£20,000')
    expect(el.textContent).toContain('£80,000')
    expect(el.textContent).not.toContain('0.2')
  })
})
