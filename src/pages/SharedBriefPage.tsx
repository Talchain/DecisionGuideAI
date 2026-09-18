/**
 * Shared decision page — the one surface a person outside the team ever sees,
 * reached anonymously by slug.
 *
 * ⭐ 18 Sep 2026 — RE-POINTED FROM BRIEFS TO SNAPSHOTS, AND THE REASON MATTERS.
 *
 * This page used to read `get_shared_brief_by_slug`. Measured at the deployed
 * database (output/accelerate-20260918/SHARE-GATING-ITEM-SETTLED.md):
 *
 *   - `shared_briefs` holds 0 rows and always has. Its writer,
 *     `create_shared_brief`, gates on `scenarios.brief` and
 *     `scenarios.analysis_provenance` — populated in 1 of 14,141 rows, and that
 *     row is a synthetic fixture. So no reader has ever reached this page with
 *     real content, which is exactly why the previous session could write
 *     "nobody knows what this page receives".
 *   - Even a row that passed carried no graph. `get_shared_brief_by_slug`
 *     returns prose plus three hashes. That is the empty canvas recipients
 *     reported: the link resolved, and there was no decision in it.
 *
 * `get_shared_snapshot_by_slug` carries the graph. So this page can now show
 * the model rather than describe it.
 *
 * ⚠ THE ALLOWLIST DOCTRINE FROM THE PREVIOUS VERSION IS KEPT, DELIBERATELY.
 * The old code's worst defect was a `JSON.stringify(brief)` fallback that
 * printed the raw stored record at an anonymous reader. Nothing here renders a
 * payload it has not recognised field by field: no ids, no provenance
 * internals, no raw dumps. An unrecognised shape says so and stops.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, AlertTriangle, FileText } from 'lucide-react'
import * as scenarioService from '../services/scenarioService'
import type { SharedSnapshotRow } from '../types/scenario'
import { formatRelativeTime } from '../utils/formatRelativeTime'

// ---------------------------------------------------------------------------
// Graph reading — allowlisted fields only
// ---------------------------------------------------------------------------

interface ReadNode {
  type: string
  label: string
  description?: string
  value?: string
  quote?: string
}

/**
 * Pull the display fields off one node.
 *
 * ⭐ THE FIELD NAMES HERE ARE DERIVED FROM THE PRODUCER, NOT FROM THIS PAGE'S
 * IDEA OF ONE. Census over every graph written in the 7 days to 18 Sep 2026 —
 * 45,876 nodes, 72,660 edges:
 *
 *   kind           45,876   ← the taxonomy key. `type` occurs ZERO times.
 *   label          45,876
 *   source_quote    9,756   ← the sender's own words, per element
 *   display_value   4,695   (4,687 of them on factors)
 *   description       118   ← essentially absent
 *   value / unit        0   ← never written
 *
 * The first draft of this page grouped by `type` and leaned on `description`.
 * Both are hand-authored guesses that happen to appear in older graphs, and
 * against current data every node would have fallen into the ungrouped bucket
 * with no supporting text. A fixture you wrote yourself is not evidence about
 * the wire.
 *
 * `type` is still read as a fallback so graphs written before the rename keep
 * grouping. `value`/`unit` are kept for the same reason and cost nothing.
 */
function readNode(raw: unknown): ReadNode | null {
  if (!raw || typeof raw !== 'object') return null
  const n = raw as Record<string, unknown>

  const label = typeof n.label === 'string' ? n.label.trim() : ''
  if (label === '') return null

  const type =
    typeof n.kind === 'string' && n.kind.trim() !== ''
      ? n.kind
      : typeof n.type === 'string' && n.type.trim() !== ''
        ? n.type
        : 'unknown'

  // `display_value` is the already-formatted string the canvas shows. Prefer
  // it: re-deriving a number's presentation here would give the recipient a
  // different figure from the sender, which is the defect class this estate
  // has paid for repeatedly.
  let value: string | undefined
  if (typeof n.display_value === 'string' && n.display_value.trim() !== '') {
    value = n.display_value.trim()
  } else if (typeof n.value === 'number' && Number.isFinite(n.value)) {
    const unit = typeof n.unit === 'string' ? n.unit.trim() : ''
    value = unit === '' ? String(n.value) : `${n.value} ${unit}`
  }

  const description =
    typeof n.description === 'string' && n.description.trim() !== ''
      ? n.description.trim()
      : undefined

  // The sender's own words for this element, carried from their brief. Same
  // content class as `brief_text`, which this page already shows — the sharer's
  // prose, deliberately shared — so it is inside the allowlist, not an
  // exception to it. It is also the attribution the programme asks for: it
  // tells the recipient WHY an element is in the model, in the sender's voice.
  const quote =
    typeof n.source_quote === 'string' && n.source_quote.trim() !== ''
      ? n.source_quote.trim()
      : undefined

  return { type, label, description, value, quote }
}

function readNodes(graph: unknown): ReadNode[] {
  if (!graph || typeof graph !== 'object') return []
  const g = graph as Record<string, unknown>
  if (!Array.isArray(g.nodes)) return []
  return g.nodes.map(readNode).filter((n): n is ReadNode => n !== null)
}

function edgeCount(graph: unknown): number {
  if (!graph || typeof graph !== 'object') return 0
  const g = graph as Record<string, unknown>
  return Array.isArray(g.edges) ? g.edges.length : 0
}

// ---------------------------------------------------------------------------
// Model renderer
// ---------------------------------------------------------------------------

/**
 * Ordered by how a reader meets the decision, not by how common each kind is.
 * The six kinds are the producer's own, censused over 45,876 nodes:
 * factor 15,449 · option 12,020 · risk 6,698 · outcome 5,341 · decision 3,184 ·
 * goal 3,184. `risk` was missing from the first draft of this list, which is
 * 6,698 nodes that would have rendered under "Also in the model".
 */
const GROUPS: Array<{ type: string; heading: string }> = [
  { type: 'decision', heading: 'The decision' },
  { type: 'goal', heading: 'What it is for' },
  { type: 'option', heading: 'Options on the table' },
  { type: 'factor', heading: 'What it depends on' },
  { type: 'risk', heading: 'What could go wrong' },
  { type: 'outcome', heading: 'What could follow' },
]

function NodeList({ nodes }: { nodes: ReadNode[] }) {
  return (
    <ul className="space-y-2">
      {nodes.map((n, i) => (
        <li key={i} className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium text-text-header">{n.label}</span>
            {n.value && (
              <span className="text-sm text-text-body whitespace-nowrap">{n.value}</span>
            )}
          </div>
          {n.description && (
            <p className="mt-1 text-sm text-text-light leading-relaxed">{n.description}</p>
          )}
          {n.quote && (
            <p className="mt-1 text-sm text-text-light leading-relaxed italic">
              &ldquo;{n.quote}&rdquo;
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

function ModelContent({ graph }: { graph: unknown }) {
  const nodes = readNodes(graph)

  if (nodes.length === 0) {
    // Honest stop, same reasoning as the old unrenderable state: a page that
    // shows nothing and says nothing reads as broken, and nobody reports it.
    return (
      <div data-testid="shared-snapshot-unrenderable">
        <h2 className="text-xl font-semibold text-text-header">
          This decision could not be displayed
        </h2>
        <p className="mt-2 text-text-body leading-relaxed">
          The link is genuine and the record below is real, but the model is not in a
          format this page can show. Ask the person who shared it to send it again.
        </p>
      </div>
    )
  }

  const grouped = GROUPS.map((g) => ({
    ...g,
    nodes: nodes.filter((n) => n.type === g.type),
  })).filter((g) => g.nodes.length > 0)

  const known = new Set(GROUPS.map((g) => g.type))
  const others = nodes.filter((n) => !known.has(n.type))

  return (
    <div className="space-y-6" data-testid="shared-snapshot-model">
      {grouped.map((g) => (
        <section key={g.type}>
          <h3 className="text-sm font-medium text-text-light uppercase tracking-wide mb-2">
            {g.heading}
          </h3>
          <NodeList nodes={g.nodes} />
        </section>
      ))}

      {others.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-text-light uppercase tracking-wide mb-2">
            Also in the model
          </h3>
          <NodeList nodes={others} />
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SharedBriefPage() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<SharedSnapshotRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return

    setLoading(true)
    setError(null)
    setNotFound(false)

    scenarioService.getSharedSnapshotBySlug(slug)
      .then((result) => {
        if (result) {
          setData(result)
        } else {
          setNotFound(true)
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load this decision')
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
          <h1 className="text-xl font-semibold text-text-header">Decision not found</h1>
          <p className="mt-2 text-sm text-text-light">
            This link doesn&apos;t exist or has expired.
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
          <h1 className="text-xl font-semibold text-text-header">Failed to load this decision</h1>
          <p className="mt-2 text-sm text-text-light">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const nodeTotal = readNodes(data.graph).length
  const edgeTotal = edgeCount(data.graph)

  return (
    <div className="min-h-screen bg-gray-50 p-6 sm:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <FileText className="w-5 h-5 text-info" />
          <h1 className="text-lg font-semibold text-text-header">Shared decision</h1>
        </div>

        {/* The brief, as the sender wrote it. Plain text, so it is rendered as
            text — never as markup, and never re-wrapped into a shape the sender
            did not choose. */}
        {data.brief_text && data.brief_text.trim() !== '' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
            <h2 className="text-sm font-medium text-text-light uppercase tracking-wide mb-2">
              The situation
            </h2>
            <p className="text-text-body leading-relaxed whitespace-pre-wrap">
              {data.brief_text}
            </p>
          </div>
        )}

        {/* The model */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <ModelContent graph={data.graph} />
        </div>

        {/* Provenance footer. No ids and no owner — the read function does not
            return them, and this page does not invent them. */}
        <div className="mt-4 text-xs text-text-light space-y-0.5">
          <p>
            Shared {formatRelativeTime(data.created_at)} · {nodeTotal}{' '}
            {nodeTotal === 1 ? 'element' : 'elements'} · {edgeTotal}{' '}
            {edgeTotal === 1 ? 'link' : 'links'}
          </p>
          {data.graph_hash && (
            <p className="font-mono">Model hash: {data.graph_hash.slice(0, 12)}…</p>
          )}
          {data.expires_at && (
            <p>Expires: {new Date(data.expires_at).toLocaleDateString()}</p>
          )}
        </div>
      </div>
    </div>
  )
}
