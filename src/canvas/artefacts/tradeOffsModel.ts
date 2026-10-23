/**
 * WHAT EACH OPTION GAINS AND GIVES UP, IN THIS MODEL (Paul, 19 Oct 2026: "pros and cons lists that actually allow the
 * user to edit them and change the data model"; DL-3 GO on Tier 1, 19 Oct 20:54Z).
 *
 * A pure read of the drawn model, never a second store and never a judgement. For each option that changes a factor
 * from where it stands without it, every route from that factor to the goal along the model's own links is one row:
 *   - the option moves the factor UP or DOWN: its target (`resolveOptionTargets`) against the option card's own
 *     reference, the baseline option's target (`resolveBaselineOptionReference`) else the factor's value today, and
 *     "no change" by the card's rule (`isInterventionNoChange`);
 *   - each link passes the movement on with its stated direction (`resolveEdgeDirectionDisplay`, the one read-side gate:
 *     a direction nobody set is never guessed);
 *   - the product of those signs, against the way the goal wants to move, says whether the route moves the goal the way
 *     the user wants (a gain) or the other way (a give-up).
 * A route through a link with no stated direction is "direction not set": it is listed, never sorted into either side.
 * A route moves the goal's DIRECTION only: it says nothing about how much, or which option is better overall (CLAUDE.md
 * §4: model-relative, never a recommendation).
 *
 * ⚠ SCIENCE MAPPING (DL-3 condition 4): this sign rule is the AIE's to sign off before merge.
 */
import type { Edge, Node } from '@xyflow/react'
import { resolveEdgeDirectionDisplay } from '../domain/edgeValueProvenance'
import { goalTargetChangeFrameOf, statedGoalTargetRaw, statedTargetNumber, type GoalTargetSource } from '../domain/goalTarget'
import { goalTargetComparator, isGoalTargetRow } from '../domain/goalOwnTargetRow'
import type { CEEGoalConstraint } from '../../adapters/cee/types'
import { linkIsStructural } from '../edges/edgePresentation'
import { analysisViewIsStale, resolveBaselineOptionReference, resolveOptionTargets } from '../nodes/shared/optionTargetDisplay'
import { isInterventionNoChange } from '../utils/interventionDisplay'
import { baselineGuessBarred, baselineOptionsOf, resolveOptionIsBaseline } from '../utils/baselineDetection'
import { resolveActiveGoalNodeId } from '../hooks/goalThresholdResolvers'
import { goalConstraintText } from '../utils/goalConstraintText'
import { assumptionMapOf, type AssumptionItem, type RestsOnMark } from './assumptionMapModel'

export type GoalWants = 'higher' | 'lower'
export type RouteEffect = 'gains' | 'gives_up' | 'not_set'
export type Move = 'up' | 'down'

export interface RouteStep {
  /** The element this step reaches (the first step is the factor the option changes). */
  readonly nodeId: string
  readonly label: string
  /** How the option moves it along this route, or null once a link's direction is not set. */
  readonly move: Move | null
  /** The link INTO this step (null for the first). */
  readonly edgeId: string | null
  /** The link's "Rests on" item from its owner reader (who said it, in the owner's words); null for the first step and
   *  for a link that holds by definition, which is not an assumption. */
  readonly link: AssumptionItem | null
}

export interface TradeOffRoute {
  readonly key: string
  readonly effect: RouteEffect
  readonly steps: readonly RouteStep[]
}

export interface OptionTradeOffs {
  readonly optionId: string
  readonly label: string
  /** What this option's changes are read against: the baseline option's name, or null for "each factor's value today". */
  readonly againstLabel: string | null
  /** How many factors this option moves from where they stand: 0 means it changes nothing in the model yet. */
  readonly changes: number
  readonly routes: readonly TradeOffRoute[]
}

export interface OptionInterventions {
  readonly id: string
  readonly interventions?: Record<string, unknown>
  readonly intervention_details?: Record<string, unknown>
}

/**
 * Which way the goal should move, from what the goal itself states, never from its words (`getGoalDirection`'s keyword
 * guess and its "maximise" default are not used): the comparator its target holds (`goalTargetComparator`, the editors'
 * one owner: the node's `goal_direction`, else its own limit row), else a target stated as a change (its sign), else a
 * level target against today's level. Anything else is null: the lens then says the goal has no direction yet, and
 * sorts nothing.
 */
export function goalWantsOf(goal: Node | undefined, constraints?: readonly CEEGoalConstraint[] | null): GoalWants | null {
  const data = goal?.data as (GoalTargetSource & { observedState?: { raw_value?: unknown } }) | undefined
  if (!goal || !data) return null
  const held = goalTargetComparator(data, constraints, goal.id)
  if (held !== null) return held === '>=' || held === '>' ? 'higher' : 'lower'
  const target = statedTargetNumber(statedGoalTargetRaw(data))
  if (target === null || target === 0) return null
  if (goalTargetChangeFrameOf(data.goal_threshold_frame) !== null) return target > 0 ? 'higher' : 'lower'
  const today = statedTargetNumber(data.observedState?.raw_value)
  if (today === null || today === target) return null
  return target > today ? 'higher' : 'lower'
}

/** Bounds on the walk: a model's routes are short; these only stop a pathological graph from stalling a render. */
const MAX_DEPTH = 8
const MAX_ROUTES_PER_OPTION = 24

const labelOf = (n: Node | undefined, id: string): string => String(n?.data?.label ?? id)

const observedValueOf = (factor: Node | undefined): number | null => {
  const value = (factor?.data as { observedState?: { value?: unknown } } | undefined)?.observedState?.value
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** +1 for a link stated as positive, -1 negative, null when nobody set its direction. */
function linkSign(edge: Edge): 1 | -1 | null {
  const d = resolveEdgeDirectionDisplay(edge.data as Record<string, unknown> | undefined)
  return d.show ? (d.direction === 'positive' ? 1 : -1) : null
}

/**
 * Every option's trade-offs. `isBaseline` is the caller's one baseline resolver (`resolveOptionIsBaseline`), so this
 * never re-decides which option is the status quo. `goalWants` null (no goal, or no stated direction) leaves every
 * route "not set": the moves are still shown, sorted into neither side.
 */
export function tradeOffsOf(input: {
  readonly nodes: readonly Node[]
  readonly edges: readonly Edge[]
  readonly goalId: string | null
  readonly goalWants: GoalWants | null
  readonly ceeOptions?: readonly OptionInterventions[]
  readonly viewStale?: boolean
  readonly isBaseline: (option: Node) => boolean
}): OptionTradeOffs[] {
  const { nodes, edges, goalId, goalWants, ceeOptions, viewStale, isBaseline } = input
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const ceeOf = (id: string) => ceeOptions?.find((o) => o.id === id)
  const options = nodes.filter((n) => n.type === 'option')
  const baseline = options.find(isBaseline) ?? null
  const linkItems = linkItemsOf(nodes, edges, goalId)
  // Causal links only: the option → factor wiring is the option's own change, read from its targets.
  const out = new Map<string, Edge[]>()
  for (const e of edges) {
    const from = byId.get(e.source)
    const to = byId.get(e.target)
    if (!from || !to || linkIsStructural(from.type, to.type, e.data)) continue
    const list = out.get(e.source)
    if (list) list.push(e)
    else out.set(e.source, [e])
  }

  return options.filter((o) => o !== baseline).map((option) => {
    const routes: TradeOffRoute[] = []
    let changes = 0
    // The card's own reference: the baseline option's target, else the factor's value today.
    const reference = resolveBaselineOptionReference(nodes, ceeOptions, option.id)
    if (goalId !== null) {
      for (const [factorId, { value: target }] of resolveOptionTargets(option.data as Record<string, unknown>, ceeOf(option.id), { viewStale })) {
        const against = reference?.values[factorId]?.value ?? observedValueOf(byId.get(factorId))
        if (against == null || isInterventionNoChange(against, target)) continue
        changes += 1
        const start: RouteStep = {
          nodeId: factorId, label: labelOf(byId.get(factorId), factorId), move: target > against ? 'up' : 'down', edgeId: null, link: null,
        }
        const walk = (path: RouteStep[], seen: Set<string>) => {
          if (routes.length >= MAX_ROUTES_PER_OPTION) return
          const at = path[path.length - 1]
          if (at.nodeId === goalId) {
            const end = at.move
            const effect: RouteEffect = end === null || goalWants === null ? 'not_set'
              : (end === 'up') === (goalWants === 'higher') ? 'gains' : 'gives_up'
            routes.push({ key: `${option.id}:${path.map((s) => s.edgeId ?? s.nodeId).join('>')}`, effect, steps: path })
            return
          }
          if (path.length > MAX_DEPTH) return
          for (const e of out.get(at.nodeId) ?? []) {
            if (seen.has(e.target)) continue
            const sign = linkSign(e)
            const move: Move | null = at.move === null || sign === null ? null : (at.move === 'up') === (sign === 1) ? 'up' : 'down'
            seen.add(e.target)
            walk([...path, { nodeId: e.target, label: labelOf(byId.get(e.target), e.target), move, edgeId: e.id, link: linkItems.get(e.id) ?? null }], seen)
            seen.delete(e.target)
          }
        }
        walk([start], new Set([factorId]))
      }
    }
    return { optionId: option.id, label: labelOf(option, option.id), againstLabel: reference?.label ?? null, changes, routes }
  })
}

/** Each link's "Rests on" item, by link id: the owner reader's own words, read once. */
function linkItemsOf(nodes: readonly Node[], edges: readonly Edge[], goalId: string | null): Map<string, AssumptionItem> {
  const items = new Map<string, AssumptionItem>()
  for (const item of assumptionMapOf(nodes, edges, goalId).items) if (item.target.kind === 'edge') items.set(item.target.id, item)
  return items
}

/** A risk the model holds, with its links into the model as their owner reads them. */
export interface ModelRisk {
  readonly id: string
  readonly label: string
  readonly links: readonly { readonly toLabel: string; readonly item: AssumptionItem }[]
}

/**
 * What the model holds that bears on the goal whichever option is chosen, read as it is (never hidden, never sorted
 * into a gain or a give-up, never pinned to an option): every risk with its links, and the goal's limits in the goal
 * card's own words (`goalConstraintText`; the goal's own target rows are the target, not a limit).
 */
export function alsoInModelOf(state: Pick<TradeOffsState, 'nodes' | 'edges' | 'goalConstraints'>, goalId: string | null): {
  readonly risks: readonly ModelRisk[]
  readonly limits: readonly { readonly id: string; readonly text: string }[]
} {
  const byId = new Map(state.nodes.map((n) => [n.id, n]))
  const linkItems = linkItemsOf(state.nodes, state.edges, goalId)
  const risks = state.nodes.filter((n) => n.type === 'risk').map((risk) => ({
    id: risk.id,
    label: labelOf(risk, risk.id),
    links: state.edges.flatMap((e) => {
      const item = e.source === risk.id ? linkItems.get(e.id) : undefined
      return item ? [{ toLabel: labelOf(byId.get(e.target), e.target), item }] : []
    }),
  }))
  const limits = (state.goalConstraints ?? []).filter((c) => !isGoalTargetRow(c)).map((c, i) => ({
    id: c.constraint_id ?? `${c.node_id ?? 'limit'}:${i}`,
    text: goalConstraintText(c, state.nodes),
  }))
  return { risks, limits }
}

/** The store slice the trade-offs read needs: one entry point for the lens and its key card. */
export interface TradeOffsState {
  readonly nodes: readonly Node[]
  readonly edges: readonly Edge[]
  readonly ceeAnalysisReady?: { readonly current_graph_hash?: string; readonly goal_node_id?: string | null; readonly options?: readonly (OptionInterventions & { is_baseline?: boolean | null })[] } | null
  readonly lastServerGraphHash?: string | null
  readonly outcomeNodeId?: string | null
  readonly goalConstraints?: readonly CEEGoalConstraint[] | null
  readonly servedBaselineOptions?: ReadonlyArray<{ id: string; is_baseline?: boolean | null }>
}

/** Every option's trade-offs from the store, with the goal and the baseline resolved by their one owners. */
export function tradeOffsForState(state: TradeOffsState): {
  readonly goalId: string | null
  readonly goalLabel: string | null
  readonly goalWants: GoalWants | null
  readonly options: OptionTradeOffs[]
  readonly alsoInModel: ReturnType<typeof alsoInModelOf>
} {
  const goalId = resolveActiveGoalNodeId({ ceeAnalysisReady: state.ceeAnalysisReady, outcomeNodeId: state.outcomeNodeId, nodes: state.nodes })
  const goal = goalId === null ? undefined : state.nodes.find((n) => n.id === goalId)
  const goalWants = goalWantsOf(goal, state.goalConstraints)
  const flags = baselineOptionsOf(state)
  const barred = baselineGuessBarred(state.nodes, flags)
  const options = tradeOffsOf({
    nodes: state.nodes,
    edges: state.edges,
    goalId,
    goalWants,
    ceeOptions: state.ceeAnalysisReady?.options,
    viewStale: analysisViewIsStale(state.ceeAnalysisReady, state.lastServerGraphHash),
    isBaseline: (o) => resolveOptionIsBaseline(o.data as { is_baseline?: unknown; label?: unknown }, flags?.find((f) => f.id === o.id), barred),
  })
  return { goalId, goalLabel: goal ? labelOf(goal, goal.id) : null, goalWants, options, alsoInModel: alsoInModelOf(state, goalId) }
}

/**
 * Each link on the option's routes, numbered from 1 in the order the key lists them (route by route), with its "Rests
 * on" state: the same pill on the canvas and in the key, so a number in one is found in the other. Numbers are identity,
 * not rank. A link that holds by definition carries no state and no number.
 */
export function tradeOffLinkMarks(option: OptionTradeOffs): Map<string, RestsOnMark> {
  const marks = new Map<string, RestsOnMark>()
  for (const route of option.routes) {
    for (const step of route.steps) {
      if (step.edgeId === null || step.link === null || marks.has(step.edgeId)) continue
      marks.set(step.edgeId, { n: marks.size + 1, column: step.link.column })
    }
  }
  return marks
}

