/**
 * PanelSection - Reusable content section for panels
 *
 * Provides consistent structure for content blocks:
 * - Title with optional help/tooltip
 * - Subtle border and internal padding
 * - Consistent spacing
 */

import React from 'react'

export interface PanelSectionProps {
  /** Section title */
  title: string
  /** Optional help icon or tooltip */
  help?: React.ReactNode
  /** Section content */
  children: React.ReactNode
  /** Optional additional CSS classes */
  className?: string
}

export function PanelSection({
  title,
  help,
  children,
  className = '',
}: PanelSectionProps) {
  return (
    <section className={`border border-gray-200 rounded-xl p-3 bg-white ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[12px] font-medium text-gray-600 uppercase tracking-wide">
          {title}
        </h4>
        {help}
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </section>
  )
}
