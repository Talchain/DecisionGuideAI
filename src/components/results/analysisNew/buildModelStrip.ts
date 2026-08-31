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

/** Above this many nodes a row shows a proportional bar instead of marks. */
export const MARK_CAP = 12

export interface StripNode {
  id: string
  label: string
}

export interface StripRow {
  /** The node-kind literal — drives shape and colour, matching the canvas. */
  kind: 'option' | 'factor' | 'risk' | 'outcome'
  label: string
  nodes: StripNode[]
  /**
   * True when the row has more nodes than `MARK_CAP` and renders a bar.
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
    const entry = { id: node.id, label: labelOf(node) }
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
  }
}
