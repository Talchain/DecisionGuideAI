// Shared helpers used by every scenario.

import { runTurn, sleep } from '../harness.mjs'
import { buildExplicitGenerate, buildConversation } from '../builders.mjs'
import { buildCeeGraphState } from '../state.mjs'
import {
  hasGraphPatchBlock,
  isStructuralPatch,
  graphValidityPass,
  orphanedNewNodes,
} from '../assertions.mjs'

export const HARD_FAIL_ACTION_LANGUAGE = ['s1-add-option', 's2-fix-connection', 's3-update-factor']

export function buildTurnBase(ctx) {
  return {
    scenario_id: ctx.scenarioId,
    conversation_history: ctx.history,
    session_state: ctx.sessionState,
    graph_state: buildCeeGraphState(ctx.graph),
  }
}

// T1 draft — common to every scenario. Validates the draft produced a
// structural graph and did not leave orphaned nodes. Returns { log, ok }.
export async function draftTurn({ ctx, scenarioName, brief, mode }) {
  const spec = {
    message: brief,
    turn_type: 'explicit_generate',
    build: (c) => buildExplicitGenerate({
      ...buildTurnBase(c),
      message: brief,
    }),
  }
  const res = await runTurn({ ctx, spec, scenarioName, mode })
  const failures = []

  if (res.transportError) {
    // Harness already logged the transport failure.
    return { log: res.log, ok: false, failures: res.log.failures }
  }

  const envelope = res.envelope
  const blocks = envelope?.blocks ?? []
  if (!hasGraphPatchBlock(blocks)) failures.push('draft_missing_graph_patch')
  if (!isStructuralPatch(res.ops)) failures.push('draft_not_structural')
  if (!graphValidityPass(ctx.graph)) failures.push('draft_graph_validity_fail')

  // Require ≥1 goal, ≥2 options, ≥1 factor.
  const nodesByKind = groupByKind(ctx.graph.nodes)
  if ((nodesByKind.goal ?? 0) < 1) failures.push('draft_missing_goal')
  if ((nodesByKind.option ?? 0) < 2) failures.push('draft_needs_at_least_two_options')
  if ((nodesByKind.factor ?? 0) < 1) failures.push('draft_needs_at_least_one_factor')

  // Orphaned-new-node check across all new nodes from this draft.
  const orphaned = res.log.flags.orphaned_new_nodes
  if (orphaned.length > 0) failures.push(`draft_orphaned_nodes:${orphaned.join(',')}`)

  // Hard fail action-language on mutating scenarios.
  if (HARD_FAIL_ACTION_LANGUAGE.includes(scenarioName) && res.log.flags.action_language_without_block) {
    failures.push('action_language_without_block')
  }

  if (failures.length > 0) {
    res.log.pass = false
    res.log.failures.push(...failures)
  }

  return { log: res.log, ok: failures.length === 0, failures, res }
}

export function groupByKind(nodes) {
  const out = {}
  for (const n of nodes ?? []) {
    const k = n.kind ?? n.data?.kind ?? n.data?.type ?? 'unknown'
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

// Convenience for building a conversation (non-draft) turn in a scenario spec.
export function buildFollowup(ctx, message, extras = {}) {
  return buildConversation({
    ...buildTurnBase(ctx),
    message,
    ...extras,
  })
}

// Enforce the mutation-scenario hard rule after a turn.
export function enforceHardMutationChecks(log, failures) {
  if (log.flags.action_language_without_block) failures.push('action_language_without_block')
  if (log.flags.orphaned_new_nodes.length > 0) {
    failures.push(`orphaned_new_nodes:${log.flags.orphaned_new_nodes.join(',')}`)
  }
  if (!log.flags.graph_validity_pass) failures.push('graph_validity_fail')
}

export { runTurn, sleep }
