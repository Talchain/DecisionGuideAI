/**
 * M5: Provenance Hub Tab
 * Shows all citations and document connections
 */

import { useState } from 'react'
import { FileText, Eye, EyeOff, Link as LinkIcon, Search } from 'lucide-react'
import type { Citation, Document } from '../share/types'

interface ProvenanceHubTabProps {
  citations: Citation[]
  documents: Document[]
  redactionEnabled: boolean
  onToggleRedaction: () => void
  onFocusNode: (nodeId: string) => void
}

export function ProvenanceHubTab({
  citations,
  documents,
  redactionEnabled,
  onToggleRedaction,
  onFocusNode,
}: ProvenanceHubTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)

  // Group citations by document
  const citationsByDoc = citations.reduce((acc, citation) => {
    if (!acc[citation.documentId]) {
      acc[citation.documentId] = []
    }
    acc[citation.documentId].push(citation)
    return acc
  }, {} as Record<string, Citation[]>)

  // Filter citations by search query
  const filteredCitations = searchQuery
    ? citations.filter(
        (c) =>
          c.snippet.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.nodeId.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : citations

  // Filter by selected document
  const displayedCitations = selectedDocId
    ? filteredCitations.filter((c) => c.documentId === selectedDocId)
    : filteredCitations

  // Redact snippet if enabled
  const formatSnippet = (snippet: string): string => {
    if (!redactionEnabled) return snippet
    return snippet.length > 100 ? snippet.slice(0, 100) + '...' : snippet
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">Provenance Hub</h3>
          <button
            onClick={onToggleRedaction}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100"
            title={redactionEnabled ? 'Show full snippets' : 'Redact snippets'}
          >
            {redactionEnabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {redactionEnabled ? 'Show full' : 'Redact'}
          </button>
        </div>

        <p className="text-xs text-gray-600">
          {citations.length} citation{citations.length !== 1 ? 's' : ''} from {documents.length}{' '}
          document{documents.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search citations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Document filter chips */}
      {documents.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-200 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedDocId(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
              selectedDocId === null
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({citations.length})
          </button>
          {documents.map((doc) => {
            const count = citationsByDoc[doc.id]?.length || 0
            return (
              <button
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                  selectedDocId === doc.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {doc.name} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Citations list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {displayedCitations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <LinkIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No citations found</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-blue-600 hover:underline mt-1"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          displayedCitations.map((citation) => {
            const document = documents.find((d) => d.id === citation.documentId)
            return (
              <CitationCard
                key={citation.id}
                citation={citation}
                document={document}
                snippet={formatSnippet(citation.snippet)}
                onFocusNode={onFocusNode}
              />
            )
          })
        )}
      </div>
    </div>
  )
}

function CitationCard({
  citation,
  document,
  snippet,
  onFocusNode,
}: {
  citation: Citation
  document: Document | undefined
  snippet: string
  onFocusNode: (nodeId: string) => void
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
      {/* Node reference */}
      <button
        onClick={() => onFocusNode(citation.nodeId)}
        className="text-sm font-medium text-blue-600 hover:underline mb-2"
      >
        → {citation.nodeId}
        {citation.edgeId && ` (edge: ${citation.edgeId})`}
      </button>

      {/* Snippet */}
      <div className="text-sm text-gray-700 italic border-l-2 border-purple-300 pl-3 mb-2">
        "{snippet}"
      </div>

      {/* Document source */}
      {document && (
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <FileText className="w-3 h-3" />
          <span className="font-medium">{document.name}</span>
          {citation.charOffset !== undefined && (
            <>
              <span>•</span>
              <span>Offset: {citation.charOffset}</span>
            </>
          )}
          {citation.confidence !== undefined && (
            <>
              <span>•</span>
              <span>Confidence: {Math.round(citation.confidence * 100)}%</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
