/**
 * Golden fixture tests for renderTimeline and renderTimelineSummary.
 *
 * 7 fixtures covering: normal flow, missing fields, empty, single stage,
 * direct_edit with target_label, missing array fields, stage_changed grouping.
 *
 * Deterministic: no Date.now(), no randomness.
 */

import { describe, it, expect } from 'vitest'
import type { ScenarioEvent, ScenarioEventType } from '../../../types/scenario'
import { renderTimeline } from '../renderTimeline'
import { renderTimelineSummary } from '../renderTimelineSummary'

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let seqCounter = 0

function makeEvent(
  eventType: ScenarioEventType,
  details: Record<string, unknown> = {},
  overrides: Partial<ScenarioEvent> = {},
): ScenarioEvent {
  seqCounter += 1
  return {
    event_id: `evt-${seqCounter}`,
    seq: seqCounter,
    event_type: eventType,
    timestamp: `2026-03-08T10:${String(seqCounter).padStart(2, '0')}:00Z`,
    details,
    ...overrides,
  }
}

// Reset counter before each test
import { beforeEach } from 'vitest'
beforeEach(() => { seqCounter = 0 })

// ---------------------------------------------------------------------------
// Fixture 1 — Normal scenario (Frame -> Ideate -> Evaluate)
// ---------------------------------------------------------------------------

describe('Fixture 1 — Normal scenario', () => {
  const events: ScenarioEvent[] = [
    makeEvent('scenario_created'),
    makeEvent('framing_confirmed', { goal: 'Choose the best market entry strategy' }),
    makeEvent('graph_drafted', { node_count: 6, edge_count: 8 }),
    makeEvent('patch_accepted', { summary: 'Added regulatory risk factor' }),
    makeEvent('patch_accepted', { summary: 'Connected market size to revenue' }),
    makeEvent('patch_dismissed', { summary: 'Skip competitor analysis' }),
    makeEvent('stage_changed', { from: 'frame', to: 'ideate' }),
    makeEvent('stage_changed', { from: 'ideate', to: 'evaluate' }),
    makeEvent('analysis_run', { winner: 'Option A', probability: 72, robustness: 'robust' }),
    makeEvent('brief_generated'),
  ]

  it('produces correct number of entries', () => {
    const entries = renderTimeline(events)
    expect(entries).toHaveLength(10)
  })

  it('assigns correct stages', () => {
    const entries = renderTimeline(events)
    // Events 1-6 (before stage_changed to ideate) are in 'frame'
    expect(entries[0].stage).toBe('frame') // scenario_created
    expect(entries[1].stage).toBe('frame') // framing_confirmed
    expect(entries[2].stage).toBe('frame') // graph_drafted
    expect(entries[3].stage).toBe('frame') // patch_accepted
    expect(entries[4].stage).toBe('frame') // patch_accepted
    expect(entries[5].stage).toBe('frame') // patch_dismissed
    // stage_changed to ideate is assigned to ideate (destination)
    expect(entries[6].stage).toBe('ideate')
    // stage_changed to evaluate is assigned to evaluate
    expect(entries[7].stage).toBe('evaluate')
    expect(entries[8].stage).toBe('evaluate') // analysis_run
    expect(entries[9].stage).toBe('evaluate') // brief_generated
  })

  it('generates correct headlines', () => {
    const entries = renderTimeline(events)
    expect(entries[0].headline).toBe('Scenario created')
    expect(entries[1].headline).toBe('Decision framed: Choose the best market entry strategy')
    expect(entries[2].headline).toBe('Model created with 6 factors and 8 relationships')
    expect(entries[3].headline).toBe('Added regulatory risk factor')
    expect(entries[4].headline).toBe('Connected market size to revenue')
    expect(entries[5].headline).toBe('Suggestion dismissed: Skip competitor analysis')
    expect(entries[6].headline).toBe('Moved to ideate stage')
    expect(entries[7].headline).toBe('Moved to evaluate stage')
    expect(entries[8].headline).toBe('Analysis complete - Option A recommended at 72% (robust)')
    expect(entries[9].headline).toBe('Decision brief generated')
  })

  it('assigns correct icons', () => {
    const entries = renderTimeline(events)
    expect(entries[1].icon).toBe('Target')          // framing_confirmed
    expect(entries[2].icon).toBe('GitBranch')        // graph_drafted
    expect(entries[3].icon).toBe('Check')            // patch_accepted
    expect(entries[5].icon).toBe('X')                // patch_dismissed
    expect(entries[6].icon).toBe('ArrowRight')       // stage_changed
    expect(entries[8].icon).toBe('BarChart3')         // analysis_run
    expect(entries[9].icon).toBe('FileText')         // brief_generated
  })

  it('assigns correct colours', () => {
    const entries = renderTimeline(events)
    expect(entries[1].colour).toBe('text-info')       // framing_confirmed
    expect(entries[3].colour).toBe('text-success')    // patch_accepted
    expect(entries[5].colour).toBe('text-text-light') // patch_dismissed
    expect(entries[8].colour).toBe('text-success')    // analysis_run
  })

  it('assigns correct sources', () => {
    const entries = renderTimeline(events)
    expect(entries[0].source).toBe('system')  // scenario_created
    expect(entries[2].source).toBe('ai')      // graph_drafted
    expect(entries[3].source).toBe('user')    // patch_accepted
    expect(entries[5].source).toBe('user')    // patch_dismissed
    expect(entries[8].source).toBe('ai')      // analysis_run
    expect(entries[9].source).toBe('system')  // brief_generated
  })

  it('produces correct summary', () => {
    const summary = renderTimelineSummary(events)
    expect(summary).toBe(
      'Framing confirmed: Choose the best market entry strategy. ' +
      'Graph drafted with 6 nodes, 8 edges. ' +
      'Analysis run: Option A at 72%, robustness robust. ' +
      '2 patches accepted, 1 dismissed. ' +
      'Brief generated.',
    )
  })
})

// ---------------------------------------------------------------------------
// Fixture 2 — Missing fields
// ---------------------------------------------------------------------------

describe('Fixture 2 — Missing fields', () => {
  it('falls back to sentence-cased event type when goal is missing', () => {
    const events = [makeEvent('framing_confirmed', {})]
    const entries = renderTimeline(events)
    expect(entries[0].headline).toBe('Framing confirmed')
  })

  it('falls back to sentence-cased event type when analysis winner is missing', () => {
    const events = [makeEvent('analysis_run', {})]
    const entries = renderTimeline(events)
    expect(entries[0].headline).toBe('Analysis run')
  })

  it('handles missing message in analysis_failed', () => {
    const events = [makeEvent('analysis_failed', {})]
    const entries = renderTimeline(events)
    expect(entries[0].headline).toBe('Analysis failed')
  })

  it('does not throw for any event type with empty details', () => {
    const allTypes: ScenarioEventType[] = [
      'scenario_created', 'framing_confirmed', 'stage_changed',
      'graph_drafted', 'patch_accepted', 'patch_dismissed', 'patch_rejected',
      'direct_edit', 'analysis_run', 'analysis_failed',
      'brief_generated', 'brief_shared',
      'confidence_pre', 'confidence_post', 'evidence_intent',
      'changed_thinking', 'feedback_submitted',
    ]
    for (const type of allTypes) {
      expect(() => renderTimeline([makeEvent(type, {})])).not.toThrow()
    }
  })
})

// ---------------------------------------------------------------------------
// Fixture 3 — Empty events
// ---------------------------------------------------------------------------

describe('Fixture 3 — Empty events', () => {
  it('returns empty array for empty input', () => {
    expect(renderTimeline([])).toEqual([])
  })

  it('returns "No activity yet." for empty summary', () => {
    expect(renderTimelineSummary([])).toBe('No activity yet.')
  })
})

// ---------------------------------------------------------------------------
// Fixture 4 — Single stage (all in Frame, no stage_changed)
// ---------------------------------------------------------------------------

describe('Fixture 4 — Single stage', () => {
  it('assigns all entries to frame when no stage_changed exists', () => {
    const events = [
      makeEvent('scenario_created'),
      makeEvent('framing_confirmed', { goal: 'Test' }),
      makeEvent('graph_drafted', { node_count: 3, edge_count: 2 }),
    ]
    const entries = renderTimeline(events)
    expect(entries).toHaveLength(3)
    expect(entries.every(e => e.stage === 'frame')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Fixture 5 — direct_edit with target_label / fallback to target_id
// ---------------------------------------------------------------------------

describe('Fixture 5 — direct_edit', () => {
  it('uses target_label when available', () => {
    const events = [
      makeEvent('direct_edit', {
        change_type: 'update_node',
        target_label: 'Market growth',
        target_id: 'node-42',
      }),
    ]
    const entries = renderTimeline(events)
    expect(entries[0].headline).toBe('You updated Market growth')
    expect(entries[0].source).toBe('user')
    expect(entries[0].icon).toBe('Pencil')
    expect(entries[0].colour).toBe('text-text-body')
  })

  it('falls back to target_id when target_label is absent', () => {
    const events = [
      makeEvent('direct_edit', {
        change_type: 'update_node',
        target_id: 'node-42',
      }),
    ]
    const entries = renderTimeline(events)
    expect(entries[0].headline).toBe('You updated node-42')
  })

  it('humanises all change_type values', () => {
    const types: [string, string][] = [
      ['add_node', 'You added a factor'],
      ['remove_node', 'You removed a factor'],
      ['add_edge', 'You connected'],
      ['remove_edge', 'You disconnected'],
      ['update_edge', 'You adjusted a relationship'],
    ]
    for (const [changeType, expected] of types) {
      const events = [makeEvent('direct_edit', { change_type: changeType })]
      const entries = renderTimeline(events)
      expect(entries[0].headline).toBe(expected)
    }
  })

  it('sets relatedNodeIds from target_id', () => {
    const events = [
      makeEvent('direct_edit', { change_type: 'update_node', target_id: 'node-7' }),
    ]
    const entries = renderTimeline(events)
    expect(entries[0].relatedNodeIds).toEqual(['node-7'])
  })
})

// ---------------------------------------------------------------------------
// Fixture 6 — Missing array fields
// ---------------------------------------------------------------------------

describe('Fixture 6 — Missing array fields', () => {
  it('treats missing selected_factors as empty array', () => {
    const events = [makeEvent('evidence_intent', {})]
    const entries = renderTimeline(events)
    expect(entries[0].headline).toBe('Evidence plan: 0 factors selected')
  })

  it('treats non-array selected_factors as empty array', () => {
    const events = [makeEvent('evidence_intent', { selected_factors: 'not an array' })]
    const entries = renderTimeline(events)
    expect(entries[0].headline).toBe('Evidence plan: 0 factors selected')
  })

  it('counts array correctly when present', () => {
    const events = [makeEvent('evidence_intent', { selected_factors: ['a', 'b', 'c'] })]
    const entries = renderTimeline(events)
    expect(entries[0].headline).toBe('Evidence plan: 3 factors selected')
  })
})

// ---------------------------------------------------------------------------
// Fixture 7 — stage_changed grouping (destination stage assignment)
// ---------------------------------------------------------------------------

describe('Fixture 7 — stage_changed assigned to destination stage', () => {
  it('assigns stage_changed event to the destination stage, not origin', () => {
    const events = [
      makeEvent('scenario_created'),
      makeEvent('stage_changed', { from: 'frame', to: 'ideate' }),
      makeEvent('graph_drafted', { node_count: 5, edge_count: 3 }),
      makeEvent('stage_changed', { from: 'ideate', to: 'evaluate' }),
      makeEvent('analysis_run', { winner: 'B', probability: 65, robustness: 'moderate' }),
    ]
    const entries = renderTimeline(events)

    // scenario_created: before any stage_changed, defaults to 'frame'
    expect(entries[0].stage).toBe('frame')
    // stage_changed (frame -> ideate): assigned to 'ideate' (destination)
    expect(entries[1].stage).toBe('ideate')
    // graph_drafted: after first stage_changed, so in 'ideate'
    expect(entries[2].stage).toBe('ideate')
    // stage_changed (ideate -> evaluate): assigned to 'evaluate' (destination)
    expect(entries[3].stage).toBe('evaluate')
    // analysis_run: after second stage_changed, so in 'evaluate'
    expect(entries[4].stage).toBe('evaluate')
  })

  it('sorts by seq regardless of array order', () => {
    const events = [
      makeEvent('graph_drafted', { node_count: 2, edge_count: 1 }, { seq: 3 }),
      makeEvent('scenario_created', {}, { seq: 1 }),
      makeEvent('framing_confirmed', { goal: 'X' }, { seq: 2 }),
    ]
    const entries = renderTimeline(events)
    expect(entries[0].headline).toBe('Scenario created')
    expect(entries[1].headline).toBe('Decision framed: X')
    expect(entries[2].headline).toBe('Model created with 2 factors and 1 relationships')
  })
})

// ---------------------------------------------------------------------------
// Passive fields
// ---------------------------------------------------------------------------

describe('Passive fields', () => {
  it('sets relatedThreadEntryId from turn_id', () => {
    const events = [
      makeEvent('patch_accepted', { summary: 'Test' }, { turn_id: 'turn-abc-123' }),
    ]
    const entries = renderTimeline(events)
    expect(entries[0].relatedThreadEntryId).toBe('turn-abc-123')
  })

  it('does not set relatedThreadEntryId when turn_id is absent', () => {
    const events = [makeEvent('patch_accepted', { summary: 'Test' })]
    const entries = renderTimeline(events)
    expect(entries[0].relatedThreadEntryId).toBeUndefined()
  })
})
