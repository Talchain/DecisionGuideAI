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

  return (
    <aside
      className={`flex h-full flex-col bg-white shadow-lg rounded-l-2xl border-l border-gray-200 ${widthClass}`}
      role="complementary"
      aria-label={title}
    >
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white rounded-tl-2xl">
        <div className="flex items-center gap-2">
          {icon && <span className="text-gray-600">{icon}</span>}
          <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
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
        <div className="shrink-0 px-4 pt-2 border-b border-gray-100">
          {tabs}
        </div>
      )}

      {/* Scrollable body - min-h-0 is critical for flex scrolling */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {children}
      </div>

      {/* Sticky footer */}
      {footer && (
        <div className="shrink-0 sticky bottom-0 px-4 py-3 border-t border-gray-200 bg-white/95 backdrop-blur-sm flex items-center gap-2 rounded-bl-2xl">
          {footer}
        </div>
      )}
    </aside>
  )
}
