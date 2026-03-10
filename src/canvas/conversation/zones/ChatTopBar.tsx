/**
 * ChatTopBar — Zone 1: single-row top bar (48px) with all panel controls.
 *
 * Layout: Attach → Mic → Run analysis → Spacer →
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
  /** Unified readiness gate — mirrors OutputsDock canRunAnalysis */
  canRunAnalysis?: boolean
  /** Human-readable reason when run is blocked */
  runBlockedReason?: string
  onCollapse: () => void
  onAttach: () => void
  onRunAnalysis: () => void
  onInsertText: (text: string) => void
}

export function ChatTopBar({
  stage,
  isThinking,
  canRunAnalysis: canRun,
  runBlockedReason,
  onCollapse,
  onAttach,
  onRunAnalysis,
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
        overflow: 'visible',
      }}
      data-testid="chat-top-bar"
    >
      {/* Left cluster */}
      <IconButton icon={Paperclip} label="Attach evidence" onClick={onAttach} />
      <IconButton icon={Mic} label="Voice input" disabled />

      {/* Run analysis chip — ideate/evaluate only, unified gating */}
      {showRunAnalysis && (() => {
        const isDisabled = isThinking || canRun === false
        return (
          <button
            type="button"
            onClick={onRunAnalysis}
            disabled={isDisabled}
            title={isDisabled && runBlockedReason ? runBlockedReason : undefined}
            aria-label={isDisabled && runBlockedReason ? `Run analysis (blocked: ${runBlockedReason})` : 'Run analysis'}
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
              opacity: isDisabled ? 0.5 : 1,
            }}
            data-testid="run-analysis-chip"
          >
            <Play className="w-3.5 h-3.5 text-text-light" strokeWidth={1.8} aria-hidden="true" />
            <span>Run analysis</span>
          </button>
        )
      })()}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right cluster */}
      <div className="relative" style={{ overflow: 'visible' }}>
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

      <div className="relative" ref={thinkingRef} style={{ overflow: 'visible' }}>
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
      `}</style>
    </div>
  )
}
