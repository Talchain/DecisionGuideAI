/**
 * ChatTopBar — Zone 1: single-row top bar (48px) with all panel controls.
 *
 * Layout: Attach → Mic → Generate model → Run analysis → Spacer →
 *         Guide chip → Thinking mode → Separator → Collapse
 */

import { useRef, useState, useCallback } from 'react'
import { Paperclip, Mic, Play, ChevronsRight, Compass } from 'lucide-react'
import { IconButton } from '../primitives/IconButton'
import { GuideDropdown } from '../dropdowns/GuideDropdown'
import { ThinkingModeChip, ThinkingModeDropdown } from '../dropdowns/ThinkingModeDropdown'
import type { ThinkingMode } from '../dropdowns/ThinkingModeDropdown'
import type { ScenarioStage } from '../../../types/scenario'

export type GenerateState = 'disabled' | 'active' | 'loading'

interface ChatTopBarProps {
  stage: ScenarioStage
  isThinking: boolean
  generateState: GenerateState
  onCollapse: () => void
  onAttach: () => void
  onRunAnalysis: () => void
  onGenerateModel: () => void
  onInsertText: (text: string) => void
}

/** Spinner SVG for loading state. */
function Spinner() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      style={{ animation: 'topBarSpin 1s linear infinite' }}
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function ChatTopBar({
  stage,
  isThinking,
  generateState,
  onCollapse,
  onAttach,
  onRunAnalysis,
  onGenerateModel,
  onInsertText,
}: ChatTopBarProps) {
  const [guideOpen, setGuideOpen] = useState(false)
  const guideRef = useRef<HTMLButtonElement>(null)
  const [thinkingOpen, setThinkingOpen] = useState(false)
  const thinkingRef = useRef<HTMLDivElement>(null)
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>('normal')

  const showRunAnalysis = stage === 'ideate' || stage === 'evaluate'

  const handleGuideToggle = useCallback(() => {
    setGuideOpen(prev => !prev)
    setThinkingOpen(false)
  }, [])

  const handleThinkingToggle = useCallback(() => {
    setThinkingOpen(prev => !prev)
    setGuideOpen(false)
  }, [])

  return (
    <div
      className="flex items-center bg-panel flex-shrink-0"
      style={{
        gap: 2,
        padding: '0 6px',
        height: 48,
        minHeight: 48,
        borderBottom: '1px solid var(--border-default, #EEE6D8)',
      }}
      data-testid="chat-top-bar"
    >
      {/* Left cluster */}
      <IconButton icon={Paperclip} label="Attach evidence" onClick={onAttach} />
      <IconButton icon={Mic} label="Voice input" disabled />

      {/* Generate model chip — primary variant, 4 states */}
      <GenerateModelChip state={generateState} onClick={onGenerateModel} />

      {/* Run analysis chip — ideate/evaluate only */}
      {showRunAnalysis && (
        <button
          type="button"
          onClick={onRunAnalysis}
          disabled={isThinking}
          className="top-bar-chip cursor-pointer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            height: 30,
            padding: '0 10px',
            borderRadius: 999,
            background: 'transparent',
            border: '1px solid var(--border-default, #EEE6D8)',
            color: 'var(--text-body, #3F3F3E)',
            fontSize: 13,
            fontWeight: 500,
            whiteSpace: 'nowrap' as const,
            transition: 'all 100ms',
            opacity: isThinking ? 0.5 : 1,
          }}
          data-testid="run-analysis-chip"
        >
          <Play className="w-3.5 h-3.5 text-text-light" strokeWidth={1.8} aria-hidden="true" />
          <span>Run analysis</span>
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right cluster */}
      <div className="relative">
        <button
          ref={guideRef}
          type="button"
          onClick={handleGuideToggle}
          aria-haspopup="true"
          aria-expanded={guideOpen}
          className="top-bar-chip cursor-pointer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            height: 30,
            padding: '0 10px',
            borderRadius: 999,
            background: 'transparent',
            border: '1px solid var(--border-default, #EEE6D8)',
            color: 'var(--text-body, #3F3F3E)',
            fontSize: 13,
            fontWeight: 500,
            whiteSpace: 'nowrap' as const,
            transition: 'all 100ms',
          }}
          data-testid="guide-chip"
        >
          <Compass className="w-3.5 h-3.5 text-text-light" strokeWidth={1.8} aria-hidden="true" />
          <span>Guide</span>
        </button>
        <GuideDropdown
          isOpen={guideOpen}
          onClose={() => setGuideOpen(false)}
          onInsertText={onInsertText}
          anchorRef={guideRef}
        />
      </div>

      <div className="relative" ref={thinkingRef}>
        <ThinkingModeChip selectedMode={thinkingMode} onClick={handleThinkingToggle} />
        <ThinkingModeDropdown
          isOpen={thinkingOpen}
          onClose={() => setThinkingOpen(false)}
          selectedMode={thinkingMode}
          onSelectMode={setThinkingMode}
          anchorRef={thinkingRef}
        />
      </div>

      {/* Separator */}
      <div
        className="flex-shrink-0"
        style={{ width: 1, height: 20, background: 'var(--border-default, #EEE6D8)', margin: '0 2px' }}
        aria-hidden="true"
      />

      {/* Collapse (right-most) */}
      <IconButton icon={ChevronsRight} label="Collapse panel" onClick={onCollapse} />

      <style>{`
        .top-bar-chip:hover { background: var(--bg-panel-hover, #FEF9F3) !important; }
        .top-bar-chip:hover svg { stroke: var(--text-body, #3F3F3E); }
        @keyframes topBarSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */

function GenerateModelChip({ state, onClick }: { state: GenerateState; onClick: () => void }) {
  if (state === 'loading') {
    return (
      <button
        type="button"
        disabled
        className="flex-shrink-0"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 30,
          padding: '0 10px',
          borderRadius: 999,
          background: 'rgba(99,173,207,0.55)',
          border: 'none',
          color: 'var(--text-on-color, #FFFFFF)',
          fontSize: 13,
          fontWeight: 500,
          whiteSpace: 'nowrap' as const,
          cursor: 'default',
          pointerEvents: 'none' as const,
          boxShadow: '0 1px 2px rgba(38,38,38,0.06)',
        }}
        data-testid="generate-model-chip"
      >
        <Spinner />
        <span>Generating…</span>
      </button>
    )
  }

  const isActive = state === 'active'

  return (
    <button
      type="button"
      disabled={!isActive}
      onClick={isActive ? onClick : undefined}
      className="generate-model-chip flex-shrink-0"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 30,
        padding: '0 10px',
        borderRadius: 999,
        background: isActive ? 'var(--primary, #63ADCF)' : 'transparent',
        border: isActive ? 'none' : '1px solid rgba(176,168,153,0.35)',
        color: isActive ? 'var(--text-on-color, #FFFFFF)' : 'var(--text-light, #908D8D)',
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: 'nowrap' as const,
        cursor: isActive ? 'pointer' : 'default',
        opacity: isActive ? 1 : 0.55,
        boxShadow: isActive ? '0 1px 2px rgba(38,38,38,0.06)' : 'none',
        transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      data-testid="generate-model-chip"
    >
      <Play
        className="w-3.5 h-3.5 flex-shrink-0"
        strokeWidth={1.8}
        style={{ stroke: isActive ? 'var(--text-on-color, #FFFFFF)' : 'var(--text-light, #908D8D)' }}
        aria-hidden="true"
      />
      <span>Generate model</span>

      <style>{`
        .generate-model-chip:not(:disabled):hover {
          background: var(--primary-hover, #67C89E) !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(38,38,38,0.10) !important;
        }
        .generate-model-chip:not(:disabled):active {
          background: var(--primary-active, #5AA88A) !important;
          transform: none;
        }
      `}</style>
    </button>
  )
}
