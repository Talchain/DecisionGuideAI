/**
 * MissingData — Subgroup 3: Factors with no observed data.
 *
 * Brief 5.2 Task 3: rows render the inline ScientificEditor by default. The
 * Pencil affordance is removed — the editor IS the default state for a
 * missing-data row, so there is no "open editor" action to expose. The row
 * collapses to a no-editor layout (name + Not set + technique hint +
 * sparkle) only when another editor elsewhere in Your expertise becomes
 * active (activeEditorKey != null), preserving the one-active-editor
 * invariant from Brief 5.1 follow-up P0 #1.
 */

import { SubgroupDivider } from '../primitives/SubgroupDivider'
import Tooltip from '../../../../components/Tooltip'
import { typography } from '@/styles/typography'
import type { ImprovementItem } from '../hooks/usePreAnalysisData'
import { DiscussWithAiButton } from '../DiscussWithAiButton'
import { ScientificEditor } from '@/components/shared/ScientificEditor'

interface MissingDataProps {
  items: ImprovementItem[]
  onFocusNode?: (nodeId: string) => void
  /** Retained for legacy deep-link plumbing; no affordance in the row renders it. */
  onSetValue?: (nodeId: string) => void
  factorInfluenceMap?: Map<string, number>
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
  /**
   * Brief 5.1 follow-up P0 #1 — see AiEstimated for semantics. Brief 5.2 Task 3
   * simplifies interpretation for Missing-data rows: when activeEditorKey is
   * null, every Missing-data row's editor is open; when non-null (an
   * AiEstimated row is editing), all Missing-data rows collapse.
   */
  activeEditorKey?: string | null
  onRequestEdit?: (itemKey: string) => void
  onCommitValue?: (nodeId: string, rawValue: number) => void
  onCancelEdit?: () => void
}

function getTechniqueHint(label: string): { text: string; tooltip: string } {
  if (/rate|churn/i.test(label)) {
    return {
      text: 'Try: reference class forecasting',
      tooltip: 'Estimate by finding similar situations and using their outcomes as a baseline',
    }
  }
  return {
    text: 'Try: outside view technique',
    tooltip: 'Step back from the specifics and consider base rates from comparable cases',
  }
}

export function MissingData({
  items,
  onFocusNode,
  onSetValue,
  factorInfluenceMap,
  onHoverEnter,
  onHoverLeave,
  activeEditorKey,
  onRequestEdit,
  onCommitValue,
  onCancelEdit,
}: MissingDataProps) {
  if (items.length === 0) return null

  const inlineEditorAvailable = onRequestEdit != null && onCommitValue != null && onCancelEdit != null
  // Brief 5.2 Task 3: Missing-data rows render their editor BY DEFAULT. They
  // collapse only when some other editor (an AiEstimated row's Pencil) has
  // claimed the active slot. This keeps the one-active-editor invariant
  // from Brief 5.1 without an explicit "open editor" Pencil affordance.
  const anotherEditorIsActive = activeEditorKey != null

  return (
    <div className="space-y-1">
      <SubgroupDivider label={`Missing data (${items.length})`} />
      {items.map(item => {
        const nodeId = item.focus?.id
        const influence = nodeId ? factorInfluenceMap?.get(nodeId) : undefined
        const influencePct = influence != null ? Math.round(influence * 100) : null
        const technique = getTechniqueHint(item.label)
        const editorOpen = inlineEditorAvailable && !anotherEditorIsActive && nodeId != null

        return (
          <div key={item.key} className="relative px-1 py-2 space-y-2 pr-7" data-testid={`missing-data-row-${item.key}`}>
            {/* Row 1 — name (wraps) + Not set + influence bar */}
            <div className="flex items-start gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => nodeId && onFocusNode?.(nodeId)}
                onMouseEnter={() => nodeId && onHoverEnter?.('node', nodeId)}
                onMouseLeave={() => onHoverLeave?.()}
                className={`${typography.panelBody} text-info hover:underline cursor-pointer text-left flex-1 min-w-[12rem] break-words`}
              >
                {item.label}
              </button>
              <span className={`${typography.panelMeta} text-text-light shrink-0`}>Not set</span>
              {influencePct != null && (
                <div className="flex items-center gap-1 shrink-0" style={{ width: 60 }}>
                  <div className="flex-1 h-1 bg-panel-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-danger rounded-full"
                      style={{ width: `${Math.min(100, influencePct)}%` }}
                    />
                  </div>
                  <span className={`${typography.panelMeta} text-text-light`}>{influencePct}%</span>
                </div>
              )}
            </div>
            {/* Inline editor — default state. Collapses only when another
                editor is active elsewhere in Your expertise. */}
            {editorOpen && (
              <div className="px-1" data-testid={`missing-data-editor-${item.key}`}>
                <ScientificEditor
                  kind="factor"
                  rawValue={null}
                  cap={item.cap ?? null}
                  unit={item.unit ?? null}
                  onSave={(rawValue: number) => {
                    onCommitValue?.(nodeId!, rawValue)
                    onCancelEdit?.()
                  }}
                  onCancel={() => onCancelEdit?.()}
                />
              </div>
            )}
            {/* Technique hint — plain text (locked hint-only per Phase 0).
                Renders alongside the editor, below the name row, always. */}
            <Tooltip delay={300} content={technique.tooltip}>
              <span className={`${typography.panelMeta} text-text-light cursor-help`}>
                {technique.text}
              </span>
            </Tooltip>
            {/* One sparkle — bottom-right of the row */}
            <div className="absolute bottom-1 right-1">
              <DiscussWithAiButton element={{ kind: 'factor', label: item.label }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
