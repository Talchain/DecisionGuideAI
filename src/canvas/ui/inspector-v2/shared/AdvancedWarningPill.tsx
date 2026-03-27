/**
 * AdvancedWarningPill — compact CIL warning indicator for technical detail editor.
 * AlertTriangle icon + text in panelMeta, amber border.
 */

import { AlertTriangle } from 'lucide-react'
import { typography } from '../../../../styles/typography'

interface AdvancedWarningPillProps {
  text: string
}

export function AdvancedWarningPill({ text }: AdvancedWarningPillProps) {
  return (
    <span
      className={`${typography.panelMeta} inline-flex items-center gap-1 px-2 py-0.5 rounded-full
        bg-transparent border border-warning/30 text-text-body`}
    >
      <AlertTriangle size={11} className="text-warning flex-shrink-0" aria-hidden="true" />
      {text}
    </span>
  )
}
