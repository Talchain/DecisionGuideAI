import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Maximize2, MessageSquare, PanelBottomClose } from 'lucide-react'
import {
  ARROW_KEY_RESIZE_PX,
  FOCUS_MIN_VIEWPORT,
  type AIPanelMode,
} from './constants'

// Brief Fix 4 — Mode control redesign.
//
// Left-anchored compact icon strip on the AI zone's top edge. Shows ONLY
// the two modes the user is NOT currently in (the active mode is implicit
// — it's the state the user is looking at).
//
// The strip doubles as the visible anchor point for the vertical resize
// drag handle. The full top edge of the AI zone remains draggable (the
// parent renders a wider invisible drag region around this control).
//
//   bg-panel + border border-default + rounded-md + shadow-1
//   36×36 hit area per icon
//   role="tablist" + role="tab" + tooltips
//   keyboard: arrow keys adjust the split, Enter activates an icon

interface PullTabProps {
  activeMode: AIPanelMode
  onModeClick: (mode: AIPanelMode) => void
  onStartDrag: (event: React.PointerEvent) => void
  onAdjustByPx: (deltaPx: number) => void
  /** Border tint colour class for the strip border (brief §6.1). */
  tintBorderClass?: string
  staleAnnouncement?: boolean
}

const ALL_MODES: AIPanelMode[] = ['compact', 'conversation', 'focus']

const MODE_META: Record<AIPanelMode, { label: string; tooltip: string; Icon: typeof MessageSquare }> = {
  compact: { label: 'Compact', tooltip: 'Compact mode', Icon: PanelBottomClose },
  conversation: { label: 'Conversation', tooltip: 'Conversation mode', Icon: MessageSquare },
  focus: { label: 'Focus', tooltip: 'Focus mode', Icon: Maximize2 },
}

function useFocusEnabled(): boolean {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth >= FOCUS_MIN_VIEWPORT
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setEnabled(window.innerWidth >= FOCUS_MIN_VIEWPORT)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return enabled
}

export const PullTab = memo(function PullTab({
  activeMode,
  onModeClick,
  onStartDrag,
  onAdjustByPx,
  tintBorderClass = 'border-default',
  staleAnnouncement = false,
}: PullTabProps) {
  const focusEnabled = useFocusEnabled()

  // Show only the two modes the user is NOT currently in. The active mode
  // is implicit; switching is a directed action ("go to ___") rather than
  // a pick-from-three set.
  const visibleModes = useMemo(
    () => ALL_MODES.filter(m => m !== activeMode),
    [activeMode],
  )

  const handleLabelClick = useCallback((mode: AIPanelMode) => {
    if (mode === 'focus' && !focusEnabled) return
    onModeClick(mode)
  }, [focusEnabled, onModeClick])

  const handleHandleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      onAdjustByPx(-ARROW_KEY_RESIZE_PX)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      onAdjustByPx(ARROW_KEY_RESIZE_PX)
    }
  }, [onAdjustByPx])

  return (
    <div
      data-testid="ai-panel-v2-pull-tab"
      className="absolute left-3 top-0 -translate-y-1/2 pointer-events-none flex items-center"
      // height = single label-strip height so the visible chrome stays
      // compact; the parent renders a wider invisible drag region around
      // this control covering the full top edge of the AI zone.
    >
      {/* Transparent drag region around the visible chrome — picks up
          drag intent before clicks reach the icon buttons. The control's
          own click handlers receive the click only when the user
          actually clicked on an icon (the buttons are pointer-events:
          auto, this wrapper is pointer-events: auto so it stays
          interactive). */}
      <div
        data-testid="ai-panel-v2-pull-tab-drag"
        role="separator"
        aria-label="Resize AI panel"
        aria-orientation="horizontal"
        tabIndex={0}
        onPointerDown={onStartDrag}
        onKeyDown={handleHandleKeyDown}
        className={[
          'pointer-events-auto cursor-ns-resize',
          'flex items-center gap-1 bg-panel rounded-md shadow-1 px-1 py-0.5',
          'border transition-colors',
          tintBorderClass,
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-info',
        ].join(' ')}
        data-stale={staleAnnouncement ? 'true' : 'false'}
      >
        <div
          role="tablist"
          aria-label="AI panel mode"
          className="flex items-center gap-0.5"
        >
          {visibleModes.map(mode => {
            const { label, tooltip, Icon } = MODE_META[mode]
            const disabled = mode === 'focus' && !focusEnabled
            const title = disabled ? 'Focus mode needs a wider screen' : tooltip
            return (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={false}
                aria-disabled={disabled}
                aria-label={tooltip}
                tabIndex={-1}
                disabled={disabled}
                onPointerDown={ev => ev.stopPropagation()}
                onClick={() => handleLabelClick(mode)}
                title={title}
                data-testid={`ai-panel-v2-mode-${mode}`}
                className={[
                  'inline-flex items-center justify-center rounded-sm',
                  'text-text-light hover:text-text-body',
                  disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-info',
                ].join(' ')}
                style={{ minWidth: 36, minHeight: 36 }}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span className="sr-only">{label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
})
