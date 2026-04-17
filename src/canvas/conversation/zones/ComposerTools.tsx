/**
 * ComposerTools — composer-right toolbox.
 *
 * Single ⚙️ trigger opens a FlipDropdown containing:
 *   · Guide section (scaffold / brief help / example) — primary action
 *   · Thinking mode section (Fast · Normal · Deep) — radio-style selection
 *   · Slot for future capabilities
 *
 * Replaces the ChatTopBar's Guide chip + Thinking mode chip. Uses the
 * FlipDropdown primitive from src/components/ui so positioning flips up
 * from the composer and handles click-outside + Escape dismissal.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Settings, Layout, HelpCircle, Sparkles, Check } from 'lucide-react'
import { NodeShape } from '../primitives/NodeShape'
import type { NodeType } from '../../domain/nodes'
import { typography } from '../../../styles/typography'
import { FlipDropdown } from '../../../components/ui/FlipDropdown'

// ─────────────────────────────────────────────────────────────────────────────
// Shared types and copy (formerly in GuideDropdown / ThinkingModeDropdown)
// ─────────────────────────────────────────────────────────────────────────────

export type ThinkingMode = 'fast' | 'normal' | 'deep'

const SCAFFOLD_TEXT = [
  "The decision I'm facing is: ",
  'My goal is: ',
  "The options I'm considering are: ",
  'The factors that could influence this are: ',
  'The potential risks are: ',
  "The outcome I'm looking for is: ",
].join('\n')

const EXAMPLE_TEXT =
  'Given our goal of reaching £20k MRR within 12 months while keeping monthly churn under 4%, should we increase the Pro plan price from £49 to £59 per month with the next Pro feature release?'

const HELP_TEXT =
  'A good brief states the decision, lists alternatives, defines a measurable outcome, and notes constraints or risks.'

interface ThinkingModeCard {
  id: ThinkingMode
  shapeKind: NodeType
  label: string
  description: string
  enabled: boolean
}

const THINKING_MODES: ThinkingModeCard[] = [
  { id: 'fast',   shapeKind: 'factor',   label: 'Fast',          description: 'Quick responses for simple decisions',    enabled: false },
  { id: 'normal', shapeKind: 'decision', label: 'Normal',        description: 'Balanced speed and depth',                enabled: true },
  { id: 'deep',   shapeKind: 'goal',     label: 'Deep thinking', description: 'Thorough analysis for complex scenarios', enabled: false },
]

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface ComposerToolsProps {
  onInsertText: (text: string) => void
  selectedMode?: ThinkingMode
  onSelectMode?: (mode: ThinkingMode) => void
  /** Trigger button size in px. Matches send-button dimensions for visual parity. */
  triggerSize?: number
}

export function ComposerTools({
  onInsertText,
  selectedMode = 'normal',
  onSelectMode,
  triggerSize = 34,
}: ComposerToolsProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  // Reset help state on open so each session starts collapsed.
  useEffect(() => {
    if (isOpen) setShowHelp(false)
  }, [isOpen])

  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(prev => !prev), [])

  const handleScaffold = useCallback(() => {
    onInsertText(SCAFFOLD_TEXT)
    close()
  }, [onInsertText, close])

  const handleExample = useCallback(() => {
    onInsertText(EXAMPLE_TEXT)
    close()
  }, [onInsertText, close])

  const handleSelectMode = useCallback(
    (mode: ThinkingMode) => {
      if (onSelectMode) onSelectMode(mode)
    },
    [onSelectMode],
  )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Composer tools"
        title="Composer tools"
        className="composer-tools-trigger flex-shrink-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2"
        style={{
          width: triggerSize,
          height: triggerSize,
          borderRadius: '50%',
          marginBottom: 2,
          background: 'transparent',
          border: '1px solid var(--border-default, #EEE6D8)',
          color: 'var(--text-light, #908D8D)',
          cursor: 'pointer',
          transition: 'all 150ms',
        }}
        data-testid="composer-tools-trigger"
      >
        <Settings className="w-4 h-4" strokeWidth={1.8} aria-hidden="true" />
      </button>

      <FlipDropdown
        isOpen={isOpen}
        onClose={close}
        anchorRef={triggerRef}
        align="right"
        ariaLabel="Composer tools"
        className="bg-panel"
        style={{
          borderRadius: 12,
          border: '1px solid var(--border-default, #EEE6D8)',
          boxShadow: '0 8px 24px rgba(38,38,38,0.14)',
          minWidth: 280,
          padding: 6,
          animation: 'composerToolsIn 150ms cubic-bezier(0.0, 0, 0.2, 1) both',
        }}
        testId="composer-tools-dropdown"
      >
        {/* Guide section */}
        <div
          className={`px-3 pt-2 pb-1 ${typography.panelMeta} text-text-light`}
          style={{ letterSpacing: 0.2 }}
        >
          Guide
        </div>

        <button
          type="button"
          role="menuitem"
          onClick={handleScaffold}
          className={`
            w-full flex items-center gap-3 px-3 py-2 text-left rounded-md
            ${typography.bodySmall} text-text-body
            hover:bg-panel-hover focus-visible:bg-panel-hover
            focus-visible:outline-none transition-colors duration-100
            min-h-[44px]
          `}
          data-testid="composer-tools-guide-scaffold"
        >
          <Layout className="w-4 h-4 text-text-light flex-shrink-0" aria-hidden="true" />
          <span>Use a decision scaffold</span>
        </button>

        <button
          type="button"
          role="menuitem"
          onClick={() => setShowHelp(prev => !prev)}
          className={`
            w-full flex items-center gap-3 px-3 py-2 text-left rounded-md
            ${typography.bodySmall} text-text-body
            hover:bg-panel-hover focus-visible:bg-panel-hover
            focus-visible:outline-none transition-colors duration-100
            min-h-[44px]
          `}
          data-testid="composer-tools-guide-help"
        >
          <HelpCircle className="w-4 h-4 text-text-light flex-shrink-0" aria-hidden="true" />
          <span>What makes a good brief?</span>
        </button>

        {showHelp && (
          <div
            className={`mx-3 my-1 p-3 rounded-md border border-info/20 bg-panel ${typography.panelMeta} text-text-body`}
            data-testid="composer-tools-guide-help-card"
          >
            {HELP_TEXT}
          </div>
        )}

        <button
          type="button"
          role="menuitem"
          onClick={handleExample}
          className={`
            w-full flex items-center gap-3 px-3 py-2 text-left rounded-md
            ${typography.bodySmall} text-text-body
            hover:bg-panel-hover focus-visible:bg-panel-hover
            focus-visible:outline-none transition-colors duration-100
            min-h-[44px]
          `}
          data-testid="composer-tools-guide-example"
        >
          <Sparkles className="w-4 h-4 text-text-light flex-shrink-0" aria-hidden="true" />
          <span>Show me an example</span>
        </button>

        {/* Divider */}
        <div className="my-1" style={{ height: 1, background: 'var(--border-default, #EEE6D8)' }} aria-hidden="true" />

        {/* Thinking mode section */}
        <div
          className={`flex items-center justify-between px-3 pt-2 pb-1`}
        >
          <span className={`${typography.panelMeta} text-text-light`} style={{ letterSpacing: 0.2 }}>
            Thinking mode
          </span>
        </div>

        {THINKING_MODES.map(mode => {
          const isSelected = mode.id === selectedMode
          const labelId = `composer-tools-mode-${mode.id}-label`
          return (
            <button
              key={mode.id}
              type="button"
              role="menuitemradio"
              aria-checked={isSelected}
              aria-labelledby={labelId}
              disabled={!mode.enabled}
              onClick={() => { if (mode.enabled) handleSelectMode(mode.id) }}
              className={`
                w-full flex items-center gap-3 px-3 py-2 text-left rounded-md
                ${typography.bodySmall} text-text-body
                hover:bg-panel-hover focus-visible:bg-panel-hover
                focus-visible:outline-none transition-colors duration-100
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent
                min-h-[44px]
              `}
              data-testid={`composer-tools-mode-${mode.id}`}
            >
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 24, height: 24, borderRadius: 999, border: '1px solid var(--border-default, #EEE6D8)' }}
              >
                <NodeShape kind={mode.shapeKind} size={12} />
              </div>
              <div className="flex-1 min-w-0">
                <div id={labelId} className="flex items-center gap-2">
                  <span className="font-medium" style={{ color: 'var(--text-header, #262626)' }}>{mode.label}</span>
                  {!mode.enabled && (
                    <span
                      className={`${typography.panelMeta} text-text-light`}
                      style={{
                        padding: '1px 8px',
                        border: '1px solid var(--border-default, #EEE6D8)',
                        borderRadius: 999,
                        lineHeight: 1.4,
                      }}
                    >
                      Coming soon
                    </span>
                  )}
                </div>
                <div className={`${typography.panelMeta} text-text-light`} style={{ lineHeight: 1.4, marginTop: 2 }}>
                  {mode.description}
                </div>
              </div>
              {isSelected && mode.enabled && (
                <Check className="w-4 h-4 text-info flex-shrink-0" aria-hidden="true" />
              )}
            </button>
          )
        })}

        {/* Future capabilities slot — intentionally empty placeholder section. */}

        <style>{`
          @keyframes composerToolsIn {
            from { opacity: 0; transform: translateY(4px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          @media (prefers-reduced-motion: reduce) {
            @keyframes composerToolsIn {
              from { opacity: 1; }
              to   { opacity: 1; }
            }
          }
          .composer-tools-trigger:hover {
            background: var(--bg-panel-hover, #FEF9F3);
            color: var(--text-body, #3F3F3E);
          }
        `}</style>
      </FlipDropdown>
    </>
  )
}
