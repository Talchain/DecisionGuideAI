/**
 * Analysis (New) — "Your model so far": what the model CONTAINS, as counts and
 * as click targets.
 *
 * ⭐ WHY THIS EXISTS. This tab could describe a run in detail and could not say
 * what the run was ABOUT. Before a run it had almost nothing to show at all.
 * The strip is the design's first element and the only genuinely visual one:
 * one mark per node, grouped by kind, each mark a route to that node on canvas.
 *
 * ⚠⚠ IT MAKES NO PROVENANCE CLAIM, AND THAT IS A DELIBERATE OMISSION RATHER
 * THAN AN OVERSIGHT. The design draws these marks filled-or-hollow to say which
 * inputs are the user's and which are Olumi's. That distinction is NOT
 * available: `provenance_class` returns zero files in this repo (contrast
 * control: `authored_by`, ten files), CEE can send an intervention as a bare
 * number carrying no source, and PLoT's `routes/v2/run.ts` stamps unrecognised
 * values as `user_specified` — the strongest possible claim of human authorship
 * on a value Olumi invented (PR #353, open).
 *
 * So every mark here is identical and means one thing only: A NODE OF THIS KIND
 * EXISTS. A fill this data cannot justify would be the exact defect the strip
 * was conceived to expose. When provenance lands, the fill is the increment —
 * and until then a strip that navigates honestly beats one that decorates.
 *
 * ⚠ THE GOAL IS NOT A ROW. Every row here is progress through a SET (six
 * options, five factors). A goal is a binary — set or not — and putting it in
 * the same column of tallies made one row silently change units. It is the
 * header the rows are about.
 */

import { resolveNodeTypeLiteral } from '../../../canvas/domain/nodes'
import { factorIsConfirmable } from '../../../canvas/domain/valueProvenance'

/**
 * Above this many nodes a row shows the first `MARK_CAP` marks and says plainly
 * how many it is not showing.
 *
 * ⚠⚠ THIS COMMENT USED TO SAY "shows a proportional bar instead of marks", AND
 * THE BAR IS THE ONE THING THIS COMPONENT MUST NEVER RENDER. The bar was
 * rejected in review — it reads as a proportion of a denominator nobody
 * measured, and filled to 100% it says "complete" about a model nobody has
 * checked. The code has never rendered one; only these two comments and one
 * test name still described it, which is a live instruction to reintroduce a
 * rejected design sitting in the file a builder would read first. Corrected
 * rather than left, because a stale comment that prescribes a defect is worse
 * than no comment.
 */
export const MARK_CAP = 12

export interface StripNode {
  id: string
  label: string
  /**
   * This node carries a number nobody has confirmed — the product's own
   * "N to verify" state, and the ONLY per-node state this strip is allowed to
   * assert.
   *
   * ⚠⚠ IT IS NOT A PROVENANCE CLAIM AND THE DISTINCTION IS THE WHOLE POINT.
   * The design draws these marks filled-or-hollow to say WHOSE value each one
   * is; that is unavailable (see the header) and stays unbuilt. This field
   * answers a different, weaker and answerable question — "is there a number
   * here that a confirmation could ratify, and has nobody ratified it?" — and
   * it is the write authority's own condition, not a reading of one.
   *
   * ⚠ FACTORS ONLY, BY THE PREDICATE'S OWN DOMAIN. `factorIsConfirmable` is
   * about an `observed_state` a factor carries and an option does not, and the
   * product's live count (`countFactorsToVerify`) is scoped the same way. A
   * strip that applied it to every kind would print a number that disagrees
   * with the Model tab's badge for the same model (CLAUDE.md trap 12), and
   * would be asserting confirmability of a thing that has nothing to confirm.
   */
  needsCheck: boolean
}

export interface StripRow {
  /** The node-kind literal — drives shape and colour, matching the canvas. */
  kind: 'option' | 'factor' | 'risk' | 'outcome'
  label: string
  nodes: StripNode[]
  /**
   * True when the row has more nodes than `MARK_CAP`, so the renderer draws the
   * first `MARK_CAP` and states how many it is withholding. Never a bar — see
   * the note on `MARK_CAP`.
   *
   * ⚠ The threshold is a design decision, not a fallback. Eight marks are
   * readable and individually clickable; forty are a wall, and a real strategic
   * model reaches forty factors. Designed at the large end so the small one is
   * the easy case.
   */
  overCap: boolean
}

export interface ModelStrip {
  /** The goal or decision node's label, when the model names one. */
  goalLabel: string | null
  rows: StripRow[]
  /** Total nodes represented, across every row. Never a claim about coverage. */
  total: number
  /**
   * How many nodes carry `needsCheck`. Equal BY CONSTRUCTION to
   * `countFactorsToVerify` over the same graph — same predicate, same domain —
   * and pinned as such by a derived equality in `modelStrip.spec.ts` so a
   * later narrowing of the product's count cannot leave this strip printing a
   * different number for the same model.
   */
  needsCheckTotal: number
}

const ROW_ORDER: ReadonlyArray<{ kind: StripRow['kind']; label: string }> = [
  { kind: 'option', label: 'Options' },
  { kind: 'factor', label: 'Factors' },
  { kind: 'risk', label: 'Risks' },
  { kind: 'outcome', label: 'Outcomes' },
]

function labelOf(node: { id: string; data?: unknown }): string {
  const data = node.data as { label?: unknown } | undefined
  const raw = typeof data?.label === 'string' ? data.label.trim() : ''
  // An id is not a name. A node whose label is missing renders as its kind
  // rather than leaking an internal identifier into a tooltip.
  return raw.length > 0 && raw !== node.id ? raw : ''
}

/**
 * Build the strip from canvas nodes.
 *
 * Empty rows are DROPPED rather than rendered at zero: "Risks 0" reads as a
 * finding about the model ("you have no risks") when the truth is only that the
 * kind is absent. The panel has surfaces whose job is to say what is missing;
 * this one reports what is there.
 */
export function buildModelStrip(
  nodes: ReadonlyArray<{ id: string; type?: string; data?: unknown }>,
): ModelStrip {
  const byKind = new Map<string, StripNode[]>()
  let goalLabel: string | null = null
  let decisionLabel: string | null = null

  for (const node of nodes) {
    const kind = resolveNodeTypeLiteral(node)
    if (!kind) continue
    if (kind === 'goal') {
      goalLabel = goalLabel ?? (labelOf(node) || null)
      continue
    }
    if (kind === 'decision') {
      decisionLabel = decisionLabel ?? (labelOf(node) || null)
      continue
    }
    const bucket = byKind.get(kind)
    const entry: StripNode = {
      id: node.id,
      label: labelOf(node),
      // Scoped to the predicate's own domain — see `StripNode.needsCheck`.
      needsCheck: kind === 'factor' && factorIsConfirmable(node.data),
    }
    if (bucket) bucket.push(entry)
    else byKind.set(kind, [entry])
  }

  const rows: StripRow[] = []
  for (const { kind, label } of ROW_ORDER) {
    const found = byKind.get(kind)
    if (!found || found.length === 0) continue
    rows.push({ kind, label, nodes: found, overCap: found.length > MARK_CAP })
  }

  return {
    // The decision node names the question when no goal node does; both are
    // the thing the rows are about, so either serves as the header.
    goalLabel: goalLabel ?? decisionLabel,
    rows,
    total: rows.reduce((n, r) => n + r.nodes.length, 0),
    needsCheckTotal: rows.reduce(
      (n, r) => n + r.nodes.filter((x) => x.needsCheck).length,
      0,
    ),
  }
}
