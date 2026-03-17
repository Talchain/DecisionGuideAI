import { useEffect, useRef } from 'react'
import { Zap, Brain, Layers } from 'lucide-react'
import { typography } from '../../styles/typography'

interface ThinkingModePopoverProps {
  isOpen: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement>
}

interface ModeChip {
  icon: React.ElementType
  label: string
  description: string
}

const MODES: ModeChip[] = [
  {
    icon: Zap,
    label: 'Fast',
    description: 'Quick responses for simple decisions',
  },
  {
    icon: Layers,
    label: 'Normal',
    description: 'Balanced speed and depth',
  },
  {
    icon: Brain,
    label: 'Deep thinking',
    description: 'Thorough analysis for complex scenarios',
  },
]

/**
 * Thinking Mode Popover — coming-soon placeholder
 *
 * Replaces the functional ModelSettingsPopover while the Fast / Normal / Deep
 * feature is in development. All chips are non-interactive.
 *
 * Positioned via CSS absolute positioning relative to the nearest `position: relative`
 * ancestor (the DraftChat card wrapper). This avoids the broken `position: fixed` +
 * JS coordinate calculation approach — the DraftChat outer wrapper uses
 * `transform: translateX(-50%)` which creates a new containing block, making `fixed`
 * positioning resolve against the wrapper instead of the viewport.
 */
export function ThinkingModePopover({ isOpen, onClose, anchorRef }: ThinkingModePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        anchorRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return
      }
      onClose()
    }

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, anchorRef])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={popoverRef}
      role="region"
      aria-labelledby="thinking-mode-title"
      className="absolute z-50 w-72 bottom-full right-0 mb-2 bg-panel rounded-[20px] shadow-2 border border-panel-border flex flex-col overflow-hidden"
      style={{
        animation: 'thinkingModeIn 160ms cubic-bezier(0.16, 1, 0.3, 1) both',
      }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-panel-border">
        <h3
          id="thinking-mode-title"
          className={`${typography.label} text-text-body`}
        >
          Thinking mode
        </h3>
        <span
          className={`${typography.panelMeta} text-text-light border border-panel-border rounded-full px-2 py-0.5`}
        >
          Coming soon
        </span>
      </div>

      {/* Mode chips */}
      <div className="px-4 py-3 space-y-2">
        {MODES.map(({ icon: Icon, label, description }) => (
          <div
            key={label}
            aria-disabled="true"
            className="flex items-start gap-3 rounded-xl border border-panel-border px-3 py-2.5 opacity-50 pointer-events-none select-none"
          >
            <div className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-canvas flex items-center justify-center">
              <Icon className="w-3.5 h-3.5 text-text-light" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className={`${typography.panelBody} text-text-body font-medium`}>
                {label}
              </p>
              <p className={`${typography.panelMeta} text-text-light mt-0.5`}>
                {description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 pb-4">
        <p className={`${typography.panelMeta} text-text-light`}>
          Select the depth of reasoning for your analysis. Available in an upcoming release.
        </p>
      </div>

      {/* Keyframe animation — injected once per render, scoped via unique name */}
      <style>{`
        @keyframes thinkingModeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
