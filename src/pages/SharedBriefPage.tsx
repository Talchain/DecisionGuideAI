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
 *
 * ⭐ 18 Sep 2026 (later the same day) — IT NOW CARRIES THE ANALYSIS TOO.
 * A recipient was seeing the model and none of the conclusions. CEE began
 * writing `scenarios.brief` on every successful run that morning (39 of 14,252
 * rows, all written between 01:48Z and 12:37Z), the share now carries it as
 * `p_analysis`, and `AnalysisSection` renders the ranked options, the headline
 * the producer was entitled to state, robustness, drivers and what would
 * change. The allowlist applies to it field by field — see `readAnalysis`,
 * which records what is deliberately excluded and the measurement behind it.
 *
 * Two rules from `src/lib/decisionVerdict.ts` bind this page and are cited at
 * their call sites: RENDER the producer's owned claim and never DERIVE one
 * (its silence is meaningful), and disclose robustness SEPARATELY from the
 * leader claim rather than collapsing the two.
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
// Analysis reading — allowlisted fields only
// ---------------------------------------------------------------------------

/**
 * What the run concluded, reduced to the fields this page is willing to show.
 *
 * ⭐ THE FIELD NAMES ARE DERIVED FROM THE PRODUCER. Measured at the deployed
 * database on 18 Sep 2026 over every `scenarios.brief` CEE has written — 39
 * rows, ALL of them written that day between 01:48Z and 12:37Z, which is why
 * this page had nothing to show until now. Eighteen keys, present on all 39.
 * Population of the parts that matter, and the shapes:
 *
 *   options            39/39   [{ rank, label, option_id, win_probability }]
 *   headline           39/39   the producer's own sentence
 *   robustness_caveat  39/39   { text, basis, doctrine, flip_evidence }
 *   what_would_change  39/39   array of STRINGS ("A → B")
 *   top_drivers        27/39   [{ factor_label, direction, sensitivity }]
 *   key_assumptions    27/39   array of STRINGS (factor labels)
 *
 * `win_probability` over 131 option rows: min 0.000125, max 0.99595, none
 * above 1 — a probability, so it is rendered as one.
 *
 * ⛔ WHAT IS DELIBERATELY LEFT OUT, AND WHY IT IS A DECISION RATHER THAN AN
 * OVERSIGHT. `warnings` (35/39) and `defaulted_assumptions` (9/39) read like
 * honesty signals and are the obvious thing to surface. They carry RAW
 * INTERNAL IDENTIFIERS: measured over the same rows, 12 of 103 warning
 * messages name node ids ("root node '6bb6259c'", 'factor node "ab78e513"')
 * and one names the ISL service and its internal defaulting. They are
 * operator diagnostics. Contrast control in the same sweep: every field in
 * the allowlist below returned ZERO id-shaped matches across 40/188/56/135/
 * 60/40 elements, so the probe could see ids and those zeros are real absence.
 *
 * Also out: `brief_id`, `lineage`, `graph_hash`, `seed`, `version`,
 * `created_at` (provenance internals), `option_id` / `leader_option_id`
 * (producer ids), and `headline_banded` / `analysis_summary`, whose readable
 * content duplicates `headline` while carrying ids and a doctrine token.
 *
 * `sensitivity` is read but NOT rendered: 0.3077636585204695 is neither a
 * probability nor a percentage and the producer does not disclose which, so
 * showing it would mean inventing a presentation. Only the ordering it
 * implies is used.
 */
interface ReadOption {
  label: string
  winProbability: number | null
}

interface ReadAnalysis {
  headline?: string
  options: ReadOption[]
  robustnessNote?: string
  drivers: string[]
  whatWouldChange: string[]
  keyAssumptions: string[]
}

function readString(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined
}

/** Plain strings only — the shape `what_would_change` and `key_assumptions` use. */
function readStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((v) => readString(v))
    .filter((v): v is string => v !== undefined)
}

function readOptions(raw: unknown): ReadOption[] {
  if (!Array.isArray(raw)) return []

  const options = raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const o = entry as Record<string, unknown>
      const label = readString(o.label)
      if (label === undefined) return null

      // A probability in [0,1] or nothing. Anything outside that range is a
      // convention this page has not derived, and guessing at one is how a
      // figure ends up 137x wrong on a screen the sender cannot see.
      const wp = o.win_probability
      const winProbability =
        typeof wp === 'number' && Number.isFinite(wp) && wp >= 0 && wp <= 1
          ? wp
          : null

      const rank = typeof o.rank === 'number' && Number.isFinite(o.rank) ? o.rank : null
      return { label, winProbability, rank }
    })
    .filter((o): o is ReadOption & { rank: number | null } => o !== null)

  // The producer ranks them; fall back to input order when it has not.
  if (options.every((o) => o.rank !== null)) {
    options.sort((a, b) => (a.rank as number) - (b.rank as number))
  }

  return options.map(({ label, winProbability }) => ({ label, winProbability }))
}

function readDrivers(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return undefined
      return readString((entry as Record<string, unknown>).factor_label)
    })
    .filter((v): v is string => v !== undefined)
}

function readAnalysis(raw: unknown): ReadAnalysis | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const a = raw as Record<string, unknown>

  const caveat =
    a.robustness_caveat && typeof a.robustness_caveat === 'object'
      ? readString((a.robustness_caveat as Record<string, unknown>).text)
      : undefined

  const result: ReadAnalysis = {
    headline: readString(a.headline),
    options: readOptions(a.options),
    robustnessNote: caveat,
    drivers: readDrivers(a.top_drivers),
    whatWouldChange: readStringList(a.what_would_change),
    keyAssumptions: readStringList(a.key_assumptions),
  }

  const hasContent =
    result.headline !== undefined ||
    result.options.length > 0 ||
    result.robustnessNote !== undefined ||
    result.drivers.length > 0 ||
    result.whatWouldChange.length > 0 ||
    result.keyAssumptions.length > 0

  // Nothing recognised means no section at all — never an empty heading.
  return hasContent ? result : null
}

/**
 * A probability as a whole percentage. A non-zero probability that rounds to
 * zero is shown as "<1%" rather than "0%", which would read as "impossible"
 * about an option the model gave a real chance to.
 */
function formatProbability(p: number): string {
  const pct = Math.round(p * 100)
  if (pct === 0 && p > 0) return '<1%'
  return `${pct}%`
}

// ---------------------------------------------------------------------------
// Analysis renderer
// ---------------------------------------------------------------------------

/**
 * ⚠ HEADINGS ARE SENTENCE CASE, AND THAT IS A RULING, NOT A STYLE PREFERENCE.
 * The `uppercase` utility used by this page's older headings is a net-new
 * violation under `ci:guard:ds:enforce` (`uppercase-text` — "styling-driven
 * all-caps, sentence case required", DS v5 §2). The guard fired on this
 * component and was taken at its word rather than re-pinned: new code follows
 * the shipped design system. The older headings above are grandfathered in the
 * ratchet baseline, so this section reads slightly differently from them until
 * they migrate — which is what a ratchet is for.
 */
function AnalysisSection({ analysis }: { analysis: ReadAnalysis }) {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-6 mb-4"
      data-testid="shared-snapshot-analysis"
    >
      <h2 className="text-sm font-medium text-text-light mb-2">
        What the analysis concluded
      </h2>

      {/*
        The producer's own sentence, rendered as written.

        ⭐ RENDER THE OWNED CLAIM — NEVER DERIVE ONE (src/lib/decisionVerdict.ts,
        ROADMAP 1.223). CEE #711 made the producer's SILENCE meaningful: on a
        turn whose verdict is withheld it deliberately drops `headline` while
        the per-option win probabilities keep riding the wire, because the DATA
        is not withheld — only the CLAIM. A consumer-side fallback that banded
        those same numbers into a leader sentence is exactly the defect that
        was deleted rather than gated, after the product asserted a leader in
        nine places on the same screen as its own "no option can be put forward
        yet". So: no headline, no claim. The options below still render.
      */}
      {analysis.headline && (
        <p
          className="text-text-body leading-relaxed"
          data-testid="shared-analysis-headline"
        >
          {analysis.headline}
        </p>
      )}

      {analysis.options.length > 0 && (
        <section className="mt-5">
          <h3 className="text-sm font-medium text-text-light mb-2">
            How the options compared
          </h3>
          <ul className="space-y-2">
            {analysis.options.map((o, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between gap-3 p-3 bg-gray-50 rounded-lg"
                data-testid={`shared-option-${i}`}
              >
                <span className="font-medium text-text-header">{o.label}</span>
                {o.winProbability !== null && (
                  <span className="text-sm text-text-body whitespace-nowrap">
                    {formatProbability(o.winProbability)}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-text-light">
            How often each option came out best across the runs of this model.
          </p>
        </section>
      )}

      {/*
        Robustness is disclosed SEPARATELY and never folded into the leader
        claim. decisionVerdict.ts: separation ("how far apart are the options")
        and robustness ("does the ranking survive perturbation") are two facts,
        and every contradictory string this product has shipped came from a
        surface collapsing them into one. A lead that is not robust is still a
        lead; what no surface may do is deny the lead because it is fragile, or
        assert robustness because there is a lead. The producer writes a
        band-appropriate sentence — measured: the `fragile` rows say "This run
        was fragile under the changes we tested", the robust ones do not — so
        it is rendered as written rather than re-derived from the band token.
      */}
      {analysis.robustnessNote && (
        <section className="mt-5">
          <h3 className="text-sm font-medium text-text-light mb-2">
            How much to trust it
          </h3>
          <p className="text-sm text-text-body leading-relaxed">
            {analysis.robustnessNote}
          </p>
        </section>
      )}

      {analysis.whatWouldChange.length > 0 && (
        <section className="mt-5">
          <h3 className="text-sm font-medium text-text-light mb-2">
            What would change the outcome
          </h3>
          <ul className="space-y-1">
            {analysis.whatWouldChange.map((w, i) => (
              <li key={i} className="text-sm text-text-body leading-relaxed">
                {w}
              </li>
            ))}
          </ul>
        </section>
      )}

      {analysis.drivers.length > 0 && (
        <section className="mt-5" data-testid="shared-analysis-drivers">
          <h3 className="text-sm font-medium text-text-light mb-2">
            Most sensitive to
          </h3>
          <ul className="space-y-1">
            {analysis.drivers.map((d, i) => (
              <li key={i} className="text-sm text-text-body leading-relaxed">
                {d}
              </li>
            ))}
          </ul>
        </section>
      )}

      {analysis.keyAssumptions.length > 0 && (
        <section className="mt-5">
          <h3 className="text-sm font-medium text-text-light mb-2">
            Assumptions it rests on
          </h3>
          <ul className="space-y-1">
            {analysis.keyAssumptions.map((k, i) => (
              <li key={i} className="text-sm text-text-body leading-relaxed">
                {k}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
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
  const analysis = readAnalysis(data.analysis)

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

        {/* What the analysis concluded. Rendered ABOVE the model: a recipient
            opens a link to find out what was decided, and the elements are the
            supporting detail. Absent for most links — 39 of 14,252 scenarios
            carried a brief when this was written — and absence is silence, not
            an empty section. */}
        {analysis && <AnalysisSection analysis={analysis} />}

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
