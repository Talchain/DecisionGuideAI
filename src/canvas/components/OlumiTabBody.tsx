import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
// ⭐ THE FIFTH ENTRY SURFACE, and it had its OWN copy of the string.
// Found by a spec, not by the sweep: this renders the first-use line as TEXT
// while `FirstUseComposer` passes it as a placeholder ATTRIBUTE, so a grep for
// one shape does not find the other. Bound to the shared constant so the two
// cannot drift apart again.
import { ExternalLink } from 'lucide-react'
import { useConversationContext } from '../conversation/ConversationContext'
import {
  EmptyConversationInvitation,
  INVITATION_TESTID_DOCKED,
  conversationIsEmpty,
} from './EmptyConversationInvitation'
import { ConversationPanel } from '../conversation/ConversationPanel'
import { useGuidanceStore, withOlumiReveal } from '../stores/guidanceStore'
import type { GuidanceState } from '../stores/guidanceStore'
// Departed = left by an UNMOUNTED tab body; the next tab body may replace
// them. The provider releases all of them when its session ends.
import { departedTabBodyCallbacks } from '../stores/tabBodyFallback'
// Type-only: erased at compile time, so this adds no runtime edge to a module
// whose specs mock ConversationContext/ConversationPanel and not useConversation.
import type { DispatchActionOpts } from '../conversation/useConversation'
import { aiComparisonBadge } from '../../v5/aiComparisonMode'
import { typo } from '../../styles/typography'

/** The three ask slots this component may fill. Nothing else is ever written. */
type FallbackSlots = Pick<GuidanceState, '_sendMessage' | '_prefillChat' | '_dispatchAction'>
const NO_SLOTS: FallbackSlots = { _sendMessage: null, _prefillChat: null, _dispatchAction: null }


/** A slot is this fallback's to write only if it is empty, its own, or a departed tab body's. */
function fallbackMayWrite(held: object | null, ownPrevious: object | null): boolean {
  return held === null || held === ownPrevious || departedTabBodyCallbacks.has(held)
}

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
  const isEmptyConversation = conversationIsEmpty(conversation.messages)

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
  // nulls the callbacks on unmount; this component fills them again (the
  // takeover subscription below, and this re-run).
  //
  // ⚠ ConversationPanel registers the FULLER set (reveal-wrapped callbacks,
  // sendChip / runAnalysis / scrollToPatch, a token) once it mounts via the
  // populated branch. Its effect runs BEFORE this parent's, so this component
  // must not overwrite it on the re-run that follows — it used to, with bare
  // callbacks, which silently dropped the reveal from every later send and
  // prefill. See OWNERSHIP BY IDENTITY at the effect.
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
   * ⚠ AND IT NEVER REPLACES ANOTHER HOST'S. Child effects run BEFORE parent
   * effects, so on empty → populated `ConversationPanel` registers first and
   * THIS effect runs after it. The ownership rule at the effect means this
   * component can only ever ADD a working dispatcher, never remove one a
   * fuller host just installed.
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

  /** The callbacks this component last wrote (or would own). Identity is the claim. */
  const ownedRef = useRef<FallbackSlots>(NO_SLOTS)

  useEffect(() => {
    const prefillChat = (text: string) => setDraft(text)
    const mine: FallbackSlots = {
      _sendMessage: sendMessage,
      _prefillChat: prefillChat,
      _dispatchAction: dispatchActionForStore,
    }

    /*
     * ⭐ OWNERSHIP BY IDENTITY — one rule for the first write, every re-run
     * and the takeover below. A slot is written only when it is EMPTY, or holds
     * the callback THIS component wrote last (or one a departed tab body left
     * — see the unmount effect). A callback any other host wrote is never
     * replaced, and no token is ever minted or cleared.
     *
     * ⚠ THE FIRST WRITE USED TO BE UNCONDITIONAL, on mount AND on every
     * dependency change, so a re-run replaced a fuller host's reveal-wrapped,
     * token-owned callbacks with this component's bare ones. The takeover's
     * "fill holes only" was true of the subscription and false of this line.
     *
     * On a re-run the slots this component still holds move to the NEW
     * callbacks (never left stale). Reads the store NOW, not a listener's
     * `state` argument: another listener in the same notification may already
     * have re-registered. Loop-free: after a write every slot equals `mine`,
     * and an empty patch is never written.
     */
    const claim = () => {
      const now = useGuidanceStore.getState()
      const previous = ownedRef.current
      ownedRef.current = mine
      const patch: Partial<FallbackSlots> = {}
      if (fallbackMayWrite(now._sendMessage, previous._sendMessage) && now._sendMessage !== mine._sendMessage) {
        patch._sendMessage = mine._sendMessage
      }
      if (fallbackMayWrite(now._prefillChat, previous._prefillChat) && now._prefillChat !== mine._prefillChat) {
        patch._prefillChat = mine._prefillChat
      }
      if (fallbackMayWrite(now._dispatchAction, previous._dispatchAction) && now._dispatchAction !== mine._dispatchAction) {
        patch._dispatchAction = mine._dispatchAction
      }
      if (Object.keys(patch).length > 0) useGuidanceStore.setState(patch)
    }
    claim()

    /*
     * ⭐ SURVIVOR TAKEOVER — the same duty `ConversationPanel` already has, and
     * the reason is a SIBLING host, not this component's own child.
     *
     * The effect re-runs only when its deps change, so it covers this
     * component's OWN `ConversationPanel` leaving (via `realMessageCount`). It
     * did not cover the FLOATING host leaving, and that is the path every
     * fresh user takes: after the first draft the floating panel sits
     * minimised to its pill, an ask from the canvas (`requestAsk`) reveals
     * Olumi, the pill does not register a focus channel
     * (`revealWouldImposeFloating`), so `revealOlumiSurface` claims the DOCK
     * (`forceActivateOutputTab('olumi')`), and `FloatingOlumiPanel` yields and
     * unmounts its `ConversationPanel`. That host's token-guarded unregister
     * then nulls every slot — including the ones written here, because this
     * write never mints a token (deliberately, see above), so the guard cannot
     * see it. On an empty conversation nothing else re-registered: measured on
     * the Canvas Browser Gate (#1926) as `canReceiveAsk` false, every
     * `NodeCoachingIcon` unmounted, and the quick-action "Ask" gone — while
     * the prefilled question sat in the docked composer with no door left to
     * ask another.
     */
    const unsubscribe = useGuidanceStore.subscribe(claim)
    // The cleanup removes the SUBSCRIPTION only: a dependency change is not a
    // departure. What an unmount does is the separate effect below.
    return unsubscribe
  }, [sendMessage, setDraft, dispatchActionForStore, realMessageCount])

  /*
   * ⚠ UNMOUNT HANDS THE CALLBACKS ON; IT DOES NOT CLEAR THEM. This component
   * unmounts on every DOCK COLLAPSE (`OutputsDock` renders it inside
   * `{effectiveIsOpen && …}`), not only with the canvas. The session these
   * callbacks close over is the canvas-root `ConversationProvider`, which
   * outlives a collapse — and after an ask from the pill they are the only
   * registration left. Clearing them here emptied every slot and took every
   * ask door with it (the defect above, by a second route; pinned by the DOCK
   * COLLAPSE cases in `askFromMinimisedPillKeepsRegistration.spec.tsx`).
   *
   * Instead they are marked DEPARTED, so the next tab body (dock re-opened,
   * or a new canvas) replaces them rather than being locked out by them. A
   * slot another host holds is not touched.
   *
   * The canvas itself unmounting is the provider's to close: this component
   * cannot tell a collapse from a canvas unmount, so `ConversationProvider`
   * releases every tab-body callback when its session ends
   * (`stores/tabBodyFallback.ts`).
   */
  useEffect(() => () => {
    const now = useGuidanceStore.getState()
    const owned = ownedRef.current
    if (owned._sendMessage && now._sendMessage === owned._sendMessage) departedTabBodyCallbacks.add(owned._sendMessage)
    if (owned._prefillChat && now._prefillChat === owned._prefillChat) departedTabBodyCallbacks.add(owned._prefillChat)
    if (owned._dispatchAction && now._dispatchAction === owned._dispatchAction) departedTabBodyCallbacks.add(owned._dispatchAction)
    ownedRef.current = NO_SLOTS
  }, [])

  const handleCollapse = useCallback(() => {
    // The dock's own collapse button handles this; ChatTopBar is hidden anyway.
  }, [])
  const handleAttach = useCallback(() => {
    // Attach evidence is handled by CogPopover, not here.
  }, [])

  // A non-default engine is always visible, so a tester cannot unknowingly compare two AI engines under an
  // identical-looking surface; the host's own default (staging: OpenAI) is not labelled on every screen.
  const comparisonLabel = aiComparisonBadge()
  const topControls = comparisonLabel || onFloatOut ? (
    <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-0.5">
      {comparisonLabel ? (
        <span
          className={typo('panelMeta', 'rounded border border-border px-1.5 py-0.5 text-text-light')}
          data-testid="olumi-ai-comparison-mode"
          title="AI implementation active for this staging session"
        >
          AI: {comparisonLabel}
        </span>
      ) : <span />}
      {onFloatOut ? (
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
      ) : null}
    </div>
  ) : null

  if (isEmptyConversation) {
    return (
      <div className="flex flex-1 min-h-0 flex-col" data-testid="olumi-tab-empty">
        {topControls}
        <div className="flex flex-1 items-center justify-center px-6 py-6">
          {/*
            ⭐ THE INVITATION KNOWS WHETHER THERE IS A MODEL, AND IT DID NOT.
            This rendered `FIRST_USE_PLACEHOLDER` on the sole condition that the
            conversation was empty — so a canvas full of options, opened from a
            template or after a cleared history, was met with "Describe the
            decision or challenge you're working through", twenty pixels above a
            composer already saying "Ask about this model…". One frame, one
            state, two surfaces disagreeing about what the user had.

            The sentence, and the state behind it, now live in one component so
            the FLOATING host shows the same thing — see
            `EmptyConversationInvitation`, which records why it moved.
          */}
          <EmptyConversationInvitation testId={INVITATION_TESTID_DOCKED} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col" data-testid="olumi-tab-body">
      {topControls}
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
