import { memo, useCallback, useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { typography } from '../../styles/typography'
import {
  ARROW_KEY_RESIZE_PX,
  FOCUS_MIN_VIEWPORT,
  PULL_TAB_HEIGHT,
  PULL_TAB_LABEL_HEIGHT,
  PULL_TAB_LABEL_WIDTH,
  type AIPanelMode,
} from './constants'

// Brief §4 — Pull-tab.
//
//   ┌─────────────────────┐
//   │ ●Compact  Conv  Foc ├─ ─ ─ drag bar across the AI zone's top edge
//   └─────────────────────┘
//
// • 64px total effective hit area (drag zone + label strip)
// • Visible label strip: ~160×36, centred horizontally inside the tab
// • Transparent vertical-drag zone above the labels covers the resize boundary
// • Click a label → switch to that mode's preset ratio
// • Vertical drag on the tab body / handle → resize the split
// • Focus label is disabled <1440px viewport (brief §4.5)
// • Arrow keys (with focus on the drag handle): ±20px steps
//
// Step 5 wires Compact + Conversation. Focus mode (horizontal drag,
// AIFocusColumn) lands in step 12.

interface PullTabProps {
  activeMode: AIPanelMode
  onModeClick: (mode: AIPanelMode) => void
  onStartDrag: (event: React.PointerEvent) => void
  onAdjustByPx: (deltaPx: number) => void
}

const MODE_LABELS: { mode: AIPanelMode; label: string; tooltip: string }[] = [
  { mode: 'compact', label: 'Compact', tooltip: 'Switch to Compact' },
  { mode: 'conversation', label: 'Conv', tooltip: 'Switch to Conversation' },
  { mode: 'focus', label: 'Focus', tooltip: 'Switch to Focus' },
]

function useFocusEnabled(): boolean {
  // Subscribe to viewport width so the Focus label disables itself when the
  // window is too narrow. SSR-safe default: assume disabled until first
  // measurement; the layout never renders without a window, so this is just
  // a guard.
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
}: PullTabProps) {
  const focusEnabled = useFocusEnabled()

  const handleLabelClick = useCallback((mode: AIPanelMode) => {
    if (mode === 'focus' && !focusEnabled) return
    onModeClick(mode)
  }, [focusEnabled, onModeClick])

  const handleHandleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      // Up = AI zone grows upward (claim more height).
      onAdjustByPx(-ARROW_KEY_RESIZE_PX)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      onAdjustByPx(ARROW_KEY_RESIZE_PX)
    }
  }, [onAdjustByPx])

  return (
    <div
      data-testid="ai-panel-v2-pull-tab"
      className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
      style={{
        // Sits above the AI zone's top edge — the parent container sets
        // position: relative on the AI zone wrapper so this can anchor.
        top: -PULL_TAB_HEIGHT / 2,
        height: PULL_TAB_HEIGHT,
        width: PULL_TAB_LABEL_WIDTH,
      }}
    >
      {/* Transparent vertical-drag region above the labels. Covers the
          resize boundary so users can grab the edge directly. */}
      <div
        data-testid="ai-panel-v2-pull-tab-drag"
        role="separator"
        aria-label="Resize AI panel"
        aria-orientation="horizontal"
        tabIndex={0}
        onPointerDown={onStartDrag}
        onKeyDown={handleHandleKeyDown}
        className="pointer-events-auto cursor-ns-resize focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
        style={{
          width: PULL_TAB_LABEL_WIDTH,
          height: PULL_TAB_HEIGHT - PULL_TAB_LABEL_HEIGHT,
        }}
      />
      {/* Visible label strip — three mode buttons. */}
      <div
        role="tablist"
        aria-label="AI panel mode"
        className="pointer-events-auto flex items-center justify-center gap-1 bg-panel border border-panel-border rounded-t-lg shadow-1 px-1"
        style={{
          width: PULL_TAB_LABEL_WIDTH,
          height: PULL_TAB_LABEL_HEIGHT,
        }}
      >
        {MODE_LABELS.map(({ mode, label, tooltip }) => {
          const isActive = activeMode === mode
          const disabled = mode === 'focus' && !focusEnabled
          const title = disabled
            ? 'Focus mode needs a wider screen'
            : tooltip
          return (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-disabled={disabled}
              tabIndex={isActive ? 0 : -1}
              disabled={disabled}
              onClick={() => handleLabelClick(mode)}
              title={title}
              data-testid={`ai-panel-v2-mode-${mode}`}
              data-active={isActive ? 'true' : 'false'}
              className={[
                'inline-flex items-center justify-center px-2 py-1 rounded-sm',
                typography.panelMeta,
                'font-medium',
                isActive ? 'bg-panel text-info border border-info/30' : 'text-text-light hover:text-text-body border border-transparent',
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-info',
              ].join(' ')}
              style={{ minWidth: 36, minHeight: 28 }}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
})
