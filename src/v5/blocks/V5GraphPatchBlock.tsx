/**
 * V5GraphPatchBlock — renders V5 graph_patch block (post-hoc acknowledgement).
 *
 * Different from V4 ProposalBlock / GraphPatchBlockRenderer: V5 patches are
 * ALREADY APPLIED when they arrive. No Apply/Cancel buttons; just a
 * status card showing what changed.
 *
 * Workstream 1 (Journey 3 / Journey 6) — receipt is now a clean human
 * description derived UI-side from the canvas store. Raw target_id,
 * operator codes, schema field names and before/after JSON keys MUST NOT
 * appear in the default surface. The friendly description is built by
 * `buildV5PatchReceipt` (mirrors the V4 friendlyOperation.ts pattern).
 *
 * Statuses:
 *   - 'applied' — mutation applied to the model. Receipt shows the
 *                 entity affected and the change in plain English.
 *   - 'noop'    — CEE looked but nothing needed to change. Receipt
 *                 indicates the no-op without surfacing field names.
 *
 * Design tokens (DS v5 §21.2): card frame, panel typography, semantic border.
 */
import { useMemo, type ReactElement } from 'react'
import { typography } from '../../styles/typography'
import { useCanvasStore } from '../../canvas/store'
import { useAnalysisFreshnessState } from '../../lib/useAnalysisFreshnessState'
import type { V5GraphPatchBlock as V5GraphPatchBlockType } from '../../canvas/conversation/types'
import { buildV5PatchReceipt, buildV5PatchDeps } from './v5GraphPatchDescription'

export interface V5GraphPatchBlockProps {
  block: V5GraphPatchBlockType
}

export function V5GraphPatchBlock({ block }: V5GraphPatchBlockProps): ReactElement {
  // Pull only the slices we need; useCanvasStore selectors keep the
  // subscription scoped so the block does not re-render on unrelated
  // store updates.
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)

  const receipt = useMemo(
    () => buildV5PatchReceipt(block, buildV5PatchDeps(nodes, edges)),
    [block, nodes, edges],
  )

  // Workstream 1, Phase 3c — distinct freshness vs structural readiness.
  // When the mutation just landed AND a prior analysis is now out of date,
  // surface a small hint inline with the receipt so the user understands
  // the impact without navigating to the results panel. We deliberately
  // only surface the 'stale' verdict here; 'fresh' / 'none' / 'unknown'
  // would be redundant noise alongside the run/rerun chip the CEE already
  // emits.
  const freshness = useAnalysisFreshnessState()
  const showStaleHint =
    receipt.status === 'applied' && freshness.freshness === 'stale'

  const isApplied = receipt.status === 'applied'

  return (
    // No `data-operation` / `data-status` attributes: those would leak
    // schema terms (e.g. `add_constraint`, `noop`) into the rendered
    // DOM (visible via outerHTML / DevTools), breaching the V5 UI
    // rendering contract. Tests address the card via `data-testid` and
    // assert friendly text via the per-row testids below.
    <div
      data-testid="v5-change-receipt"
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
          data-testid="v5-change-status"
        >
          {isApplied ? 'Applied' : 'No change'}
        </span>
        <h3
          className={typography.panelHeader}
          data-testid="v5-change-action"
        >
          {receipt.actionLabel}
        </h3>
      </div>
      {receipt.entityLabel && (
        <p
          className={typography.panelBody}
          data-testid="v5-change-entity"
        >
          {receipt.entityLabel}
        </p>
      )}
      {receipt.changeSummary && (
        <p
          className={`${typography.panelMeta} text-text-body`}
          data-testid="v5-change-summary"
        >
          {receipt.changeSummary}
        </p>
      )}
      {showStaleHint && (
        <p
          className={`${typography.panelMeta} text-text-light`}
          data-testid="v5-change-freshness-hint"
        >
          Latest analysis is now out of date.
        </p>
      )}
    </div>
  )
}

export default V5GraphPatchBlock
