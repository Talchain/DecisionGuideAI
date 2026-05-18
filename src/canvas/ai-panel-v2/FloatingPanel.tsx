import { memo } from 'react'
import type { ReactNode } from 'react'
import { PanelRight } from 'lucide-react'
import { typography } from '../../styles/typography'
import { FLOATING_HEADER_HEIGHT, Z_FLOATING_PANEL } from './constants'
import { useFloatingPanel } from './hooks/useFloatingPanel'

// State 5 — AI assistant as a draggable, resizable floating window.
//
// Structure:
//   • Header bar (32px): "AI" label + Olumi swatch left, "Dock" button
//     (Lucide PanelRight) right. Cursor `grab`. Drag the header to move.
//   • Body: caller-supplied children (typically ChatThread).
//   • Footer composer: caller-supplied via `footer` (typically the
//     AIInputBar — same instance and conversation state as the docked
//     panel, so dock/undock preserves draft + scroll position).
//   • Bottom-right resize handle (12×12 corner grip).
//
// The body + footer come from the parent so the conversation
// state lives upstream and the SAME ChatThread instance can be reused
// (this is what preserves draft text and scroll position across
// dock/undock transitions per the brief).
//
// Bounding: useFloatingPanel clamps position + size to the viewport
// and to min/max dims on every drag/resize tick.

interface FloatingPanelProps {
  onDock: () => void
  children: ReactNode
  footer?: ReactNode
}

export const FloatingPanel = memo(function FloatingPanel({ onDock, children, footer }: FloatingPanelProps) {
  const { rect, isDragging, isResizing, startDrag, startResize } = useFloatingPanel()

  return (
    <aside
      data-testid="ai-panel-v2-floating"
      aria-label="AI conversation (floating)"
      role="dialog"
      aria-modal="false"
      className="fixed flex flex-col bg-panel border border-default rounded-2xl overflow-hidden shadow-2 pointer-events-auto"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        zIndex: Z_FLOATING_PANEL,
        transition: isDragging || isResizing ? 'none' : 'box-shadow var(--duration-base, 300ms) ease-out',
      }}
      data-dragging={isDragging ? 'true' : 'false'}
      data-resizing={isResizing ? 'true' : 'false'}
    >
      {/* Header — drag handle */}
      <div
        data-testid="ai-panel-v2-floating-header"
        onPointerDown={startDrag}
        className={`flex items-center justify-between flex-shrink-0 px-3 border-b border-default bg-panel ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ height: FLOATING_HEADER_HEIGHT }}
      >
        <div className="flex items-center gap-2 pointer-events-none select-none">
          <div
            aria-hidden="true"
            className="w-4 h-4 rounded-full bg-primary"
            style={{ flexShrink: 0 }}
          />
          <span className={`${typography.panelMeta} text-text-body font-medium`}>AI</span>
        </div>
        <button
          type="button"
          onClick={onDock}
          onPointerDown={e => e.stopPropagation()}
          aria-label="Dock to panel"
          title="Dock to panel"
          data-testid="ai-panel-v2-floating-dock"
          className="inline-flex items-center justify-center w-7 h-7 rounded-sm text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
        >
          <PanelRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Body — caller-supplied conversation tree (ChatThread) */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>

      {/* Footer composer */}
      {footer && <div className="flex-shrink-0">{footer}</div>}

      {/* Bottom-right resize handle */}
      <div
        onPointerDown={startResize}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize floating assistant"
        data-testid="ai-panel-v2-floating-resize"
        className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize"
        style={{
          // diagonal grip lines via two stacked borders — DS-token-driven
          background:
            'linear-gradient(135deg, transparent 0%, transparent 40%, var(--border-emphasis, var(--border-default)) 40%, var(--border-emphasis, var(--border-default)) 50%, transparent 50%, transparent 70%, var(--border-emphasis, var(--border-default)) 70%, var(--border-emphasis, var(--border-default)) 80%, transparent 80%)',
        }}
      />
    </aside>
  )
})
