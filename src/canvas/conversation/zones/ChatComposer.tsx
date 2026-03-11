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

import { useState, useCallback, useImperativeHandle, useEffect, useMemo, forwardRef, memo } from 'react'
import { ArrowUp, Play } from 'lucide-react'
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
import { recordUiSurfaceState } from '../../../lib/debug-state'
import type { BriefElementKind } from '../primitives/NodeShape'
import type { BriefReadiness } from '../hooks/useBriefSignals'
import type { UseConversationReturn } from '../useConversation'
import type { GenerateState } from './ChatTopBar'
import type { ScenarioStage } from '../../../types/scenario'

// ─────────────────────────────────────────────────────────────────────────────
// Imperative handle for text insertion from ChatTopBar
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
  generateState: GenerateState
  onCollapse: () => void
  onScrollToPatch: (patchId: string) => void
  onOpenInspector: (nodeId: string) => void
  onGenerateModel: () => void
  onBriefStateChange?: (readiness: BriefReadiness | null, hasText: boolean) => void
}

const STAGE_PLACEHOLDERS: Record<ScenarioStage, string> = {
  frame:    'Describe your decision, the options you\u2019re weighing, and what a good outcome looks like.',
  ideate:   'Explore options, add factors, or challenge assumptions...',
  evaluate: 'Ask about the results, challenge assumptions, or refine the model...',
  decide:   'Challenge the recommendation, or generate your brief...',
  optimise: 'Plan your next steps...',
}

export const ChatComposer = memo(forwardRef<ChatComposerHandle, ChatComposerProps>(
  function ChatComposer({ conversation, generateState, onCollapse, onScrollToPatch, onOpenInspector, onGenerateModel, onBriefStateChange }, ref) {
    const { sendMessage, isThinking } = conversation
    const { stage } = useStagePill()
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
      const MISSING_LABELS: Record<string, string> = {
        goal: 'No goal.',
        constraints: 'No constraints.',
        time_horizon: 'No time horizon.',
        success_metric: 'No success metric.',
        status_quo_option: 'No status quo option.',
        risk_factors: 'No risk factors.',
      }
      const missingText = bilResult.missing_elements
        .map(el => MISSING_LABELS[el])
        .filter(Boolean)
        .join(' ')
      const parts: string[] = []
      if (bilResult.options.length > 0) parts.push(`${bilResult.options.length} option${bilResult.options.length !== 1 ? 's' : ''}`)
      if (bilResult.factors.length > 0) parts.push(`${bilResult.factors.length} factor${bilResult.factors.length !== 1 ? 's' : ''}`)
      const detected = parts.length > 0 ? `${parts.join(', ')} detected.` : ''
      return [detected, missingText].filter(Boolean).join(' ')
    }, [bilResult])

    // Notify parent of readiness / text state changes (derived booleans, not raw value)
    const currentReadiness = briefSignals?.readiness ?? null
    const currentHasText = composer.value.trim().length > 0
    useEffect(() => {
      onBriefStateChange?.(currentReadiness, currentHasText)
    }, [currentReadiness, currentHasText, onBriefStateChange])

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

    useEffect(() => {
      recordUiSurfaceState('conversation', {
        firstDraftControlsVisible: showBriefStrip,
        staleFirstDraftGuidanceVisible: Boolean(showBriefStrip && (hasAnalysis || hasAnalysisReady)),
        aiPanelOpen: true,
        composerHasText: composer.value.trim().length > 0,
        composerTextLength: composer.value.trim().length,
        guidanceItemsVisible,
      })
    }, [showBriefStrip, hasAnalysis, hasAnalysisReady, composer.value, guidanceItemsVisible])

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
        {showBriefStrip && (
          <div className="flex items-end" style={{ gap: 6 }}>
            <BriefReadinessPill
              readiness={briefSignals!.readiness}
              expanded={stripExpanded}
              onToggle={() => setStripExpanded(prev => !prev)}
            />
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
            Tip: try describing how factors cause outcomes, not just listing them.
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

        {/* 5. Input container */}
        <div
          className="composer-input-box flex items-end bg-panel"
          style={{
            gap: 8,
            borderRadius: 20,
            border: '1px solid var(--border-default, #EEE6D8)',
            padding: '4px 5px 4px 12px',
            transition: 'border-color 200ms, box-shadow 200ms',
          }}
          data-composer-input=""
        >
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

          {/* Send button */}
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
              background: composer.canSend ? 'var(--primary, #63ADCF)' : 'var(--bg-panel-hover, #FEF9F3)',
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
        </div>

        <style>{`
          .send-btn:not(:disabled):hover {
            background: var(--primary-hover, #67C89E) !important;
            transform: translateY(-1px);
          }
          .send-btn:not(:disabled):active {
            transform: scale(0.92);
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

  return (
    <button
      type="button"
      disabled={!isActive}
      onClick={isActive ? onClick : undefined}
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
        background: isActive ? 'var(--primary, #63ADCF)' : 'transparent',
        border: isActive ? 'none' : '1px solid rgba(176,168,153,0.3)',
        color: isActive ? 'var(--text-on-color, #FFFFFF)' : 'var(--text-light, #908D8D)',
        boxShadow: isActive ? '0 1px 2px rgba(38,38,38,0.06)' : 'none',
        opacity: isActive ? 1 : 0.55,
        cursor: isActive ? 'pointer' : 'default',
      }}
      data-testid="inline-generate-btn"
    >
      <Play
        className="w-[11px] h-[11px] flex-shrink-0"
        strokeWidth={2}
        style={{ stroke: isActive ? 'var(--text-on-color, #FFFFFF)' : 'var(--text-light, #908D8D)' }}
        aria-hidden="true"
      />
      <span>Generate model</span>

      <style>{`
        .inline-gen-btn:not(:disabled):hover {
          background: var(--primary-hover, #67C89E) !important;
          transform: translateY(-1px);
        }
      `}</style>
    </button>
  )
}
