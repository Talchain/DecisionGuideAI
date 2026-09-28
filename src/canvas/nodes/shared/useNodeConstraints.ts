/**
 * ⭐⭐ THE ONE PLACE THAT DECIDES WHICH CONSTRAINTS NAME THIS NODE.
 *
 * A constraint is a boundary the reader chose — *"keep monthly churn under
 * 4%"*, *"net revenue retention above 110%"*. Three surfaces need to know which
 * ones bind to a given card, and before this hook the identity-matching rules
 * lived in `FactorNode` alone, where only the factor badge could use them.
 *
 * ⛔ AND THE STARTERS SAY WHY THAT MATTERED: of the constraints carried by the
 * shipped starter models, **not one targets a factor**. `headcount-allocation`
 * constrains a GOAL, `pricing-model` constrains an OUTCOME. A constraint
 * surface built on `FactorNode` is dark on exactly the models that have
 * constraints.
 */
import { useMemo } from 'react'
import { useCanvasStore } from '../../store'
import { goalConstraintText } from '../../utils/goalConstraintText'
import { goalCardShownLimits, sameConstraintRow } from '../../domain/goalOwnTargetRow'
import type { GoalTargetSource } from '../../domain/goalTarget'
import type { CEEGoalConstraint } from '../../../adapters/cee/types'

export interface NodeConstraints {
  /** The constraints binding to this node, producer order preserved.
   *  ⚠ NO `probability` IN THIS TYPE. Only the POST-analysis slice carries one,
   *  and this hook produces TEXT — the satisfaction figure is `GoalNode`'s
   *  business and it makes its own selection. Widening here would promise a
   *  field that is absent on every pre-analysis constraint. */
  readonly matching: readonly CEEGoalConstraint[]
  /** One ruled sentence per constraint, target name omitted — the card names it. */
  readonly lines: readonly string[]
  /**
   * ⭐ THE LINES THIS CARD STATES: `lines` less every limit the GOAL card
   * already shows, by row identity (side-by-side DIFF pre-run item 7, 28 Sep
   * 2026). See the hook body.
   */
  readonly cardLines: readonly string[]
}

export function useNodeConstraints(nodeId: string, nodeLabel: string): NodeConstraints {
  const preAnalysis = useCanvasStore(s => s.goalConstraints)
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const postAnalysis = useCanvasStore(
    s => (s.results?.report as { goal_constraints?: unknown } | null | undefined)?.goal_constraints,
  )
  const allNodes = useCanvasStore(s => s.nodes)

  /**
   * ⚠ POST-ANALYSIS CONSTRAINTS CARRY A SATISFACTION PROBABILITY; the
   * pre-analysis slice does not. `GoalNode` has always selected between them
   * this way and this is the same expression, so the two cannot disagree about
   * which set is live.
   */
  const source = useMemo((): readonly CEEGoalConstraint[] => {
    const post = Array.isArray(postAnalysis) ? (postAnalysis as CEEGoalConstraint[]) : null
    const pre: readonly CEEGoalConstraint[] = preAnalysis ?? []
    return resultsStatus === 'complete' ? (post ?? pre) : pre
  }, [resultsStatus, postAnalysis, preAnalysis])

  const matching = useMemo(() => {
    if (!source.length) return []
    /**
     * ⭐ BIND BY IDENTITY, NOT BY LABEL STRING (CLAUDE.md trap 19).
     *
     * `node_id` is the field the producer writes and the field PLoT's preflight
     * resolves against `graph.nodes`. `label` is OPTIONAL on the wire and
     * "genuinely absent in practice" — matching on it meant a constraint
     * carrying a perfectly good `node_id` and no label produced nothing, and
     * the reader's own stated limit never appeared on the graph.
     *
     * ⚠ THE LABEL LEG IS A FALLBACK, NOT A SECOND CHANNEL. Two opposite harms
     * sit under this predicate and cannot share one window: a constraint that
     * DOES reference this node showing nothing, and one that does NOT showing a
     * limit the reader never set. A constraint carrying a `node_id` has already
     * answered the question — its label is not consulted, or a label collision
     * between two nodes badges the wrong one. Label matching survives only for
     * constraints with no `node_id` at all: legacy persisted graphs minted
     * before GoalPanel captured node ids.
     */
    const target = nodeLabel.toLowerCase().trim()
    return source.filter(c => {
      if (c.node_id) return c.node_id === nodeId
      // `label` is optional on the wire — guard before comparing, or a valid
      // unlabelled constraint throws here and takes the node render with it.
      // The empty case is excluded explicitly: `'' === ''` would otherwise
      // match every unnamed node from every unlabelled legacy constraint.
      const l = c.label?.toLowerCase().trim()
      return !!l && !!target && l === target
    })
  }, [source, nodeLabel, nodeId])

  const lines = useMemo(
    () => matching.map(c => goalConstraintText(c, allNodes, { omitLabel: true })),
    [matching, allNodes],
  )

  /**
   * ⭐⭐ ONE FACT, ONCE (NODE-ANATOMY v3.2 principle 2) — side-by-side DIFF
   * pre-run item 7 (28 Sep 2026). The Outcome's limit line was kept on the
   * premise "the Goal shows no limit pills without a target". Served
   * `b40d5436` pricing: the Goal HAS a target and shows the pill
   * `Net Revenue Retention ≥110%`, while the Outcome still read `Limit ≥ 110%` —
   * one limit, twice, in two formats.
   *
   * So a card drops a limit line ONLY when a Goal card already shows THAT
   * constraint row at rest (`goalCardShownLimits`, the function the Goal's own
   * pill row calls), matched by row identity (`sameConstraintRow`: the same
   * object or the same producer id) — never by its text. A limit the Goal does
   * not show (no target on a Standard Goal, or no Goal on the canvas) stays on
   * this card, so no limit ever disappears from the resting graph.
   */
  const viewMode = useCanvasStore(s => s.viewMode)
  const cardLines = useMemo(() => {
    if (!matching.length) return []
    const isDetailed = viewMode === 'expert'
    const shownOnGoal = allNodes
      .filter(n => n.type === 'goal' && n.id !== nodeId)
      .flatMap(g => goalCardShownLimits(source, g.id, g.data as GoalTargetSource | undefined, isDetailed))
    return matching
      .filter(c => !shownOnGoal.some(g => sameConstraintRow(g, c)))
      .map(c => goalConstraintText(c, allNodes, { omitLabel: true }))
  }, [matching, allNodes, source, viewMode, nodeId])

  return { matching, lines, cardLines }
}
