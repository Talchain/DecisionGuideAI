/**
 * CEE → store goal-threshold sync unit contract.
 *
 * store.goalThreshold holds USER UNITS (the goal_threshold_raw scale):
 * threshold editors write raw values and every display consumer (Results
 * target line, goal badge, inspector) reads raw. The CEE sync must therefore
 * prefer goal_threshold_raw over the normalised 0-1 goal_threshold —
 * syncing the normalised value painted the Results target at "80%" when the
 * real target was 20% (staging trust review).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'
import type { CEEAnalysisReady } from '../../../adapters/cee/types'

function analysisReady(extra: Record<string, unknown>): CEEAnalysisReady {
  return {
    goal_node_id: 'goal_node',
    options: [
      { id: 'option_a', label: 'Option A', status: 'ready', interventions: {} },
    ],
    ...extra,
  } as CEEAnalysisReady
}

describe('Canvas Store – setCeeAnalysisReady goal-threshold sync (unit contract)', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset()
    useCanvasStore.setState({ goalThreshold: null })
  })

  it('prefers goal_threshold_raw (user units) over normalised goal_threshold — tagged raw', () => {
    useCanvasStore.getState().setCeeAnalysisReady(
      analysisReady({ goal_threshold: 0.8, goal_threshold_raw: 20, goal_threshold_cap: 25 }),
    )
    expect(useCanvasStore.getState().goalThreshold).toBe(20)
    expect(useCanvasStore.getState().goalThresholdRepresentation).toBe('raw')
  })

  it('Lane 5 (Codex P0-1): a BARE normalised goal_threshold is stored as-is and TAGGED normalised', () => {
    // This is the live-corruption input: analysis_ready carries 0.6 with no
    // raw and no cap of its OWN, but the goal node carries a cap. Storing it
    // untagged let the request boundary divide by the node cap (0.6/100 =
    // 0.006). The tag makes the boundary pass it through untouched.
    useCanvasStore.getState().setCeeAnalysisReady(analysisReady({ goal_threshold: 0.6 }))
    expect(useCanvasStore.getState().goalThreshold).toBe(0.6)
    expect(useCanvasStore.getState().goalThresholdRepresentation).toBe('normalised')
  })

  it('RED-first (2.315 Part 2): a cap WITHOUT a raw is NOT re-derived into an attested raw', () => {
    // ⚠ CONTRACT CHANGE, deliberate. This case previously computed norm × cap
    // (0.8 × 25 = 20) and tagged the product 'raw' — a value the UI derived
    // itself, presented downstream as one the producer attested.
    //
    // ⚠ #798 DOES NOT MAKE THIS REACHABLE — an earlier draft of this comment
    // said it did, which is false in the dangerous direction. #798 is
    // RAW-ANCHORED: a cap cannot reach the wire without a raw, so `ceeRaw !=
    // null` always wins and this branch stays unreachable. #798 begins emitting
    // caps AT ALL, and its anchor is what keeps the branch dead. The synthesis
    // is removed as DEFENCE IN DEPTH against that anchor loosening — it lives in
    // another repo on another schema pin — not because #798 armed a hazard.
    //
    // Refusing to synthesise does NOT reopen the double-normalisation this
    // branch was added to prevent: the value is stored untouched and TAGGED
    // 'normalised', and resolveChipGoalThreshold short-circuits on that tag
    // and never divides by a cap (useV2Run.ts). Same wire outcome, no
    // fabricated magnitude, and the display no longer claims a raw scale.
    useCanvasStore.getState().setCeeAnalysisReady(
      analysisReady({ goal_threshold: 0.8, goal_threshold_cap: 25 }),
    )
    expect(useCanvasStore.getState().goalThreshold).toBe(0.8)
    expect(useCanvasStore.getState().goalThresholdRepresentation).toBe('normalised')
  })

  it('an invalid cap is likewise never used to manufacture a value', () => {
    useCanvasStore.getState().setCeeAnalysisReady(
      analysisReady({ goal_threshold: 0.8, goal_threshold_cap: 0 }),
    )
    expect(useCanvasStore.getState().goalThreshold).toBe(0.8)
    expect(useCanvasStore.getState().goalThresholdRepresentation).toBe('normalised')
  })

  it('never overwrites a non-null threshold that is not tagged normalised', () => {
    // Legacy/untagged (null representation) is treated as raw everywhere else
    // in the estate, so the widened gate must leave it alone too.
    // Set the tag EXPLICITLY rather than relying on what reset() leaves behind —
    // the claim under test is about a null tag, so it must be established, not
    // inherited from a sibling test.
    useCanvasStore.setState({ goalThreshold: 15, goalThresholdRepresentation: null })
    useCanvasStore.getState().setCeeAnalysisReady(
      analysisReady({ goal_threshold: 0.8, goal_threshold_raw: 20 }),
    )
    expect(useCanvasStore.getState().goalThreshold).toBe(15)
  })

  it('RED-first (2.315 Part 1): a RAW payload supersedes a stored bare-NORMALISED value', () => {
    // The split-brain. The number was gated on `goalThreshold == null` while
    // the goal node's UNIT (backfillGoalThresholdOntoGoalNode) was ungated, so
    // a session holding a bare normalised 0.8 kept the 0.8 and took the new
    // payload's '£' — "≥ 0.8 £" on Inspector v2.
    useCanvasStore.getState().setCeeAnalysisReady(analysisReady({ goal_threshold: 0.8 }))
    expect(useCanvasStore.getState().goalThresholdRepresentation).toBe('normalised')

    useCanvasStore.getState().setCeeAnalysisReady(
      analysisReady({
        goal_threshold: 0.8,
        goal_threshold_raw: 800000,
        goal_threshold_unit: '£',
        goal_threshold_cap: 1000000,
      }),
    )
    expect(useCanvasStore.getState().goalThreshold).toBe(800000)
    expect(useCanvasStore.getState().goalThresholdRepresentation).toBe('raw')
  })

  it("a user's committed target is never superseded — user commits are tagged raw", () => {
    // The safety argument for widening the gate, pinned. 'normalised' has
    // exactly ONE writer in the repo — the bare-sync branch inside
    // setCeeAnalysisReady itself — so the widened condition can only ever
    // overwrite the store's own un-attested guess, never a user's number.
    // setGoalThresholdAndUpdateNode hard-codes 'raw'; setGoalThreshold
    // defaults to 'raw'.
    useCanvasStore.setState({ nodes: [{ id: 'goal_node', type: 'goal', position: { x: 0, y: 0 }, data: {} }] } as never)
    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_node', 15, { unit: '£' })
    expect(useCanvasStore.getState().goalThresholdRepresentation).toBe('raw')

    useCanvasStore.getState().setCeeAnalysisReady(
      analysisReady({ goal_threshold: 0.8, goal_threshold_raw: 800000, goal_threshold_cap: 1000000 }),
    )
    expect(useCanvasStore.getState().goalThreshold).toBe(15)
  })

  it('a normalised payload never supersedes a stored RAW value (the widening is one-way)', () => {
    useCanvasStore.getState().setCeeAnalysisReady(
      analysisReady({ goal_threshold: 0.8, goal_threshold_raw: 800000 }),
    )
    expect(useCanvasStore.getState().goalThreshold).toBe(800000)

    useCanvasStore.getState().setCeeAnalysisReady(analysisReady({ goal_threshold: 0.5 }))
    expect(useCanvasStore.getState().goalThreshold).toBe(800000)
    expect(useCanvasStore.getState().goalThresholdRepresentation).toBe('raw')
  })

  it('syncs nothing when CEE provides no threshold fields', () => {
    useCanvasStore.getState().setCeeAnalysisReady(analysisReady({}))
    expect(useCanvasStore.getState().goalThreshold).toBeNull()
  })
})
