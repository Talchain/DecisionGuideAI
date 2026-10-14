/**
 * renderTimelineSummary — produces a one-line summary of scenario activity.
 *
 * Template:
 * "Framing confirmed: [goal]. Graph drafted with [N] nodes, [M] edges.
 *  Analysis run, robustness [level].
 *  [N] patches accepted, [M] dismissed. Brief [generated/not generated]."
 *
 * Only includes sections where relevant events exist.
 * Returns "No activity yet." when events is empty.
 */

import type { ScenarioEvent } from '../../types/scenario'

export function renderTimelineSummary(events: ScenarioEvent[]): string {
  if (!events || events.length === 0) return 'No activity yet.'

  const parts: string[] = []

  // Framing
  const framing = events.find(e => e.event_type === 'framing_confirmed')
  if (framing) {
    const goal = typeof framing.details.goal === 'string' ? framing.details.goal : null
    parts.push(goal ? `Framing confirmed: ${goal}` : 'Framing confirmed')
  }

  // Graph drafted (use latest)
  const graphDrafted = [...events]
    .reverse()
    .find(e => e.event_type === 'graph_drafted')
  if (graphDrafted) {
    const nc = typeof graphDrafted.details.node_count === 'number'
      ? graphDrafted.details.node_count : 0
    const ec = typeof graphDrafted.details.edge_count === 'number'
      ? graphDrafted.details.edge_count : 0
    parts.push(`Graph drafted with ${nc} nodes, ${ec} edges`)
  }

  // Analysis (use latest)
  const analysisRun = [...events]
    .reverse()
    .find(e => e.event_type === 'analysis_run')
  if (analysisRun) {
    // #2747 re-scope 2 (DL ruling (A)): no win-share readout in C. The leader name and its "supported at N%"
    // share are not read: CEE serves no wording or Run licence for a share, and `winner` / `probability`
    // have no current writer (renderTimeline.ts, ROADMAP 1.239). Restore trigger: a CEE-served share string
    // with its own Run licence (post-C), never worded as a chance. The run fact and robustness grade stay.
    const robust = typeof analysisRun.details.robustness === 'string'
      ? analysisRun.details.robustness : null
    parts.push(robust ? `Analysis run, robustness ${robust}` : 'Analysis run')
  }

  // Patches
  const accepted = events.filter(e => e.event_type === 'patch_accepted').length
  const dismissed = events.filter(e => e.event_type === 'patch_dismissed').length
  if (accepted > 0 || dismissed > 0) {
    const patchParts: string[] = []
    if (accepted > 0) patchParts.push(`${accepted} patches accepted`)
    if (dismissed > 0) patchParts.push(`${dismissed} dismissed`)
    parts.push(patchParts.join(', '))
  }

  // Brief
  const hasBrief = events.some(e => e.event_type === 'brief_generated')
  parts.push(`Brief ${hasBrief ? 'generated' : 'not generated'}`)

  return parts.join('. ') + '.'
}
