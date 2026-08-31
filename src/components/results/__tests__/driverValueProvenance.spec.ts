/**
 * WHO AUTHORED THIS VALUE — the one oracle, and the field it asks.
 *
 * The claim under test is an ATTRIBUTION claim, so the load-bearing cases are
 * the ones where the product must NOT say "Olumi estimated this". A version
 * that answered `'estimated'` whenever it was unsure would pass every positive
 * case here and would be the exact untruth this module was written to end.
 *
 * ⚠ EVERY ASSERTION BINDS BY FACTOR ID. "Some driver reads estimated" is
 * satisfiable by the wrong driver (CLAUDE.md trap 19); the pair that matters is
 * two named ids moving in OPPOSITE directions on the same payload.
 */

import { describe, expect, it } from 'vitest'
import {
  buildNodeValueSourceMap,
  driverValueProvenance,
  nodeValueSource,
} from '../driverValueProvenance'
import codexExport from '../../../canvas/registration/__tests__/fixtures/codex-export-2026-08-05.canvas.json'
import goldenPath from '../../../test/fixtures/golden-path-staging-2026-04-05.json'

const d = (factorKey: string, matchedNodeId?: string) => ({ factorKey, matchedNodeId })
const map = (entries: Record<string, string>) => new Map(Object.entries(entries))

// ── THE MAP ─────────────────────────────────────────────────────────────────

describe('the node source decides authorship', () => {
  it('reads a producer estimate as estimated', () => {
    expect(driverValueProvenance(d('f1'), map({ f1: 'cee_inference' }))).toBe('estimated')
    expect(driverValueProvenance(d('f1'), map({ f1: 'inferred' }))).toBe('estimated')
    expect(driverValueProvenance(d('f1'), map({ f1: 'cee_repair' }))).toBe('estimated')
  })

  it('⭐ never claims a user-owned value as Olumi’s', () => {
    // The untruth this module exists to prevent, in all four user-owned kinds.
    for (const source of ['user_confirmed', 'user_override', 'user', 'user_edited', 'user_calibration', 'user_assumption']) {
      expect(driverValueProvenance(d('f1'), map({ f1: source }))).toBe('not_estimated')
    }
  })

  it('⭐ routes brief extraction to undetermined — neither claim, pending the ruling', () => {
    // `brief_extraction` is deliberately absent from `USER_OWNED_KINDS`:
    // extraction FROM the user's brief is not the user stating a figure. It is
    // also not Olumi inventing one. Saying nothing is the only honest option
    // until that is ruled on, and it is available because the third state is
    // real.
    expect(driverValueProvenance(d('f1'), map({ f1: 'brief_extraction' }))).toBe('undetermined')
    expect(driverValueProvenance(d('f1'), map({ f1: 'explicit' }))).toBe('undetermined')
  })

  it('⭐ fails closed on silence and on a literal it does not know', () => {
    // A guess here is how "Estimated by Olumi" lands on a confirmed value.
    expect(driverValueProvenance(d('f1'), map({}))).toBe('undetermined')
    expect(driverValueProvenance(d('f1'), undefined)).toBe('undetermined')
    expect(driverValueProvenance(d('f1'), map({ f1: 'some_future_literal' }))).toBe('undetermined')
    expect(driverValueProvenance(d('f1'), map({ f1: '' }))).toBe('undetermined')
  })

  it('does not treat a panel value as the reader’s own', () => {
    // Somebody ELSE's stated belief. Not Olumi's invention, not this user's
    // claim — so it is classified, and it is not user-owned.
    expect(driverValueProvenance(d('f1'), map({ f1: 'panel_elicited' }))).toBe('estimated')
  })

  it('joins on matchedNodeId first, falling back to the factor key', () => {
    // The estate's existing join, not a new one.
    expect(driverValueProvenance(d('f1', 'node_9'), map({ node_9: 'cee_inference', f1: 'user_override' })))
      .toBe('estimated')
    expect(driverValueProvenance(d('f1'), map({ f1: 'user_override' }))).toBe('not_estimated')
  })
})

// ── BOTH SPELLINGS ──────────────────────────────────────────────────────────

describe('the source is read under every shape real graphs carry', () => {
  it('reads observed_state, observedState, and both under data', () => {
    expect(nodeValueSource({ observed_state: { source: 'cee_inference' } })).toBe('cee_inference')
    expect(nodeValueSource({ observedState: { source: 'cee_inference' } })).toBe('cee_inference')
    expect(nodeValueSource({ data: { observed_state: { source: 'user_override' } } })).toBe('user_override')
    expect(nodeValueSource({ data: { observedState: { source: 'user_override' } } })).toBe('user_override')
  })

  it('⭐ CONTRAST — reading only one spelling would under-count', () => {
    // Pins WHY both are read. If this ever collapses to a single spelling the
    // camel case half of every real graph silently loses its authorship.
    const snake = buildNodeValueSourceMap([{ id: 'a', observed_state: { source: 'cee_inference' } }])
    const camel = buildNodeValueSourceMap([{ id: 'b', data: { observedState: { source: 'cee_inference' } } }])
    expect(snake.get('a')).toBe('cee_inference')
    expect(camel.get('b')).toBe('cee_inference')
  })

  it('contributes no entry for a node with no source — a miss and a silence are one answer', () => {
    const m = buildNodeValueSourceMap([
      { id: 'a', observed_state: {} },
      { id: 'b' },
      { id: '', observed_state: { source: 'cee_inference' } },
      null,
    ])
    expect(m.size).toBe(0)
  })
})

// ── THE WIRE ────────────────────────────────────────────────────────────────

/**
 * ⭐⭐ THE DISCRIMINATING PAIR, ON A REAL EXPORTED GRAPH.
 *
 * Not a fixture this lane wrote (trap 16-inverse). `codex-export-2026-08-05`
 * is a captured canvas export whose nodes carry `data.observedState.source`;
 * two of its factor nodes carry DIFFERENT real literals, so one payload settles
 * both directions and neither can be satisfied by the other's row.
 */
describe('a real exported graph, two ids, opposite directions', () => {
  const sources = buildNodeValueSourceMap((codexExport as { nodes: unknown[] }).nodes)

  it('POSITIVE CONTROL — the export really does carry sources', () => {
    // Without this the two cases below could both pass on an empty map, which
    // is the vacuity that makes an absence assertion worthless (trap 13).
    expect(sources.size).toBeGreaterThanOrEqual(7)
    expect(sources.get('fac_budget_spend')).toBe('brief_extraction')
    expect(sources.get('fac_conversion_rate')).toBe('cee_inference')
  })

  it('⭐ fac_budget_spend (brief_extraction) is NOT claimed as Olumi’s', () => {
    expect(driverValueProvenance(d('fac_budget_spend'), sources)).toBe('undetermined')
  })

  it('⭐ fac_conversion_rate (cee_inference) IS Olumi’s, on the SAME payload', () => {
    // The other half of the pair. A rule that blanket-returned `undetermined`
    // would pass the case above and fail here; one that blanket-returned
    // `estimated` would do the reverse. Only a rule that reads the source
    // passes both.
    expect(driverValueProvenance(d('fac_conversion_rate'), sources)).toBe('estimated')
  })

  it('⭐ every classified literal in this export is one the shared map knows', () => {
    // If a producer ships a literal `SOURCE_CLASSES` has not declared, this
    // module routes it to `undetermined` and the fact must be REPORTED, never
    // patched in here — the contract's own completeness guard is the only thing
    // that can see that drift.
    const unknown = [...sources.values()].filter(
      (s) => driverValueProvenance(d('x'), map({ x: s })) === 'undetermined' && s !== 'brief_extraction' && s !== 'explicit',
    )
    expect(unknown).toEqual([])
  })

  it('joins against a second, independently captured staging graph', () => {
    const gp = buildNodeValueSourceMap(
      ((goldenPath as Record<string, unknown>).cee_request as { graph_state: { nodes: unknown[] } })
        .graph_state.nodes,
    )
    expect(gp.get('fac_acquisition')).toBe('cee_inference')
    expect(driverValueProvenance(d('fac_acquisition'), gp)).toBe('estimated')
  })
})
