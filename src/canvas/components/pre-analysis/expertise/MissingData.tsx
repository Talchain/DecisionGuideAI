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
 *
 * Brief 5.2 Task 8d follow-up (ChatGPT P1 #1): the technique hint renders
 * as a click-to-chat button when onSendMessage is wired. Click opens chat
 * with a prompt asking how to apply the technique to the factor label.
 * Fallback to non-interactive span preserves the pre-analysis panel
 * fixtures that don't register onSendMessage.
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
  /**
   * Brief 5.2 Task 8d follow-up: when provided, the technique hint becomes
   * a click-to-chat button. When absent, the hint renders as a
   * non-interactive tooltip span (fixtures, Storybook).
   */
  onSendMessage?: (text: string) => void
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
  // Brief 5.2 Task 3 removed the Pencil that routed through this callback.
  // Kept on the prop contract for API compatibility with YourExpertise —
  // any future deep-link flow can wire back into this handler.
  onSetValue: _onSetValue,
  factorInfluenceMap,
  onHoverEnter,
  onHoverLeave,
  activeEditorKey,
  onRequestEdit,
  onCommitValue,
  onCancelEdit,
  onSendMessage,
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
            {/* Technique hint — click-to-chat button when onSendMessage is
                wired (Brief 5.2 Task 8d follow-up, ChatGPT P1 #1). Opens
                chat pre-filled with a prompt asking how to apply the
                technique to this factor. Falls back to the non-interactive
                tooltip span for fixtures / Storybook that don't wire
                onSendMessage. */}
            {onSendMessage ? (
              <Tooltip delay={300} content={technique.tooltip}>
                <button
                  type="button"
                  onClick={() => onSendMessage(
                    `How do I apply ${technique.text.replace(/^Try:\s*/, '')} to "${item.label}"?`,
                  )}
                  data-testid={`technique-hint-${item.key}`}
                  aria-label={`Discuss applying ${technique.text.replace(/^Try:\s*/, '')} to ${item.label}`}
                  className={`${typography.panelMeta} text-info hover:underline cursor-pointer bg-transparent border-0 p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 rounded`}
                >
                  {technique.text}
                </button>
              </Tooltip>
            ) : (
              <Tooltip delay={300} content={technique.tooltip}>
                <span
                  className={`${typography.panelMeta} text-text-light cursor-help`}
                  data-testid={`technique-hint-${item.key}`}
                >
                  {technique.text}
                </span>
              </Tooltip>
            )}
            {/* One sparkle — bottom-right of the row. Brief 5.2 Task 7:
                secondary variant (opacity-50 at rest, opacity-100 on
                hover/focus-within) — expertise rows are a non-primary
                surface; sparkles here should not compete with the hero
                and triage-card sparkles for attention. */}
            <div className="absolute bottom-1 right-1">
              <DiscussWithAiButton element={{ kind: 'factor', label: item.label }} variant="secondary" />
            </div>
          </div>
        )
      })}
    </div>
  )
}
