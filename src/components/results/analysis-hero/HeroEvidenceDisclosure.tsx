/**
 * HeroEvidenceDisclosure — §6.6's one expandable evidence section:
 * "Why and what could change it", hosting three views.
 *
 * Toggle anatomy (prototype §3): a full-width row button — bold title
 * stacked over the 'Drivers, flip risks and trade-offs' subtitle, grow
 * spacer, trailing chevron rotating 180° when open (reduced-motion safe),
 * row hover background.
 *
 * - Drivers: producer rank order, top three with See all factors/Show
 *   fewer; rows carry the +/- direction sign (producer direction, omitted
 *   when absent) and a 6px influence magnitude bar (the SAME displayed
 *   metric DriversSection renders — UI-SEM-080 layout mapping); rows focus
 *   the factor on canvas when a target exists. Evidence-quality wording is
 *   deliberately absent live (no display-safe producer contract — same
 *   class as the hidden DriversSection quality hint); the slot returns
 *   with the producer signal.
 * - Flip risks: plain-language consequences pre-built by buildHeroModel
 *   from producer flipThresholds (user units, named alternative winner,
 *   no normalised internals), with the producer switch probability as the
 *   row meta ('48% switch') and magnitude bar where the fragile-edge join
 *   found one.
 * - Trade-offs: renders ONLY when the model carries a producer/reviewed
 *   narrative (null live — the UI must not invent trade-offs), so the
 *   tab is fixture-gallery-only today. Grid layout per prototype: a 2×2
 *   grid of bordered cells (de-emphasised label over value).
 * - Resolve next: ISL's per-factor EVPPI as a RANKING ONLY, plus the
 *   whole-decision line. See the block comment at the view itself.
 *
 * DATA is presentational: every value rendered here arrives on `evidence`, and
 * focus is the container's callback. The component does hold TWO non-display
 * seams, both re-homed here from the retired `V7EvidenceDisclosure` because
 * both are functions of THIS component's open/view state and of nothing else:
 * the analysis-graph projection (`useAnalysisProjection`) and the
 * `evidence_view_opened` measurement. Neither reads data for rendering; the
 * header line above used to say "no store access" and would now be false.
 */
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Crosshair, Info } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { HERO_COPY } from './heroCopy'
import { RESOLVE_NEXT_COPY as R } from '../voi/resolveNextCopy'
import type { HeroEvidenceModel } from './heroTypes'
import { useAnalysisProjection } from '../../../canvas/highlighting/useAnalysisProjection'
import { useCanvasStore } from '../../../canvas/store'
import { trackMeasurement } from '../../../telemetry/measurementEvents'

const VISIBLE_DRIVERS = 3

type EvidenceView = 'drivers' | 'flipRisks' | 'tradeOffs' | 'resolveNext'

export interface HeroEvidenceDisclosureProps {
  evidence: HeroEvidenceModel
  onFocusTarget?: (targetId: string) => void
  /**
   * The ACT step. Takes the user to where this factor's value can be reviewed and
   * replaced with their own judgement.
   *
   * ⚠ A SEPARATE PROMISE FROM `onFocusTarget`, deliberately. The crosshair focuses
   * the canvas, which is honest and is kept. This estate has already ruled
   * (`focusOnCanvasCopy.ts`) that a control labelled "Edit" wired to the
   * camera-focus handler was a FALSE PROMISE — the two must not be conflated.
   */
  onReviewValue?: (factorId: string) => void
}

/**
 * UI-SEM-080 (layout half): magnitude-bar width from an existing 0-1
 * producer-backed fraction (displayed influence / switch probability),
 * clamped to [0, 100]%. Layout only — the percentage is never displayed as
 * data, never described semantically, and never fed back into selection.
 */
function barPct(fraction: number): number {
  return Math.max(0, Math.min(100, fraction * 100))
}

/** 6px magnitude bar (prototype .evidence-bar): border-default track, info fill. */
function MagnitudeBar({ fraction, testId }: { fraction: number; testId: string }) {
  return (
    <span
      aria-hidden="true"
      data-testid={testId}
      className="block h-1.5 w-full overflow-hidden rounded-full bg-panel-border"
    >
      <span
        className="block h-full rounded-full bg-info"
        style={{ width: `${barPct(fraction)}%` }}
      />
    </span>
  )
}

export function HeroEvidenceDisclosure({
  evidence,
  onFocusTarget,
  onReviewValue,
}: HeroEvidenceDisclosureProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<EvidenceView>('drivers')
  const [showAllDrivers, setShowAllDrivers] = useState(false)

  const hasDrivers = evidence.drivers.length > 0
  const hasFlipRisks = evidence.flipRisks.length > 0
  const hasTradeOffs = evidence.tradeOffs != null && evidence.tradeOffs.length > 0
  /**
   * `resolveNext === null` is the honest-gate verdict, already decided by the one
   * authority (`voi/voiRanking.ts`) and never re-derived here.
   *
   * ⚠ IT JOINS THE GUARD BELOW ON PURPOSE. A ranking alone is enough to
   * disclose: leaving it out would render NOTHING on a run whose only evidence is
   * the ranking, which is exactly the silent-capability failure this promotion
   * exists to end. (The same reasoning is recorded at `V7EvidenceDisclosure.tsx`
   * for the other host.)
   */
  const hasResolveNext = evidence.resolveNext != null

  const views = (
    [
      { key: 'drivers', label: HERO_COPY.evidence.driversTab, present: hasDrivers },
      { key: 'flipRisks', label: HERO_COPY.evidence.flipRisksTab, present: hasFlipRisks },
      { key: 'tradeOffs', label: HERO_COPY.evidence.tradeOffsTab, present: hasTradeOffs },
      // Last in the strip, and NOT the default view: Drivers remains the primary
      // explanation of the result. Promoting this ONE STEP — from a secondary
      // tab's collapsed disclosure to the DEFAULT tab's collapsed disclosure — is
      // Paul's 14-Aug ruling; demoting Drivers was not part of it.
      { key: 'resolveNext', label: R.tab, present: hasResolveNext },
    ] satisfies Array<{ key: EvidenceView; label: string; present: boolean }>
  ).filter((v) => v.present)
  /**
   * ⚠ HOISTED ABOVE THE NOTHING-TO-DISCLOSE RETURN so the two effects below can
   * be unconditional (hook order must not depend on the model). `views[0]` is
   * guaranteed present BELOW that return; above it, a run with nothing to
   * disclose genuinely has no active view, and `null` is what says so — it must
   * NOT collapse to 'drivers', which would make the projection mark driver
   * nodes for a disclosure that never rendered.
   */
  const activeView: EvidenceView | null = views.some((v) => v.key === view)
    ? view
    : views[0]?.key ?? null

  // ── Analysis-graph projection (P3 UI agency) ───────────────────────────────
  //
  // RE-HOMED FROM `V7EvidenceDisclosure`, which was the hook's ONLY caller in
  // the repo — with it deleted, the marking code in BaseNode/StyledEdge was
  // permanently inert. Consumption is unchanged from that host: while this
  // disclosure is OPEN on Flip risks or Drivers, the resolvable canvas elements
  // the view is about are marked; closing it, or switching to any other view,
  // clears the marks (the hook's own cleanup does that, and it also clears on
  // unmount).
  //
  // ⚠ UNCONDITIONAL, and deliberately ABOVE the nothing-to-disclose return, so
  // that hook order is stable AND so it still CLEARS when there is nothing to
  // show — exactly as it sat in the retired host.
  const projectionActive: 'flip_risks' | 'drivers' | null =
    !open ? null : activeView === 'flipRisks' ? 'flip_risks' : activeView === 'drivers' ? 'drivers' : null
  const driverFocusIds = useMemo(
    // `targetId` is `string | null` on this host and `focusId?: string` on the
    // retired one; the resolver's input type is `(string | undefined)[]` and it
    // drops falsy ids either way. Normalised here rather than widening the
    // resolver, so the honesty rule stays where it is enforced.
    () => evidence.drivers.map((d) => d.targetId ?? undefined),
    [evidence.drivers],
  )
  useAnalysisProjection({
    active: projectionActive,
    flipRisks: evidence.fragileEdgeRefs,
    driverFocusIds,
  })

  // ── evidence_view_opened (ROADMAP 1.68) ────────────────────────────────────
  //
  // RE-HOMED FROM `V7EvidenceDisclosure`, which was the ONLY emitter of this
  // event in the repo — `measurementEvents.ts` calls it "the highest-value
  // single site in this taxonomy", and between that component's deletion and
  // this line it had zero emitters while its schema stayed declared.
  //
  // WHY THIS SITE. It captures what the product TOLD the user, at the moment it
  // told them — and for the resolve-next ranking that is the only moment at
  // which it is the truth. The ranking is recomputed every run, so reading it
  // back afterwards answers a different question from the one the user saw.
  //
  // ON TRANSITION, NOT ON RENDER. The deps are exactly [open, activeView], so
  // React fires it when the disclosure OPENS and when the view CHANGES, and not
  // on any other re-render. Closing and reopening on the same view does
  // re-emit — that is a new opening, and counting it as one is the point.
  //
  // ⚠ KEYED ON `activeView`, NOT the raw `view` state, and that is the one
  // faithful-port divergence: this host FILTERS its chips by presence, so the
  // view a user is looking at is the resolved one. Reporting `view` would name
  // a view that was never rendered.
  //
  // NEVER-CAPTURE: ids and counts only. `r.label` and `d.label` are rendered a
  // few lines from here and are user/model-authored text — the payload takes
  // `factorId`, never `label`. See measurementEvents.ts.
  const resolveNextForEvent = evidence.resolveNext
  useEffect(() => {
    if (!open || activeView == null) return
    const state = useCanvasStore.getState()
    const isResolveNext = activeView === 'resolveNext'
    const ranked = resolveNextForEvent?.resolved ?? []
    trackMeasurement('evidence_view_opened', {
      view: activeView,
      scenario_id: state.currentScenarioId ?? null,
      gated:
        activeView === 'drivers' ? evidence.drivers.length === 0
        : activeView === 'flipRisks' ? evidence.flipRisks.length === 0
        : activeView === 'tradeOffs' ? (evidence.tradeOffs?.length ?? 0) === 0
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
  }, [open, activeView])

  if (!hasDrivers && !hasFlipRisks && !hasTradeOffs && !hasResolveNext) return null

  const visibleDrivers = showAllDrivers
    ? evidence.drivers
    : evidence.drivers.slice(0, VISIBLE_DRIVERS)

  /** Driver row body: sign + label, then the magnitude bar. */
  const driverRowBody = (d: HeroEvidenceModel['drivers'][number]) => (
    <>
      <span className={`${typography.panelBody} flex min-w-0 items-center gap-1.5 text-text-body`}>
        {onFocusTarget && d.targetId != null && (
          <Crosshair aria-hidden="true" className="h-3 w-3 flex-none text-info" />
        )}
        {d.direction != null && (
          // DS v5 §2.4: `<strong>` carries the emphasis semantically instead of a
          // raw weight utility, matching the pattern already used for inline
          // emphasis inside panel text (TriageActionCardsBody). The glyph is
          // aria-hidden and the direction is also stated in the sr-only span
          // below, so the weight is a visual cue only.
          <strong
            data-testid="hero-driver-sign"
            aria-hidden="true"
            className={d.direction === 'positive' ? 'text-success' : 'text-danger'}
          >
            {d.direction === 'positive' ? '+' : '-'}
          </strong>
        )}
        <span className="min-w-0 truncate text-left">{d.label}</span>
        {/* Direction perceivable without the sign glyph/colour. */}
        {d.direction != null && (
          <span className="sr-only">
            ({d.direction === 'positive' ? 'increases the outcome' : 'decreases the outcome'})
          </span>
        )}
        {/*
          ⭐ THE `est.` PROVENANCE TAG — ported from the retired V7 disclosure,
          same wording, same treatment (a bordered pill after the label).

          It renders on `'estimated'` ONLY. `'not_estimated'` and
          `'undetermined'` both render nothing, and they are NOT the same
          statement: the first is a producer denial, the second is producer
          silence. Neither licenses a POSITIVE marker, so neither gets one —
          but the model keeps them apart so that a surface which one day wants
          to say "you gave us this" cannot say it on silence. See
          `HeroDriverValueProvenance`.
        */}
        {d.isEstimate === 'estimated' && (
          <span
            data-testid="hero-driver-est"
            aria-label={HERO_COPY.evidence.estimateTagAria}
            className={`${typography.panelMeta} flex-none rounded-full border border-panel-border bg-transparent px-1.5 py-0 text-text-light`}
          >
            {HERO_COPY.evidence.estimateTag}
          </span>
        )}
      </span>
      {d.influence != null ? (
        <MagnitudeBar fraction={d.influence} testId="hero-driver-bar" />
      ) : (
        <span />
      )}
    </>
  )

  /** Flip row body: consequence sentence, bar, switch meta. */
  const flipRowBody = (r: HeroEvidenceModel['flipRisks'][number]) => (
    <>
      <span className={`${typography.panelBody} flex min-w-0 items-start gap-1.5 text-left text-text-body`}>
        {onFocusTarget && r.targetId != null && (
          <Crosshair aria-hidden="true" className="mt-0.5 h-3 w-3 flex-none text-info" />
        )}
        <span className="min-w-0">{r.text}</span>
      </span>
      {r.magnitude != null ? (
        <MagnitudeBar fraction={r.magnitude} testId="hero-flip-bar" />
      ) : (
        <span />
      )}
      {r.switchMeta != null ? (
        <span
          data-testid="hero-flip-switch-meta"
          className={`${typography.panelMeta} whitespace-nowrap text-right text-text-light`}
        >
          {r.switchMeta}
        </span>
      ) : (
        <span />
      )}
    </>
  )

  return (
    <div className="border-t border-panel-border pt-1" data-testid="hero-evidence-disclosure">
      {/* Full-width toggle row (prototype §3): stacked title + subtitle,
          spacer, trailing chevron rotating 180° when open. */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded px-1 py-1.5 text-left transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
      >
        <span className="min-w-0 flex-1">
          <span className={`${typography.panelHeader} block text-text-header`}>
            {HERO_COPY.evidence.heading}
          </span>
          <span className={`${typography.panelMeta} block text-text-light`}>
            {HERO_COPY.evidence.subtitle}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 flex-none text-text-light transition-transform motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {/* Plain toggle buttons, NOT role=tab: the ARIA tabs pattern
              promises arrow-key/roving-tabindex behaviour (HeroLensTabs
              implements it fully); claiming the role without the keyboard
              model would mislead AT users. Selected state uses the
              HeroLensTabs treatment (bg-primary), not a filled pill. */}
          {views.length > 1 && (
            <div className="flex gap-1">
              {views.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  aria-pressed={activeView === v.key}
                  onClick={() => setView(v.key)}
                  // Identity handle for the chips. Added with Resolve next
                  // because a test that reaches a view by its LABEL binds to
                  // copy, and the mount-path assertion this promotion needs has
                  // to bind to the view itself (CLAUDE.md trap 19).
                  data-testid={`hero-evidence-tab-${v.key}`}
                  className={`px-2 py-0.5 rounded-full ${typography.panelMeta} ${
                    activeView === v.key
                      ? 'bg-primary text-text-on-color'
                      : 'border border-panel-border bg-transparent text-text-light hover:border-info/30 hover:text-text-body'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}

          {activeView === 'drivers' && (
            <div className="space-y-1.5" data-testid="hero-evidence-drivers">
              <p className={`${typography.panelMeta} text-text-light`}>
                {HERO_COPY.evidence.driversNote}
              </p>
              {/*
                THE WITHHELD PER-FACTOR ANSWER, SAID OUT LOUD.

                The list below is ranked by effect on the ANALYSED OUTCOME.
                ISL separately computes each factor's effect on an option's
                CHANCE OF COMING OUT AHEAD (`p_win_sensitivity`) and, under
                active correlation, SUPPRESSES it — "absent from the response,
                not null" — naming what it withheld in
                `correlation_model.suppressed_attributions` — an ATTRIBUTION-KIND
                manifest, not a list of factors. Both keys have been CARRIED by
                the mapper since the VOI family landed and read by nothing.

                ⚠ SCOPE, STATED HONESTLY: this is a FAIL-CLOSED GUARD, not the
                repair of a defect a user has seen. `correlation_model` is
                emitted only when the request supplied `factor_correlations`,
                and no code path in CEE or the UI populates that key — so the
                chain is complete but UNFED at the current tips. The notice is
                here so that the day a caller does supply correlations, the
                withholding is said out loud instead of arriving silently.

                IT SITS DIRECTLY UNDER `driversNote` BY DESIGN. That note is
                what tells the reader what the ranking IS; this is what tells
                them which per-factor question it does NOT answer. Separating
                them would leave the caveat below a list the reader has already
                finished interpreting.

                WHAT DECIDES IT lives in `voi/attributionSuppression.ts`; the
                sentence and its licence live in `heroCopy.ts`. Nothing is
                decided here: this block renders ONE ratified string on ONE
                member of a closed two-member enum, and `not_attested` renders
                nothing at all rather than a placeholder — because an
                unreadable disclosure is not a withholding claim.

                NO MAGNITUDE, and not by restraint: the producer's own contract
                text says "pp display is barred by PP_TOKEN doctrine". No value
                from the suppressed payload is in scope at this site.
              */}
              {evidence.attributionSuppression === 'suppressed' && (
                <p
                  className={`${typography.panelMeta} flex items-start gap-1.5 text-text-light`}
                  data-testid="hero-evidence-attribution-suppressed"
                >
                  <Info aria-hidden="true" className="mt-0.5 h-3 w-3 flex-none text-info" />
                  <span>{HERO_COPY.evidence.attributionSuppressed}</span>
                </p>
              )}
              {visibleDrivers.map((d) => {
                const key = `driver-${d.rank}-${d.label}`
                const grid = 'grid w-full grid-cols-[minmax(0,1fr)_5rem] items-center gap-2'
                return d.targetId != null && onFocusTarget ? (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onFocusTarget(d.targetId!)}
                    className={`${grid} rounded py-0.5 transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                  >
                    {driverRowBody(d)}
                  </button>
                ) : (
                  <div key={key} className={`${grid} py-0.5`}>
                    {driverRowBody(d)}
                  </div>
                )
              })}
              {evidence.drivers.length > VISIBLE_DRIVERS && (
                <button
                  type="button"
                  onClick={() => setShowAllDrivers((s) => !s)}
                  className={`${typography.panelMeta} text-text-light hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                >
                  {showAllDrivers
                    ? HERO_COPY.evidence.showFewer
                    : HERO_COPY.evidence.seeAllFactors}
                </button>
              )}
            </div>
          )}

          {activeView === 'flipRisks' && (
            <div className="space-y-1.5" data-testid="hero-evidence-flip-risks">
              <p className={`${typography.panelMeta} text-text-light`}>
                {HERO_COPY.evidence.flipRisksNote(evidence.designationsWithheld)}
              </p>
              {evidence.flipRisks.map((r, i) => {
                const key = `flip-${i}`
                const grid =
                  'grid w-full grid-cols-[minmax(0,1fr)_4rem_auto] items-center gap-2'
                return r.targetId != null && onFocusTarget ? (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onFocusTarget(r.targetId!)}
                    className={`${grid} rounded py-0.5 text-left transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                  >
                    {flipRowBody(r)}
                  </button>
                ) : (
                  <div key={key} className={`${grid} py-0.5`}>
                    {flipRowBody(r)}
                  </div>
                )
              })}
            </div>
          )}

          {/*
            ── Resolve next (V7-C slice 1 + slice 2a) ────────────────────────

            PROMOTED TO THIS HOST by Paul's ruling of 14 Aug 2026. The ranking
            itself is unchanged from the Alt-view rendering: rows arrive from
            `voi/voiRanking.ts` already label-resolved, validated, split by
            producer status and in PRODUCER WIRE ORDER, and this block maps them
            and adds nothing. No sort, no filter, no re-group — a view that
            "fixes" the order is a view that can invert it, and the order is the
            only thing the surface shows.

            NO DIGIT IN ANY CLAIM. `evppi` and `decision_evpi` are in the
            decision's OUTCOME units with no licensed display (and the UI's own
            unit story is a heuristic that guesses from `goalThresholdCap`), so
            the ranking is carried STRUCTURALLY by an ordered list rather than by
            narrated numerals. Unlike the Alt-view host this view has no row
            clamp, so there is no "Show N more" counter and the no-digit property
            holds over the WHOLE view with no carve-out.
          */}
          {/*
            ⚠ NO HONEST-GATE BRANCH ON THIS HOST, AND THAT IS A DELIBERATE
            DIVERGENCE FROM THE ALT-VIEW RENDERING — measured, not assumed.

            The Alt-view host renders all four chips unconditionally, so a null
            ranking there reaches a "wasn't produced for this run" gate. This host
            FILTERS its chips by presence, and its own convention is pinned:
            "never shows a Trade-offs tab when the producer narrative is absent"
            (`__tests__/content.spec.tsx`). So `hasResolveNext === false` removes
            the chip, and a gate branch here would be UNREACHABLE DEAD CODE with a
            test that could only ever pass by never exercising it — which is worse
            than no branch, because it reads as coverage.

            The resulting behaviour is honest silence: on a run with no usable
            value-of-information the surface makes NO claim rather than offering a
            chip that leads only to a dead end. Pinned in §2.2 of
            `HeroEvidenceDisclosure.resolveNextOnAnalysisTab.spec.tsx`.

            The `!= null` below is therefore a TYPE NARROWING, not an alternative
            rendering: `activeView === 'resolveNext'` already implies the chip
            exists, but the compiler cannot see it through the `views` filter.
          */}
          {activeView === 'resolveNext' && evidence.resolveNext != null && (
            <div className="space-y-1.5" data-testid="hero-evidence-resolve-next">
              {(
                <>
                  <p className={`${typography.panelMeta} text-text-light`}>{R.note}</p>

                  {/*
                    ⭐ L51 — THE ARRIVED-AND-ALL-SUB-RESOLUTION EMPTY STATE.

                    We are inside `resolveNext != null`, and `buildVoiRanking`
                    returns null for EVERY case where the estimator delivered no
                    usable rows (absent, null, empty, all-invalid,
                    all-unlabelable, unusable rank 1). So reaching here means rows
                    ARRIVED, validated and label-resolved — and a non-null ranking
                    is guaranteed at least one row in some band, so
                    `resolved.length === 0` here means every surviving row is
                    below-resolution: exactly what the sentence claims.

                    THE BOUNDARY IT MUST NOT CROSS: the sentence asserts the
                    analysis LOOKED. On an absent/unusable block that assertion
                    would be fabricated, which is why those cases keep the honest
                    gate in the `else` below and must never reach here.
                  */}
                  {evidence.resolveNext.resolved.length === 0 && (
                    <p
                      className={`${typography.panelBody} text-text-body`}
                      data-testid="hero-resolve-next-none-above-resolution"
                    >
                      {R.noneAboveResolution}
                    </p>
                  )}

                  {/*
                    ⭐⭐ SLICE 2a — THE DECISION-LEVEL LINE. The point of the lane.

                    WHY IT IS GATED EXACTLY HERE. It renders only in the
                    all-below-resolution state, beneath the L51 sentence, because
                    that is the state where today's copy is most likely to be
                    MISREAD: "nothing stands out to resolve yet" reads as "the
                    analysis looked and there is nothing more to learn". On 5 of 5
                    live payloads captured in this repo that sentence was the ONLY
                    thing on screen while `decision_evpi` had come back NON-ZERO.
                    The two facts are complementary, not competing — this line
                    adds the other measurement and never softens the first.

                    ⚠ IT DOES NOT RENDER ON THE GATE STATE (`resolveNext == null`,
                    the `else` below). `decision_evpi` may well have arrived there,
                    but stating a whole-decision fact beside a line saying no
                    ranking was produced would imply an assessment that never
                    happened. One honest site first; the gate-state disclosure is
                    a rowed follow-on, not an oversight.

                    ⚠ AND IT DOES NOT RENDER ON A RANKED RUN. There the ranking IS
                    the answer, and the interesting question ("does resolving rank
                    1 get most of the way there") is a RATIO of the two estimates
                    — dimensionless and cap-bounded to [0,1], but with hand-tuned
                    cut points. That needs a Paul threshold ruling and is rowed.

                    WHAT THE VERDICT CAN AND CANNOT SAY lives in
                    `voi/decisionVoi.ts`; the sentences and their licences live in
                    `voi/resolveNextCopy.ts`. Nothing is decided here: this block
                    picks one of two ratified strings from a closed enum, and
                    `not_computed` renders nothing at all rather than a placeholder
                    — because the contract's own absence rule says absence means
                    NOT COMPUTED, never zero.
                  */}
                  {evidence.resolveNext.resolved.length === 0 &&
                    evidence.decisionVoi !== 'not_computed' && (
                      <p
                        className={`${typography.panelBody} flex items-start gap-1.5 text-text-body`}
                        data-testid="hero-resolve-next-decision-level"
                      >
                        <Info aria-hidden="true" className="mt-0.5 h-3 w-3 flex-none text-info" />
                        <span>
                          {evidence.decisionVoi === 'measured_zero'
                            ? R.decisionZero
                            : R.decisionNotZero}
                        </span>
                      </p>
                    )}

                  {evidence.resolveNext.resolved.length > 0 && (
                    <ol className="ml-4 list-decimal space-y-1.5 marker:text-text-light">
                      {evidence.resolveNext.resolved.map((r, i) => {
                        const canFocus = Boolean(r.canFocus && onFocusTarget)
                        // Rank 1 leads; every later rank is a "then". The rows are
                        // rendered in full (no clamp on this host), so the visible
                        // index IS the producer rank by construction.
                        const isLead = i === 0
                        const body = (
                          <>
                            <span className={`${typography.panelBody} flex min-w-0 items-center gap-1.5 text-left text-text-body`}>
                              {canFocus && (
                                <Crosshair aria-hidden="true" className="h-3 w-3 flex-none text-info" />
                              )}
                              <span className="min-w-0 truncate">{r.label}</span>
                            </span>
                            <span
                              data-testid={isLead ? 'hero-resolve-next-lead' : 'hero-resolve-next-then'}
                              className={`${typography.panelMeta} whitespace-nowrap text-right text-text-light`}
                            >
                              {isLead ? R.lead : R.then}
                            </span>
                          </>
                        )
                        const grid =
                          'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2'
                        // ⚠ THE ACT STEP, AND WHAT ITS WORDS MAY CLAIM.
                        //
                        // Gated on `canReviewValue`, never on `canFocus`: a node
                        // can exist and have no editor, and the Model tab renders
                        // an inert "Not set" for exactly those. An unset factor
                        // ALSO makes the rerun refuse, so such a row cannot
                        // complete the loop even if it could be edited.
                        //
                        // "Review this value" is provenance-NEUTRAL on purpose.
                        // These rows are ranked by VALUE OF INFORMATION, not by
                        // defaultedness — the number may be one the USER set — so
                        // "review Olumi's estimate" would be false on exactly
                        // those rows.
                        //
                        // And it promises no consequence. The destination accepts
                        // input without checking plausibility, so nothing here may
                        // say Olumi validates the number or that entering one
                        // improves the analysis.
                        const canReview = Boolean(r.canReviewValue && onReviewValue)
                        return (
                          <li key={`${r.factorId}-${i}`} data-testid="hero-resolve-next-row">
                            <div className="flex min-w-0 items-center gap-1">
                              <div className="min-w-0 flex-1">
                                {canFocus ? (
                                  <button
                                    type="button"
                                    onClick={() => onFocusTarget?.(r.factorId)}
                                    className={`${grid} rounded py-0.5 text-left transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                                  >
                                    {body}
                                  </button>
                                ) : (
                                  <div className={`${grid} py-0.5`}>{body}</div>
                                )}
                              </div>
                              {canReview && (
                                <button
                                  type="button"
                                  onClick={() => onReviewValue?.(r.factorId)}
                                  data-testid="hero-resolve-next-review"
                                  className={`${typography.panelMeta} flex-none whitespace-nowrap rounded px-1.5 py-0.5 text-info transition-colors hover:bg-panel-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                                >
                                  Review this value
                                </button>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  )}

                  {/* Demoted, never ranked. Below-resolution means
                      indistinguishable from noise AT THIS RUN'S RESOLUTION — not
                      zero value, and not "not worth resolving". The wording
                      attributes the shortfall to THIS RUN'S precision, which is
                      the honest cause, and never to the factors' worth. */}
                  {evidence.resolveNext.belowResolution.length > 0 && (
                    <p
                      className={`${typography.panelMeta} text-text-light`}
                      data-testid="hero-resolve-next-below"
                    >
                      {R.below(evidence.resolveNext.belowResolution.map((r) => r.label).join(', '))}
                    </p>
                  )}

                  {/* Disclosed WITHOUT naming which factors: the producer's id
                      lists are dropped at the PLoT hop, and an id-shaped name is
                      banned regardless. */}
                  {evidence.resolveNext.someFactorsUnassessed && (
                    <p
                      className={`${typography.panelMeta} flex items-start gap-1.5 text-text-light`}
                      data-testid="hero-resolve-next-partial"
                    >
                      <Info aria-hidden="true" className="mt-0.5 h-3 w-3 flex-none" />
                      <span>{R.partial}</span>
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {activeView === 'tradeOffs' && evidence.tradeOffs && (
            <div className="space-y-2" data-testid="hero-evidence-trade-offs">
              {evidence.tradeOffs.map((t) => (
                <div key={t.option} className="space-y-1">
                  <p className={`${typography.panelHeader} text-text-header`}>
                    {t.option}
                  </p>
                  {/* Prototype .trade-grid: 2×2 bordered cells, de-emphasised
                      label over the value. */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        [HERO_COPY.evidence.tradeOffGain, t.gain],
                        [HERO_COPY.evidence.tradeOffGiveUp, t.giveUp],
                        [HERO_COPY.evidence.tradeOffDependsOn, t.dependsOn],
                        [HERO_COPY.evidence.tradeOffWatch, t.watch],
                      ] as const
                    ).map(([cellLabel, value]) => (
                      <div
                        key={cellLabel}
                        className="rounded-lg border border-panel-border p-1.5"
                      >
                        <p className={`${typography.panelMeta} text-text-light`}>{cellLabel}</p>
                        <p className={`${typography.panelBody} mt-0.5 text-text-body`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
