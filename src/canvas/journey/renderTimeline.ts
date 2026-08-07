/**
 * renderTimeline — pure function that transforms ScenarioEvent[] into TimelineEntry[].
 *
 * Deterministic: same input always produces same output. No side effects.
 */

import type { ScenarioEvent, ScenarioEventType, ScenarioStage } from '../../types/scenario'
import { SYSTEM_MARKER_EVENT_TYPES } from '../../types/scenario'
import type { TimelineEntry, TimelineIconKey, TimelineColourClass } from './types'

// ---------------------------------------------------------------------------
// Icon + colour + source lookup
// ---------------------------------------------------------------------------

interface EventMeta {
  icon: TimelineIconKey
  colour: TimelineColourClass
  source: 'user' | 'ai' | 'system'
}

const EVENT_META: Record<string, EventMeta> = {
  scenario_created:    { icon: 'Activity',       colour: 'text-text-light', source: 'system' },
  framing_confirmed:   { icon: 'Target',         colour: 'text-info',       source: 'system' },
  stage_changed:       { icon: 'ArrowRight',     colour: 'text-info',       source: 'system' },
  graph_drafted:       { icon: 'GitBranch',      colour: 'text-info',       source: 'ai' },
  patch_accepted:      { icon: 'Check',          colour: 'text-success',    source: 'user' },
  patch_dismissed:     { icon: 'X',              colour: 'text-text-light', source: 'user' },
  patch_rejected:      { icon: 'AlertTriangle',  colour: 'text-danger',     source: 'system' },
  direct_edit:         { icon: 'Pencil',         colour: 'text-text-body',  source: 'user' },
  analysis_run:        { icon: 'BarChart3',      colour: 'text-success',    source: 'ai' },
  analysis_failed:     { icon: 'AlertTriangle',  colour: 'text-danger',     source: 'system' },
  brief_generated:     { icon: 'FileText',       colour: 'text-success',    source: 'system' },
  brief_shared:        { icon: 'Share2',         colour: 'text-info',       source: 'system' },
  confidence_pre:      { icon: 'Gauge',          colour: 'text-info',       source: 'system' },
  confidence_post:     { icon: 'Gauge',          colour: 'text-info',       source: 'system' },
  evidence_intent:     { icon: 'Activity',       colour: 'text-text-light', source: 'system' },
  changed_thinking:    { icon: 'Activity',       colour: 'text-text-light', source: 'system' },
  feedback_submitted:  { icon: 'Activity',       colour: 'text-text-light', source: 'system' },
}

const DEFAULT_META: EventMeta = { icon: 'Activity', colour: 'text-text-light', source: 'system' }

// ---------------------------------------------------------------------------
// Headline templates
// ---------------------------------------------------------------------------

/** Safely read a string from details, returning fallback if absent/non-string */
function str(details: Record<string, unknown>, key: string, fallback = ''): string {
  const v = details[key]
  return typeof v === 'string' ? v : fallback
}

/** Safely read a number from details */
function num(details: Record<string, unknown>, key: string, fallback = 0): number {
  const v = details[key]
  return typeof v === 'number' ? v : fallback
}

/** Safely read an array length from details */
function arrLen(details: Record<string, unknown>, key: string): number {
  const v = details[key]
  return Array.isArray(v) ? v.length : 0
}

/** Humanise change_type for direct_edit events */
function humaniseChangeType(changeType: string): string {
  switch (changeType) {
    case 'add_node': return 'added a factor'
    case 'remove_node': return 'removed a factor'
    case 'update_node': return 'updated'
    case 'add_edge': return 'connected'
    case 'remove_edge': return 'disconnected'
    case 'update_edge': return 'adjusted a relationship'
    default: return changeType.replace(/_/g, ' ')
  }
}

/** Sentence-case fallback: "framing_confirmed" -> "Framing confirmed" */
function sentenceCase(eventType: string): string {
  const words = eventType.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

type HeadlineBuilder = (d: Record<string, unknown>) => string

const HEADLINE_BUILDERS: Partial<Record<ScenarioEventType, HeadlineBuilder>> = {
  scenario_created: () => 'Scenario created',
  framing_confirmed: (d) => {
    const goal = str(d, 'goal')
    return goal ? `Decision framed: ${goal}` : sentenceCase('framing_confirmed')
  },
  stage_changed: (d) => {
    const to = str(d, 'to')
    return to ? `Moved to ${to} stage` : sentenceCase('stage_changed')
  },
  graph_drafted: (d) => {
    const nc = num(d, 'node_count')
    const ec = num(d, 'edge_count')
    return nc || ec
      ? `Model created with ${nc} factors and ${ec} relationships`
      : sentenceCase('graph_drafted')
  },
  patch_accepted: (d) => str(d, 'summary') || sentenceCase('patch_accepted'),
  patch_dismissed: (d) => {
    const summary = str(d, 'summary')
    return summary ? `Suggestion dismissed: ${summary}` : sentenceCase('patch_dismissed')
  },
  patch_rejected: (d) => {
    const message = str(d, 'message')
    return message ? `Suggestion rejected: ${message}` : sentenceCase('patch_rejected')
  },
  direct_edit: (d) => {
    const changeType = str(d, 'change_type')
    const label = str(d, 'target_label') || str(d, 'target_id')
    const verb = changeType ? humaniseChangeType(changeType) : 'edited'
    return label ? `You ${verb} ${label}` : `You ${verb}`
  },
  /**
   * ROADMAP 1.239 — the leader clause is DELETED, not gated.
   *
   * This line used to read "Analysis complete - {winner} performs best at N%"
   * off `details.winner` / `details.probability`, with no reference to the
   * verdict. Two independent findings retired it:
   *
   * 1. NO WRITER. Complete manifest for `analysis_run` event details, derived
   *    at UI ae77248a across all of src/ excluding tests (`appendEvent(`,
   *    `storeAnalysis(`, `persistAnalysisSuccess`) plus the RPC itself:
   *      · canvas/hooks/useV2Run.ts        → { option_count, analysis_status }
   *      · canvas/conversation/useConversation.ts
   *                                        → { option_count, analysis_status, source }
   *      · store_analysis_and_log          → passes p_details through unchanged
   *    Every other `appendEvent` caller writes `direct_edit`. `winner`,
   *    `probability` and `robustness` have no writer.
   * 2. LIVE CORROBORATION. The render probe scored this surface SILENT on both
   *    PERMITTED runs — runs where a leader existed and every other leader
   *    surface fired. A surface silent on the runs that entitle it is not
   *    gated, it is unreachable.
   *
   * Claim type, precisely: no CURRENT WRITER. Rows persisted by earlier builds
   * are outside what this repo can prove, which is the argument for changing
   * the READER rather than leaving it and trusting the writers.
   *
   * A gate was not the alternative. This function receives one event's
   * details — no report, no `DecisionVerdict`, nothing to establish
   * entitlement from. A gate on a key with no writer would be dead code that
   * reads as a guarantee.
   *
   * The lifecycle FACT and the run-level robustness grade are not comparative
   * and stay. The old null-probability guard goes with the clause it guarded;
   * its contract ("a run that happened but produced no probability must not
   * read as a clean success") is restated, and strengthened to hold for every
   * probability, in residualComparative.analysisRunEvent.spec.ts.
   */
  analysis_run: (d) => {
    const robust = str(d, 'robustness')
    return robust ? `Analysis complete (${robust})` : sentenceCase('analysis_run')
  },
  analysis_failed: (d) => {
    const msg = str(d, 'message')
    return msg ? `Analysis failed: ${msg}` : sentenceCase('analysis_failed')
  },
  brief_generated: () => 'Decision brief generated',
  brief_shared: () => 'Brief shared',
  confidence_pre: (d) => {
    const score = num(d, 'score')
    return score ? `Pre-decision confidence: ${score}/5` : sentenceCase('confidence_pre')
  },
  confidence_post: (d) => {
    const score = num(d, 'score')
    return score ? `Post-decision confidence: ${score}/5` : sentenceCase('confidence_post')
  },
  evidence_intent: (d) => {
    const count = arrLen(d, 'selected_factors')
    return `Evidence plan: ${count} factors selected`
  },
  changed_thinking: (d) => {
    const response = str(d, 'response')
    return response ? `Reflection: ${response}` : sentenceCase('changed_thinking')
  },
  feedback_submitted: () => 'Feedback submitted',
}

// ---------------------------------------------------------------------------
// Main transform
// ---------------------------------------------------------------------------

/**
 * Transform raw scenario events into renderable timeline entries.
 *
 * - Sorts by `seq` ascending
 * - Tracks current stage via `stage_changed` events (default: 'frame')
 * - `stage_changed` events are assigned to the destination stage (details.to)
 */
export function renderTimeline(events: ScenarioEvent[]): TimelineEntry[] {
  if (!events || events.length === 0) return []

  const sorted = [...events].sort((a, b) => a.seq - b.seq)
  let currentStage: ScenarioStage = 'frame'
  const entries: TimelineEntry[] = []

  for (const event of sorted) {
    // For stage_changed, update current stage BEFORE assigning
    // so the event belongs to the destination stage
    if (event.event_type === 'stage_changed') {
      const to = str(event.details, 'to') as ScenarioStage
      if (to) currentStage = to
    }

    // Skip system persistence markers (e.g. graph_saved autosave events),
    // derived from the shared source of truth in types/scenario.
    // Placed AFTER the stage-tracking update so a hidden event still cannot
    // desync the running stage (defensive — markers never carry a stage).
    if (SYSTEM_MARKER_EVENT_TYPES.has(event.event_type)) continue

    const meta = EVENT_META[event.event_type] ?? DEFAULT_META
    const buildHeadline = HEADLINE_BUILDERS[event.event_type]
    const headline = buildHeadline
      ? buildHeadline(event.details)
      : sentenceCase(event.event_type)

    const entry: TimelineEntry = {
      id: event.event_id,
      stage: currentStage,
      timestamp: event.timestamp,
      icon: meta.icon,
      colour: meta.colour,
      headline,
      source: meta.source,
    }

    // Passive fields for Track 1
    if (event.turn_id) {
      entry.relatedThreadEntryId = event.turn_id
    }

    const targetId = str(event.details, 'target_id')
    if (targetId) {
      entry.relatedNodeIds = [targetId]
    }

    entries.push(entry)
  }

  return entries
}
