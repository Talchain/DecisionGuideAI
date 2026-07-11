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
 *   Callers must use `hasRunAnalysisFact === true` OR the explicit
 *   `analysisFreshness === 'fresh'` signal — never readiness alone.
 */
import type { OlumiResponse } from '@talchain/schemas/boundary'

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
  signal_code: string
  category: 'must_fix' | 'should_fix' | 'could_fix' | 'technique'
  source: 'analysis' | 'structural' | 'prompt'
  title: string
  detail?: string
  primary_action: { type: 'discuss'; prompt: string }
  target_object?: { type: 'node' | 'edge' | 'option' | 'graph' | 'framing'; id?: string; label?: string }
  related_elements?: Array<{ id?: string; type?: string; label?: string }>
  valid_while?: { analysis_hash?: string; graph_hash?: string }
  priority: number
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
  const kind = safeString(ref.kind)
  if (kind) {
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
function deriveGuidance(block: Phase3RawBlock): DerivedGuidanceItem | null {
  const r = block.raw
  const title =
    safeString(r.title) ??
    safeString(r.headline) ??
    safeString(r.summary) ??
    safeString(r.label)
  if (!title) return null
  const detail = safeString(r.detail) ?? safeString(r.body) ?? safeString(r.message)

  // Category — accept the four canonical values or fall back to should_fix
  // for evidence/review_card surfaces (which expect attention without being
  // blockers). Coaching defaults to should_fix.
  const rawCategory = safeString(r.category) ?? safeString(r.severity)
  const category: DerivedGuidanceItem['category'] =
    rawCategory === 'must_fix' || rawCategory === 'should_fix' ||
    rawCategory === 'could_fix' || rawCategory === 'technique'
      ? rawCategory
      : 'should_fix'

  // Source — analysis when emitted as part of a run_analysis turn,
  // structural for graph-shaped advice. Fall back to analysis.
  const rawSource = safeString(r.source)
  const source: DerivedGuidanceItem['source'] =
    rawSource === 'analysis' || rawSource === 'structural' || rawSource === 'prompt'
      ? rawSource
      : 'analysis'

  // priority: prefer CEE-emitted numeric, fall back to priority_rank
  // ordering (1 = highest → 100, descending). Default 50.
  const explicit = safeNumber(r.priority)
  const rank = safeNumber(r.priority_rank)
  const priority =
    explicit !== undefined
      ? Math.max(0, Math.min(100, Math.round(explicit)))
      : rank !== undefined
        ? Math.max(0, Math.min(100, 100 - rank))
        : 50

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

  // primary_action — derived from action_intent + suggested follow-up
  // prompt. Default to 'discuss' with the block's headline as the prompt.
  const intentPrompt = safeString(r.action_intent) ?? safeString(r.suggested_prompt) ?? title

  return {
    item_id: block.id,
    signal_code: safeString(r.signal_code) ?? block.type,
    category,
    source,
    title,
    ...(detail ? { detail } : {}),
    primary_action: { type: 'discuss', prompt: intentPrompt },
    ...(target_object ? { target_object } : {}),
    ...(related_elements ? { related_elements } : {}),
    ...(valid_while ? { valid_while } : {}),
    priority,
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
 * Per correction 3: rely on hasRunAnalysisFact when CEE emits it; otherwise
 * accept analysisFreshness === 'fresh' AND presence of an analysis_result
 * block as a conservative fallback. analysis_ready alone is NOT sufficient.
 */
export function v5ResponseHasRunAnalysisFact(
  response: OlumiResponse | OlumiResponseWithExtensions,
  extraction?: Phase3Extraction,
): boolean {
  const ext = extraction ?? extractPhase3FromV5Response(response)
  if (ext.hasRunAnalysisFact === true) return true
  if (ext.hasRunAnalysisFact === false) return false
  if (ext.analysisFreshness === 'fresh') {
    return response.blocks.some((b) => b.type === 'analysis_result')
  }
  return false
}
