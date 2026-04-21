/**
 * V5GraphPatchBlock — renders V5 graph_patch block (post-hoc acknowledgement).
 *
 * Different from V4 ProposalBlock / GraphPatchBlockRenderer: V5 patches are
 * ALREADY APPLIED when they arrive. No Apply/Cancel buttons; just a
 * status card showing what changed.
 *
 * Statuses:
 *   - 'applied' — mutation applied to the graph. Show operation + target.
 *   - 'noop'    — CEE looked but nothing needed to change. Hide before/after.
 *
 * Design tokens (DS v5 §21.2): card frame, panel typography, semantic border.
 */
import { type ReactElement } from 'react'
import { typography } from '../../styles/typography'
import type { V5GraphPatchBlock as V5GraphPatchBlockType } from '../../canvas/conversation/types'

export interface V5GraphPatchBlockProps {
  block: V5GraphPatchBlockType
}

const OPERATION_LABELS: Record<V5GraphPatchBlockType['operation'], string> = {
  set_factor_value: 'Set factor value',
  add_constraint: 'Add constraint',
  adjust_edge_strength: 'Adjust edge strength',
}

function formatFieldValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'string') return val
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  try {
    return JSON.stringify(val)
  } catch {
    return '[unserialisable]'
  }
}

function renderChangedFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Array<{ field: string; before: string; after: string }> {
  const beforeObj = before ?? {}
  const afterObj = after ?? {}
  const fieldSet = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])
  const out: Array<{ field: string; before: string; after: string }> = []
  for (const field of fieldSet) {
    const b = formatFieldValue(beforeObj[field])
    const a = formatFieldValue(afterObj[field])
    if (b !== a) out.push({ field, before: b, after: a })
  }
  return out
}

export function V5GraphPatchBlock({ block }: V5GraphPatchBlockProps): ReactElement {
  const opLabel = OPERATION_LABELS[block.operation] ?? block.operation
  const isApplied = block.status === 'applied'
  const changes = isApplied ? renderChangedFields(block.before, block.after) : []

  return (
    <div
      data-testid="v5-graph-patch"
      data-status={block.status}
      data-operation={block.operation}
      className="rounded-xl border border-panel-border bg-panel p-4 space-y-2"
    >
      <div className="flex items-center gap-2">
        <span
          className={[
            'inline-flex items-center rounded-full px-2.5 py-0.5',
            'bg-transparent text-text-body',
            isApplied ? 'border border-success/30' : 'border border-text-light/30',
            typography.panelMeta,
          ].join(' ')}
          data-testid="v5-graph-patch-status"
        >
          {isApplied ? 'Applied' : 'No change'}
        </span>
        <h3
          className={typography.panelHeader}
          data-testid="v5-graph-patch-operation"
        >
          {opLabel}
        </h3>
      </div>
      <p className={typography.panelBody} data-testid="v5-graph-patch-target">
        <span className="text-text-light">Target: </span>
        <code className="text-text-body">{block.target_id}</code>
      </p>
      {isApplied && changes.length > 0 && (
        <ul
          className={`${typography.panelMeta} space-y-1`}
          data-testid="v5-graph-patch-changes"
        >
          {changes.map((c) => (
            <li key={c.field} className="flex items-center gap-2">
              <span className="text-text-light">{c.field}:</span>
              <span className="text-text-body">{c.before}</span>
              <span className="text-text-light">→</span>
              <span className="text-text-body font-medium">{c.after}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default V5GraphPatchBlock
