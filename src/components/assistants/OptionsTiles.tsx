/**
 * N4: Options Tiles - Assistants Integration
 *
 * Calls /bff/assist/suggest-options to generate decision option cards
 * with pros, cons, and supporting evidence.
 *
 * Append-only: New tiles accumulate without replacing existing ones.
 */

import { useState } from 'react'
import { Lightbulb, ThumbsUp, ThumbsDown, FileText, Loader2 } from 'lucide-react'

export interface OptionCard {
  id: string
  title: string
  pros: string[]
  cons: string[]
  evidence?: string
}

interface OptionsTilesProps {
  context: {
    nodes: any[]
    edges: any[]
    outcomeNodeId?: string
  }
  onOptionSelect?: (option: OptionCard) => void
}

export function OptionsTiles({ context, onOptionSelect }: OptionsTilesProps) {
  const [options, setOptions] = useState<OptionCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const handleGenerateOptions = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/bff/assist/suggest-options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ context })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Append new options (don't replace existing)
      const newOptions = data.options || []
      setOptions((prev) => [...prev, ...newOptions])
    } catch (err: any) {
      console.error('[OptionsTiles] Failed to generate options:', err)
      setError(err.message || 'Failed to generate options')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header + Generate Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-warning-600" />
          <h3 className="text-sm font-semibold text-gray-900">Decision Options</h3>
        </div>
        <button
          onClick={handleGenerateOptions}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-medium text-white bg-info-500 hover:bg-info-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-info-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          aria-label="Generate decision options"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Lightbulb className="w-3.5 h-3.5" />
              Generate Options
            </>
          )}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="px-3 py-2 bg-danger-50 border border-danger-200 rounded-lg text-xs text-danger-900">
          {error}
        </div>
      )}

      {/* Options Grid */}
      {options.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {options.map((option) => (
            <OptionCardTile
              key={option.id}
              option={option}
              onSelect={onOptionSelect}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {options.length === 0 && !loading && !error && (
        <div className="px-4 py-6 text-center text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg">
          Generate options to explore different decision paths.
        </div>
      )}
    </div>
  )
}

interface OptionCardProps {
  option: OptionCard
  onSelect?: (option: OptionCard) => void
}

function OptionCardTile({ option, onSelect }: OptionCardProps) {
  return (
    <div
      className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onSelect?.(option)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect?.(option)
        }
      }}
      aria-label={`Select option: ${option.title}`}
    >
      {/* Title */}
      <h4 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2">
        {option.title}
      </h4>

      {/* Pros */}
      {option.pros.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-1.5 mb-1">
            <ThumbsUp className="w-3.5 h-3.5 text-success-600" />
            <span className="text-xs font-medium text-success-700">Pros</span>
          </div>
          <ul className="text-xs text-gray-700 space-y-0.5 pl-5 list-disc">
            {option.pros.slice(0, 3).map((pro, idx) => (
              <li key={idx} className="line-clamp-1">{pro}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Cons */}
      {option.cons.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-1.5 mb-1">
            <ThumbsDown className="w-3.5 h-3.5 text-danger-600" />
            <span className="text-xs font-medium text-danger-700">Cons</span>
          </div>
          <ul className="text-xs text-gray-700 space-y-0.5 pl-5 list-disc">
            {option.cons.slice(0, 3).map((con, idx) => (
              <li key={idx} className="line-clamp-1">{con}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Evidence */}
      {option.evidence && (
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1.5 mb-1">
            <FileText className="w-3.5 h-3.5 text-info-600" />
            <span className="text-xs font-medium text-info-700">Evidence</span>
          </div>
          <p className="text-xs text-gray-600 line-clamp-2">{option.evidence}</p>
        </div>
      )}
    </div>
  )
}
