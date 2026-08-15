/**
 * Evidence-lens classification for a relationship (edge).
 *
 * ── Why this module exists (measured 15 Aug 2026, real browser, real wire) ──
 *
 * The evidence lens classified edges with an exact-membership check against a
 * hand-written list of provenance strings, reading `data.provenance ??
 * data.provenance_source`. Driving the deployed flag posture at 1280x800 with
 * the committed CEE draft capture
 * (`tests/fixtures/cee-responses/draft-graph.success.no-coaching.json`,
 * 17 nodes / 37 edges) showed:
 *
 *   - `data.provenance`        = null on 37/37
 *   - `data.provenance_source` = null on 37/37
 *   - `data.provenanceDisplay` = 'ai_inferred' on 37/37
 *
 * CEE sends `provenance` as an OBJECT (`{ source: 'cee_hypothesis' }`) and the
 * human-readable value in `provenance_display`; `applyDraftResult` maps the
 * latter to `provenanceDisplay` and does not write `provenance` at all. So the
 * lens was reading a field the primary draft path never populates, every edge
 * fell through to `unknown`, and all 18 causal edges rendered in the alarm
 * colour — the exception style covering the whole graph, encoding nothing.
 *
 * ── The two rules that follow ──
 *
 * 1. Read the field the value actually lands in, and accept the object form.
 *    A resolver that names one spelling is a hand-maintained mirror of the
 *    producer; this one accepts every spelling that carries the same fact.
 *
 * 2. Classify OPEN-WORLD. `evidence` is a closed, semantically-defined set —
 *    a provenance that means "this came from something outside the model".
 *    Everything else that is PRESENT is `assumed`: the model (or a person)
 *    asserted it without external backing. `unknown` is reserved for genuinely
 *    ABSENT provenance — we do not know where this came from.
 *
 *    The old list-membership form had the failure mode backwards: an
 *    unrecognised value landed in the most alarming bucket, so every new CEE
 *    provenance string was one deploy away from turning the whole graph red.
 *    Open-world classification makes an unrecognised value land in the QUIET
 *    bucket, which is both the honest reading and the safe failure direction.
 */

export type EvidenceEdgeClass = 'evidence' | 'assumed' | 'unknown'

/**
 * Provenance values meaning the relationship is backed by something outside
 * the model. Closed by construction — adding to it is a claim that a new
 * source is genuine evidence, which is a deliberate decision, not a default.
 */
const GROUNDED_PROVENANCE = new Set([
  'document',
  'metric',
  'evidence',
  'brief_extraction',
  'user_evidence',
])

/**
 * Pull a comparable provenance string out of whatever shape the producer used.
 * Accepts the bare string, CEE's `{ source: '…' }` object, and the display
 * spelling. Returns `null` for absent/empty — which is the `unknown` signal
 * and must stay distinguishable from "present but unrecognised".
 */
export function normaliseEdgeProvenance(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim().toLowerCase()
      if (trimmed) return trimmed
      continue
    }
    if (candidate && typeof candidate === 'object') {
      const source = (candidate as { source?: unknown }).source
      if (typeof source === 'string') {
        const trimmed = source.trim().toLowerCase()
        if (trimmed) return trimmed
      }
    }
  }
  return null
}

/** Classify one edge's provenance. See the module header for the two rules. */
export function classifyEdgeEvidence(...candidates: unknown[]): EvidenceEdgeClass {
  const provenance = normaliseEdgeProvenance(...candidates)
  if (provenance === null) return 'unknown'
  return GROUNDED_PROVENANCE.has(provenance) ? 'evidence' : 'assumed'
}

/** Read the provenance candidates off an edge's `data` bag, in precedence order. */
export function classifyEdgeEvidenceFromData(data: Record<string, unknown> | undefined): EvidenceEdgeClass {
  return classifyEdgeEvidence(
    data?.provenance,
    data?.provenance_source,
    data?.provenanceDisplay,
    data?.provenance_display,
  )
}
