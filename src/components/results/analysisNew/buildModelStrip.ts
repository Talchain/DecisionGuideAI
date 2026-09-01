/**
 * Analysis (New) — "Your model so far": what the model CONTAINS, as counts and
 * as click targets.
 *
 * ⭐ WHY THIS EXISTS. This tab could describe a run in detail and could not say
 * what the run was ABOUT. Before a run it had almost nothing to show at all.
 * The strip is the design's first element and the only genuinely visual one:
 * one mark per node, grouped by kind, each mark a route to that node on canvas.
 *
 * ⚠⚠ THE MARK MAKES NO PROVENANCE CLAIM, AND THAT IS STILL DELIBERATE. The
 * design draws these marks filled-or-hollow to say which inputs are the user's
 * and which are Olumi's. Every mark here is identical and means one thing only:
 * A NODE OF THIS KIND EXISTS. A fill would have to be legible at 8px with no
 * label, so it must be right for EVERY node in the row or it teaches a false
 * reading of all of them — and CEE can send an intervention as a bare number
 * carrying no source at all, so a whole row can be unanswerable.
 *
 * ⚠⚠ BUT THE ORIGINAL REASON GIVEN FOR THAT REFUSAL WAS WRONG, AND IT WAS
 * BLOCKING MORE THAN THE FILL. This header used to say the distinction "is NOT
 * available: `provenance_class` returns zero files in this repo". That names a
 * WIRE FIELD, not the question. The authority for "who put this value here" is
 * the node's own `observed_state.source`, whose closed vocabulary
 * `canvas/domain/valueProvenance.ts` classifies and which this very tab already
 * joins against for the glance's condition line
 * (`useAnalysisNewViewModel.ts` → `buildNodeValueSourceMap`). A field-name grep
 * returning zero is evidence about that NAME, never about the question — the
 * estate's own trap 13e, committed inside the comment that cites a contrast
 * control.
 *
 * So `valueSource` is carried per node and the DETAIL says the word, where
 * there is a label to carry it, one node at a time, and an unclassifiable
 * literal renders nothing. The fill stays refused; the silence about
 * authorship does not.
 *
 * ⚠ THE GOAL IS NOT A ROW. Every row here is progress through a SET (six
 * options, five factors). A goal is a binary — set or not — and putting it in
 * the same column of tallies made one row silently change units. It is the
 * header the rows are about.
 */

import { resolveNodeTypeLiteral } from '../../../canvas/domain/nodes'
import { factorIsConfirmable } from '../../../canvas/domain/valueProvenance'
import { nodeValueSource } from '../driverValueProvenance'
import { factorDisplayText } from '../../../utils/formatFactorDisplayValue'

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
  /**
   * The factor's value AS THE CANVAS RENDERS IT, or `null` when it has none.
   *
   * ⚠ NOT FORMATTED HERE, AND THAT IS THE WHOLE REASON THIS FIELD EXISTS
   * RATHER THAN A NUMBER. `factorDisplayText` is the estate's shared entry
   * point — the same one `FactorNode` and the inspector-v2 factor panels call —
   * and it carries the unit/cap/`display_value` priority chain, the currency
   * classification and the compound-value unwrap. A second formatter here
   * would put the panel and the canvas node in disagreement about one factor's
   * value (CLAUDE.md trap 12), which is the exact defect a detail claiming to
   * show "the data behind this" must not have.
   *
   * `null` is MEANINGFUL and is a different state from "we could not establish
   * the source": it says the factor carries no value at all.
   *
   * ⚠ FACTORS ONLY. `factorDisplayText` reads an `observedState` that options,
   * risks and outcomes do not carry in this shape.
   */
  valueText: string | null
  /**
   * The node's `observed_state.source` literal, VERBATIM — never a class.
   *
   * ⚠ THE CLASSIFIER IS THE CONSUMER'S, DELIBERATELY. `classifyValueProvenance`
   * returns `null` for a literal it does not know rather than guessing, and the
   * renderer's honest silence depends on receiving that `null` itself. A class
   * resolved here would have to pick a fallback, and a guessed fallback is how
   * "AI estimate" lands on a number the user typed.
   *
   * ⚠ AND IT IS `observed_state.source`, NOT AN INTERVENTION SOURCE. The two
   * fields share a name and answer different questions; `valueProvenance.ts`
   * documents why routing one through the other's classifier is the wrong call
   * that survives review.
   */
  valueSource: string | undefined
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
  /**
   * The goal node's id, so the target line can write to the RIGHT node.
   *
   * ⚠ NOT `outcomeNodeId`. The store's setter falls back to that when handed no
   * id, and `GoalThresholdEditor` carries the same warning in its own props —
   * "preventing writes to the wrong node". A model with a goal AND an outcome
   * would otherwise have its target written onto the outcome.
   */
  goalNodeId: string | null
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
 * ⭐⭐ EVERYTHING THIS STRIP DISPLAYS ABOUT ONE NODE, BEYOND ITS IDENTITY.
 *
 * ⚠ WHY IT EXISTS. `ModelStrip` subscribes to the canvas through a SIGNATURE
 * rather than the node array, because React Flow replaces that array on every
 * drag. The signature was `id:type` — and its comment said that was "the only
 * thing this component displays", which was true when it was written and is not
 * now.
 *
 * ⚠⚠ WITNESSED ON THE DEPLOYED BUILD (`32e9becd`, fresh guest). Typing a value
 * into the detail's own editor wrote it — the canvas node re-rendered showing
 * `42` — and the detail the user had just typed into still read "No value set".
 * The strip could not see its own edit, because `observed_state` is not part of
 * `id:type`, so `buildModelStrip` never recomputed. An affordance whose effect
 * is invisible on the surface that offers it.
 *
 * ⚠ AND IT WAS ALREADY WRONG FOR `needsCheck` BEFORE ANY OF THIS. That field is
 * `factorIsConfirmable(node.data)`, which reads the same `observed_state`, so
 * the strip's "N to verify" worklist had the identical staleness — it simply
 * had no affordance pointing at it, so nobody met the defect.
 *
 * ⚠ RAW FIELDS, NEVER `factorDisplayText`. This runs inside a zustand selector,
 * on every store change: it must be cheap and allocation-light. Formatting here
 * would put the unit/cap/currency chain on the hot path for no gain, since the
 * only question is "did anything the strip renders change".
 *
 * ⚠ AND IT DELIBERATELY IGNORES POSITION, which is the whole reason the
 * signature exists. A drag changes `x`/`y` and nothing here.
 */
export function stripNodeValueSignature(node: { data?: unknown } | undefined): string {
  const n = node as Record<string, unknown> | undefined
  const inner = n?.data as Record<string, unknown> | undefined
  const obs = (n?.observedState ??
    n?.observed_state ??
    inner?.observedState ??
    inner?.observed_state) as Record<string, unknown> | undefined
  if (!obs) return ''
  // `display_value` is included because `factorDisplayText` prefers it, so a
  // producer changing only that would otherwise be invisible here.
  const parts = [obs.value, obs.raw_value, obs.unit, obs.cap, obs.source, obs.display_value]
  return parts.map((v) => (v === undefined || v === null ? '' : String(v))).join(',')
}

/**
 * Build the strip from canvas nodes.
 *
 * Empty rows are DROPPED rather than rendered at zero: "Risks 0" reads as a
 * finding about the model ("you have no risks") when the truth is only that the
 * kind is absent. The panel has surfaces whose job is to say what is missing;
 * this one reports what is there.
 */
/**
 * The model's goal node id, or null when it has no goal.
 *
 * ⭐ EXTRACTED SO TWO SURFACES CANNOT DISAGREE ABOUT WHETHER A GOAL EXISTS.
 * `buildModelStrip` calls this for its own `goalNodeId`, so the strip and any
 * caller asking "is the strip rendering a target affordance?" read one answer.
 * A second, hand-written copy of the first-goal-wins rule is exactly the
 * hand-maintained mirror this estate keeps paying for (CLAUDE.md trap 12).
 *
 * First goal node in node order wins — the strip's long-standing rule, moved
 * here verbatim rather than restated.
 */
/**
 * Does the strip render anything at all?
 *
 * ⚠ THE ROWS ARE THE CENSUS — options, factors, risks, outcomes. Goal and
 * decision are pulled OUT of them (they are the subject line, not a tally), so
 * a model that is only a goal, or a goal and a decision, has ZERO rows and the
 * strip renders NOTHING — including its target line, which lives inside it.
 */
export function stripHasContent(strip: Pick<ModelStrip, 'rows'>): boolean {
  return strip.rows.length > 0
}

/**
 * ⭐⭐ IS THE STRIP ACTUALLY OFFERING THE SUCCESS-TARGET CONTROL?
 *
 * ⚠⚠ THIS EXISTS BECAUSE "THE MODEL HAS A GOAL" IS THE WRONG QUESTION, AND
 * ASKING IT SHIPPED A REGRESSION. The glance suppresses its own "define a
 * success measure" card when the strip is already offering the same control —
 * but the first version of that suppression keyed on `resolveGoalNodeId(nodes)
 * !== null`, which is TRUE on a goal-only or goal+decision model where
 * `ModelStrip` returns null at `rows.length === 0` and offers nothing at all.
 * On exactly those models the panel would have lost its only visible way to set
 * a target, leaving the ask behind a collapsed Strengthen section.
 *
 * Found by independent review (Codex, CHANGES_REQUIRED on #1120), which is
 * where it should have been found — I named this failure mode in the review
 * request and still wrote the narrower predicate.
 *
 * Both conditions, in ONE place, so no caller can ask half the question:
 * the strip must render, AND it must have a goal to attach a target to
 * (`SuccessTargetLine` returns null without one — a control writing nowhere).
 */
export function stripRendersTargetAffordance(strip: ModelStrip): boolean {
  return stripHasContent(strip) && strip.goalNodeId !== null
}

export function resolveGoalNodeId(
  nodes: ReadonlyArray<{ id: string; type?: string; data?: unknown }>,
): string | null {
  for (const node of nodes) {
    if (resolveNodeTypeLiteral(node) === 'goal') return node.id
  }
  return null
}

export function buildModelStrip(
  nodes: ReadonlyArray<{ id: string; type?: string; data?: unknown }>,
): ModelStrip {
  const byKind = new Map<string, StripNode[]>()
  let goalLabel: string | null = null
  // ⚠ ONE OWNER. Never re-derive this inline — see `resolveGoalNodeId`.
  const goalNodeId: string | null = resolveGoalNodeId(nodes)
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
    const isFactor = kind === 'factor'
    const entry: StripNode = {
      id: node.id,
      label: labelOf(node),
      // Scoped to the predicate's own domain — see `StripNode.needsCheck`.
      needsCheck: isFactor && factorIsConfirmable(node.data),
      // Both scoped to factors for the reasons on the fields themselves.
      valueText: isFactor
        ? factorDisplayText(node.data as Record<string, unknown> | null | undefined)
        : null,
      valueSource: isFactor ? nodeValueSource(node) : undefined,
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
    // ⚠ THE GOAL NODE ONLY, never the decision node's id as a fallback. The
    // header LABEL may come from either — both name the thing the rows are
    // about — but a success target belongs to a goal, and writing one onto a
    // decision node would put a threshold where nothing reads it.
    goalNodeId,
    rows,
    total: rows.reduce((n, r) => n + r.nodes.length, 0),
    needsCheckTotal: rows.reduce(
      (n, r) => n + r.nodes.filter((x) => x.needsCheck).length,
      0,
    ),
  }
}
