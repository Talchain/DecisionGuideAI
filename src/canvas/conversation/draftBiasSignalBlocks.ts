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
 *   - entity-id-shaped code (`fac_…`, `opt_…`) → skipped — a node reference
 *     in the category slot is a producer field error, not a category
 *   - unrecognised but well-formed code → the OBSERVATION IS KEPT under a
 *     neutral heading that names no bias. The code itself is still never
 *     rendered: it is wire vocabulary and has no honest sentence-cased form
 *     (no safeBiasTitle here). This is the PreAnalysisPanel convention, which
 *     has always fallen through to a generic heading rather than discarding
 *     the entry — the bridge was the outlier, and dropping the producer's
 *     paragraph with its unknown label inverted the feature: the less standard
 *     the insight, the likelier it was binned
 *   - producer-typed bias coaching already on the turn → [] (producer wins)
 *
 * Grounding is OPTIONAL (mirrors CEE #541). The canonical deployed wire
 * schema is `BiasSignalSchema = z.object({ type, detail }).strict()`
 * (@talchain/schemas) — real signals carry ONLY `{ type, detail }` and NEVER
 * a `target`, so the old `if (!ref) continue` skipped every real signal and
 * the fallback emitted zero cards. A known-type, non-blank-detail signal now
 * emits whether or not it names a resolvable node: when a `target` IS present
 * and resolves it rides as a target_ref, otherwise the card is ungrounded
 * (`target_refs: []`). The renderer already guards its ref pills on
 * `target_refs.length > 0` (V5CoachingBlock.tsx), so an empty list renders no
 * pills.
 *
 * Copy: title is the humanised bias name (same canonical names as the
 * pre-analysis surface, one bias one name everywhere); body is the
 * producer's `detail` verbatim; the reference, when resolvable, rides as a
 * target_ref resolved against the live graph.
 */
import type { CEEDraftCoaching } from '../../adapters/cee/types'
import type { ConversationBlock, V5CoachingBlock } from './types'
import { DRAFT_BIAS_SIGNAL_CARD_CAP } from './types'
import { isBiasSignalCoachingBlock } from './phase3Pacing'
import {
  resolveBiasSignal,
  isRescuableBiasCode,
  UNRECOGNISED_BIAS_SIGNAL_TITLE,
} from '../shared/biasSignalTitles'

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
  // UI-SEM-083 (#356 fast-follow; CEE #541 parity): alias-equivalence dedupe —
  // equivalent signals collapse BEFORE the cap, so a producer duplicate can
  // never displace a distinct third signal. Identity is the canonical humanised
  // TITLE only (alias codes like anchoring/anchoring_bias are the same bias —
  // one bias, one name): the same bias is one card regardless of which node(s)
  // it names. Grounding is no longer part of the identity — now that most
  // signals are ungrounded, keying on the target id would let every ungrounded
  // same-bias signal through (their id fragment being identically empty). First
  // occurrence wins. Display-side equivalence judgement, never a value transform.
  //
  // ⭐⭐ AND KEEPING THE OBSERVATION ONCE MUST NOT ERASE ITS SCOPE — the
  // blocking correction from review, and the one my first two pushes missed
  // while I chased CI.
  //
  // Every unrecognised signal shares one heading, so identity carries the
  // detail. Two signals with the SAME paragraph on DIFFERENT nodes are one
  // observation with two affected nodes — not a duplicate to drop. The old
  // `continue` kept the paragraph and silently discarded the second
  // `target_ref`: the same "Evidence for this estimate is missing" note on
  // option A and option B rendered as A alone.
  //
  // ⚠ SO THE LOOP NO LONGER STOPS AT THE CAP, and that is the substance of the
  // fix rather than a tidy-up. `out.length < CAP` in the loop condition meant
  // scanning ENDED once two cards existed, so a later duplicate carrying a
  // third node was never read. The cap is a limit on CARDS DISPLAYED, not on
  // signals examined; it now guards the push alone.
  //
  // ⛔ MERGING IS FOR UNRECOGNISED OBSERVATIONS ONLY. Recognised-code policy is
  // deliberately unchanged here: `dedupes on canonical bias identity` and `the
  // same bias on DIFFERENT targets dedupes to ONE card (title-only identity)`
  // are ratified, and a repair to the unknown path has no business rewriting
  // them.
  const kept = new Map<string, V5CoachingBlock>()
  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i] as unknown
    if (!signal || typeof signal !== 'object') continue
    const s = signal as Record<string, unknown>

    // Allowlist lookup through the ONE bias registry — the
    // trim/lowercase/own-key guard lives there, shared with every other
    // surface. Unknown / non-string codes fail closed (never
    // sentence-cased), so a raw wire token can never leak into copy.
    // ⚠⚠ AN UNRECOGNISED CODE NO LONGER DISCARDS THE OBSERVATION.
    //
    // This read `?? null` then `if (!title) continue`, which dropped the WHOLE
    // signal — `detail` included. The note above is still right that a raw wire
    // token must never leak into copy as a bias NAME; it does not follow that
    // the producer's paragraph should be thrown away with it. The shipped
    // `build-vs-buy` starter carries `"type": "omission / status-quo bias"` —
    // free text, no key — and a real observation nobody has ever seen.
    //
    // So the NAME still fails closed, and the CONTENT survives under a heading
    // that names no bias at all.
    // ⚠⚠ AND THE RESCUE IS NARROWER THAN MY FIRST VERSION MADE IT. That
    // version treated EVERY resolver miss as "a category we have no key for"
    // — so `type: ''`, `type: 42` and `type: 'fac_current_supplier'` all
    // minted cards, and three ratified fail-closed guards went red. They were
    // right and the change was wrong: the resolver answers ONE question ("is
    // this a code I hold?") and I read its miss as the answer to a different
    // one ("is this an unrecognised category?"). Three cases sit between them.
    //
    //   ABSENT / NON-STRING — `''`, `42`, a missing key. Not an unrecognised
    //   category; no category at all. The wire schema types `type` as a
    //   required string, so the entry violates its own contract and nothing
    //   in it can be trusted to be a bias observation.
    //
    //   ENTITY-ID SHAPED — `fac_current_supplier`. A NODE REFERENCE in the
    //   category slot: the producer populated the wrong field. Malformed in
    //   the same way `42` is, just typed as a string. Told apart by the
    //   producer's own id convention, not by a shape rule invented here.
    //
    //   FREE TEXT NAMING A CATEGORY — `'omission / status-quo bias'`. THIS,
    //   and only this, is the case the rescue is for.
    //
    // Well-formedness first, then recognition. A faulted entry fails closed
    // exactly as it always did; an entry that is sound but uncategorised
    // keeps its observation.
    const resolved = resolveBiasSignal(s.type)
    // Ordered so the REGISTRY ALWAYS WINS: a code it holds is a category by
    // definition, so no future key can be shadowed by a guard in the rescue
    // path. `isRescuableBiasCode` is only consulted once the registry misses,
    // and it owns the whole "is this a category at all?" judgement — see its
    // note for the three fault classes and why each is refused.
    if (resolved == null && !isRescuableBiasCode(s.type)) continue
    const title = resolved?.title ?? UNRECOGNISED_BIAS_SIGNAL_TITLE

    const detail = typeof s.detail === 'string' ? s.detail.trim() : ''
    // Still fails closed on an EMPTY observation: a heading with nothing under
    // it is a card announcing only that something was withheld.
    if (!detail) continue

    // Grounding is OPTIONAL: resolve a ref when the (optional) target names a
    // live node, but a null ref no longer skips the signal — it emits
    // ungrounded (target_refs: [] below).
    const ref = resolveNodeForTarget(s.target, nodesById)

    // ⚠ THE DEDUP KEY MUST CARRY THE DETAIL FOR UNRECOGNISED SIGNALS. Keying on
    // the title alone is right for RESOLVED codes — two "Anchoring" cards say
    // the same thing — but every unrecognised signal now shares ONE heading, so
    // a title-only key would collapse genuinely different observations into
    // whichever arrived first. That would be a new way to lose exactly the
    // content this change exists to preserve.
    const identity = resolved ? title : `${title}::${detail}`
    const existing = kept.get(identity)
    if (existing) {
      // A repeat of an observation already kept. For an UNRECOGNISED one, fold
      // in any affected node it names that the retained card does not yet
      // carry — bound by node id, so the same node arriving twice adds nothing.
      if (!resolved && ref && !existing.target_refs.some((r) => r.id === ref.id)) {
        existing.target_refs.push(ref)
      }
      continue
    }
    // The cap gates the CARD, not the scan: a duplicate above may still be
    // merging refs into an already-kept observation after this point.
    if (out.length >= DRAFT_BIAS_SIGNAL_CARD_CAP) continue

    // No priority_rank / freshness: those are PRODUCER-owned Phase 3 fields
    // and the wire bias_signals carry neither — fabricating them here
    // ("rank = arrival order", "freshness = fresh") was invention, not
    // passthrough. Verified zero consumers: the bridge blocks are appended
    // AFTER composePhase3BridgedBlocks' rank sort, and the only runtime
    // read was the renderer's data-freshness attribute (now simply absent).
    const block: V5CoachingBlock = {
      type: 'v5_coaching',
      block_id: `draft_bias_signal_${i}`,
      title,
      body: detail,
      coaching_kind: 'bias_signal',
      source: 'draft_graph',
      target_refs: ref ? [ref] : [],
    }
    kept.set(identity, block)
    out.push(block)
  }
  return out
}
