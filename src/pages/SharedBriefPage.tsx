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
            {/* ⛔ WAS `JSON.stringify(data.recommendation)`. Same defect as the
                whole-payload fallback below, one field narrower: a non-string
                value rendered its raw JSON inline, at an anonymous URL, inside a
                sentence. Withholding the one field is honest; dumping it is not. */}
            {typeof data.recommendation === 'string'
              ? data.recommendation
              : 'This section is not in a format this page can show.'}
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
            {/* ⛔ WAS `JSON.stringify(data.summary)`. Same defect as the
                whole-payload fallback below, one field narrower: a non-string
                value rendered its raw JSON inline, at an anonymous URL, inside a
                sentence. Withholding the one field is honest; dumping it is not. */}
            {typeof data.summary === 'string'
              ? data.summary
              : 'This section is not in a format this page can show.'}
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
            {/* ⛔ WAS `JSON.stringify(data.robustness)`. Same defect as the
                whole-payload fallback below, one field narrower: a non-string
                value rendered its raw JSON inline, at an anonymous URL, inside a
                sentence. Withholding the one field is honest; dumping it is not. */}
            {typeof data.robustness === 'string'
              ? data.robustness
              : 'This section is not in a format this page can show.'}
          </p>
        </section>
      )}

      {/* ⛔⛔ THIS RENDERED `JSON.stringify(brief, null, 2)` INTO THE PAGE.
          This is the ONLY surface a person outside the team ever sees, reached
          anonymously by slug, and its fallback for an unrecognised payload was a
          raw dump of the stored JSONB.

          ⚠ AND THE FALLBACK IS NOT HYPOTHETICAL — IT IS THE UNWITNESSED CASE.
          Swept at `6497a251`: there is NO captured `shared_briefs` row anywhere
          in this repo. Every fixture proving this page is hand-written in its own
          spec (`{ title, summary }`, `{ custom_field }`). Contrast control in the
          same sweep: 91 captured JSON fixtures exist under `src/`, including live
          staging captures — so the repo captures payloads readily and has simply
          never captured one of these. `docs/specs/tenancy-collab-migration-spec-v1_7-draft.md`
          records `shared_briefs` at **0 rows** and notes the live
          `create_shared_brief` is "the CEE variant". **So nobody knows what this
          page receives, and the branch taken when it does not recognise the shape
          was the one that printed the raw record at the reader.**

          Three reasons the dump is the wrong answer, in order of seriousness:
            1. PRIVACY. The design record for this table
               (`docs/designs/collab-multiuser-design-recommendations-v1.md:270`)
               specifies "allowlist, no ids/PII" for the public brief. A verbatim
               dump renders whatever the row happens to hold, which is the exact
               thing the allowlist exists to prevent — at an anonymous URL.
            2. IT IS NOT A BRIEF. A colleague opening a shared decision receives a
               wall of JSON. That is not a degraded view of the document; it is a
               different artefact, and it reads as broken.
            3. IT HIDES THE FAILURE. A dump looks like content, so nobody reports
               it and nobody fixes the shape it failed to recognise.

          The honest state says what happened, keeps the provenance footer (which
          renders outside this component, so the reader can still see the brief is
          real and dated), and points back to the person who sent it — the only
          route that actually resolves it. */}
      {!data.title && !data.headline && !data.recommendation && !data.summary && (
        <div data-testid="shared-brief-unrenderable">
          <h2 className="text-xl font-semibold text-text-header">
            This brief could not be displayed
          </h2>
          <p className="mt-2 text-text-body leading-relaxed">
            The decision is saved and the record below is genuine, but it is not in a
            format this page can show. Ask the person who shared it to send it again.
          </p>
        </div>
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
