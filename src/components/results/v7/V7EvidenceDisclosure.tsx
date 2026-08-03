/**
 * V7EvidenceDisclosure — one expandable evidence section with three views
 * (V7 Lane L5, spec row 7).
 *
 * A single disclosure ("Why, and what could change it") hosting three tabs:
 *   · Drivers — producer rank order (drivers.drivers, already ranked upstream),
 *     top 3 with "Show N more" expansion; a +/- direction sign (producer
 *     direction, omitted when absent) and an "est." tag when the factor value
 *     or its confidence was defaulted (a direct producer boolean read, never a
 *     threshold). Rows focus the factor on canvas when a target exists.
 *   · Flip risks — challengeFragileEdges (the SAME fragile-edge slice the
 *     signal row + stress test consume): "{from} → {to}" with the producer
 *     switch probability as row meta.
 *   · Trade-offs — conditional_winners narrated verbatim from producer values
 *     (factor label, split value/unit, winner labels); nothing invented.
 *   · Resolve next — ISL's per-factor EVPPI as a RANKING ONLY (V7-C slice 1,
 *     ROADMAP 2.141): producer wire order, rank-1 annotated as the one most
 *     worth resolving, below-resolution factors demoted to a muted line, and
 *     NO magnitude anywhere. The numbers are in the decision's OUTCOME units
 *     and have no licensed rendering, so no CLAIM this view makes contains a
 *     digit — the ranking is carried structurally by an ordered list. (The one
 *     digit-bearing string is the "Show N more" row-clamp counter shared with
 *     Drivers: a count of hidden rows, not a value of information. It is carved
 *     out of the no-digit assertion and pinned exactly, so the carve-out cannot
 *     widen.) An absent or unusable block renders the honest gate; it never
 *     falls back to the retired `gap.voi` heuristic this view exists to
 *     replace.
 *
 * Each tab renders its live rows or an honest gate — never a fabricated list.
 * Tabs use aria-pressed toggle buttons (not role=tab): the disclosure body is
 * not a full WAI-ARIA tablist and must not promise roving-tabindex it does not
 * implement (same rationale as the live HeroEvidenceDisclosure).
 *
 * PASSTHROUGH only, reads existing store fields, invents no numbers, ships
 * flagless. COMPLETE borders only (L1 guard).
 */

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, AlertTriangle, Crosshair, GitBranch, Info } from 'lucide-react'
import { typography } from '@/styles/typography'
import { formatPercent } from '@/utils/formatPercent'
import { formatRangeValue } from '../utils/formatRangeValue'
import type { V7EvidenceModel } from './buildV7Lenses'
import { V7_LENS_COPY } from './v7LensCopy'
import { ClampToggle } from './ClampToggle'
import { useAnalysisProjection } from '@/canvas/highlighting/useAnalysisProjection'
import { useCanvasStore } from '@/canvas/store'
import { trackMeasurement } from '@/telemetry/measurementEvents'

const E = V7_LENS_COPY.evidence

/**
 * The row clamp — ONE number, ONE meaning, across every clamped view in this
 * disclosure (Drivers and Resolve next today). It was two constants whose
 * equality lived in a comment: a comment cannot fail, so the day one of them
 * moved the two views would have silently disagreed about "top N".
 */
const VISIBLE_EVIDENCE_ROWS = 3

type EvidenceView = 'drivers' | 'flipRisks' | 'tradeOffs' | 'resolveNext'

/** The four view chips, in render order. Static — every label is a module
 * constant, so this is built once rather than on every render. */
const VIEWS: ReadonlyArray<{ key: EvidenceView; label: string }> = [
  { key: 'drivers', label: E.driversTab },
  { key: 'flipRisks', label: E.flipRisksTab },
  { key: 'tradeOffs', label: E.tradeOffsTab },
  { key: 'resolveNext', label: E.resolveNextTab },
]

export interface V7EvidenceDisclosureProps {
  evidence: V7EvidenceModel
  onFocusNode?: (nodeId: string) => void
}

/** Honest-gate line — one leaf for the three identical per-view gate copies
 * (same classes; only the testid + copy differ per view). */
function EvidenceGate({ testId, children }: { testId: string; children: React.ReactNode }) {
  return (
    <p className={`${typography.panelBody} text-text-light`} data-testid={testId}>
      {children}
    </p>
  )
}

/** The muted lead-in note above a view's rows — three identical copies. */
function EvidenceNote({ children }: { children: React.ReactNode }) {
  return <p className={`${typography.panelMeta} text-text-light`}>{children}</p>
}

/*
 * `ClampToggle` moved to `./ClampToggle.tsx` (R-11). It was extracted here for
 * "the two verbatim copies" while a THIRD lived one file away in
 * `V7GuidanceSection.tsx`, unable to consume it because it was module-private.
 * Its full rationale — including the hidden-row-counter property that the
 * Resolve-next no-digit assertion carves out — moved with it.
 */

export function V7EvidenceDisclosure({ evidence, onFocusNode }: V7EvidenceDisclosureProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<EvidenceView>('drivers')
  const [showAllDrivers, setShowAllDrivers] = useState(false)
  const [showAllResolveNext, setShowAllResolveNext] = useState(false)

  // Analysis-graph projection: while this disclosure is open on the Flip-risks
  // or Drivers view, mark the resolvable canvas elements it names (fragile edges
  // / driver nodes). Closing the disclosure or switching to Trade-offs clears
  // the marks. Hook runs unconditionally (before the nothing-to-disclose return
  // below) so it also clears when there is nothing to show.
  const projectionActive: 'flip_risks' | 'drivers' | null =
    !open ? null : view === 'flipRisks' ? 'flip_risks' : view === 'drivers' ? 'drivers' : null
  const driverFocusIds = useMemo(() => evidence.drivers.map((d) => d.focusId), [evidence.drivers])
  useAnalysisProjection({
    active: projectionActive,
    flipRisks: evidence.flipRisks,
    driverFocusIds,
  })

  // ── evidence_view_opened (ROADMAP 1.68) ────────────────────────────────────
  //
  // WHY THIS SITE. It captures what the product TOLD the user, at the moment it
  // told them — and for the resolve-next ranking that is the only moment at
  // which it is the truth. The ranking is recomputed every run, so reading it
  // back afterwards answers a different question from the one the user saw.
  //
  // ON TRANSITION, NOT ON RENDER. The effect's deps are exactly [open, view],
  // so React fires it when the disclosure OPENS and when the view CHANGES, and
  // not on any other re-render. Closing and reopening on the same view does
  // re-emit — that is a new opening, and counting it as one is the point.
  //
  // The hook is unconditional and sits ABOVE the nothing-to-disclose early
  // return below, so hook order is stable.
  //
  // NEVER-CAPTURE: ids and counts only. `r.label` and `d.label` are rendered
  // two lines from here and are user/model-authored text — the payload takes
  // `factorId`, never `label`. See measurementEvents.ts.
  const resolveNextForEvent = evidence.resolveNext
  useEffect(() => {
    if (!open) return
    const state = useCanvasStore.getState()
    const isResolveNext = view === 'resolveNext'
    const ranked = resolveNextForEvent?.resolved ?? []
    trackMeasurement('evidence_view_opened', {
      view,
      scenario_id: state.currentScenarioId ?? null,
      gated:
        view === 'drivers' ? evidence.drivers.length === 0
        : view === 'flipRisks' ? evidence.flipRisks.length === 0
        : view === 'tradeOffs' ? evidence.tradeOffs.length === 0
        : resolveNextForEvent == null,
      // PREFIX ONLY — a full run id is a cross-session linking token.
      ...(state.results?.runId ? { run_id_prefix: state.results.runId.slice(0, 8) } : {}),
      ...(isResolveNext && resolveNextForEvent
        ? {
            // ID ONLY. NEVER ranked[0].label.
            ...(ranked[0] ? { rank1_factor_id: ranked[0].factorId } : {}),
            ranked_count: ranked.length,
            below_resolution_count: resolveNextForEvent.belowResolution.length,
            some_factors_unassessed: resolveNextForEvent.someFactorsUnassessed,
          }
        : {}),
    })
    // `evidence` is intentionally NOT a dep: a new model object on the same
    // open view is a re-render, not a new opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view])

  const hasDrivers = evidence.drivers.length > 0
  const hasFlipRisks = evidence.flipRisks.length > 0
  const hasTradeOffs = evidence.tradeOffs.length > 0
  // `resolveNext === null` is the honest-gate verdict, already decided by the
  // one authority (`voi/voiRanking.ts`) — never re-derived here. A ranking
  // alone is enough to disclose, so it joins the guard below; leaving it out
  // would render nothing on a run whose only evidence is the ranking.
  const hasResolveNext = evidence.resolveNext != null

  // Nothing to disclose at all → render nothing (never an empty shell).
  if (!hasDrivers && !hasFlipRisks && !hasTradeOffs && !hasResolveNext) return null

  const visibleDrivers = showAllDrivers ? evidence.drivers : evidence.drivers.slice(0, VISIBLE_EVIDENCE_ROWS)
  const moreCount = evidence.drivers.length - VISIBLE_EVIDENCE_ROWS

  const resolveNext = evidence.resolveNext
  const resolvedRows = resolveNext?.resolved ?? []
  const visibleResolveNext = showAllResolveNext
    ? resolvedRows
    : resolvedRows.slice(0, VISIBLE_EVIDENCE_ROWS)
  const resolveNextMoreCount = resolvedRows.length - VISIBLE_EVIDENCE_ROWS

  return (
    <section
      data-testid="v7-evidence-disclosure"
      className="rounded-lg border border-panel-border bg-panel px-3 py-1.5"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded py-1.5 text-left transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
      >
        <span className="min-w-0 flex-1">
          <span className={`${typography.panelHeader} block text-text-header`}>{E.heading}</span>
          <span className={`${typography.panelMeta} block text-text-light`}>{E.subtitle}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 flex-none text-text-light transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="mt-1 space-y-2 pb-2">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Evidence view">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                aria-pressed={view === v.key}
                onClick={() => setView(v.key)}
                data-testid={`v7-evidence-tab-${v.key}`}
                className={`px-2 py-0.5 rounded-full ${typography.panelMeta} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info ${
                  view === v.key
                    ? 'bg-primary text-text-on-color'
                    : 'border border-panel-border bg-transparent text-text-light hover:border-info hover:text-text-body'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {view === 'drivers' && (
            <div className="space-y-1.5" data-testid="v7-evidence-drivers">
              {hasDrivers ? (
                <>
                  <EvidenceNote>{E.driversNote}</EvidenceNote>
                  {visibleDrivers.map((d, i) => {
                    const canFocus = Boolean(d.focusId && onFocusNode)
                    const body = (
                      <span className={`${typography.panelBody} flex min-w-0 items-center gap-1.5 text-left text-text-body`}>
                        {canFocus && <Crosshair aria-hidden="true" className="h-3 w-3 flex-none text-info" />}
                        {d.direction && (
                          <span
                            aria-hidden="true"
                            data-testid="v7-driver-sign"
                            className={`font-semibold ${d.direction === 'positive' ? 'text-success' : 'text-danger'}`}
                          >
                            {d.direction === 'positive' ? '+' : '-'}
                          </span>
                        )}
                        <span className="min-w-0 truncate">{d.label}</span>
                        {d.direction && (
                          <span className="sr-only">
                            ({d.direction === 'positive' ? 'increases the outcome' : 'decreases the outcome'})
                          </span>
                        )}
                        {d.isEstimate && (
                          <span
                            data-testid="v7-driver-est"
                            aria-label={E.estimateTagAria}
                            className={`${typography.panelMeta} flex-none rounded-full border border-panel-border bg-transparent px-1.5 py-0 text-text-light`}
                          >
                            {E.estimateTag}
                          </span>
                        )}
                      </span>
                    )
                    return canFocus ? (
                      <button
                        key={`${d.factorKey}-${i}`}
                        type="button"
                        onClick={() => onFocusNode?.(d.focusId as string)}
                        className="flex w-full rounded py-0.5 transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
                      >
                        {body}
                      </button>
                    ) : (
                      <div key={`${d.factorKey}-${i}`} className="py-0.5">
                        {body}
                      </div>
                    )
                  })}
                  <ClampToggle
                    testId="v7-drivers-toggle"
                    hiddenCount={moreCount}
                    expanded={showAllDrivers}
                    onToggle={() => setShowAllDrivers((s) => !s)}
                  />
                </>
              ) : (
                <EvidenceGate testId="v7-evidence-drivers-gate">{E.driversGate}</EvidenceGate>
              )}
            </div>
          )}

          {view === 'flipRisks' && (
            <div className="space-y-1.5" data-testid="v7-evidence-flip-risks">
              {hasFlipRisks ? (
                <>
                  <EvidenceNote>{E.flipRisksNote(evidence.designationsWithheld)}</EvidenceNote>
                  {evidence.flipRisks.map((r, i) => {
                    const canFocus = Boolean(r.fromId && onFocusNode)
                    const body = (
                      <>
                        <span className={`${typography.panelBody} flex min-w-0 items-center gap-1.5 text-left text-text-body`}>
                          <AlertTriangle aria-hidden="true" className="h-3 w-3 flex-none text-warning" />
                          <span className="min-w-0 truncate">
                            {r.fromLabel} → {r.toLabel}
                          </span>
                        </span>
                        {r.switchProbability != null && (
                          <span className={`${typography.panelMeta} whitespace-nowrap text-right text-text-light`}>
                            {E.flipSwitchMeta(formatPercent(r.switchProbability, { fromDecimal: true }))}
                          </span>
                        )}
                      </>
                    )
                    const grid = 'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2'
                    return canFocus ? (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onFocusNode?.(r.fromId as string)}
                        className={`${grid} rounded py-0.5 text-left transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                      >
                        {body}
                      </button>
                    ) : (
                      <div key={i} className={`${grid} py-0.5`}>
                        {body}
                      </div>
                    )
                  })}
                </>
              ) : (
                <EvidenceGate testId="v7-evidence-flip-risks-gate">{E.flipRisksGate}</EvidenceGate>
              )}
            </div>
          )}

          {view === 'tradeOffs' && (
            <div className="space-y-1.5" data-testid="v7-evidence-trade-offs">
              {hasTradeOffs ? (
                <>
                  <EvidenceNote>{E.tradeOffsNote(evidence.designationsWithheld)}</EvidenceNote>
                  {evidence.tradeOffs.map((t, i) => (
                    <div key={`${t.factorId}-${i}`} className="flex items-start gap-1.5">
                      <GitBranch aria-hidden="true" className="mt-0.5 h-3 w-3 flex-none text-info" />
                      <p className={`${typography.panelBody} text-text-body`}>
                        {E.tradeOffSplit(
                          t.factorLabel,
                          `${formatRangeValue(t.splitValue)}${t.splitUnit ? ` ${t.splitUnit}` : ''}`,
                          t.highWinnerLabel,
                          t.lowWinnerLabel,
                        )}
                      </p>
                    </div>
                  ))}
                </>
              ) : (
                <EvidenceGate testId="v7-evidence-trade-offs-gate">{E.tradeOffsGate}</EvidenceGate>
              )}
            </div>
          )}

          {/*
            Resolve next (V7-C slice 1, ROADMAP 2.141).

            RANKING ONLY. Rows arrive from `voi/voiRanking.ts` already
            label-resolved, validated, split by producer status and in PRODUCER
            WIRE ORDER — this block maps them and adds nothing. No sort, no
            filter, no re-group: a view that "fixes" the order is a view that
            can invert it, and the order is the only thing the surface shows.

            The ranks are an ORDERED LIST rather than narrated numerals, so the
            rendering carries the ordinal structurally and the view's rendered
            text carries no digit in any CLAIM it makes — only the shared
            "Show N more" clamp counter, which is pinned exactly. That is not
            cosmetic: `evppi` is in
            the decision's OUTCOME units with no licensed display, so the
            safest surface is one with no numeric text to mis-read.
          */}
          {view === 'resolveNext' && (
            <div className="space-y-1.5" data-testid="v7-evidence-resolve-next">
              {resolveNext ? (
                <>
                  <EvidenceNote>{E.resolveNextNote}</EvidenceNote>
                  {/*
                    ⭐ L51 — THE ARRIVED-AND-ALL-SUB-RESOLUTION EMPTY STATE.

                    WHY THIS CONDITION IS THE HONEST ONE, EXACTLY. We are inside
                    the `resolveNext != null` branch, and `buildVoiRanking`
                    returns `null` for every case where the estimator did not
                    deliver usable rows — absent, null, empty, all-invalid,
                    all-unlabelable, unusable rank 1 (`voiRanking.ts:186,290,292`).
                    So reaching here at all means rows ARRIVED, validated and
                    label-resolved. `voiRanking.ts:292` then guarantees a
                    non-null ranking has at least one row in some band, so
                    `resolvedRows.length === 0` here means every surviving row is
                    below-resolution — the precise condition the sentence claims.

                    That is why the test is `resolvedRows.length === 0` and NOT
                    `belowResolution.length > 0`: the two are equivalent at this
                    point, and the former says what the sentence is about (there
                    is nothing to rank) rather than restating the band split.

                    THE BOUNDARY THIS MUST NOT CROSS. The sentence asserts the
                    analysis LOOKED. On absent/unusable VOI that assertion would
                    be fabricated, so those cases must keep the pre-existing
                    `resolveNextGate` in the `else` below and must never reach
                    here. Both directions are pinned in
                    `__tests__/V7EvidenceDisclosure.resolveNextAllBelowResolution.spec.tsx`
                    (§2 renders it, §3 proves absent/empty/invalid/unlabelable do
                    not, §4 proves a single resolved row does not).

                    It sits ABOVE the below-resolution line so the plain-language
                    outcome is read before the factor list that occasioned it.
                  */}
                  {resolvedRows.length === 0 && (
                    <p
                      className={`${typography.panelBody} text-text-body`}
                      data-testid="v7-resolve-next-none-above-resolution"
                    >
                      {E.resolveNextNoneAboveResolution}
                    </p>
                  )}
                  {resolvedRows.length > 0 && (
                    <ol className="ml-4 list-decimal space-y-1.5 marker:text-text-light">
                      {visibleResolveNext.map((r, i) => {
                        const canFocus = Boolean(r.canFocus && onFocusNode)
                        // Rank 1 leads; every later rank is a "then". The
                        // annotation is the design's licensed sentence carried
                        // as row meta (§2: "rank 1 gets the headline copy …
                        // ranks 2-3 listed beneath"). `visibleResolveNext` is
                        // always a PREFIX slice of `resolvedRows`, so the
                        // visible index is the producer rank — expanding the
                        // list cannot move the leader.
                        const isLead = i === 0
                        const body = (
                          <>
                            <span className={`${typography.panelBody} flex min-w-0 items-center gap-1.5 text-left text-text-body`}>
                              {canFocus && <Crosshair aria-hidden="true" className="h-3 w-3 flex-none text-info" />}
                              <span className="min-w-0 truncate">{r.label}</span>
                            </span>
                            <span
                              data-testid={isLead ? 'v7-resolve-next-lead' : 'v7-resolve-next-then'}
                              className={`${typography.panelMeta} whitespace-nowrap text-right text-text-light`}
                            >
                              {isLead ? E.resolveNextLead : E.resolveNextThen}
                            </span>
                          </>
                        )
                        const grid = 'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2'
                        return (
                          <li key={`${r.factorId}-${i}`} data-testid="v7-resolve-next-row">
                            {canFocus ? (
                              <button
                                type="button"
                                onClick={() => onFocusNode?.(r.factorId)}
                                className={`${grid} rounded py-0.5 text-left transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                              >
                                {body}
                              </button>
                            ) : (
                              <div className={`${grid} py-0.5`}>{body}</div>
                            )}
                          </li>
                        )
                      })}
                    </ol>
                  )}
                  <ClampToggle
                    testId="v7-resolve-next-toggle"
                    hiddenCount={resolveNextMoreCount}
                    expanded={showAllResolveNext}
                    onToggle={() => setShowAllResolveNext((s) => !s)}
                  />
                  {/* Demoted, never ranked. Below-resolution means
                      indistinguishable from noise AT THIS RUN'S RESOLUTION —
                      not zero value, and not "not worth resolving".

                      ⭐ L51 review: the COPY here is no longer the design's
                      "Below resolution on this run: …". It was reworded to the
                      plain class ("Not enough precision this run to rank: …")
                      because this line is behind NO expert affordance —
                      `expertMode` is never passed into `V7TopMatter`, so it
                      never reaches this component and every user who opens the
                      accordion on an all-below run reads it.

                      THE DOCTRINE ABOVE IS UNCHANGED and still constrains the
                      wording: the shortfall is attributed to THIS RUN'S
                      precision, never to the factors' worth. Any future
                      rewording that implies "no value" or "not worth
                      resolving" breaks it, whatever it does to the prose. */}
                  {resolveNext.belowResolution.length > 0 && (
                    <p
                      className={`${typography.panelMeta} text-text-light`}
                      data-testid="v7-resolve-next-below"
                    >
                      {E.resolveNextBelow(resolveNext.belowResolution.map((r) => r.label).join(', '))}
                    </p>
                  )}
                  {/* Disclosed without naming which factors: the producer's id
                      lists are dropped at the PLoT hop, and an id-shaped name
                      is banned regardless. */}
                  {resolveNext.someFactorsUnassessed && (
                    <p
                      className={`${typography.panelMeta} flex items-start gap-1.5 text-text-light`}
                      data-testid="v7-resolve-next-partial"
                    >
                      <Info aria-hidden="true" className="mt-0.5 h-3 w-3 flex-none" />
                      <span>{E.resolveNextPartial}</span>
                    </p>
                  )}
                </>
              ) : (
                <EvidenceGate testId="v7-evidence-resolve-next-gate">{E.resolveNextGate}</EvidenceGate>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default V7EvidenceDisclosure
