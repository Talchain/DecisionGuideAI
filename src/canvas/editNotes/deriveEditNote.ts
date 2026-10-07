import { readGoalChanceLicence, type GoalChanceDriver } from '../../components/results/utils/goalChanceLicence'
import { formatFlipValue } from '../../components/results/utils/flipThresholdDisplay'
import { resolveOptionInterventionsForDisplay } from '../utils/factorOptionSetting'
import { unwrapInterventionValue } from '../utils/labelUtils'
import { findPathsToGoal } from '../utils/pathFinding'
import { resolveGoalTarget } from '../domain/goalTarget'
import { isEdgeFragile, parallelEdgeIdsFor, type FragileEdgeCandidate } from '../utils/fragileEdgeMatch'
import { turningPointNumberPrints } from '../nodes/shared/factorTurningPoint'
import type { FactorTurningPoint } from '../nodes/shared/nodeAttention'
import { formatValueWithUnit } from '../utils/formatValueWithUnit'
import { editNoteCopy as copy } from './editNoteCopy'

export interface EditNode { id: string; type?: string; data: Record<string, unknown> }
export interface EditEdge { id: string; source: string; target: string; data?: Record<string, unknown> }
export interface EditGraph {
  nodes: EditNode[]
  edges: EditEdge[]
  options?: readonly { id: string; interventions?: unknown; intervention_details?: unknown }[] | null
  goal_constraints?: readonly GoalConstraint[] | null
}
export interface GoalConstraint { constraint_id?: string; node_id?: string; operator?: string; value?: number; unit?: string }
export interface LastRunSnapshot {
  visible: boolean
  runId: string
  /** The reporter may pass the displayed report; the licence is always decoded by its canonical reader. */
  report?: unknown
  drivers?: Readonly<Record<string, GoalChanceDriver>>
  fragileEdges?: readonly FragileEdgeCandidate[]
  turningPoints?: Readonly<Record<string, FactorTurningPoint>> | ReadonlyMap<string, FactorTurningPoint>
  goalConstraints?: readonly GoalConstraint[] | null
  limitVerdicts?: { perLimit?: readonly { constraintId: string; state: string }[] } | null
}
export interface ManualEdit {
  kind: 'factor_value_edit' | 'option_intervention_edit' | 'goal_target_edit' | 'edge_strength_edit' | 'structural_delete' | 'structural_add' | 'structural_add_edge' | 'structural_rename'
  elementId: string
  factorId?: string
  accepted: boolean
  origin?: 'manual' | 'proposal'
  userFigure?: boolean
}
// F2 (outside the user's own range) is NOT here: the canvas holds no user-owned range to compare against (a user value
// replaces the prior, `factorPriorRange.userValueReplacesPrior`). It waits for that carrier rather than shipping inert.
export type EditNoteCheck = 'F1' | 'A1' | 'A2' | 'O1' | 'O2' | 'R1' | 'G1' | 'S1' | 'D1' | 'S2' | 'F4' | 'F3' | 'X1' | 'G2' | 'O3' | 'O4'
export type DiscussIntent = 'lever-today' | 'connect' | 'differentiate' | 'edit-driver' | 'edit-removed' | 'limit-connect' | 'link' | 'explain' | 'estimate' | 'challenge'
export type EditNoteAction = { kind: 'option' | 'link' | 'rename' | 'keep' | 'discuss' | 'run' | 'undo'; label: string; nodeIds?: string[]; edgeIds?: string[]; intent?: DiscussIntent }
/** `onceKey`: a note with one shows at most once until the notes are cleared (a Run, a proposal approval). T3 keys on
 * the Run and the element (first edit since that Run); O4 keys on the limit's node (one limit, not every option edit). */
export interface EditNote { check: EditNoteCheck; tier: 'T1' | 'T2' | 'T3' | 'T4'; elementId: string; words: string; actions: EditNoteAction[]; onceKey?: string }
export interface EditNoteInput { edit: ManualEdit; before: EditGraph; after: EditGraph; readinessBefore?: unknown; readinessAfter?: unknown; lastRun?: LastRunSnapshot }
const kindOf = (node: EditNode) => node.type ?? node.data.kind ?? node.data.type
const labelOf = (node: EditNode | undefined) => typeof node?.data.label === 'string' ? node.data.label.trim() : ''
const settingMap = (node: EditNode, graph: EditGraph) => resolveOptionInterventionsForDisplay(node, graph.options?.find(o => o.id === node.id))
const valueOf = (node: EditNode | undefined): number | null => {
  const state = node?.data.observedState ?? node?.data.observed_state
  const value = state && typeof state === 'object' ? (state as { value?: unknown }).value : node?.data.value
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
const unitOf = (node: EditNode | undefined): string | undefined => {
  const state = node?.data.observedState ?? node?.data.observed_state
  const unit = state && typeof state === 'object' ? (state as { unit?: unknown }).unit : node?.data.unit
  return typeof unit === 'string' ? unit : undefined
}
/** The link's SIZE: canvas edges carry a signed `strength_mean` (CEE) or an unsigned `weight` (`edgeValueProvenance`). */
const magnitudeOf = (edge: EditEdge | undefined): number | null => {
  const d = edge?.data
  const raw = typeof d?.strength_mean === 'number' ? d.strength_mean : typeof d?.weight === 'number' ? d.weight : null
  return raw !== null && Number.isFinite(raw) ? Math.abs(raw) : null
}
/** The link's DIRECTION as stored (`direction ?? effect_direction`). A reversal is a change of this, never of a sign. */
const directionOf = (edge: EditEdge | undefined): 'positive' | 'negative' | null => {
  const raw = edge?.data?.direction ?? edge?.data?.effect_direction
  return raw === 'positive' || raw === 'negative' ? raw : null
}
const profile = (node: EditNode, graph: EditGraph) => {
  const entries = Object.entries(settingMap(node, graph) ?? {}).map(([id, raw]) => [id, unwrapInterventionValue(raw).value ?? (typeof raw === 'string' ? raw : null)] as const).sort(([a], [b]) => a.localeCompare(b))
  // Unknown settings cannot prove two complete profiles are identical.
  return entries.length && entries.every(([, value]) => value !== null) ? JSON.stringify(entries) : null
}
const driversOf = (run: LastRunSnapshot | undefined) => run?.drivers ?? readGoalChanceLicence((run?.report as { inference_warnings?: unknown } | undefined)?.inference_warnings)?.driverByOption ?? {}
const turningPointOf = (run: LastRunSnapshot, id: string): FactorTurningPoint | undefined => run.turningPoints instanceof Map ? run.turningPoints.get(id) : run.turningPoints?.[id]

/** Pure deterministic checks over the committed edit, in tier order. No store reads. */
export function deriveEditNote({ edit, before, after, lastRun }: EditNoteInput): EditNote | null {
  if (!edit.accepted || edit.origin === 'proposal') return null
  const oldNode = before.nodes.find(n => n.id === edit.elementId)
  const node = after.nodes.find(n => n.id === edit.elementId)
  const oldEdge = before.edges.find(e => e.id === edit.elementId)
  const edge = after.edges.find(e => e.id === edit.elementId)
  const subject = node ?? oldNode
  if (!subject && !edge && !oldEdge) return null
  const label = labelOf(subject)
  if (subject && !edge && !oldEdge && !label) return null
  const goal = after.nodes.find(n => kindOf(n) === 'goal')
  const options = after.nodes.filter(n => kindOf(n) === 'option')
  const reaches = (id: string, target: string) => id === target || findPathsToGoal(id, target, [...after.edges], { maxDepth: after.nodes.length }).length > 0
  const reachesGoal = (id: string) => !!goal && reaches(id, goal.id)
  const keep: EditNoteAction = { kind: 'keep', label: copy.actions.keep }
  const discuss = (intent: DiscussIntent, nodeIds: string[], edgeIds?: string[]): EditNoteAction => ({ kind: 'discuss', label: copy.actions.discuss, intent, nodeIds, ...(edgeIds ? { edgeIds } : {}) })
  const run: EditNoteAction = { kind: 'run', label: copy.actions.runAgain }
  const undo: EditNoteAction = { kind: 'undo', label: copy.actions.undo }
  const result = (check: EditNoteCheck, tier: EditNote['tier'], words: string, actions: EditNoteAction[], onceKey?: string): EditNote => ({
    check, tier, elementId: edit.elementId, words, actions,
    ...(onceKey ? { onceKey } : tier === 'T3' && lastRun ? { onceKey: `${lastRun.runId}\u0000${edit.elementId}` } : {}),
  })
  // An option's changes are the factors it SETS (its settings, or an option→factor link), never the option card itself.
  const optionReaches = (option: EditNode, target: string) => [
    ...Object.keys(settingMap(option, after) ?? {}),
    ...after.edges.filter(e => e.source === option.id).map(e => e.target),
  ].some(factorId => reaches(factorId, target))

  // T1 remains first: lower numbered tiers outrank later tiers.
  if (edit.kind === 'structural_add' && node && goal && node.id !== goal.id) {
    const connected = after.edges.some(e => e.source === node.id || e.target === node.id)
    if (!connected) return result('A1', 'T1', copy.A1(label, labelOf(goal)), [{ kind: 'link', label: copy.actions.link, nodeIds: [node.id] }, discuss('connect', [node.id]), keep])
    if (!reachesGoal(node.id)) return result('A2', 'T1', copy.A2(label, labelOf(goal)), [{ kind: 'link', label: copy.actions.link, nodeIds: [node.id] }, discuss('connect', [node.id]), keep])
  }
  if (edit.kind === 'option_intervention_edit' && node && kindOf(node) === 'option') {
    const constraints = lastRun?.goalConstraints ?? after.goal_constraints ?? []
    const unreachable = constraints.find(c => c.node_id && typeof c.value === 'number' && !options.some(o => optionReaches(o, c.node_id!)))
    const limited = unreachable && after.nodes.find(n => n.id === unreachable.node_id)
    if (unreachable && limited) {
      return result('O4', 'T1', copy.O4(labelOf(limited), formatValueWithUnit(unreachable.value!, unreachable.unit)),
        [discuss('limit-connect', [limited.id]), keep], `limit\u0000${limited.id}`)
    }
    const own = profile(node, after); const other = own && options.find(o => o.id !== node.id && profile(o, after) === own)
    if (other) return result('O1', 'T1', copy.O1(label, labelOf(other)), [{ kind: 'option', label: copy.actions.editOption, nodeIds: [node.id] }, discuss('differentiate', [node.id, other.id])])
    const factor = after.nodes.find(n => n.id === edit.factorId)
    if (factor && goal && !reachesGoal(factor.id)) return result('O2', 'T1', copy.O2(labelOf(factor), label), [{ kind: 'link', label: copy.actions.link, nodeIds: [factor.id] }, discuss('connect', [factor.id])])
  }

  // T2 checks.
  if (edit.kind === 'factor_value_edit' && node && kindOf(node) === 'factor') {
    const setters = options.filter(o => settingMap(o, after)?.[node.id] != null || after.edges.some(e => e.source === o.id && e.target === node.id))
    if (setters.length) {
      const keepers = options.filter(o => !setters.includes(o)); const words = keepers.length === 0 ? copy.F1All(label) : copy.F1Some(label, setters.map(labelOf), keepers.map(labelOf))
      return result('F1', 'T2', words, [{ kind: 'option', label: copy.actions.option, nodeIds: setters.map(o => o.id) }, keep, discuss('lever-today', [node.id])])
    }
  }
  if (edit.kind === 'option_intervention_edit' && node && edit.factorId) {
    const factor = after.nodes.find(n => n.id === edit.factorId); const raw = settingMap(node, after)?.[edit.factorId]; const value = unwrapInterventionValue(raw).value
    const constraint = (lastRun?.goalConstraints ?? after.goal_constraints ?? []).find(c => c.node_id === edit.factorId && c.unit === unitOf(factor) && typeof c.value === 'number')
    if (typeof value === 'number' && constraint && ((constraint.operator?.includes('<') && value > constraint.value!) || (constraint.operator?.includes('>') && value < constraint.value!))) {
      const side = constraint.operator?.includes('<') ? 'above' : 'below'; const unit = constraint.unit
      return result('O3', 'T2', copy.O3(label, labelOf(factor), formatValueWithUnit(value, unit), side, formatValueWithUnit(constraint.value!, unit)), [{ kind: 'option', label: copy.actions.editOption, nodeIds: [node.id] }, keep, discuss('challenge', [node.id])])
    }
  }
  if (edit.kind === 'structural_rename' && node && after.nodes.some(n => n.id !== node.id && labelOf(n).toLocaleLowerCase('en-GB') === label.toLocaleLowerCase('en-GB'))) return result('R1', 'T2', copy.R1(label), [{ kind: 'rename', label: copy.actions.rename, nodeIds: [node.id] }, keep])

  // Every result below is evidence about a displayed previous Run.
  if (lastRun?.visible) {
    const drivers = driversOf(lastRun)
    const optionLabels = (predicate: (d: GoalChanceDriver) => boolean) => Object.entries(drivers).filter(([, d]) => predicate(d)).map(([id]) => labelOf(after.nodes.find(n => n.id === id) ?? before.nodes.find(n => n.id === id))).filter(Boolean)
    const linkDriver = (d: GoalChanceDriver) => (d.kind === 'link_strength' || d.kind === 'link_existence') && d.from === (edge ?? oldEdge)?.source && d.to === (edge ?? oldEdge)?.target
    if (edit.kind === 'edge_strength_edit' && edge && oldEdge) {
      const reversed = directionOf(edge) !== null && directionOf(oldEdge) !== null && directionOf(edge) !== directionOf(oldEdge)
      const before = magnitudeOf(oldEdge), now = magnitudeOf(edge)
      const resized = before !== null && now !== null && Math.abs(before - now) > 1e-9
      const names = optionLabels(linkDriver)
      const driverTalk = discuss('edit-driver', [edge.source, edge.target], [edge.id])
      if (names.length && reversed) return result('D1', 'T3', copy.D1(names), [run, undo, driverTalk])
      if (names.length && resized) {
        const own = Object.values(drivers).some(d => linkDriver(d) && d.authoredBy === 'olumi') && edit.userFigure !== false
        return result('S1', 'T3', own ? copy.S1Own(names) : copy.S1(names), [run, undo, driverTalk])
      }
      // "Any other direction change: no note" (EDIT-AI §3.4): S2 speaks of a strength change only.
      if (!names.length && resized && !reversed) {
        const fragile = isEdgeFragile(edge.id, edge.source, edge.target, [...(lastRun.fragileEdges ?? [])], { parallelEdgeIds: parallelEdgeIdsFor(after.edges, edge.source, edge.target) })
        if (fragile) return result('S2', 'T3', copy.S2, [run, discuss('link', [edge.source, edge.target], [edge.id])])
      }
    }
    if (edit.kind === 'factor_value_edit' && node) {
      const names = optionLabels(d => d.kind === 'factor_value' && d.factorId === node.id)
      if (names.length) return result('F4', 'T3', copy.F4(names, label), [run, discuss('explain', [node.id])])
      const tp = turningPointOf(lastRun, node.id); const old = valueOf(oldNode); const next = valueOf(node)
      if (tp && old !== null && next !== null && (old - tp.flipValue) * (next - tp.flipValue) < 0) {
        const figure = turningPointNumberPrints(tp, unitOf(node)) ? formatFlipValue(tp.flipValue, tp.unit) : null
        return result('F3', 'T3', copy.F3(label, figure), [run, undo, discuss('explain', [node.id])])
      }
    }
    if (edit.kind === 'structural_delete') {
      if (oldEdge) {
        const names = optionLabels(linkDriver)
        if (names.length) return result('X1', 'T3', copy.X1Link(names), [undo, run, discuss('edit-removed', [oldEdge.source, oldEdge.target])])
      } else if (oldNode) {
        // A removed card takes its links with it: a driver ON the card, or a link driver touching it, both count.
        // A turning point alone has no sentence here, so it gets no note (never a sentence with an empty option list).
        const names = optionLabels(d => (d.kind === 'factor_value' && d.factorId === oldNode.id)
          || ((d.kind === 'link_strength' || d.kind === 'link_existence') && (d.from === oldNode.id || d.to === oldNode.id)))
        if (names.length) return result('X1', 'T3', copy.X1Card(names, labelOf(oldNode)), [undo, run, discuss('edit-removed', [oldNode.id])])
      }
    }
    const oldTarget = resolveGoalTarget(oldNode?.data), newTarget = node ? resolveGoalTarget(node.data) : null
    if (edit.kind === 'goal_target_edit' && node && oldTarget && newTarget && String(oldTarget.raw) !== String(newTarget.raw)) return result('G2', 'T3', copy.G2, [run])
  }
  if (edit.kind === 'goal_target_edit' && node && !resolveGoalTarget(oldNode?.data) && resolveGoalTarget(node.data)) return result('G1', 'T4', copy.G1(label), [{ kind: 'run', label: copy.actions.run }])
  return null
}
