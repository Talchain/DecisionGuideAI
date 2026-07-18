/**
 * draftBiasSignalBlocks — leg 3 of the bias-coaching design
 * (BIAS-COACHING-PROPOSAL-2026-07-16 §2, FRAME beat): bridge the draft
 * response's `coaching.bias_signals` into typed `v5_coaching` conversation
 * blocks with `coaching_kind: 'bias_signal'` — the value the 0.15.0
 * boundary schema already types on its coaching-block enum
 * (@talchain/schemas boundary/blocks CoachingBlockSchema). Building on
 * that typed path means that when CEE starts emitting real boundary
 * coaching blocks for bias signals, the same conversation block type and
 * the same renderer carry them with no UI change — and this bridge steps
 * aside (see the producer-wins rule below).
 *
 * Gate shape mirrors maybeBuildModelReceiptBlock (modelCardAdapter §8):
 * pure, store-reading, called on the V5 turn that applied a fresh draft
 * graph, after applyDraftResult has committed `draftCoaching` to the
 * canvas store synchronously.
 *
 * Fail-closed, per entry (ratified cards-cap 2):
 *   - not a draft turn / absent coaching / empty array → []
 *   - malformed entry (non-object, blank/non-string type or detail) → skipped
 *   - unknown bias code (not on the allowlist) → skipped — the code is
 *     wire vocabulary, never visible copy, so an unmapped code has no
 *     honest rendering (mirrors, and tightens, the PreAnalysisPanel
 *     convention: no safeBiasTitle sentence-casing here)
 *   - ungrounded (missing / unresolvable / blank-label target) → skipped —
 *     same resolvable-target rule as PreAnalysisPanel Brief 5.8A D2
 *   - producer-typed bias coaching already on the turn → [] (producer wins)
 *
 * Copy: title is the humanised bias name (same canonical names as the
 * pre-analysis surface, one bias one name everywhere); body is the
 * producer's `detail` verbatim; the grounded reference rides as a
 * target_ref resolved against the live graph.
 */
import type { CEEDraftCoaching } from '../../adapters/cee/types'
import type { ConversationBlock, V5CoachingBlock } from './types'
import { DRAFT_BIAS_SIGNAL_CARD_CAP } from './types'
import { isBiasSignalCoachingBlock } from './phase3Pacing'
import { resolveBiasSignal } from '../shared/biasSignalTitles'

// The cap's one definition lives with the other render budgets in ./types
// (/simplify item 5) — the render layer consumes it too. Re-exported here
// because this bridge is where it is enforced on the producing side.
export { DRAFT_BIAS_SIGNAL_CARD_CAP }

/** The minimal canvas-store surface the builder reads. */
export interface DraftBiasSignalStoreSlice {
  draftCoaching: Pick<CEEDraftCoaching, 'biasSignals'> | null
  nodes: Array<{ id: string; type?: string; data?: unknown }>
}

/** Resolve a node id to a non-blank label, or null (fail closed). */
function resolveNodeForTarget(
  target: unknown,
  nodesById: ReadonlyMap<string, DraftBiasSignalStoreSlice['nodes'][number]>,
): { id: string; label: string; kind: string } | null {
  if (typeof target !== 'string') return null
  const id = target.trim()
  if (!id) return null
  const node = nodesById.get(id)
  if (!node) return null
  const label = (node.data as Record<string, unknown> | undefined)?.label
  if (typeof label !== 'string' || !label.trim()) return null
  const kind = typeof node.type === 'string' && node.type.trim() ? node.type : 'node'
  return { id, label: label.trim(), kind }
}

/**
 * Build ≤2 typed bias-signal coaching blocks for the post-draft assistant
 * message, or [] when there is nothing honest to show.
 */
export function buildDraftBiasSignalBlocks(args: {
  /** True only on the turn that applied a fresh draft graph. */
  isDraftTurn: boolean
  store: DraftBiasSignalStoreSlice
  /**
   * Blocks already composed for this turn. When the producer sent real
   * typed bias coaching (v5_coaching with coaching_kind 'bias_signal'),
   * this bridge yields nothing — producer blocks win, never doubled cards.
   */
  existingBlocks?: readonly ConversationBlock[]
}): V5CoachingBlock[] {
  const { isDraftTurn, store, existingBlocks = [] } = args
  if (!isDraftTurn) return []

  if (existingBlocks.some(isBiasSignalCoachingBlock)) return []

  const signals = store.draftCoaching?.biasSignals
  if (!Array.isArray(signals) || signals.length === 0) return []

  const out: V5CoachingBlock[] = []
  // One lookup map for the whole signal loop (was a nodes.find per signal).
  const nodesById = new Map(store.nodes.map((n) => [n.id, n]))
  // UI-SEM-083 (#356 fast-follow): alias-equivalence dedupe — identical
  // (bias, target) signals collapse BEFORE the cap, so a producer duplicate
  // can never displace a distinct third signal. Identity is the canonical
  // humanised title (alias codes like anchoring/anchoring_bias are the same
  // bias — one bias, one name) plus the resolved target node id. First
  // occurrence wins. Display-side equivalence judgement, never a value
  // transform.
  const seen = new Set<string>()
  for (let i = 0; i < signals.length && out.length < DRAFT_BIAS_SIGNAL_CARD_CAP; i++) {
    const signal = signals[i] as unknown
    if (!signal || typeof signal !== 'object') continue
    const s = signal as Record<string, unknown>

    // Allowlist lookup through the ONE bias registry — the
    // trim/lowercase/own-key guard lives there, shared with every other
    // surface. Unknown / non-string codes fail closed (never
    // sentence-cased), so a raw wire token can never leak into copy.
    const title = resolveBiasSignal(s.type)?.title ?? null
    if (!title) continue

    const detail = typeof s.detail === 'string' ? s.detail.trim() : ''
    if (!detail) continue

    const ref = resolveNodeForTarget(s.target, nodesById)
    if (!ref) continue

    const identity = `${title}|${ref.id}`
    if (seen.has(identity)) continue
    seen.add(identity)

    // No priority_rank / freshness: those are PRODUCER-owned Phase 3 fields
    // and the wire bias_signals carry neither — fabricating them here
    // ("rank = arrival order", "freshness = fresh") was invention, not
    // passthrough. Verified zero consumers: the bridge blocks are appended
    // AFTER composePhase3BridgedBlocks' rank sort, and the only runtime
    // read was the renderer's data-freshness attribute (now simply absent).
    out.push({
      type: 'v5_coaching',
      block_id: `draft_bias_signal_${i}`,
      title,
      body: detail,
      coaching_kind: 'bias_signal',
      source: 'draft_graph',
      target_refs: [ref],
    })
  }
  return out
}
