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
 *     and have no licensed rendering, so the view renders no digit at all —
 *     the ranking is carried structurally by an ordered list. An absent or
 *     unusable block renders the honest gate; it never falls back to the
 *     retired `gap.voi` heuristic this view exists to replace.
 *
 * Each tab renders its live rows or an honest gate — never a fabricated list.
 * Tabs use aria-pressed toggle buttons (not role=tab): the disclosure body is
 * not a full WAI-ARIA tablist and must not promise roving-tabindex it does not
 * implement (same rationale as the live HeroEvidenceDisclosure).
 *
 * PASSTHROUGH only, reads existing store fields, invents no numbers, ships
 * flagless. COMPLETE borders only (L1 guard).
 */

import { useMemo, useState } from 'react'
import { ChevronDown, AlertTriangle, Crosshair, GitBranch, Info } from 'lucide-react'
import { typography } from '@/styles/typography'
import { formatPercent } from '@/utils/formatPercent'
import { formatRangeValue } from '../utils/formatRangeValue'
import type { V7EvidenceModel } from './buildV7Lenses'
import { V7_LENS_COPY } from './v7LensCopy'
import { useAnalysisProjection } from '@/canvas/highlighting/useAnalysisProjection'

const E = V7_LENS_COPY.evidence
const VISIBLE_DRIVERS = 3
/** Same clamp as Drivers — one number, one meaning, across the disclosure. */
const VISIBLE_RESOLVE_NEXT = 3

type EvidenceView = 'drivers' | 'flipRisks' | 'tradeOffs' | 'resolveNext'

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

  const views: Array<{ key: EvidenceView; label: string }> = [
    { key: 'drivers', label: E.driversTab },
    { key: 'flipRisks', label: E.flipRisksTab },
    { key: 'tradeOffs', label: E.tradeOffsTab },
    { key: 'resolveNext', label: E.resolveNextTab },
  ]

  const visibleDrivers = showAllDrivers ? evidence.drivers : evidence.drivers.slice(0, VISIBLE_DRIVERS)
  const moreCount = evidence.drivers.length - VISIBLE_DRIVERS

  const resolveNext = evidence.resolveNext
  const resolvedRows = resolveNext?.resolved ?? []
  const visibleResolveNext = showAllResolveNext
    ? resolvedRows
    : resolvedRows.slice(0, VISIBLE_RESOLVE_NEXT)
  const resolveNextMoreCount = resolvedRows.length - VISIBLE_RESOLVE_NEXT

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
            {views.map((v) => (
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
                  {moreCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllDrivers((s) => !s)}
                      data-testid="v7-drivers-toggle"
                      className={`${typography.panelMeta} text-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                    >
                      {showAllDrivers ? E.showFewer : E.seeMore(moreCount)}
                    </button>
                  )}
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
            text contains no digit at all. That is not cosmetic: `evppi` is in
            the decision's OUTCOME units with no licensed display, so the
            safest surface is one with no numeric text to mis-read.
          */}
          {view === 'resolveNext' && (
            <div className="space-y-1.5" data-testid="v7-evidence-resolve-next">
              {resolveNext ? (
                <>
                  <EvidenceNote>{E.resolveNextNote}</EvidenceNote>
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
                  {resolveNextMoreCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllResolveNext((s) => !s)}
                      data-testid="v7-resolve-next-toggle"
                      className={`${typography.panelMeta} text-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                    >
                      {showAllResolveNext ? E.showFewer : E.seeMore(resolveNextMoreCount)}
                    </button>
                  )}
                  {/* Demoted, never ranked. Below-resolution means
                      indistinguishable from noise AT THIS RUN'S RESOLUTION —
                      not zero value, and not "not worth resolving". */}
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
