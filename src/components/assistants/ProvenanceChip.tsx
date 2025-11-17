/**
 * M2.5 + S7-FILEOPS: Provenance Chips
 * Shows document sources with redaction control
 * S7-FILEOPS: Auto-updates when documents are renamed
 */

import { useState, useEffect } from 'react'
import { FileText, Eye, EyeOff } from 'lucide-react'
import { onDocumentRenamed } from '../../canvas/store/documents'

interface ProvenanceChipProps {
  documents: Array<{
    id: string
    name: string
    snippet?: string
    char_offset?: number
  }>
  redacted?: boolean
  onToggleRedaction?: () => void
}

export function ProvenanceChip({ documents, redacted = true, onToggleRedaction }: ProvenanceChipProps) {
  const [expanded, setExpanded] = useState(false)
  // S7-FILEOPS: Track document names locally to enable immediate updates on rename
  const [docNames, setDocNames] = useState<Map<string, string>>(
    new Map(documents.map(d => [d.id, d.name]))
  )

  // S7-FILEOPS: Update local names when documents prop changes
  useEffect(() => {
    setDocNames(new Map(documents.map(d => [d.id, d.name])))
  }, [documents])

  // S7-FILEOPS: Listen for document rename events
  useEffect(() => {
    const unsubscribe = onDocumentRenamed((id, oldName, newName) => {
      setDocNames(prev => {
        // Only update if this document is in our list
        if (prev.has(id)) {
          const next = new Map(prev)
          next.set(id, newName)
          return next
        }
        return prev
      })
    })

    return unsubscribe
  }, [])

  if (documents.length === 0) {
    return null
  }

  // S7-FILEOPS: Merge current names with renamed names
  const displayDocuments = documents.map(doc => ({
    ...doc,
    name: docNames.get(doc.id) ?? doc.name,
  }))

  // M2.5: Truncate snippet to ≤100 chars when redacted
  const formatSnippet = (snippet: string | undefined, isRedacted: boolean): string => {
    if (!snippet) return '...'
    if (!isRedacted) return snippet

    return snippet.length > 100 ? snippet.slice(0, 100) + '...' : snippet
  }

  return (
    <div className="inline-flex flex-col gap-1">
      {/* Main chip */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1.5 px-2 py-1 bg-purple-50 text-purple-700 rounded-md text-xs font-medium hover:bg-purple-100 border border-purple-200"
        title={`Sources: ${displayDocuments.map((d) => d.name).join(', ')}`}
      >
        <FileText className="w-3 h-3" />
        <span>{displayDocuments.length} source{displayDocuments.length > 1 ? 's' : ''}</span>
      </button>

      {/* Expanded view */}
      {expanded && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-md z-10">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm text-gray-900">Document Sources</h4>
            {onToggleRedaction && (
              <button
                onClick={onToggleRedaction}
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
                title={redacted ? 'Show full snippets' : 'Redact snippets'}
              >
                {redacted ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {redacted ? 'Show full' : 'Redact'}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {displayDocuments.map((doc) => (
              <div key={doc.id} className="border-l-2 border-purple-300 pl-2">
                <div className="font-medium text-xs text-gray-900">{doc.name}</div>
                {doc.snippet && (
                  <div className="text-xs text-gray-600 mt-0.5 italic">
                    "{formatSnippet(doc.snippet, redacted)}"
                  </div>
                )}
                {doc.char_offset !== undefined && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    Offset: {doc.char_offset}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * M2.5: Provenance settings (global toggle)
 */
export function useProvenanceSettings() {
  const [redacted, setRedacted] = useState(true) // Default: ON (redacted)

  return {
    redacted,
    toggleRedaction: () => setRedacted(!redacted),
  }
}
