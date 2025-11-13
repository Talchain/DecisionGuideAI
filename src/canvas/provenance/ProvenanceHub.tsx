/**
 * N3: Provenance Hub
 * Search, filter, and navigate to citations
 */

import { useState } from 'react'
import { Search, Filter, FileText, BarChart3, Lightbulb, Cpu } from 'lucide-react'
import type { Citation } from '../share/types'

interface ProvenanceHubProps {
  citations: Citation[]
  onGoToNode: (nodeId: string) => void
  onGoToEdge: (edgeId: string) => void
  redactionEnabled: boolean
  onToggleRedaction: () => void
}

type SourceType = 'all' | 'document' | 'metric' | 'hypothesis' | 'engine'

const SOURCE_ICONS: Record<Exclude<SourceType, 'all'>, JSX.Element> = {
  document: <FileText className="w-3.5 h-3.5" />,
  metric: <BarChart3 className="w-3.5 h-3.5" />,
  hypothesis: <Lightbulb className="w-3.5 h-3.5" />,
  engine: <Cpu className="w-3.5 h-3.5" />
}

export function ProvenanceHub({
  citations,
  onGoToNode,
  onGoToEdge,
  redactionEnabled,
  onToggleRedaction
}: ProvenanceHubProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<SourceType>('all')

  // Filter citations
  const filteredCitations = citations.filter((c) => {
    const matchesSearch = !searchQuery || c.text?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filterType === 'all' || getSourceType(c) === filterType
    return matchesSearch && matchesFilter
  })

  const handleGoTo = (citation: Citation) => {
    if (citation.nodeId) {
      onGoToNode(citation.nodeId)
    } else if (citation.edgeId) {
      onGoToEdge(citation.edgeId)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-gray-200 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Provenance Hub</h2>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search citations..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-info-500"
            aria-label="Search citations"
          />
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-600" />
          <div className="flex gap-1 flex-wrap">
            {(['all', 'document', 'metric', 'hypothesis', 'engine'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  filterType === type
                    ? 'bg-info-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                type="button"
                aria-label={`Filter by ${type}`}
              >
                {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Redaction toggle (dev only) */}
        {import.meta.env.DEV && (
          <button
            onClick={onToggleRedaction}
            className="w-full px-3 py-2 text-xs font-medium bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors"
            type="button"
            aria-label="Toggle redaction"
          >
            {redactionEnabled ? 'Reveal Full Quotes (Dev Only)' : 'Enable Redaction'}
          </button>
        )}
      </div>

      {/* Citations list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredCitations.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            No citations found
          </div>
        ) : (
          filteredCitations.map((citation, idx) => (
            <CitationCard
              key={idx}
              citation={citation}
              redacted={redactionEnabled}
              onGoTo={() => handleGoTo(citation)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function CitationCard({
  citation,
  redacted,
  onGoTo
}: {
  citation: Citation
  redacted: boolean
  onGoTo: () => void
}) {
  const sourceType = getSourceType(citation)
  const text = citation.text || 'No text available'
  const displayText = redacted && text.length > 100 ? text.slice(0, 100) + '...' : text

  return (
    <div className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          {SOURCE_ICONS[sourceType]}
          <span className="text-xs font-medium text-gray-700 capitalize">{sourceType}</span>
        </div>
        <button
          onClick={onGoTo}
          className="text-xs font-medium text-info-600 hover:text-info-700 transition-colors"
          type="button"
          aria-label="Go to source on canvas"
        >
          Go to node →
        </button>
      </div>
      <p className="text-sm text-gray-900">"{displayText}"</p>
      {citation.source && (
        <div className="mt-2 text-xs text-gray-600">
          Source: {citation.source}
        </div>
      )}
    </div>
  )
}

function getSourceType(citation: Citation): Exclude<SourceType, 'all'> {
  // Heuristic: check citation properties to determine type
  if (citation.source?.includes('document')) return 'document'
  if (citation.source?.includes('metric')) return 'metric'
  if (citation.source?.includes('hypothesis')) return 'hypothesis'
  return 'engine'
}
