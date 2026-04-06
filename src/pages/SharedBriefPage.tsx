/**
 * Shared brief read-only page (C.1b Task 7b).
 *
 * Fetches a shared brief by slug (anon-accessible) and renders it
 * in a structured read-only format. No authentication required.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, AlertTriangle, FileText } from 'lucide-react'
import * as scenarioService from '../services/scenarioService'
import type { SharedBriefRow } from '../types/scenario'
import { formatRelativeTime } from '../utils/formatRelativeTime'

// ---------------------------------------------------------------------------
// Brief renderer — structured display of the brief JSONB
// ---------------------------------------------------------------------------

function BriefContent({ brief }: { brief: unknown }) {
  if (!brief || typeof brief !== 'object') {
    return <p className="text-text-light">No brief content available.</p>
  }

  const data = brief as Record<string, unknown>

  return (
    <div className="space-y-6">
      {/* Title / headline */}
      {data.title && (
        <h2 className="text-xl font-semibold text-text-header">
          {String(data.title)}
        </h2>
      )}
      {data.headline && !data.title && (
        <h2 className="text-xl font-semibold text-text-header">
          {String(data.headline)}
        </h2>
      )}

      {/* Recommendation */}
      {data.recommendation && (
        <section>
          <h3 className="text-sm font-medium text-text-light uppercase tracking-wide mb-2">
            Result
          </h3>
          <p className="text-text-body leading-relaxed">
            {typeof data.recommendation === 'string'
              ? data.recommendation
              : JSON.stringify(data.recommendation)}
          </p>
        </section>
      )}

      {/* Summary */}
      {data.summary && (
        <section>
          <h3 className="text-sm font-medium text-text-light uppercase tracking-wide mb-2">
            Summary
          </h3>
          <p className="text-text-body leading-relaxed">
            {typeof data.summary === 'string'
              ? data.summary
              : JSON.stringify(data.summary)}
          </p>
        </section>
      )}

      {/* Key metrics */}
      {data.metrics && Array.isArray(data.metrics) && (
        <section>
          <h3 className="text-sm font-medium text-text-light uppercase tracking-wide mb-2">
            Key metrics
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {(data.metrics as Array<Record<string, unknown>>).map((metric, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-text-light">{String(metric.label ?? metric.name ?? '')}</div>
                <div className="text-lg font-semibold text-text-header">{String(metric.value ?? '')}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Options */}
      {data.options && Array.isArray(data.options) && (
        <section>
          <h3 className="text-sm font-medium text-text-light uppercase tracking-wide mb-2">
            Options analysed
          </h3>
          <div className="space-y-2">
            {(data.options as Array<Record<string, unknown>>).map((option, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg">
                <div className="font-medium text-text-header">{String(option.label ?? option.name ?? `Option ${i + 1}`)}</div>
                {option.probability != null && (
                  <div className="text-sm text-text-light mt-0.5">
                    Probability: {Math.round(Number(option.probability) * 100)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Robustness */}
      {data.robustness && (
        <section>
          <h3 className="text-sm font-medium text-text-light uppercase tracking-wide mb-2">
            Robustness assessment
          </h3>
          <p className="text-text-body leading-relaxed">
            {typeof data.robustness === 'string'
              ? data.robustness
              : JSON.stringify(data.robustness)}
          </p>
        </section>
      )}

      {/* Fallback: show raw JSON for any fields not explicitly rendered */}
      {!data.title && !data.headline && !data.recommendation && !data.summary && (
        <pre className="text-xs text-text-light bg-gray-50 rounded-lg p-4 overflow-auto max-h-96">
          {JSON.stringify(brief, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SharedBriefPage() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<SharedBriefRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return

    setLoading(true)
    setError(null)
    setNotFound(false)

    scenarioService.getSharedBriefBySlug(slug)
      .then((result) => {
        if (result) {
          setData(result)
        } else {
          setNotFound(true)
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load brief')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [slug])

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-info animate-spin" />
      </div>
    )
  }

  // Not found
  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-10 h-10 text-warning mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-text-header">Brief not found</h1>
          <p className="mt-2 text-sm text-text-light">
            This brief doesn&apos;t exist or has expired.
          </p>
        </div>
      </div>
    )
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-10 h-10 text-danger mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-text-header">Failed to load brief</h1>
          <p className="mt-2 text-sm text-text-light">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="min-h-screen bg-gray-50 p-6 sm:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <FileText className="w-5 h-5 text-info" />
          <h1 className="text-lg font-semibold text-text-header">Shared decision brief</h1>
        </div>

        {/* Brief content */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <BriefContent brief={data.brief} />
        </div>

        {/* Provenance footer */}
        <div className="mt-4 text-xs text-text-light space-y-0.5">
          <p>Analysis run {formatRelativeTime(data.created_at)}</p>
          <p className="font-mono">
            Graph hash: {data.graph_hash?.slice(0, 12)}… · Seed: {data.seed_used} · Response: {data.response_hash?.slice(0, 12)}…
          </p>
          {data.expires_at && (
            <p>Expires: {new Date(data.expires_at).toLocaleDateString()}</p>
          )}
        </div>
      </div>
    </div>
  )
}
