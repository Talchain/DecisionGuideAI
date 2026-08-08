/**
 * extractPhase3FromV5Response — read Phase 3 coaching / review / evidence /
 * exercise content out of a V5 OlumiResponse without losing fidelity.
 *
 * CEE V5 Phase 3A may carry coaching content in one of four places:
 *   1. The additive sidecar attached by responseParser, at the sidecar
 *      root (conventional `phase3_blocks`, per-type arrays, or single
 *      `review_card`). Source: 'sidecar'.
 *   2. The same sidecar's `phase3_blocks_from_blocks_array` slot — Phase 3
 *      blocks the parser lifted out of `blocks[]` per the v1.3 contract,
 *      stashed there to keep `OlumiResponse.blocks` strict-schema-clean.
 *      Source: 'sidecar_blocks_array'.
 *   3. `analysis_ready` (declared as passthrough in the V5 schema).
 *      Source: 'analysis_ready'.
 *   4. The `analysis_result` block's `enrichment` record (passthrough).
 *      Source: 'enrichment'.
 *
 * This extractor harvests Phase 3 surfaces from all four and returns:
 *   - `rawBlocks`: the original block payloads, preserved verbatim so
 *     downstream consumers can keep `freshness`, `action_intent`,
 *     `priority_rank`, `target_refs`, `graph_hash_at_generation`, etc.
 *   - `guidanceItems`: derived shape compatible with the V4 GuidanceStore
 *     for legacy AI panel surfaces. Derivation is lossless (we keep the raw
 *     block alongside via rawBlocks), so consumers who want the full block
 *     read rawBlocks directly.
 *   - `analysisFreshness`: whatever CEE has marked on the run_analysis fact,
 *     when present.
 *   - `hasRunAnalysisFact`: explicit boolean from CEE when emitted; never
 *     inferred from generic readiness.
 *
 * Pure function. No store reads, no side effects.
 *
 * IMPORTANT — per v5-canonical-analysis brief correction 3:
 *   `analysis_ready` alone is NOT proof of a successful run_analysis fact.
 *   Callers must use `deriveV5AnalysisFactUpdate` (which composes the
 *   explicit `has_run_analysis_fact` flag with the analysis_result-block run
 *   signal — F10: "ran" and "current" are different questions) — never
 *   readiness alone, and never the freshness verdict.
 */
import type { OlumiResponse } from '@talchain/schemas/boundary'
import { DskClaimProvenanceSchema } from '@talchain/schemas/boundary'

import {
  ADDITIVE_EXTENSIONS_KEY,
  PHASE3_SIDECAR_BLOCKS_KEY,
  type OlumiResponseWithExtensions,
} from './responseParser'

// ─── Types ─────────────────────────────────────────────────────────────

export type Phase3BlockType = 'coaching' | 'review_card' | 'evidence' | 'exercise'

export type AnalysisFreshness = 'fresh' | 'stale' | 'unknown' | 'none'

/** A Phase 3 block preserved verbatim. The shape is intentionally loose: we
 * pass through whatever CEE emitted. Downstream consumers must validate any
 * specific fields they read (freshness, action_intent, priority_rank, etc.). */
export interface Phase3RawBlock {
  type: Phase3BlockType
  /** Verbatim block contents — no field flattening. */
  raw: Record<string, unknown>
  /** Stable id when CEE provided one; falls back to a derived id otherwise. */
  id: string
  /** Source location, useful for diagnostics. */
  source: 'sidecar' | 'analysis_ready' | 'enrichment' | 'sidecar_blocks_array'
}

/** Subset shape derived from a Phase 3 block for the legacy GuidanceItem
 * interface in guidanceStore.ts. Fields not present on the source block are
 * omitted — callers must tolerate undefined and read the raw block when they
 * need the full fidelity. */
export interface DerivedGuidanceItem {
  item_id: string
  /**
   * The producer's `signal_code` VERBATIM when emitted — an OPEN,
   * producer-owned SCREAMING_SNAKE vocabulary (MISSING_BASE_RATE,
   * PRE_MORTEM, …). Never allowlisted, never rendered as user copy (data-*
   * only). Absent when the producer sent none: the UI does NOT invent a code
   * from the block type ('coaching'/'review_card' are block classes, not
   * codes).
   */
  signal_code?: string
  /**
   * The producer's four-value `category` VERBATIM when emitted; absent when
   * the producer sent none. Passthrough — never defaulted to 'should_fix',
   * never synthesised from `severity`.
   */
  category?: 'must_fix' | 'should_fix' | 'could_fix' | 'technique'
  source: 'analysis' | 'structural' | 'prompt'
  title: string
  detail?: string
  /**
   * The producer's `action_label` VERBATIM when supplied; absent otherwise.
   * Passthrough — the UI never authors a CTA label of its own from it. Stage 1
   * carried the raw block but this derived field was missing, so every
   * downstream consumer (the Strengthen mapper) fell back to boilerplate.
   */
  actionLabel?: string
  /**
   * The producer's `signal` display line VERBATIM when supplied; absent
   * otherwise. Distinct from `signal_code` (a data-* code, never copy): this
   * IS user-facing producer copy, carried today only on the deterministic
   * stale-rerun nudge. Rendered verbatim where present, never synthesised.
   */
  signal?: string
  primary_action: { type: 'discuss'; prompt: string }
  target_object?: { type: 'node' | 'edge' | 'option' | 'graph' | 'framing'; id?: string; label?: string }
  related_elements?: Array<{ id?: string; type?: string; label?: string }>
  valid_while?: { analysis_hash?: string; graph_hash?: string }
  /**
   * COARSE 0-100 urgency, HIGHER = more urgent — the producer's 0.19.0
   * `priority` VERBATIM when emitted (band-granular, derived 1:1 from
   * `category` producer-side; ties are expected and normal), else the 50
   * fail-closed default. Budget/filter/style on it. It is NOT a display
   * order — order by `priorityRank` (the contract says so explicitly) — and
   * it is NEVER derived from `priority_rank` (an order is not a score; that
   * derivation was the UI-SEM-085 `100 - rank` defect).
   */
  priority: number
  /**
   * The producer's 0.19.0 `priority_rank` VERBATIM: an ASCENDING display
   * ordinal, LOWER = shown FIRST. Positive integers, UNBOUNDED — never
   * invert it against 100 (ranks >= 100 are routine; bands: 1-9 lifecycle,
   * 10-99 review cards, 100-199 coaching, 200+ prompts). Unique only WITHIN
   * a band: equal ranks are producer-order ties. PRESENCE of this field is
   * the "producer ranked this block" fact — absent means the producer sent
   * no ordering (pre-0.19.0 blocks, exercise blocks, malformed ranks) and
   * consumers fall closed to their unranked treatment.
   */
  priorityRank?: number
  /**
   * UI-SEM-085 disclosure carrier. True ONLY when the producer emitted
   * `priority` on the block; false when `priority` is the UI's 50 default.
   * Set at the single defaulting site in `deriveGuidance` — downstream
   * consumers MUST read this flag rather than re-deriving it (a second
   * derivation is a second invention; a producer may legitimately send 50).
   * NOTE: rank provenance needs no flag — `priorityRank` presence IS it.
   */
  priorityIsProducerSupplied: boolean
  /**
   * DSK CLAIM PROVENANCE (schemas 0.39.0, ROADMAP 2.962) — projected from the
   * block's ATOMIC `dsk_claim_provenance` object, gated AS A UNIT against
   * `DskClaimProvenanceSchema` at the single site below.
   *
   * ⚠ THE WIRE SHAPE IS ATOMIC; THESE THREE FIELDS ARE A VIEW PROJECTION, not
   * a re-flattening of the contract. The contract forbids flat siblings on
   * coaching/review_card blocks ("ATOMIC STRICT TRIPLE, NEVER FLAT SIBLINGS",
   * CEE #830: an id must never travel without the title and strength that make
   * it verifiable against `data/dsk/v1.json`). The names here match the
   * store's `GuidanceItem` view fields — which predate 0.39.0 and mirror the
   * separate, still-flat `decision_quality_prompts` family — so hop 2
   * (`toStoreGuidanceItem`) stays a straight passthrough. Do NOT read flat
   * siblings off a coaching block: a producer emitting them is emitting a
   * shape the contract rejects, and this path fails it closed.
   *
   * `claim_title` is consumed BY the gate as the verifiability anchor and is
   * deliberately NOT projected: no surface renders it, and carrying an
   * unconsumed field would be dark work. The gate is what enforces that an id
   * never arrives here without one.
   *
   * PRESENCE of `dsk_claim_id` is the attestation; absence means "not grounded
   * in a cited DSK claim" and every surface renders no badge. Never defaulted,
   * never inferred, never partially carried.
   */
  dsk_claim_id?: string
  dsk_protocol_id?: string
  evidence_strength?: 'strong' | 'medium' | 'weak' | 'mixed'
}

export interface Phase3Extraction {
  rawBlocks: Phase3RawBlock[]
  guidanceItems: DerivedGuidanceItem[]
  analysisFreshness: AnalysisFreshness | null
  /** Strictly the CEE-emitted boolean when present; never inferred. */
  hasRunAnalysisFact: boolean | null
  /** Reason CEE emitted alongside freshness ('no_successful_run_analysis_fact', etc). */
  freshnessReason: string | null
}

// ─── Helpers ───────────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function safeString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function safeNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function safeBoolean(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined
}

const PHASE3_TYPES: ReadonlySet<Phase3BlockType> = new Set([
  'coaching',
  'review_card',
  'evidence',
  'exercise',
])

function isPhase3BlockType(v: unknown): v is Phase3BlockType {
  return typeof v === 'string' && PHASE3_TYPES.has(v as Phase3BlockType)
}

function normaliseFreshness(v: unknown): AnalysisFreshness | null {
  if (v === 'fresh' || v === 'stale' || v === 'unknown' || v === 'none') return v
  return null
}

/**
 * Collect Phase 3 blocks from a candidate container. Containers may emit
 * blocks under several conventional names — we look at each and add any
 * matches to the output. The function is forgiving on shape: entries are
 * accepted when they carry a `type` matching the Phase3 set OR when they
 * sit under a Phase3-typed container key.
 */
function collectFromContainer(
  container: Record<string, unknown>,
  source: Phase3RawBlock['source'],
  out: Phase3RawBlock[],
  seenIds: Set<string>,
  idPrefix: string,
): void {
  // Convention A: `phase3_blocks: Phase3RawBlock[]` (preferred future shape).
  const arr = container.phase3_blocks
  if (Array.isArray(arr)) {
    for (let i = 0; i < arr.length; i++) {
      const entry = arr[i]
      if (!isPlainObject(entry)) continue
      const type = entry.type
      if (!isPhase3BlockType(type)) continue
      const id =
        safeString(entry.id) ??
        safeString(entry.block_id) ??
        `${idPrefix}:phase3_blocks[${i}]`
      if (seenIds.has(id)) continue
      seenIds.add(id)
      out.push({ type, raw: entry, id, source })
    }
  }
  // Convention B: per-type arrays at the container root, e.g.
  // `{ coaching: [...], review_card: [...], evidence: [...] }`.
  for (const key of PHASE3_TYPES) {
    const v = container[key]
    if (!Array.isArray(v)) continue
    for (let i = 0; i < v.length; i++) {
      const entry = v[i]
      if (!isPlainObject(entry)) continue
      const id =
        safeString(entry.id) ??
        safeString(entry.block_id) ??
        `${idPrefix}:${key}[${i}]`
      if (seenIds.has(id)) continue
      seenIds.add(id)
      out.push({ type: key, raw: entry, id, source })
    }
  }
  // Convention C: a single `review_card` object (some surfaces emit one).
  const reviewCard = container.review_card
  if (isPlainObject(reviewCard)) {
    const id =
      safeString(reviewCard.id) ??
      safeString(reviewCard.block_id) ??
      `${idPrefix}:review_card`
    if (!seenIds.has(id)) {
      seenIds.add(id)
      out.push({ type: 'review_card', raw: reviewCard, id, source })
    }
  }
}

/**
 * Map one target_refs entry onto the legacy GuidanceItem target vocabulary
 * ('node' | 'edge' | 'option' | 'graph' | 'framing').
 *
 * Two emission conventions exist:
 *   1. The wire contract (TargetRefSchema §0.1, strict `{id,label,kind}`,
 *      kind ∈ factor|option|edge|goal|risk|constraint|outcome). All
 *      non-edge, non-option kinds are nodes on the canvas — same collapse
 *      as focusByTarget/TargetRefPill. Unknown kinds fail closed
 *      (undefined) rather than guessing.
 *   2. The legacy `type` convention (node|edge|option|graph|framing),
 *      kept as the fallback when `kind` is absent.
 * When `kind` is present it wins — a ref that names the contract field is
 * a contract ref, whatever else rides along.
 */
function guidanceTargetType(
  ref: Record<string, unknown>,
): NonNullable<DerivedGuidanceItem['target_object']>['type'] | undefined {
  if (typeof ref.kind === 'string') {
    // Any string `kind` — including empty — marks a contract ref: unknown
    // or empty kinds fail closed here, never fall back to legacy `type`.
    const kind = ref.kind
    if (kind === 'edge') return 'edge'
    if (kind === 'option') return 'option'
    if (
      kind === 'factor' || kind === 'goal' || kind === 'risk' ||
      kind === 'constraint' || kind === 'outcome'
    ) {
      return 'node'
    }
    return undefined
  }
  const ttype = safeString(ref.type)
  if (ttype === 'node' || ttype === 'edge' || ttype === 'option' ||
      ttype === 'graph' || ttype === 'framing') {
    return ttype
  }
  return undefined
}

/**
 * Derive a GuidanceItem from a Phase 3 block. Lossless: the raw block stays
 * in Phase3Extraction.rawBlocks, so consumers who need freshness /
 * action_intent / priority_rank / target_refs / graph_hash_at_generation
 * read those off the raw block.
 *
 * Returns null when the block carries no usable headline text (we do not
 * fabricate copy).
 */
/**
 * UI-SEM-085 (NARROWED, 0.19.0) — `deriveGuidance` is THE ONE wire→internal
 * mapping site for guidance-block priority semantics. The 0.19.0 contract
 * (vendored tarball, boundary/blocks JSDoc — authoritative) states:
 *
 *   - `priority_rank`: ASCENDING ordinal, LOWER = shown FIRST. Positive
 *     integers, UNBOUNDED — "never invert it against 100 (ranks >= 100 are
 *     routine)". Bands encode block class (1-9 lifecycle, 10-99 review
 *     cards, 100-199 coaching, 200+ prompts); equal ranks are
 *     producer-order ties. REQUIRED on review_card/coaching/evidence
 *     blocks; absent by contract on exercise blocks.
 *   - `priority` (optional): COARSE 0-100 urgency, HIGHER = more urgent,
 *     band-granular (derived 1:1 from `category` producer-side; ties
 *     normal). NOT a display order — order by `priority_rank`; budget,
 *     filter and style by `priority`/`category`.
 *   - `category` (optional): four-value code-keyed class.
 *
 * Mapping decisions (each field on its own contract terms, no inversions):
 *   - `priorityRank` ← `priority_rank` VERBATIM (positive integers only;
 *     malformed ranks fail closed to absent = unranked). Its PRESENCE is the
 *     "producer ranked this" fact consumed by every ordering surface.
 *   - `priority` ← `priority` VERBATIM (clamped [0,100] for safety) when
 *     emitted, else the 50 fail-closed default — now the RARE path (0.19.0
 *     CEE emits `priority` on every guidance block; pre-0.19.0 blocks and
 *     malformed payloads still default). NEVER derived from `priority_rank`:
 *     the historic `100 - rank` inversion assumed a bounded 1..N ordinal, so
 *     every rank >= 100 clamped to 0 and the whole coaching band collapsed
 *     into one tie broken by wire array order (the UI-SEM-085 defect,
 *     confirmed by an external Codex review).
 *   - `category` ← wire `category` when canonical, else ABSENT. Passthrough:
 *     the producer owns this field (real on every 0.19.0 guidance block); a
 *     non-canonical or omitted value stays undefined — never synthesised from
 *     `severity`, never defaulted to 'should_fix'.
 *   - `signal_code` ← wire `signal_code` VERBATIM, else ABSENT. Passthrough:
 *     an OPEN, producer-owned SCREAMING_SNAKE vocabulary. The UI never invents
 *     one from `block.type` ('coaching'/'review_card' are block classes, not
 *     codes — they never matched real codes like MISSING_BASE_RATE), never
 *     allowlists the set, and never renders codes as user copy.
 *
 * Residual UI-authored fields: `source`→`'analysis'` and the `priority` 50
 * fail-closed default (disclosed by `priorityIsProducerSupplied`). Copy is
 * never fabricated (title-less blocks return null below).
 */
function deriveGuidance(block: Phase3RawBlock): DerivedGuidanceItem | null {
  const r = block.raw
  const title =
    safeString(r.title) ??
    safeString(r.headline) ??
    safeString(r.summary) ??
    safeString(r.label)
  if (!title) return null
  const detail = safeString(r.detail) ?? safeString(r.body) ?? safeString(r.message)

  // Category — the producer's code-keyed four-value class VERBATIM. Passthrough:
  // an absent or non-canonical `category` stays undefined. The producer owns
  // this field (real on every 0.19.0 guidance block); the UI never synthesises
  // it from `severity` nor falls closed to a 'should_fix' default.
  const rawCategory = safeString(r.category)
  const category: DerivedGuidanceItem['category'] | undefined =
    rawCategory === 'must_fix' || rawCategory === 'should_fix' ||
    rawCategory === 'could_fix' || rawCategory === 'technique'
      ? rawCategory
      : undefined

  // signal_code — the producer's OPEN, SCREAMING_SNAKE code VERBATIM when
  // emitted; absent otherwise. Passthrough: the UI never invents one from
  // `block.type` (block classes are not codes), never allowlists the set.
  const signal_code = safeString(r.signal_code)

  // action_label — the producer's CTA label VERBATIM when supplied; absent
  // otherwise. Passthrough only (never UI-authored). Stage 1 preserved it on
  // the raw block but dropped it from this derived shape, so the Strengthen
  // mapper always fell back to boilerplate.
  const actionLabel = safeString(r.action_label)

  // signal — the producer's user-facing display line VERBATIM when supplied;
  // absent otherwise. NOT `signal_code` (that is a data-* code, never copy):
  // this is producer copy, carried today only on the deterministic stale-rerun
  // nudge. Rendered verbatim where present, never synthesised.
  const signal = safeString(r.signal)

  // Source — analysis when emitted as part of a run_analysis turn,
  // structural for graph-shaped advice. Fall back to analysis.
  const rawSource = safeString(r.source)
  const source: DerivedGuidanceItem['source'] =
    rawSource === 'analysis' || rawSource === 'structural' || rawSource === 'prompt'
      ? rawSource
      : 'analysis'

  // priority_rank — VERBATIM, no inversion, no bound (see the contract note
  // on the function doc). Positive integers only; anything else fails closed
  // to absent, which every ordering consumer treats as unranked.
  const rank = safeNumber(r.priority_rank)
  const priorityRank =
    rank !== undefined && Number.isInteger(rank) && rank >= 1 ? rank : undefined
  // priority — VERBATIM coarse urgency (0-100, higher = more urgent) when
  // the producer emitted one; 50 fail-closed default otherwise. NEVER
  // derived from priority_rank (an order is not a score — that derivation
  // was the `100 - rank` coaching-band-collapse defect).
  // UI-SEM-085: the SINGLE defaulting site. This flag is the only place the
  // producer-supplied/UI-defaulted distinction is decided — never recompute it
  // downstream from `priority === 50` (a producer may legitimately send 50).
  const explicit = safeNumber(r.priority)
  const priorityIsProducerSupplied = explicit !== undefined
  const priority =
    explicit !== undefined ? Math.max(0, Math.min(100, Math.round(explicit))) : 50

  // target_object: prefer explicit, else read the first target_refs entry —
  // contract `kind` or legacy `type` convention, via guidanceTargetType.
  let target_object: DerivedGuidanceItem['target_object']
  if (isPlainObject(r.target_object)) {
    const t = r.target_object
    const ttype = safeString(t.type)
    if (ttype === 'node' || ttype === 'edge' || ttype === 'option' ||
        ttype === 'graph' || ttype === 'framing') {
      target_object = {
        type: ttype,
        ...(safeString(t.id) ? { id: safeString(t.id) } : {}),
        ...(safeString(t.label) ? { label: safeString(t.label) } : {}),
      }
    }
  } else if (Array.isArray(r.target_refs) && r.target_refs.length > 0) {
    const first = r.target_refs[0]
    if (isPlainObject(first)) {
      const ttype = guidanceTargetType(first)
      if (ttype) {
        target_object = {
          type: ttype,
          ...(safeString(first.id) ? { id: safeString(first.id) } : {}),
          ...(safeString(first.label) ? { label: safeString(first.label) } : {}),
        }
      }
    }
  }

  // related_elements: pass through additional target_refs beyond the first.
  // `type` carries the mapped vocabulary (contract kind or legacy type);
  // unmappable refs keep their id/label so id-based matching still works.
  let related_elements: DerivedGuidanceItem['related_elements']
  if (Array.isArray(r.target_refs) && r.target_refs.length > 1) {
    related_elements = []
    for (let i = 1; i < r.target_refs.length; i++) {
      const ref = r.target_refs[i]
      if (!isPlainObject(ref)) continue
      const mapped = guidanceTargetType(ref)
      related_elements.push({
        ...(safeString(ref.id) ? { id: safeString(ref.id) } : {}),
        ...(mapped ? { type: mapped } : {}),
        ...(safeString(ref.label) ? { label: safeString(ref.label) } : {}),
      })
    }
    if (related_elements.length === 0) related_elements = undefined
  }

  // valid_while — preserve analysis_hash + graph_hash when CEE emits them.
  // graph_hash_at_generation is the canonical Phase 3 field name; map it
  // onto the legacy valid_while.graph_hash slot.
  let valid_while: DerivedGuidanceItem['valid_while']
  const analysisHash = safeString(r.analysis_hash)
  const graphHash = safeString(r.graph_hash_at_generation) ?? safeString(r.graph_hash)
  if (analysisHash || graphHash) {
    valid_while = {
      ...(analysisHash ? { analysis_hash: analysisHash } : {}),
      ...(graphHash ? { graph_hash: graphHash } : {}),
    }
  }

  // primary_action.prompt — the text GuidanceStrip SUBMITS AS A TURN
  // (`case 'discuss'` → `onSendMessage(action.prompt, ...)`). So every member
  // of this chain must be producer-authored PROSE.
  //
  // ⚠ `action_intent` USED TO LEAD THIS CHAIN AND THAT WAS THE DEFECT
  // (ROADMAP 2.225). It is a raw ENUM TOKEN — `gather_evidence`,
  // `confirm_factor` — so clicking the guidance action sent the literal
  // string "gather_evidence" to CEE as if the user had typed it. Machine
  // tokens ride as data-* in this codebase; they are never user copy, and
  // never user speech. It is dropped from the chain entirely (it remains on
  // the raw block for readers that legitimately want the token).
  //
  // `action_prompt` (schemas 0.31.0) now leads: producer-authored turn text,
  // dispatched verbatim. `title` is REQUIRED, so the chain always resolves
  // and `primary_action` stays required — no consumer needs an optional
  // guard, and no item is silently stripped of its affordance.
  const intentPrompt = safeString(r.action_prompt) ?? safeString(r.suggested_prompt) ?? title

  // DSK claim provenance (schemas 0.39.0) — the ONE gate site for this path.
  //
  // THE CONTRACT IS THE GATE: `DskClaimProvenanceSchema.safeParse` rather than
  // hand-rolled field checks, so the closed evidence-strength vocabulary and
  // the claim-ARM narrowing (`DSK-B-…`/`DSK-T-…` only, so a protocol or
  // trigger id cannot masquerade as the claim a card cites) are DERIVED from
  // the producer's schema, never mirrored here. A mirror of a vocabulary is
  // the drift defect this estate keeps paying for.
  //
  // GATED AS A UNIT, FAIL CLOSED: the schema is `.strict()` and requires the
  // whole triple, so a partial object — most importantly a bare `claim_id`,
  // the exact shape the atomic doctrine exists to forbid — carries NOTHING.
  // Absence is the honest outcome and is never a default.
  //
  // ⚠ SKEW NOTE (hazard 1): because the parse is strict, an object carrying a
  // field added by a LATER schemas version fails closed here until this repo's
  // pin catches up — the badge goes dark rather than rendering a grounding
  // claim from bytes this pin cannot fully verify. That direction is chosen
  // deliberately: this is a trust surface, and a silent unverified attestation
  // is worse than an absent badge.
  const claimProvenance = DskClaimProvenanceSchema.safeParse(r.dsk_claim_provenance)
  const dsk = claimProvenance.success ? claimProvenance.data : undefined

  return {
    item_id: block.id,
    // signal_code / category: producer-owned passthrough — included only when
    // the producer supplied them; absent stays absent, never invented.
    ...(signal_code ? { signal_code } : {}),
    ...(category ? { category } : {}),
    source,
    title,
    ...(detail ? { detail } : {}),
    // action_label / signal: producer-owned passthrough — included only when
    // the producer supplied them; absent stays absent, never invented.
    ...(actionLabel ? { actionLabel } : {}),
    ...(signal ? { signal } : {}),
    primary_action: { type: 'discuss', prompt: intentPrompt },
    ...(target_object ? { target_object } : {}),
    ...(related_elements ? { related_elements } : {}),
    ...(valid_while ? { valid_while } : {}),
    priority,
    ...(priorityRank !== undefined ? { priorityRank } : {}),
    priorityIsProducerSupplied,
    // DSK provenance: projected only when the atomic object passed the gate
    // above, as a unit. `protocol_id` rides only alongside its claim anchor.
    ...(dsk
      ? {
          dsk_claim_id: dsk.claim_id,
          ...(dsk.protocol_id ? { dsk_protocol_id: dsk.protocol_id } : {}),
          evidence_strength: dsk.evidence_strength,
        }
      : {}),
  }
}

// ─── Public extractor ───────────────────────────────────────────────────

export function extractPhase3FromV5Response(
  response: OlumiResponse | OlumiResponseWithExtensions,
): Phase3Extraction {
  const rawBlocks: Phase3RawBlock[] = []
  const seenIds = new Set<string>()

  // 1. Additive sidecar (top-level keys CEE emits ahead of schema bump).
  const sidecar = (response as OlumiResponseWithExtensions)[ADDITIVE_EXTENSIONS_KEY]
  if (sidecar && isPlainObject(sidecar)) {
    collectFromContainer(sidecar, 'sidecar', rawBlocks, seenIds, 'sidecar')

    // 1b. Phase 3 blocks pulled out of `blocks[]` by responseParser are
    // stashed under PHASE3_SIDECAR_BLOCKS_KEY as a flat array. Each entry is
    // a verbatim block payload with a string `type` already validated
    // against the Phase 3 whitelist. Preserve the original ordering so
    // downstream consumers can rebuild the block sequence.
    const fromBlocksArray = sidecar[PHASE3_SIDECAR_BLOCKS_KEY]
    if (Array.isArray(fromBlocksArray)) {
      for (let i = 0; i < fromBlocksArray.length; i++) {
        const entry = fromBlocksArray[i]
        if (!isPlainObject(entry)) continue
        const type = entry.type
        if (!isPhase3BlockType(type)) continue
        const id =
          safeString(entry.block_id) ??
          safeString(entry.id) ??
          `sidecar_blocks_array:${type}[${i}]`
        if (seenIds.has(id)) continue
        seenIds.add(id)
        rawBlocks.push({ type, raw: entry, id, source: 'sidecar_blocks_array' })
      }
    }
  }

  // 2. analysis_ready passthrough.
  const ar = (response as { analysis_ready?: unknown }).analysis_ready
  if (isPlainObject(ar)) {
    collectFromContainer(ar, 'analysis_ready', rawBlocks, seenIds, 'analysis_ready')
  }

  // 3. analysis_result block enrichment (per-block passthrough).
  for (const block of response.blocks) {
    if (block.type !== 'analysis_result') continue
    const enr = block.enrichment
    if (isPlainObject(enr)) {
      collectFromContainer(enr, 'enrichment', rawBlocks, seenIds, 'analysis_result.enrichment')
    }
  }

  // Freshness + has_run_analysis_fact extraction. CEE-emitted only — never
  // inferred from analysis_ready.status alone (per correction 3).
  // Check both the sidecar and analysis_ready, preferring the sidecar when
  // both are present (CEE's new fields land there first).
  let analysisFreshness: AnalysisFreshness | null = null
  let hasRunAnalysisFact: boolean | null = null
  let freshnessReason: string | null = null

  const freshnessSources: Array<Record<string, unknown> | undefined> = [
    sidecar && isPlainObject(sidecar) ? sidecar : undefined,
    isPlainObject(ar) ? ar : undefined,
  ]
  for (const src of freshnessSources) {
    if (!src) continue
    if (analysisFreshness === null) {
      analysisFreshness = normaliseFreshness(src.analysis_freshness ?? src.freshness)
    }
    if (hasRunAnalysisFact === null) {
      const v = safeBoolean(src.has_run_analysis_fact)
      if (v !== undefined) hasRunAnalysisFact = v
    }
    if (freshnessReason === null) {
      freshnessReason =
        safeString(src.freshness_reason) ?? safeString(src.analysis_freshness_reason) ?? null
    }
  }

  const guidanceItems = rawBlocks
    .map(deriveGuidance)
    .filter((x): x is DerivedGuidanceItem => x !== null)

  return {
    rawBlocks,
    guidanceItems,
    analysisFreshness,
    hasRunAnalysisFact,
    freshnessReason,
  }
}

/**
 * Convenience predicate: does this V5 response carry signals that an
 * analysis turn completed and produced a persisted fact?
 *
 * Rely on hasRunAnalysisFact when CEE emits it; otherwise the presence of an
 * analysis_result block IS the run signal — regardless of the freshness
 * verdict. F10 (Paul's 16-Jul session): the old fallback also required
 * freshness === 'fresh', so a run turn whose own response carried a 'stale'
 * verdict minted NO fact → the orphan banner stacked on top of the freshness
 * strip for the very run the user just watched complete. "Ran" and
 * "current" are different questions; this predicate answers only the first.
 * analysis_ready alone is still NOT sufficient.
 */
export function v5ResponseHasRunAnalysisFact(
  response: OlumiResponse | OlumiResponseWithExtensions,
  extraction?: Phase3Extraction,
): boolean {
  const ext = extraction ?? extractPhase3FromV5Response(response)
  if (ext.hasRunAnalysisFact === true) return true
  if (ext.hasRunAnalysisFact === false) return false
  return response.blocks.some((b) => b.type === 'analysis_result')
}

/**
 * The ONE decision for what a V5 response does to the `v5AnalysisFact`
 * slice. Pure — the production mint site (useConversation) applies the
 * returned action verbatim, so tests can pin the mint→classify seam against
 * THIS function instead of hand-mirroring the write.
 *
 *   - 'set': the composed run gate (`v5ResponseHasRunAnalysisFact`) passed.
 *     `hasRunAnalysisFact` on the returned fields is the COMPOSED answer
 *     (always true here), NOT CEE's raw nullable flag — writing the raw null
 *     re-opened the ran-vs-current split one layer up, because
 *     `classifyAnalysisStateSource` read the fact's own flag and disbelieved
 *     a stale-verdict run it had just watched complete (F10).
 *   - 'clear': CEE explicitly denied the fact (`has_run_analysis_fact=false`)
 *     or declared 'none' — a legitimate clear, not a blind one.
 *   - 'retain': the response carries no signal either way; conversational
 *     turns must not wipe a prior analysis fact.
 */
export type V5AnalysisFactUpdate =
  | {
      action: 'set'
      hasRunAnalysisFact: true
      freshness: AnalysisFreshness | null
      freshnessReason: string | null
      rawBlocks: Phase3RawBlock[]
    }
  | { action: 'clear' }
  | { action: 'retain' }

export function deriveV5AnalysisFactUpdate(
  response: OlumiResponse | OlumiResponseWithExtensions,
  extraction?: Phase3Extraction,
): V5AnalysisFactUpdate {
  const ext = extraction ?? extractPhase3FromV5Response(response)
  if (v5ResponseHasRunAnalysisFact(response, ext)) {
    return {
      action: 'set',
      hasRunAnalysisFact: true,
      freshness: ext.analysisFreshness,
      freshnessReason: ext.freshnessReason,
      rawBlocks: ext.rawBlocks,
    }
  }
  if (ext.hasRunAnalysisFact === false || ext.analysisFreshness === 'none') {
    return { action: 'clear' }
  }
  return { action: 'retain' }
}
