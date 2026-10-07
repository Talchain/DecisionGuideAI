import { resolveOptionInterventionsForDisplay } from '../utils/factorOptionSetting'
import { unwrapInterventionValue } from '../utils/labelUtils'
import { findPathsToGoal } from '../utils/pathFinding'
import { resolveGoalTarget } from '../domain/goalTarget'
import { editNoteCopy as copy } from './editNoteCopy'

export interface EditNode { id: string; type?: string; data: Record<string, unknown> }
export interface EditGraph {
  nodes: EditNode[]
  edges: { id: string; source: string; target: string }[]
  options?: readonly { id: string; interventions?: unknown; intervention_details?: unknown }[] | null
}
export interface ManualEdit {
  kind: 'factor_value_edit' | 'option_intervention_edit' | 'goal_target_edit' | 'structural_add' | 'structural_add_edge' | 'structural_rename'
  elementId: string
  factorId?: string
  accepted: boolean
  origin?: 'manual' | 'proposal'
}
export type EditNoteCheck = 'F1' | 'A1' | 'A2' | 'O1' | 'O2' | 'R1' | 'G1'
export type EditNoteAction = { kind: 'option' | 'link' | 'rename' | 'keep' | 'discuss' | 'run'; label: string; nodeIds?: string[]; intent?: 'lever-today' | 'connect' | 'differentiate' }
export interface EditNote { check: EditNoteCheck; tier: 'T1' | 'T2' | 'T4'; elementId: string; words: string; actions: EditNoteAction[] }
export interface EditNoteInput { edit: ManualEdit; before: EditGraph; after: EditGraph; readinessBefore?: unknown; readinessAfter?: unknown }
const kindOf = (node: EditNode) => node.type ?? node.data.kind ?? node.data.type
const labelOf = (node: EditNode) => typeof node.data.label === 'string' ? node.data.label.trim() : ''
const settingMap = (node: EditNode, graph: EditGraph) => resolveOptionInterventionsForDisplay(node, graph.options?.find(o => o.id === node.id))
const profile = (node: EditNode, graph: EditGraph) => {
  const entries = Object.entries(settingMap(node, graph) ?? {}).map(([id, raw]) => {
    const value = unwrapInterventionValue(raw).value
    return [id, value ?? (typeof raw === 'string' ? raw : null)] as const
  }).sort(([a], [b]) => a.localeCompare(b))
  // Unknown settings cannot prove two complete profiles are identical.
  return entries.length && entries.every(([, value]) => value !== null) ? JSON.stringify(entries) : null
}

/** Pure deterministic checks over the committed edit, in tier order. No store reads. */
export function deriveEditNote({ edit, before, after }: EditNoteInput): EditNote | null {
  if (!edit.accepted || edit.origin === 'proposal') return null
  const node = after.nodes.find(n => n.id === edit.elementId)
  if (!node) return null
  const label = labelOf(node)
  if (!label) return null
  const goal = after.nodes.find(n => kindOf(n) === 'goal')
  const options = after.nodes.filter(n => kindOf(n) === 'option')
  const reachesGoal = (id: string) => !!goal && (id === goal.id || findPathsToGoal(id, goal.id, [...after.edges], { maxDepth: after.nodes.length }).length > 0)
  const keep: EditNoteAction = { kind: 'keep', label: copy.actions.keep }
  const discuss = (intent: 'lever-today' | 'connect' | 'differentiate', nodeIds: string[]): EditNoteAction => ({ kind: 'discuss', label: copy.actions.discuss, intent, nodeIds })
  const link = (id: string): EditNoteAction => ({ kind: 'link', label: copy.actions.link, nodeIds: [id] })
  const result = (check: EditNoteCheck, tier: EditNote['tier'], words: string, actions: EditNoteAction[]): EditNote => ({ check, tier, elementId: node.id, words, actions })

  if (edit.kind === 'structural_add' && goal && node.id !== goal.id) {
    const connected = after.edges.some(e => e.source === node.id || e.target === node.id)
    if (!connected) return result('A1', 'T1', copy.A1(label, labelOf(goal)), [link(node.id), discuss('connect', [node.id]), keep])
    if (!reachesGoal(node.id)) return result('A2', 'T1', copy.A2(label, labelOf(goal)), [link(node.id), discuss('connect', [node.id]), keep])
  }
  if (edit.kind === 'option_intervention_edit' && kindOf(node) === 'option') {
    const own = profile(node, after)
    const other = own && options.find(o => o.id !== node.id && profile(o, after) === own)
    if (other) return result('O1', 'T1', copy.O1(label, labelOf(other)), [
      { kind: 'option', label: copy.actions.editOption, nodeIds: [node.id] }, discuss('differentiate', [node.id, other.id]),
    ])
    const factor = after.nodes.find(n => n.id === edit.factorId)
    if (factor && goal && !reachesGoal(factor.id)) return result('O2', 'T1', copy.O2(labelOf(factor), label), [link(factor.id), discuss('connect', [factor.id])])
  }
  if (edit.kind === 'factor_value_edit' && kindOf(node) === 'factor') {
    const setters = options.filter(o => settingMap(o, after)?.[node.id] != null
      || after.edges.some(e => e.source === o.id && e.target === node.id))
    if (setters.length === 0) return null
    const keepers = options.filter(o => !setters.includes(o))
    const words = keepers.length === 0 ? copy.F1All(label) : copy.F1Some(label, setters.map(labelOf), keepers.map(labelOf))
    return result('F1', 'T2', words, [{ kind: 'option', label: copy.actions.option, nodeIds: setters.map(o => o.id) }, keep, discuss('lever-today', [node.id])])
  }
  if (edit.kind === 'structural_rename' && after.nodes.some(n => n.id !== node.id && labelOf(n).toLocaleLowerCase('en-GB') === label.toLocaleLowerCase('en-GB'))) {
    return result('R1', 'T2', copy.R1(label), [{ kind: 'rename', label: copy.actions.rename, nodeIds: [node.id] }, keep])
  }
  if (edit.kind === 'goal_target_edit' && kindOf(node) === 'goal') {
    const old = before.nodes.find(n => n.id === node.id)
    if (!resolveGoalTarget(old?.data) && resolveGoalTarget(node.data)) return result('G1', 'T4', copy.G1(label), [{ kind: 'run', label: copy.actions.run }])
  }
  return null
}
