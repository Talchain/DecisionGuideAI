import { memo, useCallback, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import { typo } from '../../styles/typography'
import { useConversationContext } from '../conversation/ConversationContext'
import { ConversationPanel } from '../conversation/ConversationPanel'
import { useGuidanceStore } from '../stores/guidanceStore'

interface OlumiTabBodyProps {
  /** Opens the floating Olumi panel for the user (manual float-out from
   *  the docked tab). Rendered as a small, subtle icon-only control —
   *  never as a CTA that blocks access to the docked conversation. */
  onFloatOut?: () => void
}

/**
 * OlumiTabBody — docked Olumi tab content.
 *
 * Round-3 UX correction: clicking the Olumi tab always docks the
 * conversation here (handleTabClick closes the floating panel first if
 * needed). The docked view is never a redirect to floating; the empty
 * state shows a calm welcome line, and a small float-out icon lives in
 * the top-right corner for users who prefer the floating window.
 *
 * Two render states:
 *  - Empty conversation → calm welcome line + subtle float-out icon.
 *  - Has messages → full ConversationPanel with `hideComposer` (the
 *    persistent strip below the tab body owns submission so the docked
 *    composer is never duplicated).
 */
export const OlumiTabBody = memo(function OlumiTabBody({ onFloatOut }: OlumiTabBodyProps) {
  const conversation = useConversationContext()
  const realMessageCount = conversation.messages.filter((m) => !m.synthetic).length

  // pre-analysis-power-v2 fix: register minimal guidance-store callbacks
  // (sendMessage + prefillChat) at the OlumiTabBody level so consumers
  // like `DiscussWithAiButton` (the priority-card sparkles in the
  // Analysis tab) work without requiring ConversationPanel to be mounted.
  // Before this fix, the empty-conversation early return below kept
  // ConversationPanel unmounted; its `registerConversationCallbacks`
  // useEffect never fired; sparkles rendered `null` on first load.
  //
  // `realMessageCount` is in the dep array so the effect re-runs when
  // the conversation transitions populated → empty (clearHistory,
  // scenario reset, hydration failure). ConversationPanel's cleanup
  // nulls the callbacks on unmount; this effect re-registers them on
  // the same render pass. React runs the child-cleanup before the
  // parent-effect-setup when deps change, so the end state is always
  // "registered" while OlumiTabBody is mounted.
  //
  // ConversationPanel still re-registers the full callback set
  // (sendChip / runAnalysis / scrollToPatch / dispatchAction) once it
  // mounts via the populated branch — that overwrite is idempotent.
  const { sendMessage, setDraft } = conversation
  useEffect(() => {
    useGuidanceStore.setState({
      _sendMessage: sendMessage,
      _prefillChat: (text: string) => setDraft(text),
    })
    // No cleanup: OlumiTabBody stays mounted across tab switches (visibility
    // toggled via the parent `hidden` class), so the callbacks should
    // persist for the duration of the canvas session.
  }, [sendMessage, setDraft, realMessageCount])

  const handleCollapse = useCallback(() => {
    // The dock's own collapse button handles this; ChatTopBar is hidden anyway.
  }, [])
  const handleAttach = useCallback(() => {
    // Attach evidence is handled by CogPopover, not here.
  }, [])

  // Float-out icon — small, top-right corner, subtle. Available in both
  // empty and populated states so users can switch surface preference
  // without losing draft text (singleton ConversationContext preserves it).
  const floatOutIcon = onFloatOut ? (
    <div className="flex justify-end px-2 pt-1 pb-0.5">
      <button
        type="button"
        onClick={onFloatOut}
        className="inline-flex items-center justify-center w-6 h-6 rounded text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
        aria-label="Open Olumi in floating panel"
        data-testid="olumi-tab-float-out"
        title="Open in floating window"
      >
        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  ) : null

  if (realMessageCount === 0) {
    return (
      <div className="flex flex-1 min-h-0 flex-col" data-testid="olumi-tab-empty">
        {floatOutIcon}
        <div className="flex flex-1 items-center justify-center px-6 py-6">
          <p className={typo('panelBody', 'text-text-light text-center max-w-xs')}>
            Describe your decision, goal, options, and any assumptions, risks or constraints you’re aware of.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col" data-testid="olumi-tab-body">
      {floatOutIcon}
      <div className="flex flex-1 min-h-0 flex-col">
        <ConversationPanel
          conversation={conversation}
          onCollapse={handleCollapse}
          onAttach={handleAttach}
          hideComposer
          compact
        />
      </div>
    </div>
  )
})
