/**
 * Dropped-content counter — Track C Step 1 (approved decision D-5).
 *
 * Counts CEE content the UI received but did not render, keyed by
 * block type + drop source, with a tracked rationale per record. This is
 * the audit's `unknown_block_type` counter: observability ONLY.
 *
 * Contract rules:
 *   - UI renders, never invents: this module counts and reports; it does
 *     NOT reinterpret, rescue, or render dropped content, and it never
 *     changes what is rendered.
 *   - Privacy-safe: records carry type labels + counts + timestamps only —
 *     never block payloads, labels, ids, values, or user content. Labels
 *     are length-clamped defensively.
 *   - Session-scoped: module state resets on page load. The per-turn truth
 *     remains the parser's `__additive__.unknown_blocks` sidecar riding
 *     each captured response; this counter aggregates across the session
 *     for the debug export (`bundle.dropped_content_counter`).
 *
 * Wired drop points (sources):
 *   - 'v5_response_parser': truly-unknown `blocks[]` types dropped by the
 *     defensive-hardening tolerance in `src/v5/responseParser.ts` before
 *     strict validation (rationale
 *     'unknown_block_type_dropped_pre_validation'). Dropped != rendered:
 *     tolerance is a safety net, not a rendering contract.
 *   - 'phase3_block_bridge': Phase 3 blocks harvested from the parser
 *     sidecar that the render bridge (composePhase3BridgedBlocks in
 *     useConversation.ts) did NOT surface. Track C slice 1 renders
 *     schema-valid 'coaching' + 'review_card'; everything else here is
 *     counted with a precise rationale:
 *       - 'malformed_phase3_block_suppressed': a coaching/review_card that
 *         failed 0.13.x typed-field adaptation (fail-closed — counted +
 *         suppressed, never crashes, never rendered with invented fields).
 *       - 'no_renderer_for_block_type': evidence / exercise — tolerated
 *         types with no renderer in this slice.
 *       - 'legacy_review_card_suppressed': a legacy-shaped (pre-0.13.x)
 *         review_card not surfaced by the legacy top-1/fact-gated bridge.
 *
 * Future sources should add a new source/rationale literal here rather
 * than reusing existing ones, so by-source counts stay attributable.
 */

/** Where the drop happened. */
export type DroppedContentSource = 'v5_response_parser' | 'phase3_block_bridge'

/** Tracked rationale — WHY the content was not rendered. */
export type DroppedContentRationale =
  | 'unknown_block_type_dropped_pre_validation'
  | 'malformed_phase3_block_suppressed'
  | 'no_renderer_for_block_type'
  | 'legacy_review_card_suppressed'

/** One aggregated counter row (type+source+rationale). */
export interface DroppedContentEntry {
  block_type: string
  source: DroppedContentSource
  rationale: DroppedContentRationale
  count: number
  first_seen_at: string
  last_seen_at: string
}

/** Snapshot embedded into the debug bundle. */
export interface DroppedContentCounterSnapshot {
  /** Total dropped block instances recorded this session. */
  total_dropped: number
  /** Aggregated rows, highest count first (ties: block_type ascending). */
  entries: DroppedContentEntry[]
  /** Where the per-turn (non-aggregated) truth lives, for reviewers. */
  per_turn_truth: 'payloads.cee_response.__additive__.unknown_blocks'
}

/** Defensive bound mirroring the parser's unknown-type label clamp. */
const MAX_LABEL_LENGTH = 100

const entries = new Map<string, DroppedContentEntry>()

function clampLabel(label: string): string {
  return label.length > MAX_LABEL_LENGTH
    ? `${label.slice(0, MAX_LABEL_LENGTH)}…`
    : label
}

/**
 * Record dropped content. Never throws; a diagnostics counter must not be
 * able to break the pipeline that feeds it.
 */
export function recordDroppedContent(input: {
  blockType: string
  source: DroppedContentSource
  rationale: DroppedContentRationale
  /** Number of dropped instances of this type (default 1). */
  count?: number
}): void {
  try {
    const count =
      typeof input.count === 'number' && Number.isFinite(input.count) && input.count > 0
        ? Math.floor(input.count)
        : 1
    const blockType = clampLabel(String(input.blockType))
    const key = `${input.source}::${input.rationale}::${blockType}`
    const now = new Date().toISOString()
    const existing = entries.get(key)
    if (existing) {
      existing.count += count
      existing.last_seen_at = now
    } else {
      entries.set(key, {
        block_type: blockType,
        source: input.source,
        rationale: input.rationale,
        count,
        first_seen_at: now,
        last_seen_at: now,
      })
    }
    const total = getDroppedContentSnapshot().total_dropped
    // Observability channel required by D-5 (console.info specifically —
    // the drop is informational, not a warning/error). Stripped from
    // production builds by the esbuild `drop: ['console']` setting;
    // visible in dev and staging diagnostics.
    // eslint-disable-next-line no-console
    console.info(
      `[dropped-content] ${count}x block type "${blockType}" not rendered `
      + `(source=${input.source}, rationale=${input.rationale}); session total ${total}`,
    )
  } catch {
    // Counting must never break parsing/rendering.
  }
}

/** Current aggregated snapshot (sorted copy — safe to embed/serialise). */
export function getDroppedContentSnapshot(): DroppedContentCounterSnapshot {
  const rows = Array.from(entries.values())
    .map((e) => ({ ...e }))
    .sort((a, b) => (b.count - a.count) || a.block_type.localeCompare(b.block_type))
  return {
    total_dropped: rows.reduce((sum, e) => sum + e.count, 0),
    entries: rows,
    per_turn_truth: 'payloads.cee_response.__additive__.unknown_blocks',
  }
}

/** Test-only reset. @internal */
export function _resetDroppedContentCounter(): void {
  entries.clear()
}
