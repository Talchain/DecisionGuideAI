/**
 * ChatComposer — Zone 3: coaching tip + guidance strip + readiness row + input.
 *
 * Layers (top to bottom):
 * 1. CoachingTip (conditional, on guidance pill click)
 * 2. BriefGuidanceStrip (framing stage only, when any element detected)
 * 3. Readiness row: BriefReadinessPill + inline Generate model button (framing stage)
 * 4. GuidanceStrip (orchestrator coaching items — non-framing stages)
 * 5. Input container: textarea + send button
 */

import { useState, useCallback, useImperativeHandle, useEffect, useMemo, useRef, forwardRef, memo } from 'react'
import { ArrowUp, Paperclip, Mic, Play, Square } from 'lucide-react'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useStagePill } from '../../hooks/useStagePill'
import { useCanvasStore } from '../../store'
import { isFramingStage } from '../../../signals/stage-helpers'
import { useDebounce } from '../../../hooks/useDebounce'
import { useComposerState } from '../hooks/useComposerState'
import { useBriefSignals } from '../hooks/useBriefSignals'
import { isBilPreviewEnabled } from '../../../flags'
import { extractLocalBIL } from '../../brief-intelligence/extract'
import { GuidanceStrip } from '../GuidanceStrip'
import { CoachingTip } from './CoachingTip'
import { BriefGuidanceStrip } from './BriefGuidanceStrip'
import { BriefReadinessPill } from './BriefReadinessPill'
import { ComposerTools, type ThinkingMode } from './ComposerTools'
import { recordUiSurfaceState } from '../../../lib/debug-state'
import type { BriefElementKind } from '../primitives/NodeShape'
import type { BriefReadiness } from '../hooks/useBriefSignals'
import type { UseConversationReturn } from '../useConversation'
import type { ScenarioStage } from '../../../types/scenario'

// ChatTopBar is removed (Tranche 1 item 30); GenerateState now lives here.
export type GenerateState = 'disabled' | 'active' | 'loading'

// ─────────────────────────────────────────────────────────────────────────────
// Imperative handle for text insertion from external callers (e.g. Guide tool)
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatComposerHandle {
  replaceText: (text: string) => void
  /** Extract brief text and reset composer. Returns null if empty. */
  consumeBrief: () => string | null
  peekText: () => string
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface ChatComposerProps {
  conversation: UseConversationReturn
  onCollapse: () => void
  onScrollToPatch: (patchId: string) => void
  onOpenInspector: (nodeId: string) => void
  onGenerateModel: () => void
  onBriefStateChange?: (readiness: BriefReadiness | null, hasText: boolean) => void
  /** Insert text at cursor (from ComposerTools guide shortcuts). */
  onInsertText: (text: string) => void
  /** Attachment uploader trigger. */
  onAttach: () => void
  /** Run PLoT analysis. Gated by canRunAnalysis + stage. */
  onRunAnalysis: () => void
  /** Unified readiness gate (mirrors OutputsDock canRunAnalysis). */
  canRunAnalysis?: boolean
  /** Human-readable reason when run is blocked (tooltip). */
  runBlockedReason?: string
}

const STAGE_PLACEHOLDERS: Record<ScenarioStage, string> = {
  frame:    'Describe your decision, the options you\'re weighing, and what a good outcome looks like.',
  ideate:   'Explore options, add factors, or challenge assumptions...',
  evaluate: 'Ask about the results, challenge assumptions, or refine the model...',
  decide:   'Challenge the result, or generate your brief...',
  optimise: 'Plan your next steps...',
}

export const ChatComposer = memo(forwardRef<ChatComposerHandle, ChatComposerProps>(
  function ChatComposer({
    conversation, onCollapse, onScrollToPatch, onOpenInspector, onGenerateModel, onBriefStateChange,
    onInsertText, onAttach, onRunAnalysis, canRunAnalysis, runBlockedReason,
  }, ref) {
    const { sendMessage, isThinking, cancelTurn } = conversation
    const { stage } = useStagePill()
    const [thinkingMode, setThinkingMode] = useState<ThinkingMode>('normal')
    const showRunAnalysis = stage === 'ideate' || stage === 'evaluate'
    const runDisabled = isThinking || canRunAnalysis === false
    const setActiveGuidanceItem = useGuidanceStore(s => s.setActiveGuidanceItem)
    const hasGraph = useCanvasStore(s => s.nodes.length > 0 || s.edges.length > 0)
    const hasAnalysis = useCanvasStore(s => s.results?.status === 'complete' && Boolean(s.results?.hash ?? s.currentScenarioLastResultHash))
    const hasAnalysisReady = useCanvasStore(s => Boolean(s.ceeAnalysisReady))
    const guidanceItemsVisible = useGuidanceStore(s => s.guidanceItems.length)

    // Composer state
    const handleSend = useCallback(
      (text: string) => { sendMessage(text) },
      [sendMessage],
    )

    const composer = useComposerState({
      onSend: handleSend,
      onCollapse,
      disabled: isThinking,
    })

    // Derive generateState locally — avoids the useEffect lag from onBriefStateChange
    const generateState: GenerateState = isThinking ? 'loading'
      : composer.value.trim().length > 0 ? 'active'
      : 'disabled'

    // Expose replaceText and consumeBrief to parent via ref
    useImperativeHandle(ref, () => ({
      replaceText: composer.replaceText,
      consumeBrief: () => {
        const text = composer.value.trim()
        if (!text) return null
        composer.reset()
        return text
      },
      peekText: () => composer.value,
    }), [composer.replaceText, composer.value, composer.reset])

    // Unified 500ms debounce — shared by useBriefSignals and BIL extraction
    const debouncedValue = useDebounce(composer.value, 500)

    // Brief signals (framing stage only) — consume the shared debounced value
    const briefSignals = useBriefSignals(composer.value, stage, debouncedValue)

    // BIL local preview (flag-gated, framing stage only) — pure derived state, no side effects
    const bilResult = useMemo(() => {
      if (!isBilPreviewEnabled() || !isFramingStage(stage) || debouncedValue.trim().length === 0) return null
      return extractLocalBIL(debouncedValue)
    }, [debouncedValue, stage])

    // Human-readable summary of missing elements for BIL display
    const bilSummaryLine = useMemo(() => {
      if (!bilResult) return null
      const parts: string[] = []
      if (bilResult.options.length > 0) parts.push(`${bilResult.options.length} option${bilResult.options.length !== 1 ? 's' : ''}`)
      if (bilResult.factors.length > 0) parts.push(`${bilResult.factors.length} factor${bilResult.factors.length !== 1 ? 's' : ''}`)
      const detected = parts.length > 0 ? `${parts.join(', ')} detected.` : ''
      // Concise guidance instead of exhaustive missing-item checklist
      const guidance = bilResult.missing_elements.length > 0
        ? 'Add a goal and options to get started.'
        : ''
      return [detected, guidance].filter(Boolean).join(' ') || null
    }, [bilResult])

    // Notify parent of readiness / text state changes
    const currentReadiness = briefSignals?.readiness ?? null
    const currentHasText = composer.value.trim().length > 0
    useEffect(() => {
      onBriefStateChange?.(currentReadiness, currentHasText)
    }, [currentReadiness, currentHasText, onBriefStateChange])

    // Sync brief text to canvas store (debounced) so useGraphReadiness can include it
    const debouncedBriefText = useDebounce(composer.value.trim(), 500)
    useEffect(() => {
      if (typeof useCanvasStore.setState === 'function') {
        useCanvasStore.setState({ currentBriefText: debouncedBriefText || null })
      }
    }, [debouncedBriefText])

    // Coaching tip state
    const [activeTip, setActiveTip] = useState<string | null>(null)
    const [stripExpanded, setStripExpanded] = useState(true)

    const handleElementClick = useCallback((kind: BriefElementKind) => {
      if (!briefSignals) return
      const el = briefSignals.elements.find(e => e.kind === kind)
      if (el) {
        setActiveTip(prev => (prev === el.coachingTip ? null : el.coachingTip))
      }
    }, [briefSignals])

    const showBriefStrip = Boolean(!hasGraph && isFramingStage(stage) && briefSignals && briefSignals.elements.some(e => e.detected))
    // Show Generate Model CTA when brief strip is visible, user has typed any text, OR request is in flight (loading)
    const showGenerateCta = showBriefStrip || generateState === 'loading' || Boolean(!hasGraph && isFramingStage(stage) && composer.value.trim().length > 0)
    useEffect(() => {
      recordUiSurfaceState('conversation', {
        firstDraftControlsVisible: showGenerateCta,
        staleFirstDraftGuidanceVisible: Boolean(showBriefStrip && (hasAnalysis || hasAnalysisReady)),
        aiPanelOpen: true,
        composerHasText: composer.value.trim().length > 0,
        composerTextLength: composer.value.trim().length,
        guidanceItemsVisible,
      })
    }, [showBriefStrip, showGenerateCta, hasAnalysis, hasAnalysisReady, composer.value, guidanceItemsVisible])

    return (
      <div
        className="flex flex-col bg-panel flex-shrink-0"
        style={{ padding: '8px 12px 10px', gap: 6, borderTop: '1px solid var(--border-default, #EEE6D8)' }}
        data-testid="chat-composer"
      >
        {/* 1. Coaching tip */}
        {activeTip && (
          <CoachingTip tip={activeTip} onDismiss={() => setActiveTip(null)} />
        )}

        {/* 2. Guidance strip (framing only, when elements detected) */}
        {showBriefStrip && stripExpanded && (
          <BriefGuidanceStrip
            elements={briefSignals!.elements}
            onElementClick={handleElementClick}
          />
        )}

        {/* 3. Readiness row (framing only): readiness pill + inline Generate model */}
        {showGenerateCta && (
          <div className="flex items-end" style={{ gap: 6 }}>
            {showBriefStrip && (
              <BriefReadinessPill
                readiness={briefSignals!.readiness}
                expanded={stripExpanded}
                onToggle={() => setStripExpanded(prev => !prev)}
              />
            )}
            <InlineGenerateButton state={generateState} onClick={onGenerateModel} />
          </div>
        )}

        {/* 3b. BIL summary line (flag-gated, soft guidance only) */}
        {bilSummaryLine && (
          <p
            className="text-text-light"
            style={{ fontSize: 11, lineHeight: 1.4, margin: 0, padding: '0 2px' }}
            role="status"
            aria-live="polite"
            data-testid="bil-summary"
          >
            {bilSummaryLine}
          </p>
        )}

        {/* 3c. Causal framing coaching tip (weak framing + sufficient text) */}
        {bilResult?.causal_framing_score === 'weak' && debouncedValue.length > 50 && (
          <p
            className="text-text-light"
            style={{ fontSize: 11, lineHeight: 1.4, margin: 0, padding: '0 2px', fontStyle: 'italic' }}
            data-testid="bil-causal-tip"
          >
            Tip: describe how factors cause outcomes, not just list them.
          </p>
        )}

        {/* 4. Orchestrator guidance strip (post-framing coaching items) */}
        {!isFramingStage(stage) && (
          <GuidanceStrip
            onSendMessage={sendMessage}
            onSetActive={setActiveGuidanceItem}
            onScrollToPatch={onScrollToPatch}
            onOpenInspector={onOpenInspector}
          />
        )}

        {/* 5. Input container — Claude-pattern composer row:
              left: attach · voice · (run analysis when gated)
              centre: textarea
              right: composer tools (⚙︎) · send/stop */}
        <div
          className="composer-input-box flex items-end bg-panel"
          style={{
            gap: 6,
            borderRadius: 20,
            border: '1px solid var(--border-default, #EEE6D8)',
            padding: '4px 5px 4px 8px',
            transition: 'border-color 200ms, box-shadow 200ms',
          }}
          data-composer-input=""
        >
          {/* Left cluster */}
          <button
            type="button"
            onClick={onAttach}
            aria-label="Attach evidence"
            title="Attach evidence"
            className="composer-icon-btn flex-shrink-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2"
            style={{
              width: 34, height: 34, borderRadius: '50%',
              marginBottom: 2, background: 'transparent',
              border: 'none', color: 'var(--text-light, #908D8D)', cursor: 'pointer',
              transition: 'all 150ms',
            }}
            data-testid="composer-attach-button"
          >
            <Paperclip className="w-4 h-4" strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled
            aria-label="Voice input (coming soon)"
            title="Voice input (coming soon)"
            className="composer-icon-btn flex-shrink-0 flex items-center justify-center"
            style={{
              width: 34, height: 34, borderRadius: '50%',
              marginBottom: 2, background: 'transparent',
              border: 'none', color: 'var(--text-light, #908D8D)',
              cursor: 'not-allowed', opacity: 0.5, transition: 'all 150ms',
            }}
            data-testid="composer-voice-button"
          >
            <Mic className="w-4 h-4" strokeWidth={1.8} aria-hidden="true" />
          </button>
          {showRunAnalysis && (
            <button
              type="button"
              onClick={onRunAnalysis}
              disabled={runDisabled}
              title={runDisabled && runBlockedReason ? runBlockedReason : undefined}
              aria-label={runDisabled && runBlockedReason ? `Run analysis (blocked: ${runBlockedReason})` : 'Run analysis'}
              className="composer-run-chip flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 30,
                padding: '0 10px',
                marginBottom: 4,
                borderRadius: 999,
                background: 'transparent',
                border: '1px solid var(--border-default, #EEE6D8)',
                color: 'var(--text-body, #3F3F3E)',
                fontSize: 13,
                fontWeight: 500,
                whiteSpace: 'nowrap' as const,
                transition: 'all 100ms',
                opacity: runDisabled ? 0.5 : 1,
                cursor: runDisabled ? 'not-allowed' : 'pointer',
              }}
              data-testid="run-analysis-chip"
            >
              <Play className="w-3.5 h-3.5 text-text-light" strokeWidth={1.8} aria-hidden="true" />
              <span>Run analysis</span>
            </button>
          )}

          <textarea
            ref={composer.textareaRef}
            value={composer.value}
            onChange={composer.handleChange}
            onKeyDown={composer.handleKeyDown}
            placeholder={STAGE_PLACEHOLDERS[stage] ?? STAGE_PLACEHOLDERS.frame}
            disabled={isThinking}
            rows={1}
            aria-label="Message input"
            className="flex-1 bg-transparent border-none outline-none resize-none text-text-body placeholder:text-text-light"
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              fontFamily: 'inherit',
              padding: '12px 4px',
              minHeight: 88,
              maxHeight: 180,
            }}
          />

          {/* Right cluster: composer tools (⚙︎) + send/stop */}
          <ComposerTools
            onInsertText={onInsertText}
            selectedMode={thinkingMode}
            onSelectMode={setThinkingMode}
          />

          {/* Send / Stop button (T6).
            * isThinking is the SINGLE canonical streaming signal — when true,
            * the button replaces send with stop. No loose fallback on
            * toolLoadingState; this is the only source of truth. */}
          {isThinking ? (
            <button
              type="button"
              onClick={cancelTurn}
              aria-label="Stop response"
              className="stop-btn flex-shrink-0 flex items-center justify-center"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                marginBottom: 2,
                transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                background: 'var(--bg-panel, #FEF9F3)',
                border: '1px solid var(--border-default, #EEE6D8)',
                boxShadow: 'none',
                cursor: 'pointer',
              }}
              data-testid="stop-button"
            >
              <Square
                className="w-[14px] h-[14px]"
                strokeWidth={2.2}
                fill="var(--text-body, #2A2A2A)"
                style={{ stroke: 'var(--text-body, #2A2A2A)' }}
                aria-hidden="true"
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { if (composer.canSend) { handleSend(composer.value.trim()); composer.reset() } }}
              disabled={!composer.canSend}
              aria-label="Send message"
              className="send-btn flex-shrink-0 flex items-center justify-center"
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                marginBottom: 2,
                transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                background: composer.canSend ? 'var(--primary, #2B7FA2)' : 'var(--bg-panel-hover, #FEF9F3)',
                border: composer.canSend ? 'none' : '1px solid var(--border-default, #E8E5E1)',
                boxShadow: composer.canSend ? '0 1px 2px rgba(38,38,38,0.06)' : 'none',
                cursor: composer.canSend ? 'pointer' : 'default',
              }}
              data-testid="send-button"
            >
              <ArrowUp
                className="w-[15px] h-[15px]"
                strokeWidth={2.2}
                style={{ stroke: composer.canSend ? 'var(--text-on-color, #FFFFFF)' : 'var(--text-light, #908D8D)' }}
                aria-hidden="true"
              />
            </button>
          )}
        </div>

        <style>{`
          .send-btn:not(:disabled):hover {
            background: var(--primary-hover, #67C89E) !important;
            transform: translateY(-1px);
          }
          .send-btn:not(:disabled):active {
            transform: scale(0.92);
          }
          .stop-btn:hover {
            background: var(--bg-panel-hover, #F5EEE0) !important;
          }
          .stop-btn:active {
            transform: scale(0.92);
          }
          .composer-icon-btn:not(:disabled):hover {
            background: var(--bg-panel-hover, #FEF9F3);
            color: var(--text-body, #3F3F3E);
          }
          .composer-run-chip:not(:disabled):hover {
            background: var(--bg-panel-hover, #FEF9F3);
          }
        `}</style>
      </div>
    )
  },
))

/* ─────────────────────────────────────────────────────────────────────────── */

/** Inline Generate model button — 26px height, matches readiness pill. */
function InlineGenerateButton({ state, onClick }: { state: GenerateState; onClick: () => void }) {
  const isActive = state === 'active'
  const isLoading = state === 'loading'

  return (
    <button
      type="button"
      onClick={onClick}
      data-active={isActive || undefined}
      data-loading={isLoading || undefined}
      className="inline-gen-btn flex-shrink-0"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 26,
        padding: '0 10px',
        borderRadius: 999,
        marginLeft: 'auto',
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap' as const,
        transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        background: (isActive || isLoading) ? 'var(--primary, #2B7FA2)' : 'transparent',
        border: (isActive || isLoading) ? 'none' : '1px solid rgba(176,168,153,0.3)',
        color: (isActive || isLoading) ? 'var(--text-on-color, #FFFFFF)' : 'var(--text-light, #908D8D)',
        boxShadow: (isActive || isLoading) ? '0 1px 2px rgba(38,38,38,0.06)' : 'none',
        opacity: (isActive || isLoading) ? 1 : 0.55,
        cursor: isActive ? 'pointer' : isLoading ? 'wait' : 'default',
        pointerEvents: isLoading ? 'none' : undefined,
      }}
      data-testid="inline-generate-btn"
    >
      {isLoading ? (
        <span
          className="w-[11px] h-[11px] flex-shrink-0 rounded-full border-2 border-white/30 border-t-white animate-spin"
          aria-hidden="true"
        />
      ) : (
        <Play
          className="w-[11px] h-[11px] flex-shrink-0"
          strokeWidth={2}
          style={{ stroke: isActive ? 'var(--text-on-color, #FFFFFF)' : 'var(--text-light, #908D8D)' }}
          aria-hidden="true"
        />
      )}
      <span>{isLoading ? 'Generating…' : 'Generate model'}</span>

      <style>{`
        .inline-gen-btn[data-active]:hover {
          background: var(--primary-hover, #67C89E) !important;
          transform: translateY(-1px);
        }
      `}</style>
    </button>
  )
}
