/**
 * Act-on-it row types — the per-factor "what should I do about this?" model.
 *
 * SALVAGED, not re-derived. These types (and the ranking, dispatch and row
 * components beside them) came from `components/results/analysisHeroV17/`,
 * which lived on the analysis fork's dark arm and was therefore STRUCTURALLY
 * DARK on every deployed posture, so no user ever loaded it. That directory,
 * the arm and its flag are deleted; the one genuinely valuable idea — a factor
 * is not just reported, it is ACTED ON, from the row that reports it — lives
 * here, inside the one cockpit, where it is reachable.
 *
 * `causal` is retained on `RowCategory` because `tokens.ts` maps every
 * category to a tint and a dot; no builder currently emits it (the v17
 * investigation's §11.1 precedence step for edge-resolved rows was never
 * implemented). It is a declared-but-unproduced value, not a dead branch that
 * a reader should assume is live.
 */

export type RowCategory =
  | 'evidence'   // sourced from topEvidenceGaps[] — OWNED BY THE TRIAGE QUEUE, see rowRanking
  | 'risk'       // sourced from topFragileEdge
  | 'coverage'   // sourced from a single-option model
  | 'reflect'    // sourced from m2BiasFindings
  | 'causal'     // declared; no builder emits it today
  | 'ready'      // ready-to-brief posture only

export type PriorityBand = 'High' | 'Medium' | 'Low' | 'Ready'

export type RowAction =
  | 'ai'         // "Work through with AI" — primary chat send
  | 'discuss'    // "Discuss with AI" — chat send, alternate prompt
  | 'edit'       // "Edit" — onFocusNode(targetNodeId)
  | 'confirm'    // "Confirm" — onConfirm(targetNodeId)
  | 'add'        // "Add" — chat send
  | 'challenge'  // "Challenge" — chat send
  | 'brief'      // "Create brief" — chat send

export interface ActOnItRow {
  /** Stable key for React reconciliation. */
  key: string
  /** Display title — verb-led; preserves the user's verbatim label. */
  title: string
  /** Reason / detail copy — Ground → Propose. */
  reason: string
  /** Evidence-priority band (ordering signal; not rendered). */
  priority: PriorityBand
  /** 0..100 — priority-bar fill percent (not rendered; kept for ordering tests). */
  priorityWidth: number
  /** Row tint category + colour-dot token. */
  category: RowCategory
  /** Ordered list of action icons to render right-aligned. */
  actions: RowAction[]
  /** Factor or edge ID for Edit/Confirm wiring. Optional. */
  targetNodeId: string | undefined
  /** Prompt the row's AI actions send when invoked. */
  chatPrompt: string
}

/** The payload every row action carries to the dispatcher. */
export interface RowActionPayload {
  chatPrompt: string
  targetNodeId: string | undefined
}

export type RowActionDispatcher = (action: RowAction, payload: RowActionPayload) => void
