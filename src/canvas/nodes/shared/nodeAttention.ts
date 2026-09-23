/**
 * "WORTH REVIEWING" — ONE AGGREGATED ATTENTION SIGNAL PER NODE, FROM EXISTING
 * PRODUCER SIGNALS ONLY.
 *
 * Locked Canvas design (Experience Design, Paul-approved 23 Sep 2026): the graph
 * should answer "why should I look HERE?" with one quiet marker, not a row of
 * competing warning badges. The marker aggregates reasons the analysis or the
 * producer ALREADY states; this module invents no score, threshold or science.
 *
 * THE REASONS, in priority order (1 = most consequential):
 *   1. `decision_flip` — the factor card's own turning point exists: the SAME
 *      admission the card's track uses (`selectFactorTurningPoint`, UI-SEM-097 —
 *      PLoT's root `flip_thresholds`, `flip_reason === 'found'`, both endpoints).
 *      ⛔ Never the ISL `flip_threshold`, which UI-SEM-037 defaults to 0.5.
 *      `fragile_link`  — a relationship FROM this node is in PLoT's
 *      `robustness.fragile_edges` (the same producer list the edge cue reads).
 *   2. `evidence_gap` — this factor is in the producer's top-3 by value of
 *      information (`rankFactor`'s `voiRank` — the SAME rank the card uses).
 *   3. `top_driver`   — a published rank (`rankFactor`'s `sensitivityRank`, top
 *      3, ties withheld — the SAME rank the card shows).
 *   4. `behavioural`  — a bias finding the PRODUCER maps to this node: CEE's
 *      `target_factor_id` or PLoT's `affected_elements`. Named only when the code
 *      resolves in the shared bias registry; otherwise the producer's own
 *      description. Wording is reflective ("Worth checking: …"), never a diagnosis.
 *
 * ⛔ WHAT NEVER TRIGGERS IT: being AI-generated; `Not set`; "Needs input"; stale
 * analysis. Those are explicit states with their own words on the card, and a
 * fresh model is mostly AI-generated — marking that would make the marker the
 * default state and destroy the signal.
 *
 * UI-SEM-098 — DISPLAY BUDGET (the UI-SEM-084 class): at most
 * `ATTENTION_BUDGET` nodes carry the marker. Nodes are ranked by their most
 * consequential reason, then by how many reasons they carry, then by published
 * driver rank, then by id (deterministic). The budget selects among producer
 * signals; it never creates one. Remove when the producer ships a per-surface
 * attention budget.
 */

export type AttentionReasonKind =
  | 'decision_flip'
  | 'fragile_link'
  | 'evidence_gap'
  | 'top_driver'
  | 'behavioural'

export interface AttentionReason {
  readonly kind: AttentionReasonKind
  /** 1 = most consequential. */
  readonly priority: 1 | 2 | 3 | 4
  /** User-facing, one short clause. Prefixed `Last run · ` when run-derived and stale. */
  readonly label: string
}

/** UI-SEM-098. Matches the estate's top-3 conventions (`MAX_BADGED_RANK`, `voiRank`). */
export const ATTENTION_BUDGET = 3

export interface AttentionInputs {
  /** Every node on the canvas; reasons for ids not on it are dropped. */
  readonly nodeIds: ReadonlySet<string>
  /** Published ranks per factor, from `rankFactor` (never recomputed here). */
  readonly factorRanks: ReadonlyMap<string, { sensitivityRank: number | null; voiRank: number | null }>
  /** Factors whose card shows a turning point (`selectFactorTurningPoint` !== null). */
  readonly turningPointNodeIds?: ReadonlySet<string> | null
  /** `report.robustness.fragile_edges` (PLoT). */
  readonly fragileEdges?: ReadonlyArray<unknown> | null
  /** CEE `analysis_ready.bias_findings` (pre-analysis; not run-derived). */
  readonly ceeBiasFindings?: ReadonlyArray<unknown> | null
  /** PLoT `m1_review.bias_findings` (run-derived). */
  readonly runBiasFindings?: ReadonlyArray<unknown> | null
  /** True when the model has changed since the run (`useModelChangedSinceRun`). */
  readonly runIsStale?: boolean
  /** Resolve a producer bias code to a display title, or null. */
  readonly resolveBiasTitle: (code: unknown) => string | null
  /** Sanitise producer prose for display (e.g. `sanitizeCoachingText`). */
  readonly cleanText?: (text: string) => string
}

const LAST_RUN = 'Last run · '

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}

function readFrom(fe: unknown): string | null {
  const e = (fe ?? {}) as Record<string, unknown>
  return str(e.from_id) ?? str(e.fromId) ?? str(e.source)
}

function add(map: Map<string, AttentionReason[]>, id: string, reason: AttentionReason): void {
  const list = map.get(id)
  if (!list) {
    map.set(id, [reason])
    return
  }
  if (!list.some((r) => r.kind === reason.kind)) list.push(reason)
}

export function deriveAttentionPlan(
  inputs: AttentionInputs,
  budget: number = ATTENTION_BUDGET,
): ReadonlyMap<string, readonly AttentionReason[]> {
  const run = (label: string) => (inputs.runIsStale ? `${LAST_RUN}${label}` : label)
  const clean = inputs.cleanText ?? ((t: string) => t)
  const reasons = new Map<string, AttentionReason[]>()
  const onCanvas = (id: string | null): id is string => id !== null && inputs.nodeIds.has(id)

  for (const id of inputs.turningPointNodeIds ?? []) {
    if (!onCanvas(id)) continue
    add(reasons, id, { kind: 'decision_flip', priority: 1, label: run('A turning point was found: this could change the decision') })
  }

  for (const raw of inputs.fragileEdges ?? []) {
    const id = readFrom(raw)
    if (!onCanvas(id)) continue
    add(reasons, id, { kind: 'fragile_link', priority: 1, label: run('A link from here could change the result') })
  }

  for (const [id, rank] of inputs.factorRanks) {
    if (!onCanvas(id)) continue
    if (rank.voiRank !== null) {
      add(reasons, id, { kind: 'evidence_gap', priority: 2, label: run('Among the top 3 places where evidence would help most') })
    }
    if (rank.sensitivityRank !== null) {
      add(reasons, id, { kind: 'top_driver', priority: 3, label: run(`Driver #${rank.sensitivityRank} in this analysis`) })
    }
  }

  const behavioural = (raw: unknown, targets: Array<string | null>, runDerived: boolean) => {
    const f = (raw ?? {}) as Record<string, unknown>
    const title = inputs.resolveBiasTitle(f.code ?? f.type)
    const description = str(f.description)
    const named = title ?? (description ? clean(description) : null)
    if (!named) return
    const label = `Worth checking: ${title ? title.toLowerCase() : named}`
    for (const id of targets) {
      if (!onCanvas(id)) continue
      add(reasons, id, { kind: 'behavioural', priority: 4, label: runDerived ? run(label) : label })
    }
  }
  for (const raw of inputs.ceeBiasFindings ?? []) {
    const f = (raw ?? {}) as Record<string, unknown>
    behavioural(raw, [str(f.target_factor_id)], false)
  }
  for (const raw of inputs.runBiasFindings ?? []) {
    const f = (raw ?? {}) as Record<string, unknown>
    const targets = Array.isArray(f.affected_elements) ? f.affected_elements.map(str) : []
    behavioural(raw, targets, true)
  }

  const driverRank = (id: string) => inputs.factorRanks.get(id)?.sensitivityRank ?? Number.POSITIVE_INFINITY
  const ranked = [...reasons.entries()]
    .map(([id, list]) => ({ id, list: [...list].sort((a, b) => a.priority - b.priority) }))
    .sort((a, b) =>
      a.list[0]!.priority - b.list[0]!.priority ||
      b.list.length - a.list.length ||
      driverRank(a.id) - driverRank(b.id) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .slice(0, Math.max(0, budget))

  return new Map(ranked.map(({ id, list }) => [id, list]))
}
