/**
 * ModelNotes — model critiques section in the pre-analysis panel.
 *
 * Shows pipeline-generated observations about the model, framed as notes
 * not errors. Hides entirely if zero critiques.
 *
 * Phase 2B: Pre-analysis enrichment (Task 4c).
 */

import { memo, useState } from 'react'
import { AlertTriangle, Info, ChevronDown, ChevronRight, FileText } from 'lucide-react'
import { typography } from '../../../styles/typography'

// ---------------------------------------------------------------------------
// § 1 — Types
// ---------------------------------------------------------------------------

export interface ModelNote {
  message: string
  severity: 'warning' | 'info'
  suggestedAction?: string
}

export interface ModelNotesProps {
  notes: ModelNote[]
}

// ---------------------------------------------------------------------------
// § 2 — Component
// ---------------------------------------------------------------------------

const MAX_VISIBLE = 3

export const ModelNotes = memo(function ModelNotes({ notes }: ModelNotesProps) {
  const [expanded, setExpanded] = useState(false)

  // Hide entirely if zero critiques
  if (notes.length === 0) return null

  const visible = expanded ? notes : notes.slice(0, MAX_VISIBLE)
  const remaining = notes.length - MAX_VISIBLE

  return (
    <section className="space-y-2" aria-label="Model notes">
      <div className="flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5 text-text-light" aria-hidden="true" />
        <h3 className={typography.panelHeader}>Model notes</h3>
      </div>

      <ul className="space-y-1.5" role="list">
        {visible.map((note, i) => (
          <NoteRow key={i} note={note} />
        ))}
      </ul>

      {remaining > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={`${typography.panelMeta} text-info hover:underline inline-flex items-center gap-1`}
        >
          and {remaining} more
          <ChevronDown className="w-3 h-3" aria-hidden="true" />
        </button>
      )}

      {expanded && remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className={`${typography.panelMeta} text-info hover:underline inline-flex items-center gap-1`}
        >
          Show fewer
          <ChevronRight className="w-3 h-3" aria-hidden="true" />
        </button>
      )}
    </section>
  )
})

// ---------------------------------------------------------------------------
// § 3 — Individual note row
// ---------------------------------------------------------------------------

function NoteRow({ note }: { note: ModelNote }) {
  const SeverityIcon = note.severity === 'warning' ? AlertTriangle : Info
  const iconClass = note.severity === 'warning' ? 'text-warning' : 'text-info'
  const severityLabel = note.severity === 'warning' ? 'Warning' : 'Information'

  return (
    <li className="flex gap-2 items-start">
      <SeverityIcon
        className={`w-3.5 h-3.5 ${iconClass} shrink-0 mt-0.5`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className={`${typography.panelBody} text-text-body`}>
          <span className="sr-only">{severityLabel}: </span>
          {note.message}
        </p>
        {note.suggestedAction && (
          <p className={`${typography.panelMeta} text-text-light mt-0.5`}>
            {note.suggestedAction}
          </p>
        )}
      </div>
    </li>
  )
}
