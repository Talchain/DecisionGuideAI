/**
 * THE CONNECTOR EXPLAINS ITS UNCERTAINTY.
 *
 * Measured on deployed staging: every one of a drafted model's 31 edges carries
 * `strengthStd` WITH a `strengthStdSource: 'cee'` stamp — the producer states a
 * spread on every connection — and `strengthStd` appeared in `src/canvas/edges/`
 * only inside a TEST file. Not `StyledEdge`, not `edgeLabels`. A user could read
 * it in the Model tab or the inspector and NOWHERE on the graph.
 *
 * ⚠ WHY IT WAS ABSENT, AND WHY THAT REASON NO LONGER HOLDS.
 * `StyledEdge.causalLens.2954.spec.tsx` records that the causal lens "previously
 * printed ALL FOUR as measurements" — including `USER_EDGE_DEFAULTS.strengthStd
 * = 0.15`, a constant nobody chose. The remedy then was to stop printing it. The
 * remedy now is the PROVENANCE GATE: this takes an `EdgeValueDisplay`, which
 * cannot carry a value without naming a source, so an unset std still explains
 * nothing. The stand-down case below is the one that makes this safe, and it is
 * bound to the REAL default rather than a hand-written copy.
 */
import { describe, it, expect } from 'vitest'
import { getEdgeLabel } from '../edgeLabels'
import { resolveEdgeValueDisplay, resolveEdgeSignedStrengthDisplay, resolveEdgeDirectionDisplay } from '../edgeValueProvenance'
import { USER_EDGE_DEFAULTS } from '../edges'

/** A CEE-drafted edge, shaped as the wire actually delivers it. */
const CEE_EDGE = {
  weight: 0.5, weightSource: 'cee',
  direction: 'negative', directionSource: 'cee',
  beliefExists: 0.9, beliefExistsSource: 'cee',
  strengthStd: 0.15, strengthStdSource: 'cee',
} as Record<string, unknown>

function labelFor(data: Record<string, unknown>, mode: 'numeric' | 'human') {
  return getEdgeLabel(
    resolveEdgeSignedStrengthDisplay(data),
    resolveEdgeValueDisplay(data, 'beliefExists'),
    resolveEdgeDirectionDisplay(data),
    mode,
    resolveEdgeValueDisplay(data, 'strengthStd'),
  )
}

describe('the connector explains its uncertainty', () => {
  it('states a CEE-stated spread beside the weight it qualifies', () => {
    const { tooltip } = labelFor(CEE_EDGE, 'numeric')
    expect(tooltip).toContain('± 0.15')
    // Beside the weight, not floating: it is the spread ON that number.
    expect(tooltip).toMatch(/Weight:\s*−?0\.50\s*±\s*0\.15/)
  })

  it('⛔ STANDS DOWN on an unset std — the reason it was removed before', () => {
    // Bound to the REAL constant. `USER_EDGE_DEFAULTS` pins strengthStd at 0.15
    // with NO source stamp, so a hand-drawn edge must explain nothing. If someone
    // adds a stamp to that constant, this REDs — which is exactly the change that
    // would start printing a default as a measurement again.
    expect(USER_EDGE_DEFAULTS.strengthStd).toBe(0.15)
    const drawn = { ...USER_EDGE_DEFAULTS } as unknown as Record<string, unknown>
    expect(resolveEdgeValueDisplay(drawn, 'strengthStd')).toEqual({ show: false, reason: 'not_set' })
    expect(labelFor(drawn, 'numeric').tooltip).not.toContain('±')
  })

  it('⛔ says nothing about spread when there is no weight to qualify', () => {
    // "± 0.15" beside "not set" would be an uncertainty about nothing.
    const noWeight = { beliefExists: 0.9, beliefExistsSource: 'cee', strengthStd: 0.15, strengthStdSource: 'cee' }
    const { tooltip } = labelFor(noWeight as Record<string, unknown>, 'numeric')
    expect(tooltip).toContain('not set')
    expect(tooltip).not.toContain('±')
  })

  it('⭐ the LABEL is untouched — no painted characters are added', () => {
    // Paul's standing ruling puts extra copy in the hover, not the narrowest
    // text on the board. This must change what hovering EXPLAINS, nothing else.
    const withStd = labelFor(CEE_EDGE, 'numeric').label
    const withoutStd = getEdgeLabel(
      resolveEdgeSignedStrengthDisplay(CEE_EDGE),
      resolveEdgeValueDisplay(CEE_EDGE, 'beliefExists'),
      resolveEdgeDirectionDisplay(CEE_EDGE),
      'numeric',
    ).label
    expect(withStd).toBe(withoutStd)
  })

  it('BOTH label modes explain it — one vocabulary, not two', () => {
    // `getEdgeLabel` routes the two modes through one tooltip builder so they
    // cannot drift (trap 21). A mode that dropped the spread would be a second
    // answer to one question.
    expect(labelFor(CEE_EDGE, 'numeric').tooltip).toContain('± 0.15')
    expect(labelFor(CEE_EDGE, 'human').tooltip).toContain('± 0.15')
  })

  it('CONTROL — an omitted uncertainty argument leaves every caller unchanged', () => {
    // The parameter is OPTIONAL so no existing surface can be made wrong by it.
    const legacy = getEdgeLabel(
      resolveEdgeSignedStrengthDisplay(CEE_EDGE),
      resolveEdgeValueDisplay(CEE_EDGE, 'beliefExists'),
      resolveEdgeDirectionDisplay(CEE_EDGE),
      'numeric',
    )
    expect(legacy.tooltip).toContain('Weight:')
    expect(legacy.tooltip).not.toContain('±')
  })
})
