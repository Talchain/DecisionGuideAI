/**
 * PanelShell - Unified container for all right-hand panels
 *
 * Provides consistent structure:
 * - Header with icon, title, chips, and close button
 * - Optional tabs row
 * - Scrollable body
 * - Sticky footer with CTAs
 *
 * Design system: Light theme matching Node/Edge Inspector
 */

import React from 'react'

export interface PanelShellProps {
  /** Icon element (Lucide icon component) */
  icon?: React.ReactNode
  /** Panel title */
  title: string
  /** Status chips (e.g., confidence, state) */
  chips?: React.ReactNode
  /** Tab navigation (e.g., Latest | History | Compare) */
  tabs?: React.ReactNode
  /** Panel body content */
  children: React.ReactNode
  /** Footer CTAs (buttons, actions) */
  footer?: React.ReactNode
  /** Close handler */
  onClose?: () => void
  /** Optional width override (default: 420px) */
  width?: string
}

export function PanelShell({
  icon,
  title,
  chips,
  tabs,
  children,
  footer,
  onClose,
  width = '420px',
}: PanelShellProps) {
  // Responsive width: full width on mobile (< 640px), fixed on desktop
  const widthClass = width === '480px'
    ? 'w-full sm:w-[480px]'
    : 'w-full sm:w-[420px]'

  /**
   * Safe Area Constraint (C11 P1 Polish)
   *
   * CRITICAL: This constant prevents the panel from overlapping the bottom toolbar.
   *
   * Why this exists:
   * - The CanvasToolbar is `fixed bottom-6` (24px from bottom) with ~56px height
   * - Without this constraint, panels would render over the toolbar
   * - CSS `height: 100vh` would use full viewport, ignoring toolbar position
   * - We calculate available height by subtracting toolbar safe area
   *
   * Calculation breakdown:
   * - Toolbar offset: 24px (`bottom-6` in CanvasToolbar)
   * - Toolbar height: ~56px (estimated with padding)
   * - Safety buffer: 16px (prevent visual overlap)
   * - Total: 96px
   *
   * Applied to:
   * - `height: calc(100vh - 96px)` - sets panel height
   * - `maxHeight: calc(100vh - 96px)` - prevents overflow
   *
   * When to update:
   * - If CanvasToolbar position changes (currently `bottom-6`)
   * - If toolbar height increases significantly
   * - Run PanelShell.safearea.spec.tsx to verify no regression
   *
   * DO NOT REMOVE: Without this, panels will render over toolbar on small screens
   */
  const TOOLBAR_SAFE_AREA = 96

  return (
    <aside
      className={`flex flex-col bg-paper-50 shadow-panel rounded-l-2xl border-l border-sand-200 transition-shadow duration-200 ${widthClass}`}
      style={{
        height: `calc(100vh - ${TOOLBAR_SAFE_AREA}px)`,
        maxHeight: `calc(100vh - ${TOOLBAR_SAFE_AREA}px)`,
      }}
      role="complementary"
      aria-label={title}
      data-testid="panel-shell"
    >
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-sand-200 bg-paper-50 rounded-tl-2xl">
        <div className="flex items-center gap-2">
          {icon && <span className="text-ink-900/70">{icon}</span>}
          <h3 className="text-[15px] font-semibold text-ink-900">{title}</h3>
          {chips}
        </div>
        {onClose && (
          <button
            aria-label="Close panel"
            onClick={onClose}
            className="flex items-center justify-center size-8 rounded-xl hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
            type="button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </header>

      {/* Optional tabs row */}
      {tabs && (
        <div className="shrink-0 px-4 pt-2 border-b border-sand-200">
          {tabs}
        </div>
      )}

      {/* Scrollable body - min-h-0 is critical for flex scrolling */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {children}
      </div>

      {/* Sticky footer - stays visible while body scrolls */}
      {footer && (
        <div className="shrink-0 sticky bottom-0 px-4 py-3 border-t border-sand-200 bg-paper-50/95 backdrop-blur-sm flex items-center gap-2 rounded-bl-2xl z-10">
          {footer}
        </div>
      )}
    </aside>
  )
}
