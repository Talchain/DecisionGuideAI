/**
 * ModelBuildingNoticesNotice — the reader for CEE's `model_building_notices`.
 *
 * Until this component the field had ZERO renderers repo-wide: 56 notices
 * generated, 0 delivered. Olumi was recording what it had to leave out of a
 * user's model and telling nobody — which is indistinguishable, to the user,
 * from a model that captured their brief completely.
 *
 * ── WHY THIS SURFACE ───────────────────────────────────────────────────────
 * The same argument `GroundedOnNotice` makes, for the same reason: a
 * model-building notice is a fact about ONE TURN's draft. It rides that turn's
 * bubble so scrolling back shows each draft with its OWN omissions. A canvas or
 * dock treatment is global and single-slot, so the latest draft's omissions
 * would sit beside every earlier one — a mis-attribution the user cannot
 * detect.
 *
 * It is deliberately NOT hosted inside `ModelReceiptBlock`, the other
 * post-draft card. That card is gated THREE times over — the
 * `preAnalysisEnriched` flag (envKey `VITE_FEATURE_PRE_ANALYSIS_ENRICHED`,
 * `defaultValue` false and ABSENT from `netlify.toml`), a non-empty
 * `coachingSummary`, and a normalised `ceeAnalysisReady`. Hanging an honest
 * disclosure off three preconditions it does not need is how a correct thing
 * ships dark, which is the failure this component exists to end. This one is
 * UNGATED and its only condition is the payload's own presence.
 *
 * ── PROGRESSIVE DISCLOSURE ─────────────────────────────────────────────────
 * Collapsed by default to ONE count-led line. A first-draft wall of notices is
 * its own failure — the user has just been handed a model and the primary act
 * is to read it, not to audit it. Depth is one click away and never pre-opened.
 *
 * ── WHAT IT NEVER CLAIMS ───────────────────────────────────────────────────
 * · Never a kind code. `describeModelBuildingNoticeKind` is the only path to a
 *   rendered string and returns null rather than falling back to the code.
 * · Never that the listed rows account for the headline count. A kind this UI
 *   cannot name is dropped from the rows while `total_count` stays the
 *   producer's, so the two quantities can legitimately differ; the copy is
 *   written so neither is stated in terms of the other.
 * · Never a specific example. `details_redacted: true` means the producer sent
 *   counts and nothing else — naming an item would be invention.
 * · Never anything at all when the field is absent. No zero, no empty panel.
 */
import { memo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { typography } from '../../styles/typography'
import {
  MODEL_BUILDING_NOTICES_POINTER,
  modelBuildingNoticesSummary,
  type ModelBuildingNoticesView,
} from './modelBuildingNotices'

export interface ModelBuildingNoticesNoticeProps {
  notices: ModelBuildingNoticesView
}

export const ModelBuildingNoticesNotice = memo(function ModelBuildingNoticesNotice({
  notices,
}: ModelBuildingNoticesNoticeProps) {
  const [expanded, setExpanded] = useState(false)

  // A payload that survived the schema but names nothing this UI can phrase
  // renders NOTHING. The headline alone ("Olumi left N things out") without a
  // single nameable row is a dead end by the product's own definition: it
  // reports a loss the user cannot act on. Silence is the honest alternative.
  if (notices.rows.length === 0) return null

  return (
    <div
      data-testid="model-building-notices"
      data-total-count={notices.totalCount}
      data-row-count={notices.rows.length}
      className="mt-2"
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={expanded ? 'model-building-notices-detail' : undefined}
        data-testid="model-building-notices-toggle"
        className={`${typography.panelMeta} text-text-light inline-flex items-center gap-1 hover:text-text-body transition-colors`}
      >
        {modelBuildingNoticesSummary(notices.totalCount)}
        {expanded
          ? <ChevronDown className="w-3 h-3" aria-hidden="true" />
          : <ChevronRight className="w-3 h-3" aria-hidden="true" />}
      </button>

      {expanded && (
        <div id="model-building-notices-detail" className="mt-1 pl-4 space-y-1">
          <ul className="space-y-1" role="list">
            {notices.rows.map((row) => (
              <li
                key={row.kind}
                // Provenance for tests/debug — binds a row to its producer kind
                // BY IDENTITY. Never rendered as text.
                data-notice-kind={row.kind}
                className={`${typography.panelMeta} text-text-light`}
              >
                {/* Emphasis by COLOUR, never by a raw font weight. DS v5 §2.4
                    bans raw sizes and weights in panel scope, and this file sits
                    in the dock closure — the row is `text-text-light`, so the
                    darker body token carries the count on its own. */}
                <span className="text-text-body">{row.count}</span>{' '}
                {row.description}
              </li>
            ))}
          </ul>
          <p
            data-testid="model-building-notices-pointer"
            className={`${typography.panelMeta} text-text-light`}
          >
            {MODEL_BUILDING_NOTICES_POINTER}
          </p>
        </div>
      )}
    </div>
  )
})

export default ModelBuildingNoticesNotice
