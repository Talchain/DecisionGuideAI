/**
 * COLLAB — the owner-panel href carries a PREFILL, and the bare href still works.
 *
 * Capability A's one new hop ("Ask a teammate" from an unresolved estimate row)
 * navigates to the existing setup page with `{factorId, label, unit}` carried
 * in the hash query. This file pins the carriage contract at the single href
 * authority:
 *
 *   • BACKWARDS-COMPATIBLE — a bare call builds byte-exactly the old href, so
 *     every existing caller (TopBar) is untouched;
 *   • ROUND-TRIP — what `ownerPanelHash` writes, `readPanelPrefill` reads back
 *     EXACTLY (identity, not normalisation): producer and consumer live in the
 *     same module precisely so the two spellings cannot drift (trap 12);
 *   • CONTAINMENT — hostile values are data, never structure: no factor id or
 *     label can break out of the query into the route.
 *
 * NOTE WHAT IS NOT HERE: no value field. Anti-anchoring is CEE-enforced at the
 * mint (`parseTargets` structurally refuses value-bearing fields); the prefill
 * type simply has nowhere to put one, and this file's shape assertions keep it
 * that way.
 */
import { describe, it, expect } from 'vitest'
import { ownerPanelHash, readPanelPrefill, type PanelPrefill } from '../panelRoute'

const PREFILL: PanelPrefill = {
  factorId: 'factor-churn-risk',
  label: 'Churn risk after a price rise',
  unit: '%',
}

/** The query half of a prefilled href — what a HashRouter hands useLocation(). */
function searchOf(href: string): string {
  const at = href.indexOf('?')
  expect(at, `href must carry a query: ${href}`).toBeGreaterThan(-1)
  return href.slice(at)
}

describe('ownerPanelHash — backwards-compatible prefill carriage', () => {
  it('BACKWARDS-COMPATIBLE: a bare call builds byte-exactly the old href — no query, no trailing "?"', () => {
    expect(ownerPanelHash('scn-1')).toBe('#/scenario/scn-1/panel')
  })

  it('an undefined prefill is the bare href too (the optional parameter changes nothing by existing)', () => {
    expect(ownerPanelHash('scn-1', undefined)).toBe('#/scenario/scn-1/panel')
  })

  it('carries {factorId, label, unit} in the hash query, on the unchanged route', () => {
    const href = ownerPanelHash('scn-1', PREFILL)
    expect(href.split('?')[0]).toBe('#/scenario/scn-1/panel')
    expect(readPanelPrefill(searchOf(href))).toEqual(PREFILL)
  })

  it('IDENTITY: the factor id round-trips byte-exact — never trimmed, cased or normalised', () => {
    const exact = 'Factor_A-7.b'
    const read = readPanelPrefill(searchOf(ownerPanelHash('scn-1', { factorId: exact, label: null, unit: null })))
    expect(read?.factorId).toBe(exact)
  })

  it('CONTAINMENT: hostile values are data, not structure — the route segment cannot be changed', () => {
    const hostile: PanelPrefill = { factorId: 'a&factor=b#/panel/x?y', label: 'x&label=y#z', unit: null }
    const href = ownerPanelHash('scn-1', hostile)
    // The route half is untouched…
    expect(href.split('?')[0]).toBe('#/scenario/scn-1/panel')
    // …and the participant route cannot be smuggled in ahead of the query.
    expect(href.startsWith('#/panel/')).toBe(false)
    // The values come back exactly, proving they were encoded, not interpreted.
    const read = readPanelPrefill(searchOf(href))
    expect(read).toEqual(hostile)
  })

  it('blank label/unit are omitted from the query and read back as null (no empty-string smuggling)', () => {
    const href = ownerPanelHash('scn-1', { factorId: 'factor-a', label: '', unit: '  ' })
    const read = readPanelPrefill(searchOf(href))
    expect(read).toEqual({ factorId: 'factor-a', label: null, unit: null })
  })

  it('a blank factor id builds the BARE href — a prefill with no target is no prefill', () => {
    expect(ownerPanelHash('scn-1', { factorId: '   ', label: 'x', unit: 'y' })).toBe(
      '#/scenario/scn-1/panel',
    )
  })
})

describe('readPanelPrefill — the bare hash keeps working', () => {
  it('returns null for an empty or query-less search (every pre-existing navigation)', () => {
    expect(readPanelPrefill('')).toBeNull()
    expect(readPanelPrefill('?')).toBeNull()
  })

  it('returns null when factor is absent or blank — label/unit alone are not a prefill', () => {
    expect(readPanelPrefill('?label=Churn')).toBeNull()
    expect(readPanelPrefill('?factor=')).toBeNull()
    expect(readPanelPrefill('?factor=%20%20')).toBeNull()
  })

  it('POSITIVE CONTROL: the reader really reads — a hand-written query parses', () => {
    expect(readPanelPrefill('?factor=factor-a&label=Churn+risk&unit=%25')).toEqual({
      factorId: 'factor-a',
      label: 'Churn risk',
      unit: '%',
    })
  })

  it('SHAPE: the prefill has exactly three keys — nowhere to carry a value or an anchor', () => {
    const read = readPanelPrefill('?factor=factor-a&value=0.7&estimate=42&label=L')
    expect(read).not.toBeNull()
    expect(Object.keys(read as PanelPrefill).sort()).toEqual(['factorId', 'label', 'unit'])
  })
})
