import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { OutputsDock } from '../components/OutputsDock'
import { useConversation } from '../conversation/useConversation'
import { useGuidanceStore } from '../stores/guidanceStore'
import { AIHeaderStrip } from './AIHeaderStrip'
import { ConversationSurface, type ConversationSurfaceHandle } from './ConversationSurface'
import { FloatingPanel } from './FloatingPanel'
import { MinimisedBar, type MinimisedBarHandle } from './MinimisedBar'
import { WelcomeComposer, type WelcomeComposerHandle } from './WelcomeComposer'
import { usePanelSplit } from './hooks/usePanelSplit'
import { usePanelView } from './hooks/usePanelView'
import {
  AI_HEADER_STRIP_HEIGHT,
  AI_PANEL_V2_WIDTH,
  AI_ZONE_MIN_HEIGHT,
  ANALYSIS_ZONE_MIN_HEIGHT,
  MINIMISED_BAR_HEIGHT,
  PANEL_BOTTOM_OFFSET_CSS,
  PANEL_RIGHT_MARGIN,
  POST_ANALYSIS_AI_RATIO,
  PRE_ANALYSIS_AI_RATIO,
  Z_AI_PANEL_BASE,
} from './constants'

// Right-edge AI panel (Batch 2 — state-led).
//
// View matrix (driven by `usePanelView`):
//   • welcome      → full-panel WelcomeComposer; analysis HIDDEN
//   • docked (pre) → 35% analysis / 65% AI
//   • docked (post)→ 65% analysis / 35% AI
//   • minimised    → analysis fills (panel - 48px); 48px bar at bottom
//   • floating     → analysis 100%; FloatingPanel as separate aside
//
// Single useConversation() instance lives here and is threaded into both
// the embedded OutputsDock (for chip-fires) and the ConversationSurface
// (the chat thread + input). Draft text is lifted up so it survives
// across dock/undock/minimise transitions.

export function AIPanelV2Layout() {
  // ── Singleton conversation ────────────────────────────────────────
  const conversation = useConversation()

  // ── Derived state-led view ────────────────────────────────────────
  const { view, state, setDisplay } = usePanelView({ conversation })

  // ── Sentinel measures the usable vertical budget ──────────────────
  const measureRef = useRef<HTMLDivElement>(null)
  const [availableHeightPx, setAvailableHeightPx] = useState(0)
  useLayoutEffect(() => {
    if (!measureRef.current || typeof ResizeObserver === 'undefined') return
    const el = measureRef.current
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const h = entry.contentRect.height
        if (h > 0) setAvailableHeightPx(h)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const getPanelHeight = useCallback(() => availableHeightPx, [availableHeightPx])

  // ── Vertical split (Docked States 2 + 3) ──────────────────────────
  const { aiRatio, isDragging, startDrag, adjustByPx, setRatio } = usePanelSplit({
    getPanelHeight,
    initialRatio: state === 'post-analysis' ? POST_ANALYSIS_AI_RATIO : PRE_ANALYSIS_AI_RATIO,
  })

  // Snap ratio to the right preset when the derived state transitions.
  // Tracks the previous state so we only snap on transitions, leaving
  // user-resize freedom intact while a state is stable.
  const prevStateRef = useRef(state)
  useEffect(() => {
    if (prevStateRef.current === state) return
    prevStateRef.current = state
    if (state === 'pre-analysis') setRatio(PRE_ANALYSIS_AI_RATIO)
    else if (state === 'post-analysis') setRatio(POST_ANALYSIS_AI_RATIO)
  }, [state, setRatio])

  // ── Lifted state that must survive dock/undock/minimise ───────────
  // Draft text is lifted so the textarea contents are shared across
  // every variant (Welcome / docked AIInputBar / MinimisedBar input /
  // floating AIInputBar). The brief requires draft preservation across
  // dock/undock — controlled-input pattern on each surface is what
  // honours that contract.
  const [draftText, setDraftText] = useState('')
  // Thread scrollTop preservation. ConversationSurface re-mounts when
  // the view switches between docked and floating (different parent
  // containers), so React resets the new container's scrollTop to 0.
  //
  // The pattern used here is the canonical React lifecycle:
  //   • A `useLayoutEffect` keyed to `view.kind`. The CLEANUP runs on
  //     the OUTGOING render (right before React unmounts the
  //     previous-view subtree), and we capture `scrollTop` there.
  //     scrollTop is still valid at that moment because the DOM has
  //     not been mutated for the new view yet.
  //   • The same effect's BODY runs on the INCOMING render, after the
  //     new view has mounted. We restore the saved offset (clamped to
  //     the new scrollHeight) and clear the ref so a later unrelated
  //     re-render does not reapply a stale value.
  //
  // This replaces the earlier "mutate refs during render" trick — refs
  // are now read/written only inside effects, the canonical lifecycle
  // hook for DOM-backed state.
  const threadScrollRef = useRef<HTMLDivElement | null>(null)
  const savedScrollTopRef = useRef<number | null>(null)
  const surfaceRef = useRef<ConversationSurfaceHandle>(null)
  const welcomeRef = useRef<WelcomeComposerHandle>(null)
  const minimisedRef = useRef<MinimisedBarHandle>(null)

  useLayoutEffect(() => {
    // Restore — runs on every view.kind change AFTER the new surface
    // mounts. Only acts when there's a saved offset from a prior view.
    const el = threadScrollRef.current
    const saved = savedScrollTopRef.current
    if (el && saved != null && saved > 0) {
      const maxScroll = el.scrollHeight - el.clientHeight
      if (maxScroll > 0) el.scrollTop = Math.min(saved, maxScroll)
    }
    // Clear after each transition so a subsequent unrelated re-render
    // (e.g. messages.length change) doesn't reapply a stale value.
    savedScrollTopRef.current = null

    // Capture — closes over the SAME ref object (not the current
    // .current value), so when cleanup runs the read sees the
    // ref's value at cleanup time. ConversationSurface mirrors its
    // scroll container into the same ref via the `scrollListRef`
    // prop, which keeps `.current` pointing at the still-detached but
    // scrollTop-bearing OUTGOING container DOM node until the next
    // surface's mount-effect overwrites it. Empirically validated
    // by `ScrollPreservation.spec.tsx`.
    const refForCleanup = threadScrollRef
    return () => {
      const outgoing = refForCleanup.current
      if (outgoing) savedScrollTopRef.current = outgoing.scrollTop
    }
  }, [view.kind])

  // ── Attachment plumbing (hidden file input lives at layout root) ──
  const fileInputRef = useRef<HTMLInputElement>(null)
  const handleAttach = useCallback(() => fileInputRef.current?.click(), [])

  // ── Send + prefill ────────────────────────────────────────────────
  const handleSend = useCallback(
    async (text: string) => {
      setDraftText('')
      await conversation.sendMessage(text, { debugSource: 'ai_panel_v2_input' })
    },
    [conversation],
  )

  const handlePrefill = useCallback((text: string) => {
    setDraftText(text)
    // Focus the active variant's input.
    if (view.kind === 'welcome') welcomeRef.current?.focus()
    else if (view.kind === 'minimised') minimisedRef.current?.focus()
    else surfaceRef.current?.focusInput()
  }, [view.kind])

  // Register prefill + external send into guidanceStore. The same
  // handler works for all view kinds because draftText is layout-owned.
  useEffect(() => {
    const sendForExternals = (text: string) => {
      void conversation.sendMessage(text, { debugSource: 'ai_panel_v2_external' })
    }
    useGuidanceStore.setState({
      _prefillChat: handlePrefill,
      _sendMessage: sendForExternals,
    })
    return () => {
      const s = useGuidanceStore.getState()
      if (s._prefillChat === handlePrefill) useGuidanceStore.setState({ _prefillChat: null })
      if (s._sendMessage === sendForExternals) useGuidanceStore.setState({ _sendMessage: null })
    }
  }, [conversation, handlePrefill])

  // ── Display toggle handlers ───────────────────────────────────────
  const handleMinimise = useCallback(() => setDisplay('minimised'), [setDisplay])
  const handleFloat = useCallback(() => setDisplay('floating'), [setDisplay])
  // Expanding from minimised should both restore the docked layout AND
  // land focus on the docked AIInputBar — the user was already typing
  // in the minimised input, so we move focus + cursor without losing
  // momentum. A ref-flag is set here, and the docked layout's mount
  // effect consumes it to call `surfaceRef.current?.focusInput()`.
  const focusOnNextDockRef = useRef(false)
  const handleDockOrExpand = useCallback(() => {
    focusOnNextDockRef.current = true
    setDisplay('docked')
  }, [setDisplay])

  // After the docked layout commits in response to expand, transfer
  // focus into the AIInputBar. useLayoutEffect runs before paint so
  // there is no perceivable focus blink.
  useLayoutEffect(() => {
    if (view.kind !== 'docked') return
    if (!focusOnNextDockRef.current) return
    focusOnNextDockRef.current = false
    surfaceRef.current?.focusInput()
  }, [view.kind])

  // ── Pixel heights for the docked split ────────────────────────────
  const { aiHeightPx, analysisHeightPx } = useMemo(() => {
    if (availableHeightPx <= 0) {
      return { aiHeightPx: AI_ZONE_MIN_HEIGHT, analysisHeightPx: 0 }
    }
    const rawAi = availableHeightPx * aiRatio
    const aiH = Math.max(
      AI_ZONE_MIN_HEIGHT,
      Math.min(availableHeightPx - ANALYSIS_ZONE_MIN_HEIGHT, rawAi),
    )
    return { aiHeightPx: aiH, analysisHeightPx: availableHeightPx - aiH }
  }, [availableHeightPx, aiRatio])

  // ── Renderers per view ────────────────────────────────────────────

  // Shared sentinel + hidden file input always rendered so the
  // measurement and attachment plumbing don't churn on view changes.
  const plumbing = (
    <>
      <div
        ref={measureRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: PANEL_RIGHT_MARGIN,
          bottom: PANEL_BOTTOM_OFFSET_CSS,
          right: -9999,
          width: 1,
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        data-testid="ai-panel-v2-file-input"
      />
    </>
  )

  // State 1 — Welcome: full-panel composer, analysis HIDDEN.
  if (view.kind === 'welcome') {
    return (
      <>
        {plumbing}
        <aside
          data-testid="ai-panel-v2-layout"
          data-view="welcome"
          aria-label="AI conversation"
          className="flex flex-col pointer-events-auto bg-panel border border-default rounded-2xl overflow-hidden shadow-2"
          style={{
            position: 'fixed',
            top: PANEL_RIGHT_MARGIN,
            right: PANEL_RIGHT_MARGIN,
            bottom: PANEL_BOTTOM_OFFSET_CSS,
            width: AI_PANEL_V2_WIDTH,
            zIndex: Z_AI_PANEL_BASE,
          }}
        >
          <WelcomeComposer
            ref={welcomeRef}
            onSend={handleSend}
            isThinking={conversation.isThinking}
            onAttach={handleAttach}
            value={draftText}
            onValueChange={setDraftText}
          />
        </aside>
      </>
    )
  }

  // State 5 — Floating: analysis 100% docked, AI as a separate floating aside.
  if (view.kind === 'floating') {
    return (
      <>
        {plumbing}
        <aside
          data-testid="ai-panel-v2-analysis-zone"
          aria-label="Analysis"
          className="flex flex-col pointer-events-auto bg-panel border border-default rounded-2xl overflow-hidden shadow-2"
          style={{
            position: 'fixed',
            top: PANEL_RIGHT_MARGIN,
            right: PANEL_RIGHT_MARGIN,
            bottom: PANEL_BOTTOM_OFFSET_CSS,
            width: AI_PANEL_V2_WIDTH,
            zIndex: Z_AI_PANEL_BASE,
          }}
        >
          <OutputsDock embedded embeddedSendMessage={conversation.sendMessage} />
        </aside>
        <FloatingPanel onDock={handleDockOrExpand}>
          <ConversationSurface
            ref={surfaceRef}
            conversation={conversation}
            draftText={draftText}
            onDraftChange={setDraftText}
            scrollListRef={threadScrollRef}
            onAttach={handleAttach}
            onPrefill={text => setDraftText(text)}
            onSend={handleSend}
          />
        </FloatingPanel>
      </>
    )
  }

  // State 4 — Minimised: analysis fills minus the bar; bar pinned at bottom.
  if (view.kind === 'minimised') {
    const barH = MINIMISED_BAR_HEIGHT
    return (
      <>
        {plumbing}
        <aside
          data-testid="ai-panel-v2-analysis-zone"
          aria-label="Analysis"
          className="flex flex-col pointer-events-auto bg-panel border border-default rounded-2xl overflow-hidden shadow-2"
          style={{
            position: 'fixed',
            top: PANEL_RIGHT_MARGIN,
            right: PANEL_RIGHT_MARGIN,
            bottom: `calc(${PANEL_BOTTOM_OFFSET_CSS} + ${barH}px + 8px)`,
            width: AI_PANEL_V2_WIDTH,
            zIndex: Z_AI_PANEL_BASE,
          }}
        >
          <OutputsDock embedded embeddedSendMessage={conversation.sendMessage} />
        </aside>
        <aside
          data-testid="ai-panel-v2-layout"
          data-view="minimised"
          aria-label="AI conversation (minimised)"
          className="flex flex-col pointer-events-auto bg-panel border border-default rounded-2xl overflow-hidden shadow-2"
          style={{
            position: 'fixed',
            right: PANEL_RIGHT_MARGIN,
            bottom: PANEL_BOTTOM_OFFSET_CSS,
            width: AI_PANEL_V2_WIDTH,
            zIndex: Z_AI_PANEL_BASE,
          }}
        >
          <MinimisedBar
            ref={minimisedRef}
            onSend={handleSend}
            onExpand={handleDockOrExpand}
            onAttach={handleAttach}
            isThinking={conversation.isThinking}
            value={draftText}
            onValueChange={setDraftText}
          />
        </aside>
      </>
    )
  }

  // States 2 + 3 — Docked split.
  return (
    <>
      {plumbing}
      <aside
        data-testid="ai-panel-v2-analysis-zone"
        aria-label="Analysis"
        className="flex flex-col pointer-events-auto bg-panel border border-default rounded-2xl overflow-hidden shadow-2"
        style={{
          position: 'fixed',
          top: PANEL_RIGHT_MARGIN,
          right: PANEL_RIGHT_MARGIN,
          width: AI_PANEL_V2_WIDTH,
          height: analysisHeightPx > 0
            ? `${analysisHeightPx}px`
            : `calc(70vh - ${PANEL_RIGHT_MARGIN}px)`,
          zIndex: Z_AI_PANEL_BASE,
          transition: isDragging ? 'none' : 'height var(--duration-base, 300ms) ease-out',
        }}
      >
        <OutputsDock embedded embeddedSendMessage={conversation.sendMessage} />
      </aside>
      <aside
        data-testid="ai-panel-v2-layout"
        data-view="docked"
        data-state={view.kind === 'docked' ? view.state : undefined}
        aria-label="AI conversation"
        className="flex flex-col pointer-events-auto bg-panel border border-default rounded-2xl overflow-hidden shadow-2"
        style={{
          position: 'fixed',
          width: AI_PANEL_V2_WIDTH,
          height: `${aiHeightPx}px`,
          right: PANEL_RIGHT_MARGIN,
          bottom: PANEL_BOTTOM_OFFSET_CSS,
          zIndex: Z_AI_PANEL_BASE,
          transition: isDragging ? 'none' : 'height var(--duration-base, 300ms) ease-out',
        }}
        data-ai-ratio={aiRatio.toFixed(3)}
        data-is-dragging={isDragging ? 'true' : 'false'}
      >
        <AIHeaderStrip
          onStartDrag={startDrag}
          onAdjustByPx={adjustByPx}
          onMinimise={handleMinimise}
          onFloat={handleFloat}
        />
        <div
          data-testid="ai-panel-v2-ai-zone"
          className="flex flex-col flex-1 min-h-0 bg-panel overflow-hidden"
          style={{ minHeight: `calc(100% - ${AI_HEADER_STRIP_HEIGHT}px)` }}
        >
          <ConversationSurface
            ref={surfaceRef}
            conversation={conversation}
            draftText={draftText}
            onDraftChange={setDraftText}
            scrollListRef={threadScrollRef}
            onAttach={handleAttach}
            onPrefill={text => setDraftText(text)}
            onSend={handleSend}
          />
        </div>
      </aside>
    </>
  )
}
