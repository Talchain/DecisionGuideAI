import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react'
import { ArrowUp, ChevronUp, RefreshCw, Square } from 'lucide-react'
import { typo } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { useConversationContext } from '../conversation/ConversationContext'
import { useStageAwarePlaceholder } from '../hooks/useStageAwarePlaceholder'
import { normalisePastedText } from '../conversation/normalisePastedText'
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
  /**
   * ⭐ THE ONE DISCREET RUN CONTROL AT THE BOTTOM OF THE AI TAB.
   *
   * MEASURED GAP: the Olumi surface declares `footerBar: 'readiness'`
   * (`shellContract.ts`), and `AnalysisReadinessBar` renders NULL outside the
   * pre-run window — `if (!preRunWithModel) return null`. So once an analysis
   * has completed, the AI tab has no way to run one: the only Re-analyse
   * controls live on the Analysis and Model surfaces, a tab away.
   *
   * ⚠ NOT A SECOND RUNNER AND NOT A SECOND GATE — the same two refusals
   * `AnalysisReadinessBar`'s own header makes. `onRun` must be the host's
   * canonical runner and `canRun` / `blockedReason` its existing gate values,
   * passed down rather than re-derived here (CLAUDE.md trap 21). This component
   * decides nothing about whether a run may start; it only draws the control.
   *
   * ⚠ AND NOT A SECOND CONTROL. The host is responsible for omitting this while
   * `AnalysisReadinessBar` is showing its own Analyse button, so the AI tab
   * offers exactly one run affordance in every state rather than two stacked
   * 40px apart. Omit the prop ⇒ no control is rendered at all.
   */
  analysisAction?: {
    /** The host's canonical runner. */
    onRun: () => void
    /** The host's run gate. False ⇒ the control is disabled, never hidden. */
    canRun: boolean
    /** The host's in-flight flag. */
    isRunning: boolean
    /** The gate's own refusal sentence, shown as the disabled control's title. */
    blockedReason?: string
    /** Accessible name, e.g. 'Re-run analysis'. Also the resting title. */
    label: string
  }
}

const MAX_LINES = 2
/**
 * ⚠ A FALLBACK, NOT THE TRUTH — and it had already drifted.
 *
 * This was the only line-height the auto-grow maths knew, and it is a HAND-COPY
 * of a value that lives somewhere else: the textarea renders at
 * `typography.panelBody` = `text-xs leading-relaxed` = 12px x 1.625 = **19.5px**.
 * Every "N lines" bound computed from 18 was therefore ~8% short, so a composer
 * advertised as growing to eight lines began scrolling inside itself at seven
 * and a bit — the exact stale-mirror class CLAUDE.md calls trap 12.
 *
 * The layout effect below now MEASURES the rendered line-height and uses this
 * only when the measurement is unavailable (jsdom reports an empty
 * `lineHeight`, so specs continue to see whole multiples of this number).
 */
const LINE_HEIGHT_PX = 18
/** Vertical padding the textarea adds around its text (`py-2` = 8px x 2). */
const TEXTAREA_PAD_PX = 16
/**
 * Welcome hero variant: the rest-state textarea is THREE lines tall so the
 * absolutely-positioned send control sits comfortably INSIDE the textarea
 * border. Grows on type up to 12 lines. The hero keeps the overlay layout
 * deliberately — it is a centred, generous first-use surface with room to
 * spare, and the problem the action row below solves is a problem of a
 * 416px-wide panel footer.
 */
const WELCOME_MIN_LINES = 3
const WELCOME_MAX_LINES = 12

/**
 * ⭐ THE PANEL-FOOTER COMPOSERS CARRY THEIR CONTROLS IN A ROW BENEATH THE TEXT,
 * AND THAT IS WHAT LETS THE REST STATE SHRINK.
 *
 * `STRIP_MIN_LINES` and `FLOATING_MIN_LINES` were both 3, and NEITHER was about
 * the text. Their own comments said so: three lines "so the cog + send icon
 * stack (28px + 2px gap + 28px = 58px) fits inside the textarea border". The
 * composer was reserving a 70px box to make room for a control cluster drawn on
 * top of it — and the cog was removed on 29 Aug 2026, leaving ONE 28px button
 * and a 70px reservation that nothing needed.
 *
 * Both costs were paid in the tightest place in the product: the docked panel
 * is 416px wide, the conversation above it is the thing people came for, and
 * the composer was taking ~70px of it to hold an empty two-thirds of a box.
 *
 * With the controls on their OWN row the reservation has no reason to exist, so
 * the rest state is ONE line and the ceiling rises from 8 lines to 10. The box
 * is now smaller when there is nothing in it and larger when there is, which is
 * the opposite of what it did. Three further things fall out of the same move,
 * none of which needed their own fix:
 *   - the textarea no longer reserves `pr-14` for controls floating over it, so
 *     typed text uses the panel's full width;
 *   - the `right-4` inset that existed so the buttons would not sit on top of
 *     the browser's internal scrollbar has nothing left to avoid;
 *   - the float-out chevron joins the same row instead of sitting outside the
 *     border as a fourth, differently-shaped thing.
 */
const PANEL_FOOTER_MIN_LINES = 1
const PANEL_FOOTER_MAX_LINES = 10

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
      onChevronClick,
      hideChevron = false,
      textareaId,
      testId,
      ariaLabel,
      onAfterSend,
      analysisAction,
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

    /**
     * ⭐ ONE DISCRIMINATOR FOR THE WHOLE LAYOUT, NOT A LIST OF VARIANT TESTS.
     *
     * The two PANEL FOOTER composers — the docked Olumi strip and the floating
     * panel — put their controls in a row beneath the text. The hero surfaces
     * (welcome, first-use) and the unused `docked-tab` keep the overlay layout,
     * where the send disc sits inside a deliberately generous box.
     *
     * Everything that used to be decided variant-by-variant now hangs off this
     * one boolean: the line bounds, the textarea's right padding, where the
     * chevron lives, and whether the send control is absolutely positioned.
     * Previously those were four separate ternaries over `isWelcome` /
     * `isStrip` / `isFloating`, which is how the strip ended up with a 70px
     * rest state justified by a control cluster that had been deleted.
     */
    const hasActionRow = isStrip || isFloating

    // Auto-grow between the variant's rest and ceiling, then scroll inside.
    // - welcome:            3-line rest, grows to 12 (hero composer).
    // - strip / floating:   1-line rest, grows to 10 (panel footers — see
    //                       PANEL_FOOTER_MIN_LINES on why the rest shrank).
    // - docked-tab / first-use: 1-line rest, grows to 2 (compact surfaces —
    //                       not currently exercised by AI Panel v2 callers).
    const minLines = isWelcome
      ? WELCOME_MIN_LINES
      : hasActionRow
        ? PANEL_FOOTER_MIN_LINES
        : 1
    const maxLines = isWelcome
      ? WELCOME_MAX_LINES
      : hasActionRow
        ? PANEL_FOOTER_MAX_LINES
        : MAX_LINES

    /**
     * ⚠ THE LINE HEIGHT IS MEASURED, NOT ASSUMED — see `LINE_HEIGHT_PX`.
     *
     * The bounds are written onto the element here rather than through a
     * `style` prop because the measurement is only available once the element
     * is rendered and its class-driven line-height has resolved. React would
     * overwrite an imperative value on the next render if the prop still
     * carried one, so the effect owns both bounds outright.
     *
     * `getComputedStyle` returns `''` or `'normal'` where no numeric
     * line-height resolves (jsdom, and a real browser before styles load), so
     * the parse fails closed to the declared fallback and the box is never
     * given a NaN height.
     */
    useLayoutEffect(() => {
      const el = textareaRef.current
      if (!el) return
      const measured = Number.parseFloat(window.getComputedStyle(el).lineHeight)
      const line = Number.isFinite(measured) && measured > 0 ? measured : LINE_HEIGHT_PX
      const min = line * minLines + TEXTAREA_PAD_PX
      const max = line * maxLines + TEXTAREA_PAD_PX
      el.style.minHeight = `${min}px`
      el.style.maxHeight = `${max}px`
      el.style.height = 'auto'
      el.style.height = `${Math.min(Math.max(el.scrollHeight, min), max)}px`
    }, [draft, minLines, maxLines])

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

    /**
     * ⭐ PASTE KEEPS ITS SHAPE (UI-SEM-096).
     *
     * A list copied out of a document arrives as lines beginning with a literal
     * bullet GLYPH, which `safeRichText` — the estate's tiny markdown dialect —
     * does not recognise, so the list rendered in the transcript as run-on
     * prose with stray glyphs in it. `normalisePastedText` rewrites the glyph to
     * the `- ` marker that means the same thing here, in the user's own box,
     * where they can see and undo it.
     *
     * ⚠ IT DEFERS TO THE BROWSER WHENEVER THERE IS NOTHING TO DO — the helper
     * returns its input BY IDENTITY in that case, and this returns without
     * calling `preventDefault`, so an ordinary paste keeps native undo. Only a
     * paste that actually needed rewriting loses that one undo step, which is
     * the trade the rewrite is worth and not a trade taken on every paste.
     */
    const handlePaste = useCallback(
      (e: ClipboardEvent<HTMLTextAreaElement>) => {
        const raw = e.clipboardData?.getData('text/plain') ?? ''
        if (!raw) return
        const normalised = normalisePastedText(raw)
        if (normalised === raw) return

        e.preventDefault()
        const el = e.currentTarget
        const from = el.selectionStart ?? el.value.length
        const to = el.selectionEnd ?? from
        setDraft(el.value.slice(0, from) + normalised + el.value.slice(to))
        // The caret is restored on the next frame because React has not yet
        // committed the new value; setting it now would put it back where the
        // browser left it the moment the re-render lands.
        const caret = from + normalised.length
        window.requestAnimationFrame(() => {
          if (textareaRef.current) textareaRef.current.setSelectionRange(caret, caret)
        })
      },
      [setDraft],
    )

    const base = testId ?? `ai-input-bar-${variant}`

    /**
     * Outer padding only. The composer's bordered box is a full-width block in
     * every variant now — the chevron used to sit OUTSIDE it as a flex sibling,
     * which is why this was a flex row.
     */
    const containerClasses = (() => {
      switch (variant) {
        case 'strip':
          return 'px-2 pb-2 pt-1'
        case 'docked-tab':
          return 'flex items-end gap-1 px-3 pb-3 pt-2'
        case 'floating':
          return 'px-3 pb-3 pt-2 border-t border-panel-border'
        case 'first-use':
          return 'flex items-end gap-1 px-3 pb-3 pt-2'
        case 'welcome':
          return 'flex items-end gap-2 px-2 pb-2 pt-2'
      }
    })()

    // While generating, the composer must not invite a new decision: disable
    // typing, chevron, run and send, and clear the placeholder so the
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
    /**
     * Overlay-layout geometry — read ONLY when `hasActionRow` is false. The
     * `right-4` strip inset that used to live here existed so the buttons would
     * clear the textarea's internal scrollbar; with the controls on their own
     * row there is no overlap to avoid, and no right padding to reserve, so the
     * text now uses the panel's full width.
     */
    const stackInset = isWelcome ? 'right-2 bottom-2' : 'right-1.5 bottom-1'
    const textareaRightPad = hasActionRow ? 'pr-3' : 'pr-12'

    /* ── THE CONTROLS ────────────────────────────────────────────────────────
       Defined ONCE and placed ONCE, so the two layouts cannot drift into two
       different sets of controls — the same discipline `AnalysisReadinessBar`
       uses for its own two layouts. Only WHERE they sit branches. */

    /* Send / Stop — ONE control in this slot, never two (ROADMAP 2.134).
       Mirrors `ChatComposer`'s own swap, which is the shape PR 525's abort path
       was written against. Send is `disabled` for the whole of this window
       anyway (`canSend` requires `!isThinking`), so the swap costs the user
       nothing and removes the chance of reading a live Stop as a live Send. */
    const sendControl = showStopControl ? (
      <button
        type="button"
        onClick={cancelTurn}
        className={`inline-flex items-center justify-center ${sendBtnSize} rounded-full bg-panel-hover text-text-body border border-panel-border hover:bg-panel-border focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
        aria-label="Stop drafting"
        title="Stop drafting"
        data-testid={`${base}-stop`}
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
        data-testid={`${base}-send`}
      >
        <ArrowUp className={sendIconSize} aria-hidden="true" />
      </button>
    )

    /* Float-out. Strip only — the floating composer is already floating, and
       the hero surfaces have nowhere to float to. */
    const chevronControl =
      variant === 'strip' && !hideChevron && onChevronClick ? (
        <button
          type="button"
          onClick={onChevronClick}
          disabled={inputDisabled}
          aria-disabled={inputDisabled}
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:opacity-50"
          aria-label="Open Olumi in floating panel"
          data-testid={`${base}-chevron`}
          title="Open in floating window"
        >
          <ChevronUp className="w-4 h-4" aria-hidden="true" />
        </button>
      ) : null

    /* ⭐ THE RUN CONTROL. Rendered only where there IS an action row to put it
       in, and only when the host supplied one — see `analysisAction` on the
       props for the three things it deliberately is not.

       ⚠ DISABLED, NEVER HIDDEN, WHILE THE GATE IS SHUT, and it carries the
       gate's own sentence as its `title`. `AnalysisReadinessBar` states that
       rule for the pre-run bar ("It must never look pressable while the gate is
       shut"); this is the same control on a different surface, so it obeys the
       same rule rather than quietly vanishing and leaving the user with no
       account of why they cannot run. */
    const analysisControl =
      hasActionRow && analysisAction ? (
        (() => {
          const blocked = !analysisAction.canRun && !analysisAction.isRunning
          const runDisabled = analysisAction.isRunning || !analysisAction.canRun || inputDisabled
          return (
            <button
              type="button"
              onClick={analysisAction.onRun}
              disabled={runDisabled}
              aria-disabled={runDisabled}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-text-light"
              aria-label={analysisAction.label}
              title={blocked ? analysisAction.blockedReason ?? analysisAction.label : analysisAction.label}
              data-testid={`${base}-analyse`}
              data-blocked={blocked ? 'true' : 'false'}
            >
              <RefreshCw
                className={`w-3.5 h-3.5${analysisAction.isRunning ? ' animate-spin' : ''}`}
                aria-hidden="true"
              />
            </button>
          )
        })()
      ) : null

    const textarea = (
      <textarea
        ref={textareaRef}
        id={textareaId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={effectivePlaceholder}
        rows={minLines}
        disabled={inputDisabled}
        aria-disabled={inputDisabled}
        aria-label={ariaLabel ?? 'Chat message'}
        data-testid={`${base}-textarea`}
        className={typo(
          'panelBody',
          `w-full resize-none bg-transparent outline-none text-text-body placeholder:text-text-light py-2 pl-3 ${textareaRightPad}`,
        )}
      />
    )

    // In-composer generation status: a gently-pulsing, time-escalating line
    // sitting exactly where the placeholder text would (py-2 pl-3 mirrors the
    // textarea's text inset). pointer-events-none — the textarea underneath is
    // disabled during generation anyway.
    const generatingOverlay = isGenerating ? (
      <div
        role="status"
        aria-live="polite"
        data-testid={`${base}-generating`}
        className={`pointer-events-none absolute left-0 top-0 py-2 pl-3 ${textareaRightPad}`}
      >
        <span className={typo('panelBody', 'text-text-light animate-gentle-text-flash')}>
          {generatingMessage}
        </span>
      </div>
    ) : null

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
      <div className={containerClasses} data-testid={base}>
        {hasActionRow ? (
          /* PANEL-FOOTER LAYOUT — one bordered box holding the text and, beneath
             it, a right-aligned row of quiet controls. The box is the only
             border on this surface: the chevron used to sit outside it, giving
             the footer two separate frames to read. */
          <div className="relative bg-panel border border-panel-border rounded-lg transition-colors focus-within:border-info">
            <div className="relative">
              {textarea}
              {generatingOverlay}
            </div>
            <div
              className="flex items-center justify-end gap-1 px-2 pb-2"
              data-testid={`${base}-actions`}
            >
              {analysisControl}
              {chevronControl}
              {sendControl}
            </div>
          </div>
        ) : (
          /* OVERLAY LAYOUT — the hero surfaces, where the send disc sits inside
             a deliberately generous box and there is room for it to. */
          <>
            <div className="relative flex-1 bg-panel border border-panel-border rounded-lg transition-colors focus-within:border-info">
              {textarea}
              {generatingOverlay}
              <div className={`absolute ${stackInset} flex flex-col items-center gap-0.5`}>
                {sendControl}
              </div>
            </div>
            {chevronControl}
          </>
        )}
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
