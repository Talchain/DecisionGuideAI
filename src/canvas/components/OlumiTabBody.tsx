import { memo, useCallback, useEffect, useMemo } from 'react'
// ⭐ THE FIFTH ENTRY SURFACE, and it had its OWN copy of the string.
// Found by a spec, not by the sweep: this renders the first-use line as TEXT
// while `FirstUseComposer` passes it as a placeholder ATTRIBUTE, so a grep for
// one shape does not find the other. Bound to the shared constant so the two
// cannot drift apart again.
import { FIRST_USE_PLACEHOLDER } from './firstUsePlaceholder'
import { ExternalLink } from 'lucide-react'
import { typo } from '../../styles/typography'
import { useConversationContext } from '../conversation/ConversationContext'
import { ConversationPanel } from '../conversation/ConversationPanel'
import { useGuidanceStore, withOlumiReveal } from '../stores/guidanceStore'
// Type-only: erased at compile time, so this adds no runtime edge to a module
// whose specs mock ConversationContext/ConversationPanel and not useConversation.
import type { DispatchActionOpts } from '../conversation/useConversation'

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

  // pre-analysis-power-v2 fix: register guidance-store callbacks at the
  // OlumiTabBody level so consumers like `DiscussWithAiButton` (the
  // priority-card sparkles in the Analysis tab) work without requiring
  // ConversationPanel to be mounted.
  //
  // ⚠ THIS SAID "minimal (sendMessage + prefillChat)" AND THAT IS NO LONGER
  // TRUE: `_dispatchAction` is registered here too (see the block below it,
  // which gives the reason). The minimalism was never a safety property — it
  // predates the token-guarded ownership protocol by five weeks and the race
  // note in `useConversationActions.ts` by two, so it cannot have been a guard
  // against either. It was simply the smallest thing that fixed the sparkles.
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
  // (sendChip / runAnalysis / scrollToPatch) once it mounts via the populated
  // branch — that overwrite is idempotent, and its `dispatchAction` is the
  // same singleton function this component wraps, so neither host can install
  // a dispatcher that reaches a different conversation.
  const { sendMessage, setDraft, dispatchAction } = conversation

  /**
   * ⭐⭐ `_dispatchAction` IS REGISTERED HERE TOO, BECAUSE IT IS THE ONE THAT
   * CARRIES THE CONTEXT. Without it a coaching click on a FRESH, EMPTY chat
   * did not fail — it took `NodeChip`'s tier-2 fallback to `_sendMessage`,
   * whose own comment says *"metadata cannot travel; the message still
   * lands"*. So the request went out and `action_type`, `parameters.chip_id`
   * and `source: 'chip'` did not. **That is worse than a clean failure: a
   * stripped request still returns something, so nothing looks broken.**
   *
   * ⚠ WRAPPED IN `withOlumiReveal`, AND THAT IS NOT OPTIONAL. This registration
   * path is a raw `setState`, so it does not go through
   * `registerConversationCallbacks` and gets none of its wrapping for free.
   * Registering a bare dispatcher here would send without revealing Olumi —
   * trading a metadata defect for a VISIBILITY one (the Class-8 guarantee,
   * `guidanceStore.ts`). The two callbacks above are deliberately left as they
   * are: their unwrapped state is a separate, reported defect and fixing it is
   * not this change.
   *
   * ⚠ THE PARAMETER TYPE IS THE STORE'S, NOT THE CONVERSATION'S, ON PURPOSE.
   * `_dispatchAction` declares `source: string`; `DispatchActionOpts` declares
   * the narrower `ActionSource`. Typing this adapter to the store's own slot
   * makes the assignment an identity rather than a contravariant one, and
   * confines the widening to the single documented cast below. Every in-repo
   * caller passes a declared `ActionSource` literal (`NodeChip` sends
   * `source: 'chip'`).
   *
   * ⚠ AND IT IS NEVER SET TO `null`. Child effects run BEFORE parent effects,
   * so on empty → populated `ConversationPanel` registers first and THIS effect
   * runs after it. Spreading conditionally means this component can only ever
   * ADD a working dispatcher, never remove one a fuller host just installed.
   * It also never writes `_registrationToken` — that belongs to
   * `registerConversationCallbacks`, and minting one here would corrupt the
   * ownership guard that lets two hosts coexist.
   */
  const dispatchActionForStore = useMemo(() => {
    if (typeof dispatchAction !== 'function') return null
    return withOlumiReveal((opts: {
      action_type?: string
      intent?: string
      parameters?: Record<string, unknown>
      label: string
      message: string
      hidden?: boolean
      source: string
    }) => {
      // The rejection is REPORTED, not dropped: `dispatchAction` is async and
      // the store's slot is sync, so without this a failed turn would vanish.
      void dispatchAction(opts as DispatchActionOpts).catch((err: unknown) => {
        console.error('[OlumiTabBody] dispatchAction failed:', err)
      })
    })
  }, [dispatchAction])

  useEffect(() => {
    useGuidanceStore.setState({
      _sendMessage: sendMessage,
      _prefillChat: (text: string) => setDraft(text),
      ...(dispatchActionForStore ? { _dispatchAction: dispatchActionForStore } : {}),
    })
    // No cleanup: OlumiTabBody stays mounted across tab switches (visibility
    // toggled via the parent `hidden` class), so the callbacks should
    // persist for the duration of the canvas session.
  }, [sendMessage, setDraft, dispatchActionForStore, realMessageCount])

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
            {FIRST_USE_PLACEHOLDER}
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
