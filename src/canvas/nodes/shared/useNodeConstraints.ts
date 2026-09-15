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
import type { CEEGoalConstraint } from '../../../adapters/cee/types'

export interface NodeConstraints {
  /** The constraints binding to this node, producer order preserved. */
  readonly matching: ReadonlyArray<CEEGoalConstraint & { probability?: number }>
  /** One ruled sentence per constraint, target name omitted — the card names it. */
  readonly lines: readonly string[]
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
  const source = useMemo(() => {
    const post = Array.isArray(postAnalysis)
      ? (postAnalysis as Array<CEEGoalConstraint & { probability?: number }>)
      : null
    return resultsStatus === 'complete' ? (post ?? preAnalysis) : preAnalysis
  }, [resultsStatus, postAnalysis, preAnalysis])

  const matching = useMemo(() => {
    if (!source?.length) return []
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

  return { matching, lines }
}
