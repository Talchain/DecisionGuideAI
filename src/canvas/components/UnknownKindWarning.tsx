/**
 * Unknown Kind Warning Chip
 * S1-UNK: Displays subtle warning when node type was unmapped
 *
 * Shows when node.data.unknownKind is true (set by backend kind coercion)
 * Non-blocking, informational only, with tooltip for details
 */

import { AlertTriangle } from 'lucide-react'
import { getUnknownKindWarning } from '../adapters/backendKinds'
import { typography } from '../../styles/typography'

interface UnknownKindWarningProps {
  originalKind: string
  className?: string
}

export function UnknownKindWarning({ originalKind, className = '' }: UnknownKindWarningProps) {
  const warning = getUnknownKindWarning(originalKind)

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${typography.caption} bg-amber-50 text-amber-700 border border-amber-200 ${className}`}
      role="status"
      aria-label={warning}
      title={warning}
    >
      <AlertTriangle className="w-3 h-3" aria-hidden="true" />
      <span className="font-medium">Unknown type</span>
    </div>
  )
}
