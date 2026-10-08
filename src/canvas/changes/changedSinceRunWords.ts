import type { ChangedSinceRun } from './changedSinceRun'
import { safeInterpolatedLabel } from '../../components/results/utils/glossaryCheck'

const MAX_LABEL_CHARS = 48
const MAX_NAMED_ITEMS = 3
const UNQUOTABLE = '__olumi_unquotable_label__'

/** Follow the existing footer policy: truncate first, then vet exactly the words that would ship. */
function displayLabel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  const display = trimmed.length <= MAX_LABEL_CHARS
    ? trimmed
    : `${trimmed.slice(0, MAX_LABEL_CHARS - 1).trimEnd()}…`
  return safeInterpolatedLabel(display, UNQUOTABLE) === UNQUOTABLE ? null : display
}

function joinItems(items: readonly string[]): string {
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function otherChanges(count: number): string {
  return `${count} other ${count === 1 ? 'change' : 'changes'}`
}

/** The words for the server's changed-since-Run set, resolved against the current canvas. */
export function changedSinceRunWords(
  value: ChangedSinceRun,
  nodes: readonly { id: string; data?: { label?: unknown } }[],
): string | null {
  const itemCount = value.nodeIds.size + value.linkKeys.size
  if (value.sinceRunId === null || (itemCount === 0 && value.unattributedChanges === 0)) return null

  const qualifier = value.complete ? '' : ' This list may be incomplete.'
  if (itemCount === 0) {
    const n = value.unattributedChanges
    return `${n} ${n === 1 ? 'change' : 'changes'} since your last Run.${qualifier}`
  }

  const labels = new Map(nodes.map(node => [node.id, displayLabel(node.data?.label)] as const))
  const named: string[] = []
  for (const id of value.nodeIds) {
    const label = labels.get(id)
    if (label != null) named.push(`‘${label}’`)
  }
  for (const key of value.linkKeys) {
    const boundary = key.indexOf('\u0000')
    if (boundary < 0) continue
    const from = labels.get(key.slice(0, boundary))
    const to = labels.get(key.slice(boundary + 1))
    if (from != null && to != null) named.push(`the link from ‘${from}’ to ‘${to}’`)
  }

  const shown = named.slice(0, MAX_NAMED_ITEMS)
  const items = shown.length > 0 ? [...shown] : [`${itemCount} ${itemCount === 1 ? 'item' : 'items'}`]
  // The producer's full set counts even when an element can no longer be named on the current canvas.
  const remainingCount = itemCount - shown.length
  if (shown.length > 0 && remainingCount > 0) items.push(`${remainingCount} more`)
  if (value.unattributedChanges > 0) items.push(otherChanges(value.unattributedChanges))
  // No author: the set holds applied changes from the user AND from Olumi, so the words never say "you changed".
  return `Changed since your last Run: ${joinItems(items)}.${qualifier}`
}
