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
 * carries only the numbers `prior` itself declares — no unit, no cap, no
 * invented bound.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { toModelRows } from '../adapters'
import { ModelOutline } from '../ModelOutline'

const node = (
  id: string,
  label: string,
  opts: {
    prior?: { range_min?: unknown; range_max?: unknown } | number
    observedState?: unknown
    displayValue?: string
  } = {},
) => ({
  id,
  type: 'factor',
  data: {
    label,
    kind: 'factor',
    ...(opts.prior === undefined ? {} : { prior: opts.prior }),
    ...(opts.observedState === undefined ? {} : { observedState: opts.observedState }),
    ...(opts.displayValue === undefined ? {} : { display_value: opts.displayValue }),
  },
})

function rowsFor(nodes: unknown[]) {
  return toModelRows({ nodes, edges: [] } as never)
}

describe('a recorded prior range reaches the user instead of a bare "Not set"', () => {
  it('PRECONDITION — the fixture declares a range and nothing else', () => {
    const n = node('f1', 'Churn sensitivity', { prior: { range_min: 0.2, range_max: 0.6 } })
    expect((n.data as Record<string, unknown>).prior).toEqual({ range_min: 0.2, range_max: 0.6 })
    expect((n.data as Record<string, unknown>).display_value).toBeUndefined()
    expect((n.data as Record<string, unknown>).observedState).toBeUndefined()
  })

  it('⭐ RED-FIRST: the row carries "Range 0.2–0.6, not measured", using the carried numbers only', () => {
    const rows = rowsFor([node('f1', 'Churn sensitivity', { prior: { range_min: 0.2, range_max: 0.6 } })])
    expect(rows[0].primaryValue).toBeNull()
    expect(rows[0].estimateText).toBeUndefined()
    expect(rows[0].recordedRangeText).toBe('Range 0.2–0.6, not measured')
    // The fact "a range is recorded" and the fact "no range is recorded" are
    // opposites — this row must not carry both.
    expect(rows[0].declaresNoRange).toBeUndefined()
  })

  it('⛔ DISCRIMINATING — no range text at all when the factor declares no range', () => {
    // Without this, "always compute something" would satisfy the case above
    // while inventing a bound on a factor that records none.
    const rows = rowsFor([node('f2', 'Bare factor')])
    expect(rows[0].recordedRangeText).toBeUndefined()
    expect(rows[0].declaresNoRange).toBe(true)
    render(<ModelOutline rows={rows} tier="plain" />)
    expect(screen.queryByTestId('model-row-v2-f2-value-recorded-range')).toBeNull()
  })

  it("⛔ CEE's own words still win — a display_value suppresses the range fallback", () => {
    const rows = rowsFor([
      node('f3', 'Adoption friction', {
        prior: { range_min: 0.2, range_max: 0.6 },
        displayValue: 'Moderate (0.4)',
      }),
    ])
    expect(rows[0].estimateText).toBe('Moderate (0.4)')
    expect(rows[0].recordedRangeText).toBeUndefined()
  })

  it('⛔ A SUPPLIED VALUE SUPPRESSES IT TOO — the fallback is only for an unset value', () => {
    const rows = rowsFor([
      node('f4', 'Ramp time', {
        prior: { range_min: 0.2, range_max: 0.6 },
        observedState: { raw_value: 0.4 },
      }),
    ])
    expect(rows[0].primaryValue).not.toBeNull()
    expect(rows[0].recordedRangeText).toBeUndefined()
  })

  it('BOTH AXES, EDITOR ARM — the range sits beside "Not set", never instead of it', () => {
    const rows = rowsFor([node('f1', 'Churn sensitivity', { prior: { range_min: 0.2, range_max: 0.6 } })])
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
      'Range 0.2–0.6, not measured',
    )
  })

  it('BOTH AXES, READ-ONLY ARM — the range still reaches the user', () => {
    const rows = rowsFor([node('f1', 'Churn sensitivity', { prior: { range_min: 0.2, range_max: 0.6 } })])
    render(<ModelOutline rows={rows} tier="plain" />)
    expect(screen.getByTestId('model-row-v2-f1-value').tagName).not.toBe('BUTTON')
    expect(screen.getByTestId('model-row-v2-f1-value-recorded-range').textContent).toBe(
      'Range 0.2–0.6, not measured',
    )
  })

  it('never carries the "Olumi:" attribution — a recorded range is the node\'s own declared support', () => {
    const rows = rowsFor([node('f1', 'Churn sensitivity', { prior: { range_min: 0.2, range_max: 0.6 } })])
    render(<ModelOutline rows={rows} tier="plain" />)
    const el = screen.getByTestId('model-row-v2-f1-value-recorded-range')
    expect(el.textContent).not.toMatch(/^Olumi:/)
  })
})
