/**
 * analysisSnapshotFactory — edit summary vs. system persistence markers.
 *
 * Trust-spine board #2 consequence: the gated autosave appends a `graph_saved`
 * event on EVERY debounced graph write, so between two analysis runs the event
 * log is dominated by markers. If the edit-summary derivation ever counted
 * them, the Compare tab would report edits that never happened ("Edited 7
 * factors" for a rerun with no user change).
 *
 * `EDIT_EVENT_TYPES` is derived by filtering out
 * `SYSTEM_MARKER_EVENT_TYPES` (types/scenario, the single source of truth)
 * rather than relying on a human keeping two lists disjoint. These are the
 * behavioural pins on that derivation.
 */
import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { buildAnalysisSnapshot } from '../analysisSnapshotFactory'
import { SYSTEM_MARKER_EVENT_TYPES } from '../../../types/scenario'
import type { ScenarioEvent } from '../../../types/scenario'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'
import type { ReportV1 } from '../../../adapters/plot/types'

const nodes: Node[] = [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'A' } }]
const edges: Edge[] = []

const PREV = '2026-03-08T10:00:00Z'
const AFTER = '2026-03-08T10:05:00Z'

function ev(type: string, seq: number, details: Record<string, unknown> = {}): ScenarioEvent {
  return {
    event_id: `e${seq}`,
    seq,
    event_type: type as ScenarioEvent['event_type'],
    timestamp: AFTER,
    details,
  }
}

/** runNumber 2 so deriveEditSummary actually inspects events (run 1 short-circuits). */
function summaryFor(events: ScenarioEvent[]): string {
  return buildAnalysisSnapshot({
    rawV2Response: {
      analysis_status: 'computed',
      option_comparison_status: 'computed',
      robustness_status: 'unavailable',
      drivers_status: 'unavailable',
      option_comparison: [
        {
          option_id: 'opt-1',
          option_label: 'Option A',
          win_probability: 0.6,
          confidence_interval: [0.3, 0.7],
          expected_outcome: 0.5,
        },
      ],
      critiques: [],
      response_hash: 'resp-1',
    } as unknown as V2RunResponse,
    report: {} as ReportV1,
    nodes,
    edges,
    runNumber: 2,
    events,
    previousSnapshotTimestamp: PREV,
  }).editSummary
}

describe('deriveEditSummary — system markers never count as edits', () => {
  it('a rerun whose only intervening events are graph_saved reads as "no edits"', () => {
    const summary = summaryFor([ev('graph_saved', 1), ev('graph_saved', 2), ev('graph_saved', 3)])
    expect(summary).toBe('Rerun (no edits)')
  })

  it('markers do not inflate the count alongside a real edit', () => {
    // One real edit + three autosave markers must read as ONE edit, not four.
    const withMarkers = summaryFor([
      ev('direct_edit', 1, { change_type: 'update_node', target_id: 'n1' }),
      ev('graph_saved', 2),
      ev('graph_saved', 3),
      ev('graph_saved', 4),
    ])
    const withoutMarkers = summaryFor([
      ev('direct_edit', 1, { change_type: 'update_node', target_id: 'n1' }),
    ])
    // Positive control: the real edit IS seen (not a vacuous "no edits" pass).
    expect(withoutMarkers).not.toBe('Rerun (no edits)')
    expect(withMarkers).toBe(withoutMarkers)
  })

  it('multi-edit counts ignore markers entirely', () => {
    const summary = summaryFor([
      ev('direct_edit', 1, { target_id: 'n1' }),
      ev('graph_saved', 2),
      ev('direct_edit', 3, { target_id: 'n2' }),
      ev('graph_saved', 4),
    ])
    expect(summary).toContain('Edited 2 factors')
  })
})

describe('SYSTEM_MARKER_EVENT_TYPES — shared source of truth', () => {
  it('is non-empty (a silently emptied set would make every consumer vacuous)', () => {
    expect(SYSTEM_MARKER_EVENT_TYPES.size).toBeGreaterThan(0)
  })

  it('classifies graph_saved as a system marker', () => {
    expect(SYSTEM_MARKER_EVENT_TYPES.has('graph_saved')).toBe(true)
  })

  it('does NOT classify real user activity as a marker', () => {
    for (const t of ['direct_edit', 'patch_accepted', 'graph_drafted', 'analysis_run'] as const) {
      expect(SYSTEM_MARKER_EVENT_TYPES.has(t)).toBe(false)
    }
  })
})
