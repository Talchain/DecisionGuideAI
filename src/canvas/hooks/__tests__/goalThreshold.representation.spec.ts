/**
 * Lane 5 (Codex P0-1) — goal-threshold REPRESENTATION tagging.
 *
 * Codex captured a live staging corruption (batch 9de778ca..7f360e84):
 *   - CEE analysis_ready: bare NORMALISED goal_threshold 0.6 (no raw, no cap)
 *   - goal node: raw 60, unit %, cap 100
 * The store's bare-sync writes 0.6 into the raw-units goalThreshold field
 * ("stored only capless, where raw ≡ normalised" — FALSE: the NODE carries
 * the cap), then the request boundary's cap chain finds the node's cap 100
 * and divides: 0.6 / 100 = 0.006. UI shows "Target: 60%", analysis runs at
 * 0.6%.
 *
 * Root cause: raw and normalised share one untagged scalar; representation
 * is inferred from "is a cap available", which is wrong when the cap lives
 * on the node rather than on the value's own producer. The fix is an
 * explicit `goalThresholdRepresentation` tag: a value tagged 'normalised'
 * is passed through iff ∈[0,1] and NEVER divided by any cap.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveChipGoalThreshold } from '../useV2Run'

afterEach(() => vi.restoreAllMocks())

const nodeWithCap = [{ id: 'goal_1', data: { success_threshold: 60, scale_max: 100 } }]

describe('resolveChipGoalThreshold — representation-aware (Codex P0-1)', () => {
  it('REPRODUCES the corruption when representation is unknown: a bare 0.6 + node cap 100 → 0.006', () => {
    // Legacy/absent representation → the old cap-chain behaviour. This is
    // the live bug: a normalised value gets divided by the node cap.
    const result = resolveChipGoalThreshold(0.6, {
      analysisReady: null,
      nodes: nodeWithCap,
      goalNodeId: 'goal_1',
    })
    expect(result).toBeCloseTo(0.006)
  })

  it("a value tagged 'normalised' is passed through, NEVER divided by the node cap", () => {
    const result = resolveChipGoalThreshold(0.6, {
      analysisReady: null,
      nodes: nodeWithCap,
      goalNodeId: 'goal_1',
      representation: 'normalised',
    })
    expect(result).toBe(0.6)
  })

  it("a 'normalised' value outside [0,1] fails closed (omitted), never sent", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      resolveChipGoalThreshold(60, {
        analysisReady: null,
        nodes: nodeWithCap,
        goalNodeId: 'goal_1',
        representation: 'normalised',
      }),
    ).toBeUndefined()
    expect(warn).toHaveBeenCalled()
  })

  it("a value tagged 'raw' keeps the cap-chain conversion (60 raw / cap 100 → 0.6)", () => {
    const result = resolveChipGoalThreshold(60, {
      analysisReady: null,
      nodes: nodeWithCap,
      goalNodeId: 'goal_1',
      representation: 'raw',
    })
    expect(result).toBeCloseTo(0.6)
  })

  it("a 'normalised' value ignores even a unit cap (never double-normalises)", () => {
    const result = resolveChipGoalThreshold(0.6, {
      analysisReady: null,
      nodes: [{ id: 'goal_1', data: {} }],
      goalNodeId: 'goal_1',
      unitCap: 100,
      representation: 'normalised',
    })
    expect(result).toBe(0.6)
  })
})
