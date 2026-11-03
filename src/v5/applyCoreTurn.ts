/**
 * ⭐ THE CORE TURN'S OWN APPLIER (U4; ALPHA-CODE-INVENTORY §1 U4, finding 2). A core-route turn (`CoreTurn`, the one
 * contract `coreTurnContract.ts` reads) writes only what it carries:
 *   · the note it points at: its first note on a card, held beside that card (as `applyV5State` did with the highlight
 *     directive the translator made of it: one per turn, fail-closed on a card not on the canvas);
 *   · the saved model's revision, and the shared saved-graph view reads again;
 *   · the analysis verdict as CEE sent it (`analysis_state`, null when absent or malformed).
 * It never runs the legacy V2-envelope steps `applyV5State` ran on every core turn: the stage, method pointing, graph
 * patches, enrichment, the refusal reader, `analysis_ready`, results hydration, the premortem and the leader claim on the
 * legacy report. A core turn feeds none of them.
 */
import { AnalysisStateV1Schema, type AnalysisStateV1 } from '@talchain/schemas/boundary'
import type { Node } from '@xyflow/react'
import { requestOlumiAttention } from '../canvas/utils/olumiAttention'
import { bumpSavedGraphEpoch } from '../canvas/nodes/shared/savedGraphEpoch'
import { ADDITIVE_EXTENSIONS_KEY } from './responseParser'
import type { CoreTurn } from './coreTurnContract'
import type { ApplyV5StateOptions, ApplyV5StateResult } from './applyV5State'

/** The core turn the parser kept beside the answer (`coreTurnResponse`), or null for any other answer. */
export function readCoreTurn(response: unknown): CoreTurn | null {
  if (response === null || typeof response !== 'object') return null
  const sidecar = (response as Record<string, unknown>)[ADDITIVE_EXTENSIONS_KEY] as { _core_turn?: unknown } | undefined
  return (sidecar?._core_turn as CoreTurn | undefined) ?? null
}

export interface CoreTurnApplicatorStore {
  nodes: Node[]
  setLastServerGraphHash?: (hash: string) => void
  setAnalysisStateV1?: (state: AnalysisStateV1 | null) => void
}

/** The card kinds a note sits beside (CEE `NOTE_NODE_KINDS`); the question itself is never a card to note. */
const NOTE_KINDS = new Set(['factor', 'option', 'goal', 'risk', 'constraint', 'outcome'])

export function applyCoreTurnState(turn: CoreTurn, store: CoreTurnApplicatorStore, options?: ApplyV5StateOptions): ApplyV5StateResult {
  const applied: string[] = []
  const deferred: ApplyV5StateResult['deferred'] = []
  // An older answer arriving after a newer turn was sent writes nothing.
  if (options?.turnClientId && options.currentClientTurnId && options.turnClientId !== options.currentClientTurnId) {
    deferred.push({ reason: 'stale_turn_all_writes_skipped', detail: `incoming=${options.turnClientId} active=${options.currentClientTurnId}` })
    return { applied, deferred }
  }

  const revision = turn.model?.revision ?? null
  // The note: the first one on a card of the saved model, held beside that card while it is on the canvas.
  const graphNodes = (Array.isArray(turn.model?.graph?.nodes) ? turn.model.graph.nodes : []) as Array<{ id?: unknown; kind?: unknown; label?: unknown }>
  const note = turn.notes.find((n) => graphNodes.some((g) => g.id === n.element_id && typeof g.label === 'string' && g.label.length > 0
    && typeof g.kind === 'string' && NOTE_KINDS.has(g.kind)))
  if (note !== undefined) {
    if (store.nodes.some((n) => n.id === note.element_id)) {
      requestOlumiAttention({ nodeIds: [note.element_id], edgeIds: [], note: { body: note.text.trim() }, ...(revision ? { modelVersion: revision } : {}) })
      applied.push(`note:${note.element_id}`)
    } else {
      deferred.push({ reason: 'ui_directive_target_not_found', detail: note.element_id })
    }
  }

  if (revision) {
    store.setLastServerGraphHash?.(revision)
    applied.push('graph_hash:captured')
    // The living model may have moved under an unchanged analysis hash: the shared saved-graph view reads again.
    bumpSavedGraphEpoch()
  }

  const verdict = turn.analysis_state == null ? null : AnalysisStateV1Schema.safeParse(turn.analysis_state)
  store.setAnalysisStateV1?.(verdict?.success ? verdict.data : null)
  applied.push(verdict?.success ? 'analysis_state:set' : 'analysis_state:cleared')
  return { applied, deferred }
}
