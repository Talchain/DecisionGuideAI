/**
 * buildFocusRows — pure mapper. Ownership composition, F.6 (no rank/sort), and
 * fail-closed behaviour.
 */
import { describe, it, expect } from 'vitest'
import { buildFocusRows, mapSignalToFocusRow, dropGatedRows } from '../buildFocusRows'
import { STATIC_HYGIENE_ROWS } from '../focusConstants'
import {
  signalFull,
  signalMinimal,
  signalNoObservation,
  signalsOrdered,
  gatedRow,
  serverRow,
} from '../__fixtures__/focus.fixtures'

describe('buildFocusRows — summary', () => {
  it('trims a non-empty coaching_summary', () => {
    expect(buildFocusRows({ coachingSummary: '  hello  ' }).summary).toBe('hello')
  })
  it('returns null for empty / whitespace / null / non-string summary', () => {
    expect(buildFocusRows({ coachingSummary: '' }).summary).toBeNull()
    expect(buildFocusRows({ coachingSummary: '   ' }).summary).toBeNull()
    expect(buildFocusRows({ coachingSummary: null }).summary).toBeNull()
    expect(buildFocusRows({ coachingSummary: 123 as unknown as string }).summary).toBeNull()
  })
  it('never synthesises a summary when none is given', () => {
    expect(buildFocusRows({}).summary).toBeNull()
  })
})

describe('buildFocusRows — static rows', () => {
  it('includes the six static hygiene rows by default, in fixed order', () => {
    const { rows } = buildFocusRows({})
    expect(rows).toHaveLength(STATIC_HYGIENE_ROWS.length)
    expect(rows.map((r) => r.id)).toEqual(STATIC_HYGIENE_ROWS.map((r) => r.id))
    expect(rows.every((r) => r.ownership === 'static_hygiene')).toBe(true)
  })
  it('omits static rows when suppressStatic is set', () => {
    expect(buildFocusRows({ suppressStatic: true }).rows).toHaveLength(0)
  })
  it('static rows never carry a "noticed" line (no false detection)', () => {
    for (const r of buildFocusRows({}).rows) expect(r.noticed).toBeUndefined()
  })
})

describe('buildFocusRows — server rows', () => {
  it('maps signals to server rows BEFORE static rows', () => {
    const { rows } = buildFocusRows({ signals: [signalFull] })
    expect(rows[0].ownership).toBe('server_sourced')
    expect(rows[0].primary).toBe('Your options rely on the same lever.')
    expect(rows.slice(1).every((r) => r.ownership === 'static_hygiene')).toBe(true)
  })
  it('preserves received order (never ranks by priority) — F.6', () => {
    const { rows } = buildFocusRows({ signals: signalsOrdered, suppressStatic: true })
    expect(rows.map((r) => r.primary)).toEqual(['First, as received.', 'Second, as received.'])
  })
  it('drops a signal with an empty observation', () => {
    const { rows } = buildFocusRows({ signals: [signalNoObservation], suppressStatic: true })
    expect(rows).toHaveLength(0)
  })
  it('maps only allow-listed human fields (no numeric priority / science leak)', () => {
    const r = mapSignalToFocusRow(signalFull)!
    expect(r.whyItMatters).toBe('A genuinely different route tends to make the choice clearer.')
    expect(r.tryThis).toBe('Sketch a different kind of option')
    expect(r.action).toEqual({ kind: 'prefill', label: 'Try this', prefillText: 'Sketch a different kind of option' })
    expect(r.targetKind).toBe('option')
    expect(Object.keys(r)).not.toContain('priority')
    expect(Object.keys(r)).not.toContain('lifecycle_state')
  })
  it('omits the action when a signal has no suggested action', () => {
    const r = mapSignalToFocusRow(signalMinimal)!
    expect(r.action).toBeUndefined()
    expect(r.primary).toBe('One outcome carries most of the weight here.')
  })
  it('returns null for a null / undefined signal', () => {
    expect(mapSignalToFocusRow(null)).toBeNull()
    expect(mapSignalToFocusRow(undefined)).toBeNull()
  })
  it('dedups duplicate signal ids (first wins)', () => {
    const dup = [
      { signal_id: 'x', move: 'm', source: 's', grounding: { observation: 'first' } },
      { signal_id: 'x', move: 'm', source: 's', grounding: { observation: 'second' } },
    ]
    const { rows } = buildFocusRows({ signals: dup, suppressStatic: true })
    expect(rows).toHaveLength(1)
    expect(rows[0].primary).toBe('first')
  })
})

describe('buildFocusRows — gated + fail-closed', () => {
  it('dropGatedRows removes any gated row', () => {
    expect(dropGatedRows([gatedRow, serverRow]).map((r) => r.id)).toEqual([serverRow.id])
  })
  it('never emits a gated row', () => {
    const { rows } = buildFocusRows({ signals: [signalFull, signalMinimal] })
    expect(rows.some((r) => r.ownership === 'gated')).toBe(false)
  })
  it('degrades to static-only on malformed input without throwing', () => {
    const call = () =>
      buildFocusRows({ coachingSummary: {} as unknown as string, signals: 'nope' as unknown as [] })
    expect(call).not.toThrow()
    const vm = call()
    expect(vm.summary).toBeNull()
    expect(vm.rows.every((r) => r.ownership === 'static_hygiene')).toBe(true)
  })
})
