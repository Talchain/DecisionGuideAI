import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { ArrowUp, ChevronUp, Settings, Square } from 'lucide-react'
import { typo } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { useConversationContext } from '../conversation/ConversationContext'
import { useStageAwarePlaceholder } from '../hooks/useStageAwarePlaceholder'
import { AddOptionPanel } from '../conversation/AddOptionPanel'
import {
  buildAddOptionDispatch,
  describeAddOptionRefusal,
  detectAddOptionRequest,
  resolveAddOptionTargets,
  type AddOptionCanvasTargets,
  type AddOptionChange,
} from '../conversation/addOptionRequest'
import {
  messageForElapsed,
  messageForSettling,
  messageForSettlingAfterCoaching,
} from './DraftLoadingAnimation'
import { useDraftStore, draftStreamPhaseFor, draftStreamInFlight } from '../stores/draftStore'

export type AIInputBarVariant = 'strip' | 'docked-tab' | 'floating' | 'first-use' | 'welcome'

export interface AIInputBarHandle {
  focus(): void
  /** Synchronously read current draft text (without committing through state). */
  peek(): string
}

export interface AIInputBarProps {
  /** Layout variant — affects padding, sizing, and chrome (cog, chevron, send shape). */
  variant: AIInputBarVariant
  /** Override the stage-aware placeholder. Optional. */
  placeholder?: string
  /** Disabled state — when true, the textarea is read-only and submit blocked. */
  disabled?: boolean
  /** Click handler for the cog icon. Owner decides whether it opens a popover.
   *  Receives the button element so the popover can anchor to it. */
  onCogClick?: (anchorEl: HTMLElement) => void
  /** Click handler for the chevron icon (strip only). Opens floating panel. */
  onChevronClick?: () => void
  /** Hides the chevron icon (used by floating + first-use + welcome + docked-tab variants). */
  hideChevron?: boolean
  /** Optional id for the textarea (for label/test wiring). */
  textareaId?: string
  /** Optional test id for the wrapping container. */
  testId?: string
  /** Optional aria-label for the textarea. */
  ariaLabel?: string
  /** Fires after a non-empty submit has been dispatched (sendMessage called,
   *  draft cleared). Used by FirstUseComposer to record an explicit
   *  "user submitted via this composer" signal — preferred over inferring
   *  from message-count effects, which can mis-fire under thread hydration
   *  if historic non-synthetic messages are restored before graph nodes. */
  onAfterSend?: (text: string) => void
}

const MAX_LINES = 2
const LINE_HEIGHT_PX = 18
/**
 * Welcome hero variant: the rest-state textarea is THREE lines tall
 * (≈70px = 18*3 + 16) so the absolutely-positioned cog + send icon
 * stack (32px + 4px gap + 32px = 68px) fits comfortably INSIDE the
 * textarea border. Grows on type up to 12 lines.
 */
const WELCOME_MIN_LINES = 3
const WELCOME_MAX_LINES = 12

/**
 * Floating Olumi panel variant: round-13 UX. The floating panel's footer
 * composer (variant='floating') previously inherited the default 1-line
 * min and 2-line max, so the cog + send icon stack (28px + 2px gap + 28px
 * = 58px) overflowed the textarea and the composer felt cramped during
 * follow-up questions. Bump the rest state to 3 lines (≈70px) so the
 * icon stack fits with breathing room, and allow growth up to 8 lines
 * (≈160px) before internal scroll engages — generous enough for a
 * multi-sentence follow-up without crowding the conversation history
 * above.
 */
const FLOATING_MIN_LINES = 3
const FLOATING_MAX_LINES = 8

/**
 * Strip variant (docked Olumi tab composer): round-16 UX. Same fix as the
 * floating variant — 3-line rest so the cog + send stack (58px) fits
 * inside the textarea border, and grows on type up to 8 lines before
 * internal scroll engages. The icon-stack inset is also bumped from
 * `right-1.5` to `right-4` for THIS variant so that when the textarea
 * hits its 8-line ceiling and the browser draws an internal scrollbar,
 * the buttons leave room for the scrollbar instead of overlapping it.
 */
const STRIP_MIN_LINES = 3
const STRIP_MAX_LINES = 8

/**
 * AIInputBar — single shared composer used by the persistent strip, the docked
 * Olumi tab (currently unused — strip handles), the floating Olumi panel, the
 * first-use centred composer, and the AI Panel v2 welcome hero. Owns no message
 * state; reads draft from ConversationContext so the draft survives surface
 * switches (e.g. typing in the strip → opening floating → docking → strip still
 * has the text).
 *
 * The variant affects chrome (padding, which icons are visible, send-button
 * shape, textarea minimum height). The input logic — auto-grow, Enter-to-send,
 * Shift+Enter newline — is identical across variants.
 *
 * Composer styling rules (DS v5):
 * - No blue focus ring; subtle border colour change on focus.
 * - Send button is a filled circle (bg-info) in every variant.
 * - Cog icon stays inside the input border, vertically aligned with send.
 * - During generation, the textarea, cog, send and chevron are all disabled.
 */
export const AIInputBar = memo(
  forwardRef<AIInputBarHandle, AIInputBarProps>(function AIInputBar(
    {
      variant,
      placeholder,
      disabled = false,
      onCogClick,
      onChevronClick,
      hideChevron = false,
      textareaId,
      testId,
      ariaLabel,
      onAfterSend,
    },
    ref,
  ) {
    const { draft, setDraft, clearDraft, sendMessage, dispatchAction, isThinking, cancelTurn } =
      useConversationContext()
    const stagePlaceholder = useStageAwarePlaceholder()
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    // Empty canvas → the user's send should DRAFT a model (not chat).
    // Mirrors ConversationPanel.handleGenerateModel's wiring at
    // ConversationPanel.tsx:428 — same turn type + debug source so the
    // orchestrator routes the brief through the model-generation path
    // and emits auto-apply graph patches.
    const nodeCount = useCanvasStore((s) => s.nodes.length)
    const isWelcome = variant === 'welcome'
    const isFloating = variant === 'floating'
    const isStrip = variant === 'strip'

    // Empty canvas + isThinking === a model-generation turn is in flight.
    // The composer freezes and shows a gently-pulsing, time-escalating status
    // line where the placeholder normally sits. Tick once a second so the
    // message advances through PROGRESSIVE_STAGES (0/20/45s).
    //
    // ── ROADMAP 2.122: `nodeCount === 0` ALONE IS NOW A 25-SECOND SILENCE ────
    // On the streamed draft path the graph lands on the canvas at ~36 s
    // (GRAPH_READY) while the turn keeps running to ~61 s (coaching). The
    // original gate goes false the instant those nodes appear — so the composer
    // would stay FROZEN (`isThinking` is still true) with no status line at all
    // for the remaining ~25 s. That is a worse wait than the one this lane
    // exists to shorten, so the gate widens to include the settling phase, and
    // the copy switches to the frame-licensed table for it.
    //
    // The two tables are licensed differently and must not be interchanged:
    // before GRAPH_READY the client holds only a clock (PROGRESS frames are
    // measured-ABSENT on the wire), after it the client holds a frame that says
    // the graph exists and its numbers are `in_progress`. See
    // DraftLoadingAnimation's SETTLING_STAGES docstring.
    //
    // ── THE READ IS SCOPED TO THE OPEN SCENARIO (review F2) ─────────────────
    // This was `useDraftStore((s) => s.draftStreamPhase)` — the raw, global read
    // the review found blocking every other scenario with one scenario's state.
    // `draftStreamPhaseFor` is the one place that decides ownership, and it is
    // read ONCE here: the narration gate below and the Stop control (2.134) both
    // derive from this single value rather than each taking their own copy.
    const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)
    const draftStreamPhase = useDraftStore((s) => draftStreamPhaseFor(s, currentScenarioId))
    const isSettling = draftStreamPhase === 'settling'
    // F1 (honest staged progress): once the owning turn's COACHING_READY frame
    // has landed, the settling copy must stop claiming coaching is
    // outstanding. Scoped by the SAME ownership derivation as the phase — the
    // flag is only meaningful while this scenario's own draft is settling, so
    // it is read as a conjunct of `isSettling`, never bare.
    const coachingLanded = useDraftStore((s) => s.draftStreamCoachingLanded)
    const isGenerating = isThinking && (nodeCount === 0 || isSettling)

    // ── ROADMAP 2.134: THE STOP CONTROL ─────────────────────────────────────
    // The M1-L2 streamed-draft lane's abort machinery (PR 525) was correct,
    // reviewed three times and mutation-pinned — and DORMANT: the only
    // `stop-button` in the codebase lives in `ChatComposer`, whose sole host
    // (`DraftChat`) is unmounted whenever AI Panel v2 is on — and the
    // deployed staging build forces it on
    // (`netlify.toml:50`). Measured: zero stop/cancel/abort controls at eight
    // stages of the live journey, with a positive control proving the detector
    // was not blind. Trace: PHASE0-EVIDENCE-2026-07-28/fix-2134-stop.md §1.
    //
    // BOTH conjuncts are load-bearing:
    //   - `isThinking` is the canonical in-flight signal, but it is true for
    //     EVERY turn — an analysis run included. Alone it would offer Stop over
    //     an abort that has none of the draft's semantics and nothing to mark.
    //   - the phase alone would leave a dead button behind if one were ever
    //     stranded.
    // `draftStreamInFlight` is exhaustive over the phase union in the store, so
    // this call site does not re-derive a two-clause predicate (trap 12).
    const showStopControl = isThinking && draftStreamInFlight(draftStreamPhase)
    // Store the resolved MESSAGE (not raw seconds): the 1s tick then only
    // triggers a re-render when the stage actually advances — React bails on an
    // unchanged string — instead of re-rendering the composer every second for
    // up to two minutes.
    const [generatingMessage, setGeneratingMessage] = useState(() => messageForElapsed(0))
    useEffect(() => {
      // `isSettling` is in the dep list so the clock RESTARTS when the graph
      // lands: the settling table's thresholds are measured from the render, not
      // from the start of the turn. Sharing the turn's clock would put the
      // escalated settling line up immediately on every single draft.
      // `coachingLanded` likewise restarts it when COACHING_READY lands — its
      // table is licensed by that frame, and its own clock starts with it.
      const resolve = isSettling
        ? coachingLanded
          ? messageForSettlingAfterCoaching
          : messageForSettling
        : messageForElapsed
      if (!isGenerating) {
        setGeneratingMessage(resolve(0))
        return
      }
      setGeneratingMessage(resolve(0))
      const start = Date.now()
      const id = window.setInterval(() => {
        setGeneratingMessage(resolve(Math.floor((Date.now() - start) / 1000)))
      }, 1000)
      return () => window.clearInterval(id)
    }, [isGenerating, isSettling, coachingLanded])

    useImperativeHandle(
      ref,
      () => ({
        focus: () => textareaRef.current?.focus(),
        peek: () => textareaRef.current?.value ?? draft,
      }),
      [draft],
    )

    // Auto-grow up to the variant's max line count, then scroll inside.
    // - welcome: 3-line rest, grows to 12 lines (hero composer).
    // - floating: 3-line rest, grows to 8 lines (panel footer composer).
    //   Round-13: needs ≥ 3 lines so cog + send icons fit inside without
    //   overflowing the textarea border; grows on type for follow-ups.
    // - strip: 3-line rest, grows to 8 lines (docked Olumi tab composer).
    //   Round-16: same fix as round-13 for the floating variant.
    // - docked-tab / first-use: 1-line rest, grows to 2 lines (compact
    //   surfaces — not currently exercised by AI Panel v2 callers).
    const minLines = isWelcome
      ? WELCOME_MIN_LINES
      : isFloating
        ? FLOATING_MIN_LINES
        : isStrip
          ? STRIP_MIN_LINES
          : 1
    const maxLines = isWelcome
      ? WELCOME_MAX_LINES
      : isFloating
        ? FLOATING_MAX_LINES
        : isStrip
          ? STRIP_MAX_LINES
          : MAX_LINES
    const minHeightPx = LINE_HEIGHT_PX * minLines + 16
    const maxHeightPx = LINE_HEIGHT_PX * maxLines + 16
    useLayoutEffect(() => {
      const el = textareaRef.current
      if (!el) return
      el.style.height = 'auto'
      el.style.height = `${Math.min(Math.max(el.scrollHeight, minHeightPx), maxHeightPx)}px`
    }, [draft, minHeightPx, maxHeightPx])

    // --- add-option interception ------------------------------------------
    // A typed "add an option called X" is routed into CEE's zero-LLM
    // add_option transaction instead of the free-text edit lane, via a short
    // configuration step that resolves the ids locally (see addOptionRequest.ts
    // for why prose-derived ids silently degrade to a 20s LLM path). Holding
    // the ORIGINAL text means nothing the user typed is ever lost: cancel keeps
    // it in the composer, "send as a message instead" sends it verbatim.
    const [addOption, setAddOption] = useState<{
      label: string
      text: string
      targets: AddOptionCanvasTargets
    } | null>(null)
    const [addOptionRefusal, setAddOptionRefusal] = useState<string | null>(null)

    const sendPlainMessage = useCallback(
      (text: string) => {
        sendMessage(text)
        clearDraft()
        onAfterSend?.(text)
      },
      [sendMessage, clearDraft, onAfterSend],
    )

    const handleSend = useCallback(() => {
      const text = draft.trim()
      if (!text || disabled || isThinking) return
      if (nodeCount === 0) {
        // Empty canvas: drafting a model, not chatting.
        sendMessage(text, {
          turnType: 'explicit_generate',
          debugSource: 'generate_model',
          debugSourceSurface: 'ai_panel',
        })
        clearDraft()
        onAfterSend?.(text)
        return
      }
      const detected = detectAddOptionRequest(text)
      if (detected) {
        // Read the graph imperatively: the composer must not re-render on every
        // node change just to be ready for a request it usually never sees.
        const targets = resolveAddOptionTargets(useCanvasStore.getState().nodes)
        if (targets.decisionId) {
          setAddOptionRefusal(null)
          setAddOption({ label: detected.label, text, targets })
          return
        }
        // No decision node — there is nothing to hang an option off, so fall
        // through to the ordinary lane rather than open a form that must refuse.
      }
      sendPlainMessage(text)
    }, [
      draft,
      disabled,
      isThinking,
      nodeCount,
      sendMessage,
      clearDraft,
      onAfterSend,
      sendPlainMessage,
    ])

    const closeAddOption = useCallback(() => {
      setAddOption(null)
      setAddOptionRefusal(null)
    }, [])

    const handleAddOptionSendAsMessage = useCallback(() => {
      const text = addOption?.text ?? ''
      closeAddOption()
      if (text) sendPlainMessage(text)
    }, [addOption, closeAddOption, sendPlainMessage])

    const handleAddOptionSubmit = useCallback(
      (label: string, changes: readonly AddOptionChange[]) => {
        // Re-resolve against the LIVE canvas, not the snapshot the panel opened
        // with: a node deleted while the panel was open must refuse here rather
        // than ship an id CEE cannot find.
        const built = buildAddOptionDispatch({
          label,
          changes,
          nodes: useCanvasStore.getState().nodes,
        })
        if (!built.ok) {
          setAddOptionRefusal(describeAddOptionRefusal(built.refusal))
          return
        }
        const originalText = addOption?.text ?? ''
        closeAddOption()
        void dispatchAction({ ...built.dispatch, source: 'chip' })
        clearDraft()
        onAfterSend?.(originalText)
      },
      [addOption, closeAddOption, dispatchAction, clearDraft, onAfterSend],
    )

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          handleSend()
        }
      },
      [handleSend],
    )

    const containerClasses = (() => {
      switch (variant) {
        case 'strip':
          return 'flex items-end gap-1 px-2 pb-2 pt-1'
        case 'docked-tab':
          return 'flex items-end gap-1 px-3 pb-3 pt-2'
        case 'floating':
          return 'flex items-end gap-1 px-3 pb-3 pt-2 border-t border-panel-border'
        case 'first-use':
          return 'flex items-end gap-1 px-3 pb-3 pt-2'
        case 'welcome':
          return 'flex items-end gap-2 px-2 pb-2 pt-2'
      }
    })()

    // While generating, the composer must not invite a new decision: disable
    // typing, cog, chevron and send, and clear the placeholder so the
    // gently-pulsing status overlay (rendered below) owns the text box.
    // Chat-mode thinking (nodeCount > 0) keeps the existing behaviour — Enter
    // blocked via handleSend, typing allowed so follow-ups can be composed.
    const inputDisabled = disabled || isGenerating
    const effectivePlaceholder = isGenerating
      ? ''
      : placeholder ?? stagePlaceholder
    const canSend = draft.trim().length > 0 && !inputDisabled && !isThinking

    // Send button geometry. Welcome variant gets a larger filled disc so the
    // hero composer feels generous; other variants stay compact.
    const sendBtnSize = isWelcome ? 'w-8 h-8' : 'w-7 h-7'
    const sendIconSize = isWelcome ? 'w-4 h-4' : 'w-3.5 h-3.5'
    const cogBtnSize = isWelcome ? 'w-8 h-8' : 'w-7 h-7'
    const cogIconSize = isWelcome ? 'w-4 h-4' : 'w-4 h-4'
    // Stack inset: the cog/send cluster sits inside the right edge of the
    // textarea. Welcome variant gives more breathing room. Strip variant
    // (round-16) bumps the right inset from 6px to 16px so that when the
    // textarea hits its 8-line ceiling and a vertical scrollbar appears,
    // the icon stack leaves room for the scrollbar instead of overlapping
    // it. Other variants keep their original 6px inset (the floating
    // variant's auto-grow ceiling rarely engages internal scroll in
    // practice; if it ever does, we can extend this).
    const stackInset = isWelcome
      ? 'right-2 bottom-2'
      : isStrip
        ? 'right-4 bottom-2'
        : 'right-1.5 bottom-1'
    const stackGap = isWelcome ? 'gap-1' : 'gap-0.5'
    // Right padding on textarea reserves JUST enough room for the cog+send
    // cluster plus a minimal gap, so the placeholder/typed text uses as much
    // width as possible (desktop space is tight). The cluster sits at
    // right-2/right-4/right-1.5 + a w-8/w-7 button ≈ 40/44/34px from the right
    // edge; the pad leaves ~8–12px of breathing room beyond that. Strip keeps a
    // touch more so text never drifts under the icons or an internal scrollbar.
    const textareaRightPad = isWelcome ? 'pr-12' : isStrip ? 'pr-14' : 'pr-12'

    return (
      <>
      {addOption && (
        <AddOptionPanel
          initialLabel={addOption.label}
          decisionLabel={addOption.targets.decisionLabel}
          factors={addOption.targets.factors}
          refusal={addOptionRefusal}
          busy={isThinking}
          onSubmit={handleAddOptionSubmit}
          onSendAsMessage={handleAddOptionSendAsMessage}
          onCancel={closeAddOption}
        />
      )}
      <div className={containerClasses} data-testid={testId ?? `ai-input-bar-${variant}`}>
        <div className="relative flex-1 bg-panel border border-panel-border rounded-lg transition-colors focus-within:border-info">
          <textarea
            ref={textareaRef}
            id={textareaId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={effectivePlaceholder}
            rows={minLines}
            disabled={inputDisabled}
            aria-disabled={inputDisabled}
            aria-label={ariaLabel ?? 'Chat message'}
            data-testid={`${testId ?? `ai-input-bar-${variant}`}-textarea`}
            className={typo(
              'panelBody',
              `w-full resize-none bg-transparent outline-none text-text-body placeholder:text-text-light py-2 pl-3 ${textareaRightPad}`,
            )}
            style={{ minHeight: minHeightPx, maxHeight: maxHeightPx }}
          />
          {/* In-composer generation status: a gently-pulsing, time-escalating
              line sitting exactly where the placeholder text would (py-2 pl-3
              mirrors the textarea's text inset). pointer-events-none — the
              textarea underneath is disabled during generation anyway. */}
          {isGenerating && (
            <div
              role="status"
              aria-live="polite"
              data-testid={`${testId ?? `ai-input-bar-${variant}`}-generating`}
              className={`pointer-events-none absolute left-0 top-0 py-2 pl-3 ${textareaRightPad}`}
            >
              <span className={typo('panelBody', 'text-text-light animate-gentle-text-flash')}>
                {generatingMessage}
              </span>
            </div>
          )}
          <div className={`absolute ${stackInset} flex flex-col items-center ${stackGap}`}>
            {onCogClick ? (
              <button
                type="button"
                onClick={(e) => onCogClick(e.currentTarget)}
                disabled={inputDisabled}
                aria-disabled={inputDisabled}
                // Round-9: visible filled circle to match the send button's
                // affordance. Distinct fill (panel-hover, a subtle neutral)
                // so the cog reads as a SECONDARY action vs. the send
                // button's accent fill (bg-info).
                className={`inline-flex items-center justify-center ${cogBtnSize} rounded-full bg-panel-hover text-text-light hover:text-text-body hover:bg-panel-border focus:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:opacity-50`}
                aria-label="Settings"
                data-testid={`${testId ?? `ai-input-bar-${variant}`}-cog`}
              >
                <Settings className={cogIconSize} aria-hidden="true" />
              </button>
            ) : null}
            {/* Send / Stop — ONE control in this slot, never two (ROADMAP
                2.134). Mirrors `ChatComposer`'s own swap, which is the shape
                PR 525's abort path was written against. Send is `disabled` for
                the whole of this window anyway (`canSend` requires
                `!isThinking`), so the swap costs the user nothing and removes
                the chance of reading a live Stop as a live Send. */}
            {showStopControl ? (
              <button
                type="button"
                onClick={cancelTurn}
                className={`inline-flex items-center justify-center ${sendBtnSize} rounded-full bg-panel-hover text-text-body border border-panel-border hover:bg-panel-border focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                aria-label="Stop drafting"
                title="Stop drafting"
                data-testid={`${testId ?? `ai-input-bar-${variant}`}-stop`}
              >
                <Square className={sendIconSize} fill="currentColor" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                aria-disabled={!canSend}
                className={`inline-flex items-center justify-center ${sendBtnSize} rounded-full bg-info text-text-on-color hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:opacity-30 disabled:hover:opacity-30`}
                aria-label="Send"
                data-testid={`${testId ?? `ai-input-bar-${variant}`}-send`}
              >
                <ArrowUp className={sendIconSize} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        {variant === 'strip' && !hideChevron && onChevronClick ? (
          <button
            type="button"
            onClick={onChevronClick}
            disabled={inputDisabled}
            aria-disabled={inputDisabled}
            className="inline-flex items-center justify-center w-7 h-7 rounded-sm text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:opacity-50"
            aria-label="Open Olumi in floating panel"
            data-testid={`${testId ?? `ai-input-bar-${variant}`}-chevron`}
            title="Open in floating window"
          >
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      </>
    )
  }),
)

/** Ensure the displayName shows up nicely in React DevTools. */
AIInputBar.displayName = 'AIInputBar'

/**
 * Re-export of effect that callers can wire — disables sending while thinking.
 * (Lives here so consumers don't need to re-derive from context.)
 */
export function useIsSendDisabled(): boolean {
  const { isThinking } = useConversationContext()
  return isThinking
}

// Re-exported so unit tests / Storybook can import the constant directly.
export { LINE_HEIGHT_PX, MAX_LINES }
