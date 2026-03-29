/**
 * BriefIcon — small FileText icon indicating a user-provided value from the brief.
 * Tooltip: "From your brief".
 */
import { FileText } from 'lucide-react'

export function BriefIcon() {
  return (
    <span className="inline-flex" title="From your brief">
      <FileText size={10} className="text-text-light" aria-hidden="true" />
    </span>
  )
}
