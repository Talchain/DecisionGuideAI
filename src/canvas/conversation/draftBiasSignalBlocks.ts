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
import { BIAS_SIGNAL_TITLES } from '../shared/biasSignalTitles'

/** Ratified cap: at most two bias-signal cards per draft turn. */
export const DRAFT_BIAS_SIGNAL_CARD_CAP = 2

/**
 * Humanised titles for the known CEE bias codes — re-exported from the ONE
 * canonical map (src/canvas/shared/biasSignalTitles.ts) that the
 * pre-analysis surface also derives from, so one bias renders one name on
 * every surface by construction (#356 fast-follow: was a hand-maintained
 * mirror of PreAnalysisPanel's BIAS_TYPE_ICON titles). Keys are lowercase;
 * lookup is case-insensitive to cover both wire conventions (lowercase
 * `type`, uppercase `code`). Unknown codes are NOT sentence-cased — they
 * fail closed (no card), so a raw wire token can never leak into copy.
 */
export { BIAS_SIGNAL_TITLES }

/** Allowlist lookup. Returns null for unknown / non-string codes (fail closed). */
export function humaniseBiasSignalCode(code: unknown): string | null {
  if (typeof code !== 'string') return null
  const key = code.trim().toLowerCase()
  if (!key) return null
  // Own-key guard: a bare object-literal index walks the prototype chain,
  // so the hostile wire codes '__proto__' (returns Object.prototype, a
  // truthy object React refuses to render, crashing the assistant-message
  // subtree) and 'constructor' (returns a Function) would escape both the
  // `?? null` here and the caller's `if (!title)` check. Only own keys are
  // titles; everything else fails closed like any other unknown code.
  return Object.prototype.hasOwnProperty.call(BIAS_SIGNAL_TITLES, key)
    ? BIAS_SIGNAL_TITLES[key]
    : null
}

/** The minimal canvas-store surface the builder reads. */
export interface DraftBiasSignalStoreSlice {
  draftCoaching: Pick<CEEDraftCoaching, 'biasSignals'> | null
  nodes: Array<{ id: string; type?: string; data?: unknown }>
}

/** Resolve a node id to a non-blank label, or null (fail closed). */
function resolveNodeForTarget(
  target: unknown,
  nodes: DraftBiasSignalStoreSlice['nodes'],
): { id: string; label: string; kind: string } | null {
  if (typeof target !== 'string') return null
  const id = target.trim()
  if (!id) return null
  const node = nodes.find((n) => n.id === id)
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

  const producerHasBiasCoaching = existingBlocks.some(
    (b) => b.type === 'v5_coaching' && b.coaching_kind === 'bias_signal',
  )
  if (producerHasBiasCoaching) return []

  const signals = store.draftCoaching?.biasSignals
  if (!Array.isArray(signals) || signals.length === 0) return []

  const out: V5CoachingBlock[] = []
  for (let i = 0; i < signals.length && out.length < DRAFT_BIAS_SIGNAL_CARD_CAP; i++) {
    const signal = signals[i] as unknown
    if (!signal || typeof signal !== 'object') continue
    const s = signal as Record<string, unknown>

    const title = humaniseBiasSignalCode(s.type)
    if (!title) continue

    const detail = typeof s.detail === 'string' ? s.detail.trim() : ''
    if (!detail) continue

    const ref = resolveNodeForTarget(s.target, store.nodes)
    if (!ref) continue

    out.push({
      type: 'v5_coaching',
      block_id: `draft_bias_signal_${i}`,
      title,
      body: detail,
      coaching_kind: 'bias_signal',
      source: 'draft_graph',
      target_refs: [ref],
      priority_rank: out.length + 1,
      freshness: 'fresh',
    })
  }
  return out
}
