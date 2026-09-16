/**
 * ⭐⭐ THE ENGINE'S LIMIT IS THE ENGINE'S TO STATE — the UI was refusing to run
 * at a ceiling the producer never named, and attributing it to the producer.
 *
 * ## The defect, at the bytes
 *
 * `/v1/limits` supplies exactly two facts: `nodes.max` and `edges.max`
 * (`adapters/plot/types.ts:249-254`). No zones, no bands, no thresholds.
 *
 * `deriveLimitsStatus` invents three bands at **90%** and **70%**, and
 * `deriveRunEligibility` then **hard-blocks the analysis** on the 90% one:
 *
 *     if (limitsStatus && limitsStatus.zone === 'at_limit')
 *       return { canRun: false, reason: 'limits',
 *                message: "Simplify this graph to stay within the engine's limits…" }
 *
 * ⛔ **At 90% the graph IS within the engine's limits.** With the fallback
 * limits the UI ships — `{ nodes: { max: 50 }, edges: { max: 100 } }`
 * (`useEngineLimits.ts:36`) — a model with **90 edges is refused while the
 * engine has ten to spare**, and is told the engine refused it.
 *
 * This is the governing ruling's sharpest form: not a number turned into words,
 * but a **capability withheld** on a number the UI chose, with the refusal
 * attributed to the producer.
 *
 * ## Two questions under one name (trap 21)
 *
 * `at_limit` answers both *"have you exceeded the producer's maximum?"* — a fact
 * about a stated set, whose remedy is *you must remove something* — and *"are you
 * near it?"*, whose remedy is *nothing, carry on*. One predicate, two remedies.
 * They are named apart here: the **block** reads the producer's own maximum; the
 * **bands** stay where they are and stop gating anything.
 *
 * ⚠ `current > max` is NOT a chosen threshold. It compares a live count with a
 * figure the producer stated — the UI picks neither side of it.
 *
 * ## ⛔ What the existing suite encoded
 *
 * `runEligibility.spec.ts`'s fixture built `zone: 'at_limit'` beside
 * `nodes: { current: 10, max: 100, percent: 10 }` — a state the derivation
 * cannot produce — and asserted the run was blocked. **A graph using a tenth of
 * capacity, pinned as correctly refused.** The fixture sat outside the
 * producer's domain, so the test could pass while the product was wrong.
 */
import { describe, it, expect } from 'vitest'
import { deriveRunEligibility } from '../runEligibility'
import { deriveLimitsStatus, type LimitsStatusResult } from '../limitsStatus'

/** The limits the UI actually ships when `/v1/limits` cannot be reached. */
const SHIPPED_FALLBACK = { nodes: { max: 50 }, edges: { max: 100 } }

/** ⭐ Built through the REAL derivation, so every fixture is a state the
 *  producer can actually put the UI in (trap 16-inverse). */
function realStatus(nodes: number, edges: number): LimitsStatusResult {
  const s = deriveLimitsStatus(SHIPPED_FALLBACK, nodes, edges)
  if (!s) throw new Error('fixture precondition failed: no limits status')
  return s
}

function eligibility(nodes: number, edges: number) {
  return deriveRunEligibility({
    nodeCount: nodes,
    edgeCount: edges,
    hasValidationErrors: false,
    graphHealth: null,
    limitsStatus: realStatus(nodes, edges),
  })
}

describe('the engine’s limit is the engine’s to state', () => {
  it('⭐ a graph at 90% of the engine’s maximum RUNS — the engine has room', () => {
    // 90 of 100 edges. The producer's stated maximum is 100.
    const r = eligibility(10, 90)
    // Pin the precondition in-test: this fixture must actually reach the band
    // that used to block, or the assertion proves nothing (trap 13b).
    expect(realStatus(10, 90).zone).toBe('at_limit')
    expect(r.canRun).toBe(true)
    expect(r.reason).toBe('ok')
  })

  it('⭐ exactly AT the maximum runs — “max” means the largest permitted', () => {
    expect(eligibility(10, 100).canRun).toBe(true)
    expect(eligibility(50, 10).canRun).toBe(true)
  })

  /**
   * ⛔ THE DISCRIMINATING TWIN. Without it, a change that simply never blocks on
   * limits passes every assertion above — which is the opposite defect and just
   * as wrong: a graph the engine genuinely cannot take would be sent anyway.
   */
  it('⛔ CONTRAST: OVER the engine’s maximum is still blocked', () => {
    const r = eligibility(10, 101)
    expect(r.canRun).toBe(false)
    expect(r.reason).toBe('limits')
  })

  it('⛔ CONTRAST: over on the NODE axis is blocked too — both axes, not just edges', () => {
    const r = eligibility(51, 10)
    expect(r.canRun).toBe(false)
    expect(r.reason).toBe('limits')
  })

  it('the refusal names the producer’s own figure, not a band the UI chose', () => {
    const m = eligibility(10, 140).message
    expect(m).toContain('140')   // what the graph has
    expect(m).toContain('100')   // what the producer said it will take
    // ⛔ It must not re-assert the invented ceiling as the engine's.
    expect(m).not.toMatch(/90%|recommended limit/i)
  })

  it('⛔ a fabricated `at_limit` label cannot block a graph the counts say is fine', () => {
    // The impossible state the old fixture encoded: the label says at_limit,
    // the numbers say a tenth of capacity. The counts decide.
    const impossible = { ...realStatus(10, 10), zone: 'at_limit' as const, zoneLabel: 'At limit' }
    const r = deriveRunEligibility({
      nodeCount: 10, edgeCount: 10,
      hasValidationErrors: false, graphHealth: null, limitsStatus: impossible,
    })
    expect(r.canRun).toBe(true)
  })
})
