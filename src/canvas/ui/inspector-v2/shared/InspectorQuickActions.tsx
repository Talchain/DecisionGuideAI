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
import { MessageCircleQuestion, BarChart3 } from 'lucide-react'

import { typography } from '../../../../styles/typography'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { useUIStore, type OutputTab } from '../../../../stores/uiStore'
import { requestAsk } from '../askSemantic'
import { resolveAskTemplate } from '../inspectorStrings'

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
