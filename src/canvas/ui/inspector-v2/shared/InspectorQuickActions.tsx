/**
 * InspectorQuickActions — R5, Paul's own formulation (16 Aug 2026).
 *
 * "Full functionality stays in the inspector and may be DUPLICATED there
 *  (quick actions at the top of the inspector). Efficiency principle: minimise
 *  clicks to power functionality; nothing buried."
 *
 * Two actions, both one click from any selected element:
 *   · ask Olumi about THIS element
 *   · open the analysis for THIS element
 *
 * The ask runs the ONE ask semantic (`askSemantic.ts`): it never dispatches, it
 * lands an editable draft the user sends. It is HIDDEN — not disabled, not
 * silently inert — when no conversation surface is registered, because a
 * control that looks live and does nothing is the dead-button class this
 * estate keeps shipping.
 */

import { useCallback, useMemo } from 'react'
import { MessageCircleQuestion, BarChart3, PenLine } from 'lucide-react'

import { typography } from '../../../../styles/typography'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { useUIStore, type OutputTab } from '../../../../stores/uiStore'
import { requestAsk } from '../askSemantic'
import { resolveAskTemplate, resolveChangeTemplate } from '../inspectorStrings'

interface InspectorQuickActionsProps {
  /** Node or edge id — the ask's model target. */
  elementId: string
  /** User-facing name of the element, used in the question and the labels. */
  elementLabel: string
  /** Panel type, for the shared ask-question template table. */
  panelType: string
  /** Extra label context for edge templates. */
  labelContext?: { sourceLabel?: string; targetLabel?: string }
  /** Which results surface this element's analysis lives on. */
  analysisTab?: OutputTab
}

export function InspectorQuickActions({
  elementId,
  elementLabel,
  panelType,
  labelContext,
  analysisTab = 'results',
}: InspectorQuickActionsProps) {
  const canAsk = useGuidanceStore(
    (s) => s._prefillChat !== null || s._sendMessage !== null || s._dispatchAction !== null,
  )

  const question = useMemo(() => {
    const templated = resolveAskTemplate(panelType, { label: elementLabel, ...labelContext })
    // Fallback keeps the action live for element types with no template rather
    // than silently dropping the affordance for exactly the unusual nodes a
    // user is most likely to have questions about.
    return templated ?? `Tell me about ${elementLabel} in this model.`
  }, [panelType, elementLabel, labelContext])

  const handleAsk = useCallback(() => {
    requestAsk({
      text: question,
      label: `Ask about ${elementLabel}`,
      context: '',
      targetId: elementId,
    })
  }, [question, elementLabel, elementId])

  /**
   * ⭐ "Change this" — the route out of a read-only panel.
   *
   * Most of the model has no durable direct-edit carrier (only
   * `factor_value_edit`, `prior_range_edit`, `edge_adjudication` and
   * `structural_delete` persist), which is why the panel below is read-only and
   * why its notice is TRUE. But a true refusal is still a dead end, and the SAME
   * edit made conversationally DOES persist — measured, contrast-controlled.
   *
   * So this hands the user to the writer that can actually save. It rides the
   * identical `ASK_SEMANTIC` path as "Ask Olumi": it never dispatches, it lands
   * an editable draft the user sends. The draft is deliberately an UNFINISHED
   * sentence ("Change the value of X to ") — the user completes it, and a
   * half-formed intent is the correct output of this control, not a defect.
   *
   * ⚠ IT PROMISES NOTHING. This is a request; CEE decides. Do not let the copy
   * drift into implying the change is already made — that would be the
   * looks-like-a-guarantee defect this estate keeps shipping, and the read-only
   * notice beneath would then contradict it.
   */
  const changeRequest = useMemo(
    () => resolveChangeTemplate(panelType, { label: elementLabel, ...labelContext }),
    [panelType, elementLabel, labelContext],
  )

  const handleChange = useCallback(() => {
    if (!changeRequest) return
    requestAsk({
      text: changeRequest,
      label: `Change ${elementLabel}`,
      context: '',
      targetId: elementId,
    })
  }, [changeRequest, elementLabel, elementId])

  const handleAnalysis = useCallback(() => {
    useUIStore.getState().setActiveOutputTab(analysisTab)
  }, [analysisTab])

  return (
    <div
      data-testid="inspector-quick-actions"
      className="flex items-center gap-1.5 pt-2 pb-0.5"
    >
      {canAsk && (
        <button
          type="button"
          data-testid="inspector-quick-ask"
          onClick={handleAsk}
          title={`Ask Olumi about ${elementLabel}`}
          aria-label={`Ask Olumi about ${elementLabel}`}
          className={`${typography.panelMeta} inline-flex items-center gap-1 rounded-full border border-panel-border px-2 py-1 text-text-body hover:bg-panel-hover hover:text-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40 transition-colors`}
        >
          <MessageCircleQuestion size={12} aria-hidden="true" />
          Ask Olumi
        </button>
      )}
      {/* HIDDEN, not disabled, when there is no conversation surface or no
          template for this element type — the same rule the ask follows. A
          control that looks live and does nothing is the dead-button class
          this estate keeps shipping, and it is exactly what this button
          exists to remove. */}
      {canAsk && changeRequest !== null && (
        <button
          type="button"
          data-testid="inspector-quick-change"
          onClick={handleChange}
          title={`Ask Olumi to change ${elementLabel}`}
          aria-label={`Ask Olumi to change ${elementLabel}`}
          className={`${typography.panelMeta} inline-flex items-center gap-1 rounded-full border border-panel-border px-2 py-1 text-text-body hover:bg-panel-hover hover:text-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40 transition-colors`}
        >
          <PenLine size={12} aria-hidden="true" />
          Change this
        </button>
      )}
      <button
        type="button"
        data-testid="inspector-quick-analysis"
        onClick={handleAnalysis}
        title={`Open the analysis for ${elementLabel}`}
        aria-label={`Open the analysis for ${elementLabel}`}
        className={`${typography.panelMeta} inline-flex items-center gap-1 rounded-full border border-panel-border px-2 py-1 text-text-body hover:bg-panel-hover hover:text-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40 transition-colors`}
      >
        <BarChart3 size={12} aria-hidden="true" />
        Its analysis
      </button>
    </div>
  )
}
