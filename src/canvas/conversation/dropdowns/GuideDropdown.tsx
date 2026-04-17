/**
 * GuideDropdown — scaffold, example, and help menu.
 *
 * Anchored to the Guide trigger. Prefers upward placement; flips down when
 * there is insufficient room above (delegated to FlipDropdown primitive).
 */

import { useCallback, useEffect, useState } from 'react'
import { Layout, HelpCircle, Sparkles } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { FlipDropdown } from '../../../components/ui/FlipDropdown'

// ─────────────────────────────────────────────────────────────────────────────
// Copy
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface GuideDropdownProps {
  isOpen: boolean
  onClose: () => void
  onInsertText: (text: string) => void
  anchorRef: React.RefObject<HTMLElement | null>
}

interface MenuItem {
  id: string
  icon: React.ElementType
  label: string
  action: () => void
}

export function GuideDropdown({ isOpen, onClose, onInsertText, anchorRef }: GuideDropdownProps) {
  const [focusIndex, setFocusIndex] = useState(0)
  const [showHelp, setShowHelp] = useState(false)

  const items: MenuItem[] = [
    { id: 'scaffold', icon: Layout,     label: 'Use a decision scaffold', action: () => { onInsertText(SCAFFOLD_TEXT); onClose() } },
    { id: 'help',     icon: HelpCircle, label: 'What makes a good brief?', action: () => setShowHelp(prev => !prev) },
    { id: 'example',  icon: Sparkles,   label: 'Show me an example',       action: () => { onInsertText(EXAMPLE_TEXT); onClose() } },
  ]

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setFocusIndex(0)
      setShowHelp(false)
    }
  }, [isOpen])

  // Arrow key navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusIndex(i => (i + 1) % items.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusIndex(i => (i - 1 + items.length) % items.length)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        items[focusIndex].action()
      }
    },
    [focusIndex, items],
  )

  return (
    <FlipDropdown
      isOpen={isOpen}
      onClose={onClose}
      anchorRef={anchorRef}
      align="right"
      ariaLabel="Guide menu"
      className="bg-panel rounded-lg border border-panel-border py-1 min-w-[240px]"
      style={{
        boxShadow: 'var(--shadow-2, 0 4px 12px rgba(0,0,0,0.08))',
        animation: 'guideDropIn 120ms cubic-bezier(0,0,0.2,1) both',
      }}
      testId="guide-dropdown"
    >
      <div onKeyDown={handleKeyDown}>
        {items.map((item, idx) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              tabIndex={idx === focusIndex ? 0 : -1}
              ref={el => { if (idx === focusIndex) el?.focus() }}
              onClick={item.action}
              className={`
                w-full flex items-center gap-3 px-3 py-2 text-left
                ${typography.bodySmall} text-text-body
                hover:bg-panel-hover focus-visible:bg-panel-hover
                focus-visible:outline-none transition-colors duration-100
                min-h-[44px]
              `}
              data-testid={`guide-item-${item.id}`}
            >
              <Icon className="w-4 h-4 text-text-light flex-shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          )
        })}

        {showHelp && (
          <div
            className={`mx-3 mb-2 mt-1 p-3 rounded-md border border-info/20 bg-panel ${typography.panelMeta} text-text-body relative`}
            data-testid="guide-help-card"
          >
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full text-text-light hover:bg-panel-hover transition-colors"
              aria-label="Dismiss"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            <span className="pr-5">{HELP_TEXT}</span>
          </div>
        )}

        <style>{`
          @keyframes guideDropIn {
            from { opacity: 0; transform: translateY(4px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          @media (prefers-reduced-motion: reduce) {
            @keyframes guideDropIn { from { opacity: 1; } to { opacity: 1; } }
          }
        `}</style>
      </div>
    </FlipDropdown>
  )
}
