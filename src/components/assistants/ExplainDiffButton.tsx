/**
 * N4: Explain Diff Button
 * Calls BFF /assist/explain-diff with patch context
 * Renders ≤280-char rationales inline
 */

import { useState } from 'react'
import { Lightbulb, Loader2 } from 'lucide-react'

interface ExplainDiffButtonProps {
  patch: string
  context?: string
  onExplanation?: (text: string) => void
}

export function ExplainDiffButton({ patch, context, onExplanation }: ExplainDiffButtonProps) {
  const [loading, setLoading] = useState(false)
  const [explanation, setExplanation] = useState<string>('')
  const [error, setError] = useState<string>('')

  const handleExplain = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/bff/assist/explain-diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch, context })
      })

      if (!response.ok) {
        throw new Error(`Failed to explain diff: ${response.statusText}`)
      }

      const data = await response.json()
      const text = data.explanation?.slice(0, 280) || 'No explanation available'
      setExplanation(text)
      onExplanation?.(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch explanation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleExplain}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-info-600 bg-info-50 border border-info-200 rounded-lg hover:bg-info-100 transition-colors disabled:opacity-50"
        type="button"
        aria-label="Explain this diff"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Lightbulb className="w-4 h-4" />
        )}
        {loading ? 'Explaining...' : 'Explain Diff'}
      </button>

      {explanation && (
        <div className="px-3 py-2 bg-info-50 border border-info-200 rounded-lg text-sm text-info-900">
          {explanation}
        </div>
      )}

      {error && (
        <div className="px-3 py-2 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-900">
          {error}
        </div>
      )}
    </div>
  )
}
