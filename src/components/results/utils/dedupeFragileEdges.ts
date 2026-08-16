/**
 * Fragile-edge dedup — pure helper for the "Fragile factors (N)" subsection.
 *
 * Manual test, 2026-08-16: the live Analysis surface rendered "If Leadership
 * capacity shifts" twice inside one alt-winner group and counted the duplicate
 * in N. Nothing on the chain deduped — useResultsSectionData.ts:3430-3491
 * validates, resolves alt-winner labels and sorts; StressTestSection sorted,
 * sliced to 3 and took `.length`. A repeated producer row therefore rendered
 * twice AND consumed one of only three display slots.
 *
 * IDENTITY, NOT DISPLAY STRING. Two genuinely different relationships can
 * render the same "If X shifts" line — one source factor feeding two targets —
 * and collapsing those would delete producer findings. The key is therefore
 * built from the producer's own identifiers, and it carries the ALTERNATIVE
 * WINNER as a discriminator: the same edge flipping the lead to Option B and
 * to Option C is two distinct claims, not one claim twice.
 *
 * Key precedence, most authoritative first:
 *   1. `edge_id`                      — the producer's relationship id
 *   2. `from_id`→`to_id`              — canvas endpoint pair
 *   3. `from_label`→`to_label`        — last resort when the producer sent no
 *                                       ids at all
 * paired with `alternative_winner_id` when present, else the alt-winner label.
 *
 * An entry from which no key can be derived is KEPT (we cannot dedup safely
 * without one) — the same fail-open stance as `dedupTriageItems`.
 */

/** The identity-bearing subset of a fragile edge. `to_id` is supplied at runtime
 *  by useResultsSectionData.ts:3472 even though `ChallengeFragileEdge` omits it. */
export interface DedupableFragileEdge {
  edge_id?: string
  from_id?: string
  to_id?: string
  from_label?: string
  to_label?: string
  alternative_winner_id?: string
  alternative_winner_label?: string
}

function firstNonEmpty(...candidates: Array<string | undefined>): string | null {
  for (const c of candidates) {
    const trimmed = typeof c === 'string' ? c.trim() : ''
    if (trimmed.length > 0) return trimmed
  }
  return null
}

/**
 * Canonical identity for dedup, or null when the producer gave nothing to key
 * on (caller keeps the item in that case).
 */
export function fragileEdgeIdentity(edge: DedupableFragileEdge): string | null {
  const relationship =
    firstNonEmpty(edge.edge_id) != null
      ? `edge:${firstNonEmpty(edge.edge_id)}`
      : (() => {
          const from = firstNonEmpty(edge.from_id, edge.from_label)
          const to = firstNonEmpty(edge.to_id, edge.to_label)
          return from != null && to != null ? `pair:${from}->${to}` : null
        })()
  if (relationship == null) return null
  // Alt-winner discriminator: a second claim about the SAME relationship with a
  // DIFFERENT alternative winner is a different finding and must survive.
  const altWinner = firstNonEmpty(edge.alternative_winner_id, edge.alternative_winner_label) ?? ''
  return `${relationship}|alt:${altWinner}`
}

/**
 * Keeps the FIRST occurrence of each identity. Callers sort before calling, so
 * "first" is the producer's highest-ranked instance, never an arbitrary array
 * position. Entries with no derivable identity are kept.
 */
export function dedupeFragileEdgesByIdentity<T extends DedupableFragileEdge>(edges: T[]): T[] {
  const seen = new Set<string>()
  return edges.filter(edge => {
    const identity = fragileEdgeIdentity(edge)
    if (identity == null) return true
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}
