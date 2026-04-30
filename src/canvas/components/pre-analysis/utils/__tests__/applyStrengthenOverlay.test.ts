/**
 * Brief 5.8A D3b — strengthen-overlay match tests.
 *
 * Strict normalised exact match. Pure function. Tests confirm every guarantee
 * the brief calls out: case-insensitive trim, no fuzzy match, duplicates
 * silently skipped + console.warn fired exactly once per duplicate label,
 * empty/missing inputs produce empty map.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  buildStrengthenOverlayMap,
  findStrengthenOverlay,
  tokenToActionLabel,
} from '../applyStrengthenOverlay'

describe('buildStrengthenOverlayMap (Brief 5.8A D3b)', () => {
  it('returns empty map when input is null', () => {
    expect(buildStrengthenOverlayMap(null).size).toBe(0)
  })

  it('returns empty map when input is undefined', () => {
    expect(buildStrengthenOverlayMap(undefined).size).toBe(0)
  })

  it('returns empty map when input is an empty array', () => {
    expect(buildStrengthenOverlayMap([]).size).toBe(0)
  })

  it('maps a single label exactly', () => {
    const m = buildStrengthenOverlayMap([
      { label: 'Engineering velocity', detail: 'Confirm the figure.', actionType: 'set_value' },
    ])
    expect(m.size).toBe(1)
    expect(m.get('engineering velocity')).toEqual({
      detail: 'Confirm the figure.',
      actionTypeLabel: 'Set value',
    })
  })

  it('normalises the lookup key (case-insensitive trim)', () => {
    const m = buildStrengthenOverlayMap([
      { label: '  ENGINEERING velocity  ', detail: 'Detail', actionType: 'set_value' },
    ])
    expect(m.has('engineering velocity')).toBe(true)
  })

  it('skips strengthen items with blank labels', () => {
    const m = buildStrengthenOverlayMap([
      { label: '   ', detail: 'Detail' },
      { label: '', detail: 'Detail' },
    ])
    expect(m.size).toBe(0)
  })

  it('skips strengthen items with blank details', () => {
    const m = buildStrengthenOverlayMap([
      { label: 'Velocity', detail: '   ' },
    ])
    expect(m.size).toBe(0)
  })

  it('drops both entries when two strengthen items share a normalised label', () => {
    const warn = vi.fn()
    const m = buildStrengthenOverlayMap(
      [
        { label: 'Velocity', detail: 'First detail' },
        { label: 'velocity', detail: 'Second detail' },
      ],
      warn,
    )
    expect(m.size).toBe(0)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][1]).toBe('Velocity')
  })

  it('logs only one warning per duplicate label even when more than two collide', () => {
    const warn = vi.fn()
    buildStrengthenOverlayMap(
      [
        { label: 'Velocity', detail: 'a' },
        { label: 'velocity', detail: 'b' },
        { label: 'VELOCITY', detail: 'c' },
      ],
      warn,
    )
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('keeps non-conflicting labels alongside conflicting ones', () => {
    const warn = vi.fn()
    const m = buildStrengthenOverlayMap(
      [
        { label: 'Velocity', detail: 'a' },
        { label: 'velocity', detail: 'b' },
        { label: 'Throughput', detail: 'kept' },
      ],
      warn,
    )
    expect(m.has('velocity')).toBe(false)
    expect(m.get('throughput')?.detail).toBe('kept')
  })

  it('omits actionTypeLabel when actionType is absent', () => {
    const m = buildStrengthenOverlayMap([
      { label: 'Velocity', detail: 'Detail' },
    ])
    expect(m.get('velocity')?.actionTypeLabel).toBeNull()
  })
})

describe('findStrengthenOverlay (Brief 5.8A D3b)', () => {
  const m = buildStrengthenOverlayMap([
    { label: 'Engineering velocity', detail: 'Detail A', actionType: 'set_value' },
  ])

  it('returns the overlay for an exact title match (after normalisation)', () => {
    expect(findStrengthenOverlay({ title: '  engineering VELOCITY  ' }, m)).toEqual({
      detail: 'Detail A',
      actionTypeLabel: 'Set value',
    })
  })

  it('returns null when the title does not match any label', () => {
    expect(findStrengthenOverlay({ title: 'Unrelated' }, m)).toBeNull()
  })

  it('returns null for partial substring matches (no fuzzy matching)', () => {
    expect(findStrengthenOverlay({ title: 'Engineering' }, m)).toBeNull()
    expect(findStrengthenOverlay({ title: 'Engineering velocity team' }, m)).toBeNull()
  })

  it('returns null for blank titles', () => {
    expect(findStrengthenOverlay({ title: '' }, m)).toBeNull()
    expect(findStrengthenOverlay({ title: '   ' }, m)).toBeNull()
  })
})

describe('tokenToActionLabel', () => {
  it('converts snake_case to sentence-case', () => {
    expect(tokenToActionLabel('set_value')).toBe('Set value')
    expect(tokenToActionLabel('confirm_estimate')).toBe('Confirm estimate')
  })

  it('preserves a single token', () => {
    expect(tokenToActionLabel('confirm')).toBe('Confirm')
  })

  it('returns the original token when it is blank', () => {
    expect(tokenToActionLabel('   ')).toBe('   ')
  })

  it('lowercases all-uppercase tokens', () => {
    expect(tokenToActionLabel('SET_VALUE')).toBe('Set value')
  })
})
