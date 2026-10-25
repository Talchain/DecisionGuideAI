/**
 * scenarioDisplayTitle — the name a SAVED scenario row is shown under, outside
 * the canvas (scenario list cards, the compare picker, the compare columns).
 *
 * WHY THIS EXISTS (measured on real staging rows, 4 Oct 2026). Every scenario
 * CEE drafts is stored with `title: null` AND `framing: null`. The canvas still
 * shows a real name for it, because its ladder (`routes/CanvasMVP.tsx`) ends at
 * the GOAL NODE's label in the graph. The list and the picker read only the
 * `title` column and `framing`, so they said "Untitled" for every such row
 * while the canvas, one click away, did not.
 *
 * This is the canvas's ladder applied to the stored row, through the same
 * derivation (`deriveModelNameFromGoal`) so the two cannot drift:
 *   1. the `title` column (a name someone chose; the canvas syncs renames here);
 *   2. `framing.title`;
 *   3. the stored graph's question node label (the question card's words, whole; Paul, 25 Oct 2026);
 *   4. `framing.goal`, derived;
 *   5. the stored graph's goal node label, derived;
 *   6. `framing.decision_question` / `framing.question` (older rows).
 *
 * Returns `null` when nothing names the row, so each surface keeps its own
 * honest "Untitled …" wording. Display only: nothing is written.
 *
 * STORED NODE SHAPE. `scenarios.graph.nodes[]` is CEE's flat shape
 * (`{ id, ref, kind, label, provenance, … }`), not the canvas's
 * `{ type, data: { label } }`. Both are read, because local/guest-saved graphs
 * carry the canvas shape.
 */
import { deriveModelNameFromGoal } from './modelDisplayName'
import { displayLabelText } from './elementLabel'

type Loose = Record<string, unknown>

const asObject = (value: unknown): Loose | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Loose) : null

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null

/** The label of the first node of `kind` in a stored graph, or null. */
function storedNodeLabel(graph: unknown, wanted: 'goal' | 'decision'): string | null {
  const nodes = asObject(graph)?.nodes
  if (!Array.isArray(nodes)) return null
  for (const raw of nodes) {
    const node = asObject(raw)
    if (!node) continue
    const data = asObject(node.data)
    const kind = node.kind ?? data?.kind ?? data?.type ?? node.type
    if (kind !== wanted) continue
    const label = text(node.label) ?? text(data?.label)
    if (label) return label
  }
  return null
}

/** The label of the first goal node in a stored graph, or null. */
export function storedGoalNodeLabel(graph: unknown): string | null {
  return storedNodeLabel(graph, 'goal')
}

/** The question card's words in a stored graph (its producer's "Decision: " prefix off, as the card shows it), or null. */
export function storedQuestionNodeLabel(graph: unknown): string | null {
  const label = storedNodeLabel(graph, 'decision')
  return label === null ? null : displayLabelText(label, 'decision')
}

/**
 * The option labels in a stored graph, in stored order, without repeats. Used
 * by the scenario list to tell apart rows that resolve to the same title.
 */
export function storedOptionLabels(graph: unknown): string[] {
  const nodes = asObject(graph)?.nodes
  if (!Array.isArray(nodes)) return []
  const labels: string[] = []
  for (const raw of nodes) {
    const node = asObject(raw)
    if (!node) continue
    const data = asObject(node.data)
    const kind = node.kind ?? data?.kind ?? data?.type ?? node.type
    if (kind !== 'option') continue
    const label = text(node.label) ?? text(data?.label)
    if (label && !labels.includes(label)) labels.push(label)
  }
  return labels
}

export function scenarioDisplayTitle(row: {
  title?: unknown
  framing?: unknown
  graph?: unknown
}): string | null {
  const framing = asObject(row.framing)
  return (
    text(row.title) ??
    text(framing?.title) ??
    storedQuestionNodeLabel(row.graph) ??
    deriveModelNameFromGoal(framing?.goal) ??
    deriveModelNameFromGoal(storedGoalNodeLabel(row.graph)) ??
    text(framing?.decision_question) ??
    text(framing?.question)
  )
}
