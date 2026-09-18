/**
 * ⛔⛔ THIS SPEC HAS NEVER BEEN RUN. Written 18 Sep 2026 under a hard
 * no-install, no-suite, no-typecheck constraint — nothing in this file has been
 * executed, not once, and no assertion below has been observed to pass or to
 * fail. CI is the authority. Read a green CI run as the first evidence about
 * it; read this header as the reason not to quote it before then.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT THIS PINS
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `strength: { mean, std }` is the ONLY declared spelling. `olumi-schemas` main
 * (`src/graph.ts:758`) and CEE's `EdgeV3` (`src/schemas/cee-v3.ts:450`) both
 * declare `StrengthSchema` with `std` REQUIRED and `.positive()`.
 * `strength_mean` / `strength_std` / `weight` / `strengthStd` are ALL
 * undeclared; the flat pair survives only via `.passthrough()`.
 *
 * Two consequences this file asserts rather than assumes:
 *
 *   1. ⭐ THE CANONICAL NESTED FORM WINS. A probe that reads the undeclared
 *      flat name before the declared nested one lets a field nobody owes
 *      outrank the field the contract requires. Both ingestion seams are pinned
 *      nested-first here, INCLUDING the disagreement case — which is the only
 *      case that can tell the two orders apart.
 *
 *   2. ⛔ ABSENCE FAILS CLOSED. Because `std` is required and positive, an edge
 *      without one is CONTRACT-INVALID, not a value awaiting a default. There
 *      is no "was it supplied?" question, so there is nothing to label: the
 *      remedy is to stop producing a substitute, not to stamp one. An absent
 *      std must stay absent through ingestion.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠ THE BUNDLE IS NOT THE WIRE — the misreading this file exists to prevent
 * ────────────────────────────────────────────────────────────────────────────
 * A debug bundle's `full_graph` is `exportBundle.transformGraphDataEnriched`'s
 * projection of the CANVAS STORE, in snake_case names that transform invents.
 * `strength_mean` there is `edge.data.weight`; `strength_std` is
 * `edge.data.strengthStd`. It emits no `strengthStd` key and no nested
 * `strength` key, so NEITHER can ever appear — and on 18 Sep 2026 those two
 * guaranteed absences were read as proof that the UI drops CEE's uncertainty.
 * It does not. The last describe block below pins the re-keying so the next
 * reader inherits it instead of re-deriving it from a bundle.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE FIXTURES ARE REAL VALUES
 * ────────────────────────────────────────────────────────────────────────────
 * σ = 0.1045, 0.2, 0.18 against β = 0.4354, 0.3, 0.75 are the three edges out
 * of *Pro Plan Price* (`e-10`, `e-11`, `e-12`) in request `39f05ab7`. A real
 * corpus is what catches a constant; an intuited one reproduces the author's
 * model of the producer (CLAUDE.md trap 22).
 *
 * ⛔ 0.15 IS NOT A SAFE SENTINEL. `USER_EDGE_DEFAULTS.strengthStd = 0.15`, and
 * edge `e-4` in this same capture genuinely carries `strength_std: 0.15`. A
 * real value and a fabrication are INDISTINGUISHABLE BY ARITHMETIC, which is
 * exactly why the absence assertions below test for ABSENCE and not for
 * "not 0.15" — the latter is satisfied by any other invented number.
 */

import { describe, it, expect } from 'vitest'
import { mapDraftEdgeToCanvas } from '../applyDraftResult'
import { adaptDraftResponse } from '../../../adapters/cee/client'
import {
  transformGraphDataEnriched,
  type FullGraphData,
} from '../../../components/debug/utils/exportBundle'
import { USER_EDGE_DEFAULTS } from '../../domain/edges'

/**
 * The three edges out of `ed5b5711` (*Pro Plan Price*), in the CANONICAL shape
 * CEE actually sends on the live V5 turn path. `EdgeV3Schema` is a plain
 * `z.object`, so a CEE edge carries the nested form and nothing else.
 */
const CAPTURED_EDGES = [
  { id: 'e-10', from: 'ed5b5711', to: '72495f86', strength: { mean: 0.4354166666666666, std: 0.10449999999999998 }, belief_exists: 0.8, effect_direction: 'positive' },
  { id: 'e-11', from: 'ed5b5711', to: '7acd9279', strength: { mean: 0.3, std: 0.2 }, belief_exists: 0.75, effect_direction: 'positive' },
  { id: 'e-12', from: 'ed5b5711', to: '94fa174b', strength: { mean: 0.75, std: 0.17999999999999997 }, belief_exists: 0.8, effect_direction: 'positive' },
] as const

describe('canonical strength.std reaches the canvas store', () => {
  it('carries each supplied std to strengthStd with its value intact', () => {
    const mapped = CAPTURED_EDGES.map((e, i) => mapDraftEdgeToCanvas(e, i))

    expect(mapped.map(m => m.data.strengthStd)).toEqual([
      0.10449999999999998, 0.2, 0.17999999999999997,
    ])
  })

  /**
   * The defect the bundle was misread as showing would look EXACTLY like this
   * if it were real: three edges, one number. Asserting the SPREAD separately
   * from the values means a mapper that pinned every edge to a constant fails
   * here even if someone "fixed" the values above by hard-coding them.
   */
  it('keeps the three edges distinguishable rather than collapsing them to one number', () => {
    const stds = CAPTURED_EDGES.map((e, i) => mapDraftEdgeToCanvas(e, i).data.strengthStd)
    expect(new Set(stds).size).toBe(3)
  })

  /**
   * ⛔ FAIL CLOSED. An edge the producer sent no std for is contract-invalid,
   * and the honest outcome is NOTHING — not `USER_EDGE_DEFAULTS.strengthStd`,
   * and not any other substitute. Asserting absence rather than `!== 0.15` is
   * deliberate: `not.toBe(0.15)` passes for every invented number except one.
   */
  it('invents no uncertainty for an edge carrying no std', () => {
    const silent = mapDraftEdgeToCanvas(
      { id: 'e-silent', from: 'a', to: 'b', strength: { mean: 0.4 }, effect_direction: 'positive' },
      0,
    )

    expect(silent.data.strengthStd).toBeUndefined()
    expect('strengthStd' in silent.data).toBe(false)
  })

  /**
   * The value/fabrication collision as a test rather than a comment. `e-4`
   * genuinely carries std 0.15 — the same number `USER_EDGE_DEFAULTS`
   * fabricates. It must arrive as a real value, which is only possible because
   * the SUPPLIED case and the ABSENT case differ in presence, never in
   * arithmetic. Any consumer discriminating on the number alone cannot tell
   * these two tests apart; that is the point of running both.
   */
  it('carries a genuine 0.15 through, indistinguishable by value from the fabricated one', () => {
    const genuine = mapDraftEdgeToCanvas(
      { id: 'e-4', from: '7acd9279', to: 'b4014d90', strength: { mean: 0.5, std: 0.15 }, effect_direction: 'negative' },
      0,
    )

    expect(genuine.data.strengthStd).toBe(USER_EDGE_DEFAULTS.strengthStd)
  })
})

describe('the declared nested spelling outranks the undeclared flat one', () => {
  /**
   * ⭐ THE DISCRIMINATING CASE, AND THE ONLY ONE THAT CAN FAIL.
   *
   * When only one spelling is present, flat-first and nested-first return the
   * same answer, so an edge carrying just one proves nothing about the order.
   * These fixtures carry BOTH, with DIFFERENT values, so exactly one order can
   * satisfy them. Reverting either seam to `flat ?? nested` turns these red.
   */
  const CONFLICTING = {
    id: 'e-conflict',
    from: 'a',
    to: 'b',
    strength: { mean: 0.75, std: 0.18 },   // declared — must win
    strength_mean: 0.3,                     // undeclared passthrough — must lose
    strength_std: 0.2,                      // undeclared passthrough — must lose
    effect_direction: 'positive',
  }

  it('prefers strength.std over strength_std at the canvas mapper', () => {
    expect(mapDraftEdgeToCanvas(CONFLICTING, 0).data.strengthStd).toBe(0.18)
  })

  it('prefers strength.std over strength_std in the CEE draft adapter', () => {
    const adapted = adaptDraftResponse({ graph: { nodes: [], edges: [CONFLICTING] } })
    expect(adapted.edges[0].strength_std).toBe(0.18)
  })

  it('prefers strength.mean over strength_mean in the CEE draft adapter', () => {
    const adapted = adaptDraftResponse({ graph: { nodes: [], edges: [CONFLICTING] } })
    expect(adapted.edges[0].strength_mean).toBe(0.75)
  })

  /**
   * The legacy fallback must still work, or the reorder above would have
   * quietly dropped pre-v3 responses instead of merely de-prioritising them.
   * This is the twin of the case above: same seam, opposite direction.
   */
  it('still reads the flat spelling when no nested strength is present', () => {
    const legacyOnly = { id: 'e-legacy', from: 'a', to: 'b', strength_mean: 0.3, strength_std: 0.2 }

    expect(mapDraftEdgeToCanvas(legacyOnly, 0).data.strengthStd).toBe(0.2)
    expect(adaptDraftResponse({ graph: { nodes: [], edges: [legacyOnly] } }).edges[0].strength_std).toBe(0.2)
  })

  /** A std of zero violates `StrengthSchema`'s `.positive()` and must not pass. */
  it('rejects a non-positive std rather than carrying it', () => {
    const adapted = adaptDraftResponse({
      graph: {
        nodes: [],
        edges: [{ id: 'e-zero', from: 'a', to: 'b', strength: { mean: 0.5, std: 0 } }],
      },
    })
    expect(adapted.edges[0].strength_std).toBeUndefined()
  })
})

describe('the debug bundle invents the flat names — full_graph is not the wire', () => {
  const storeGraph = (): FullGraphData => ({
    nodes: [],
    edges: CAPTURED_EDGES.map((e, i) => {
      const m = mapDraftEdgeToCanvas(e, i)
      return { id: m.id, source: m.source, target: m.target, data: m.data }
    }),
  })

  /**
   * ⭐⭐ THE MISREADING, PINNED AS A PAIR SO IT IS A DISCRIMINATION AND NOT A
   * TAUTOLOGY. The camelCase key is absent AND the snake_case key carries the
   * real value, in the same object. Asserting only the absence would pass on an
   * empty object; asserting only the value would miss the re-key entirely.
   */
  it('emits strength_std (from strengthStd) and never a camelCase strengthStd', () => {
    const edge = transformGraphDataEnriched(storeGraph()).edges[0] as unknown as Record<string, unknown>

    expect('strengthStd' in edge).toBe(false)
    expect(edge.strength_std).toBe(0.10449999999999998)
  })

  /**
   * The other guaranteed absence that was read as evidence: a bundle contains
   * no nested `strength` object, so `"strength":` occurring zero times in a
   * capture says nothing whatever about what the producer sent.
   */
  it('emits no nested strength object, so its absence in a bundle proves nothing', () => {
    const edge = transformGraphDataEnriched(storeGraph()).edges[0] as unknown as Record<string, unknown>
    expect('strength' in edge).toBe(false)
  })

  /** `strength_mean` in a bundle is `edge.data.weight` — a re-key, not a wire field. */
  it('emits strength_mean from the store weight', () => {
    const exported = transformGraphDataEnriched(storeGraph())
    expect(exported.edges.map(e => e.strength_mean)).toEqual([0.4354166666666666, 0.3, 0.75])
  })

  /**
   * ⛔ THE FAIL-CLOSED PROPERTY MUST SURVIVE THE PROJECTION. An edge with no
   * std must reach the bundle with no uncertainty — if the export defaulted it,
   * every future diagnosis would read a fabrication as a supplied value, which
   * is the whole failure mode this file documents.
   */
  it('carries an absent uncertainty through the export as absent', () => {
    const silent = mapDraftEdgeToCanvas({ id: 'e-silent', from: 'a', to: 'b', strength: { mean: 0.4 } }, 0)
    const exported = transformGraphDataEnriched({
      nodes: [],
      edges: [{ id: silent.id, source: silent.source, target: silent.target, data: silent.data }],
    })

    expect(exported.edges[0].strength_std).toBeUndefined()
  })
})
