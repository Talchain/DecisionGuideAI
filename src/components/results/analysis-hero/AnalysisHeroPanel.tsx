/**
 * AnalysisHeroPanel — presentational, prop-driven, store-free for DATA.
 *
 * Renders the answer-first hero: headline + tension subline, lens tabs,
 * axis, option rows (disclosure detail), caption, quick-evidence pills, the
 * evidence disclosure, the footer strip (Main reason / Focus next) and the
 * Next-step route row. Also renders the curated non-chart states
 * (partial / failed / blocked / paused). Every number shown comes from the
 * model built by buildHeroModel — this component adds layout and copy
 * composition only.
 *
 * The ONE store import is `openAskOlumi` (paused-state resolution action —
 * an ACTION DISPATCH into the Ask-Olumi drawer, not a data read; the panel
 * still renders exclusively from its props).
 *
 * Lens switching and row disclosure are LOCAL render state: no fetch, no
 * analysis rerun, no selector recomputation, and the row DOM persists across
 * lens switches (values morph via transform/opacity in HeroOptionRow).
 *
 * Stale treatment (prototype v6, ratified guide): the hero renders NO stale
 * surface of its own — AnalysisFreshnessNotice (the adjacent strip) owns the
 * warning AND carries the one Rerun (Wave F-B; brief §5 one freshness owner,
 * §2.2 never repeat the same action across surfaces). The content stays
 * fully readable and interactive. The former footer Re-run pill (an
 * explicitly commented deviation from strict v6) is REMOVED — lane C1.
 *
 * Trust discipline: no trust/stability wording is rendered anywhere in this
 * panel — no producer-supplied display-safe label exists today (see
 * ROBUSTNESS-VERDICT-CONTRACT), so the trust line is omitted rather than
 * derived. Raw 0-1 stability/confidence floats are never displayed.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { Check, Crosshair, FlaskConical, Info, Target } from 'lucide-react'
import { typography } from '@/styles/typography'
import { openAskOlumi } from '../coaching/askOlumiStore'
import { HeroEvidenceDisclosure } from './HeroEvidenceDisclosure'
import { HERO_COPY } from './heroCopy'
import { HeroLensTabs, tabId } from './HeroLensTabs'
import { HeroOptionRow, HERO_ROW_GRID, HERO_ROW_TRACK_SPAN } from './HeroOptionRow'
import type { HeroChartModel, HeroLens, HeroStatusModel } from './heroTypes'

export interface AnalysisHeroPanelProps {
  model: HeroChartModel | HeroStatusModel
  /** Wave 2 (§6.5): canvas focus for quick links; absent = links inert-hidden. */
  onFocusTarget?: (targetId: string) => void
  /**
   * A rerun is in flight — disables the analysis-affecting target-apply
   * controls (committing a success target triggers a rerun). The hero
   * renders no rerun action of its own (C1: the freshness strip owns the
   * one Rerun).
   */
  rerunDisabled: boolean
  /**
   * @deprecated Legacy gate kept for older callers (the gallery passes it);
   * the live container now supplies `focusPanelSelector` instead. Ignored.
   */
  focusPanelMounted?: boolean
  /**
   * CSS selector of the coaching/Strengthen panel below (flag-aware, from
   * useAnalysisHero) — the scroll target for the Focus-next affordance and
   * the Next-step row's Open action. Null/absent = no scroll affordance is
   * ever rendered (the lines degrade to plain text — never a dead link).
   */
  focusPanelSelector?: string | null
  /**
   * Title of the TOP active Strengthen entry (priority order) — renders the
   * Next-step footer row mirroring the panel below. Null/absent hides the
   * row (the generic Focus-next line renders instead).
   */
  nextRecommendation?: string | null
  /**
   * Existing apply-target route (OutputsDock handleApplyThreshold: sets the
   * goal threshold and reruns — the same handler the Options Compare target
   * row used). When absent, the promoted Focus-next target line degrades to
   * plain text; the hero never invents an action route of its own.
   */
  onApplyTarget?: (value: number) => void
  /**
   * Opens the Define-success modal (owned by another lane at
   * src/components/results/modals/ — deliberately NOT imported here). When
   * absent the inline goal-lens CTA is hidden entirely — never a dead
   * control.
   */
  onDefineSuccess?: () => void
}

/**
 * House-style guard for PRODUCER-slot text (trust line, status chip, named
 * focus action): em/en dashes are swapped for a plain hyphen. Glyph swap
 * only — no words are added, removed or reordered, so the producer's
 * content passes through untouched. (The app-wide '—' missing-value
 * placeholder glyph is unaffected: it never flows through these slots.)
 */
function dashSafe(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ' - ')
}

/** Scroll to the coaching panel below; no-op when the target is absent. */
function scrollToPanel(selector: string) {
  const el = document.querySelector(selector)
  if (!el) return
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
}

function StatusState({ model }: { model: HeroStatusModel }) {
  return (
    <div data-testid={`hero-status-${model.variant}`} className="space-y-1.5">
      <h3 className={`${typography.panelHeader} text-text-header`}>{model.headline}</h3>
      <p className={`${typography.panelBody} text-text-light`}>{model.body}</p>
      {model.resolution && (
        <p data-testid="hero-paused-resolution" className={`${typography.panelBody} text-text-body`}>
          {model.resolution}
        </p>
      )}
      {/* §6.2 pause-read resolution route: opens the Ask-Olumi drawer with
          the contradiction (the model body, producer text) as context and an
          editable prefilled draft — routed, never auto-sent. The drawer is
          mounted by ResultsBody, so the live mount always backs this button. */}
      {model.variant === 'paused' && (
        <button
          type="button"
          data-testid="hero-paused-resolve"
          onClick={() =>
            openAskOlumi({
              context: model.body,
              draft: HERO_COPY.paused.draft,
              label: HERO_COPY.paused.askLabel,
            })
          }
          className={`${typography.panelMeta} inline-flex items-center rounded-full bg-primary px-3 py-1.5 font-semibold text-text-on-color transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
        >
          {HERO_COPY.paused.resolveButton}
        </button>
      )}
    </div>
  )
}

export function AnalysisHeroPanel({
  model,
  rerunDisabled,
  focusPanelSelector = null,
  nextRecommendation = null,
  onApplyTarget,
  onDefineSuccess,
  onFocusTarget,
}: AnalysisHeroPanelProps) {
  const panelId = useId()
  const [lensState, setLensState] = useState<HeroLens | null>(null)
  const [openRowId, setOpenRowId] = useState<string | null>(null)

  // Promoted success-target affordance (single-lens no-target runs only):
  // local edit state mirroring the retired SuccessTargetRow contract —
  // Enter/tick commits a raw user-unit number to the existing apply route,
  // Escape/blur reverts. No value is stored here beyond the draft text.
  const [targetEditing, setTargetEditing] = useState(false)
  const [targetDraft, setTargetDraft] = useState('')
  const targetInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (targetEditing) {
      targetInputRef.current?.focus()
      targetInputRef.current?.select()
    }
  }, [targetEditing])
  const commitTarget = () => {
    // STRICT parse (write-boundary gate): empty, partial or trailing-junk
    // input ("", "62abc", "e") must never reach the apply route — Number()
    // rejects anything that is not a complete numeric literal, and only a
    // finite value commits. Invalid input closes nothing and fires nothing.
    const trimmed = targetDraft.trim()
    const parsed = trimmed === '' ? NaN : Number(trimmed)
    if (!Number.isFinite(parsed)) return
    onApplyTarget?.(parsed)
    setTargetEditing(false)
  }

  // Goal-lens auto-switch (prototype: saving the success measure lands the
  // user on the newly available Goal fit view): when the model transitions
  // from no-user-target (showGoalHint true) to target-set (false) while
  // mounted, select the goal lens ONCE. showGoalHint is exactly the
  // no-user-target signal (buildHeroModel: true iff goalThreshold is null),
  // so this never fires for producer gaps on already-targeted runs.
  const chartShowGoalHint = model.kind === 'chart' ? model.showGoalHint : null
  const prevGoalHintRef = useRef<boolean | null>(null)
  useEffect(() => {
    const prev = prevGoalHintRef.current
    prevGoalHintRef.current = chartShowGoalHint
    if (prev === true && chartShowGoalHint === false) setLensState('goal')
  }, [chartShowGoalHint])

  // `focusPanelSelector` only says which panel's flag is on. The scroll
  // affordances must never be an enabled no-op for keyboard and
  // screen-reader users, so the actual scroll target's presence is confirmed
  // post-commit (its error boundary may have replaced it) and the lines
  // degrade to plain text when the target is absent. Re-checked on every
  // commit; React's setState equality bail-out keeps this loop-free.
  const [focusTargetPresent, setFocusTargetPresent] = useState(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately dependency-less: the scroll target can appear/vanish without any prop changing (error boundary swap), so the check must run on every commit; the setState equality bail-out keeps it loop-free
  useEffect(() => {
    setFocusTargetPresent(
      focusPanelSelector != null && document.querySelector(focusPanelSelector) != null,
    )
  })

  if (model.kind === 'status') {
    return (
      <section
        aria-label={HERO_COPY.panelAria}
        data-testid="analysis-hero-panel"
        className="space-y-2 rounded-lg border border-panel-border bg-panel p-3"
      >
        {model.provenance === 'fixture' && (
          <p
            data-testid="hero-fixture-banner"
            className={`${typography.panelMeta} flex items-center gap-1.5 rounded border border-panel-border bg-panel-hover px-2 py-1 text-warning`}
          >
            <FlaskConical aria-hidden="true" className="h-3.5 w-3.5 flex-none" />
            {HERO_COPY.fixtureBanner}
          </p>
        )}
        <StatusState model={model} />
      </section>
    )
  }

  // Local lens state: every lens in the strip is selectable (unavailable
  // lenses show the explained empty body), so the remembered lens only
  // falls back to the model default when nothing has been chosen yet.
  const lens: HeroLens = lensState ?? model.defaultLens
  const lensAvailable = model.lenses.includes(lens)

  // Constraint presence picks the goal-lens copy variant once (the caption
  // key structure in HERO_COPY).
  const goalKey = model.hasConstraints ? ('goalWithLimits' as const) : ('goalOnly' as const)
  // Axis labels per lens: the goal lens draws NO tracks (prototype v6
  // readout-only table), so no axis is drawn for it; Stability rows carry
  // the producer's own readout labels; What changed compares the same
  // outcome quantities as Likely outcome.
  const axis =
    lens === 'outcome' || lens === 'whatChanged' ? HERO_COPY.axis.outcome : null
  // The Likely outcome lens shows option comparison only — no target line or
  // target mention (target attainment lives on the Goal fit lens). The
  // caption describes only what the chart draws: no lines → dots-only
  // wording; one line → no overlap sentence (a single range cannot
  // overlap); two-plus → the full wording. What changed adds the
  // ghost-mark legend; Stability needs no caption (the readouts are the
  // producer's own labels).
  const caption =
    lens === 'goal'
      ? HERO_COPY.caption[goalKey]
      : lens === 'whatChanged'
        ? HERO_COPY.ghostLegend
        : lens === 'stability'
          ? HERO_COPY.caption.stability
          : model.outcomeRangedRowCount === 0
            ? HERO_COPY.caption.outcomeDotsOnly
            : model.outcomeRangedRowCount === 1
              ? HERO_COPY.caption.outcomeSingleRange
              : `${HERO_COPY.caption.outcome} ${HERO_COPY.caption.outcomeOverlap}`

  // Honest unavailable-lens body: why it is empty + what unlocks it. The
  // goal lens distinguishes the user-actionable no-target case from a
  // producer gap.
  const unavailableBody = !lensAvailable
    ? lens === 'goal'
      ? model.showGoalHint
        ? HERO_COPY.lensUnavailable.goalNoTarget
        : HERO_COPY.lensUnavailable.goalProducerGap
      : HERO_COPY.lensUnavailable[lens]
    : null

  const leaderId = model.leaders[lens]

  // §6.5 quick-evidence pills: outlined pills in the summary row between
  // the lens body and the evidence disclosure (prototype 1d .hero-summary).
  // Rendered only with a focus callback (never dead pills). When the main
  // driver and the top flip risk are the SAME factor, ONE combined pill
  // renders — two pills pointing at one node would double-claim it.
  const mainDriverLink = onFocusTarget ? model.quickLinks.mainDriver : null
  const topFlipLink = onFocusTarget ? model.quickLinks.topFlipRisk : null
  const combinedLink =
    mainDriverLink && topFlipLink && mainDriverLink.targetId === topFlipLink.targetId
      ? mainDriverLink
      : null
  const showPillsRow = Boolean(mainDriverLink || topFlipLink)
  const pillClass = `${typography.panelMeta} inline-flex items-center gap-1 rounded-full border border-panel-border bg-transparent px-2 py-0.5 text-text-body transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`

  return (
    <section
      aria-label={HERO_COPY.panelAria}
      data-testid="analysis-hero-panel"
      className="space-y-2 rounded-lg border border-panel-border bg-panel p-3"
    >
      {/* Fixture guard: models branded 'fixture' (internal gallery only)
          always carry a visible banner — example data must never be
          mistakable for real analysis output. */}
      {model.provenance === 'fixture' && (
        <p
          data-testid="hero-fixture-banner"
          className={`${typography.panelMeta} flex items-center gap-1.5 rounded border border-panel-border bg-panel-hover px-2 py-1 text-warning`}
        >
          <FlaskConical aria-hidden="true" className="h-3.5 w-3.5 flex-none" />
          {HERO_COPY.fixtureBanner}
        </p>
      )}

      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className={`${typography.panelHeader} text-text-header`} data-testid="hero-headline">
            {model.headline}
          </h3>
          {/* Status chip slot — PRODUCER-SUPPLIED label rendered verbatim
              (issue 221); the live adapter sets null until it exists. */}
          {model.statusChip && (
            <span
              data-testid="hero-status-chip"
              className={`${typography.panelMeta} whitespace-nowrap rounded-full border border-panel-border bg-transparent px-2 py-0.5 text-text-light`}
            >
              {dashSafe(model.statusChip)}
            </span>
          )}
        </div>
        {model.subline && (
          <p className={`${typography.panelBody} text-text-light`} data-testid="hero-subline">
            {model.subline}
          </p>
        )}
      </div>

      {/* Chart area — prototype v6 stale doctrine: NEVER dimmed or locked.
          The adjacent AnalysisFreshnessNotice strip is the sole stale
          surface; the hero content stays readable and interactive. */}
      <div data-testid="hero-chart-area" className="space-y-2">
        {/* Full prototype lens strip — always rendered; lenses without
            data are muted but selectable and explain themselves below. */}
        <HeroLensTabs
          available={model.lenses}
          active={lens}
          onSelect={setLensState}
          panelId={panelId}
        />

        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={tabId(panelId, lens)}
          className="space-y-1"
        >
          {unavailableBody ? (
            /* Explained empty state — why this lens is empty and what
               unlocks it. Never a fabricated chart. The no-target goal state
               carries the inline Define-success action AT the point of need
               when a route is wired (hidden otherwise — never dead). */
            <p
              data-testid="hero-lens-unavailable"
              className={`${typography.panelBody} flex items-start gap-1.5 py-2 text-text-light`}
            >
              <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-none text-info" />
              <span>
                {unavailableBody}
                {lens === 'goal' && model.showGoalHint && onDefineSuccess && (
                  <>
                    {' '}
                    <button
                      type="button"
                      data-testid="hero-define-success"
                      onClick={onDefineSuccess}
                      className="text-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
                    >
                      {HERO_COPY.lensUnavailable.goalDefineSuccess}
                    </button>
                  </>
                )}
              </span>
            </p>
          ) : (
            <>
              {/* Axis labels (decorative; values live in the row readouts).
                  Shares the row grid template and the track's column span so
                  the fragments sit exactly over the tracks below. */}
              {axis && (
                <div aria-hidden="true" className={`${HERO_ROW_GRID} items-end py-0`}>
                  <span />
                  <span
                    className={`${HERO_ROW_TRACK_SPAN} ${typography.panelMeta} flex items-baseline justify-between gap-2 text-text-light`}
                  >
                    <span className="flex-none">{axis.left}</span>
                    <span className="min-w-0 truncate text-center text-text-body">
                      {axis.mid}
                    </span>
                    <span className="flex-none">{axis.right}</span>
                  </span>
                </div>
              )}

              <div
                role="group"
                aria-label={HERO_COPY.rowsAria[lens]}
                className="space-y-0.5"
                data-testid="hero-chart-rows"
              >
                {model.rows.map((row) => (
                  <HeroOptionRow
                    key={row.id}
                    row={row}
                    lens={lens}
                    isLeader={row.id === leaderId}
                    showOrdinal={!model.designationsWithheld}
                    isOpen={openRowId === row.id}
                    onToggle={() => setOpenRowId((cur) => (cur === row.id ? null : row.id))}
                    outcomeDomain={model.outcomeDomain}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {!unavailableBody && caption && (
          <p className={`${typography.panelBody} flex items-start gap-1.5 text-text-body`}>
            <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-none text-info" />
            <span data-testid="hero-caption">{caption}</span>
          </p>
        )}
      </div>

      {/* §6.5 quick-evidence summary row (prototype 1d .hero-summary):
          outlined pills between the lens body and the evidence disclosure.
          Click focuses the factor on canvas via the container's fail-closed
          resolver. */}
      {showPillsRow && (
        <div
          data-testid="hero-summary-pills"
          className="flex flex-wrap gap-1.5 border-t border-panel-border pt-2"
        >
          {combinedLink ? (
            <button
              type="button"
              data-testid="hero-quicklink-combined"
              onClick={() => onFocusTarget!(combinedLink.targetId)}
              className={pillClass}
            >
              <Crosshair aria-hidden="true" className="h-3 w-3 flex-none text-info" />
              {HERO_COPY.pills.combined(combinedLink.label)}
            </button>
          ) : (
            <>
              {mainDriverLink && (
                <button
                  type="button"
                  data-testid="hero-quicklink-driver"
                  onClick={() => onFocusTarget!(mainDriverLink.targetId)}
                  className={pillClass}
                >
                  <Crosshair aria-hidden="true" className="h-3 w-3 flex-none text-info" />
                  {HERO_COPY.pills.mainDriver(mainDriverLink.label)}
                </button>
              )}
              {topFlipLink && (
                <button
                  type="button"
                  data-testid="hero-quicklink-flip"
                  onClick={() => onFocusTarget!(topFlipLink.targetId)}
                  className={pillClass}
                >
                  <Crosshair aria-hidden="true" className="h-3 w-3 flex-none text-info" />
                  {HERO_COPY.pills.topFlipRisk(topFlipLink.label)}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* §6.6: one expandable evidence section between the summary pills and
          the footer — self-hides when the model has nothing to disclose. */}
      <HeroEvidenceDisclosure evidence={model.evidence} onFocusTarget={onFocusTarget} />

      {/* Footer strip: Main reason (static fallback when the driver pill is
          absent) · Trust slot · Focus next. The trust line renders
          PRODUCER-SUPPLIED text verbatim (issues 219/221) — the live adapter
          sets null until such a label exists, so the slot is fixture-only
          today; the hero never authors trust wording. The strip self-hides
          when the Next-step row supersedes its only line (no empty border). */}
      {(Boolean(model.mainReason && !mainDriverLink) ||
        model.trustLine != null ||
        model.showGoalHint ||
        model.focusAction != null ||
        !nextRecommendation) && (
      <div className="space-y-1.5 border-t border-panel-border pt-2">
        {model.mainReason && !mainDriverLink && (
          <p className={`${typography.panelBody} text-text-body`} data-testid="hero-main-reason">
            {model.mainReason}
          </p>
        )}
        {model.trustLine && (
          <p className={`${typography.panelBody} text-text-light`} data-testid="hero-trust-line">
            {dashSafe(model.trustLine)}
          </p>
        )}
        {/* C1: the former isStale Re-run pill is REMOVED (ratified v6 —
            the hero has no stale affordance at all; the freshness strip
            above owns recovery and carries the one Rerun). The content
            stays fully readable and interactive when stale. */}
        {model.showGoalHint ? (
          /* Promoted single-lens unlock: the Focus-next slot carries the
             success-target action (fires ONLY when no target exists — never
             for producer gaps). Actionable solely through the existing
             apply route; without it the line is plain text, never a dead
             control. */
          targetEditing && onApplyTarget ? (
            <span
              className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1"
              data-testid="hero-focus-target-editor"
              onBlur={(e) => {
                // Abandon only when focus leaves the editor GROUP — tabbing
                // from the input to the apply button must not unmount the
                // editor mid-flight (keyboard flow; review fix).
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setTargetEditing(false)
                }
              }}
            >
              <Target aria-hidden="true" className="h-3.5 w-3.5 flex-none text-info" />
              {/* Visible label + unit: the user sees WHAT to type and in
                  which unit before committing (unit is the outcome unit —
                  passthrough of existing fields, review gate). */}
              <span className={`${typography.panelBody} text-text-body`}>
                {HERO_COPY.footer.targetLabel}
              </span>
              <input
                ref={targetInputRef}
                type="number"
                value={targetDraft}
                onChange={(e) => setTargetDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitTarget()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setTargetEditing(false)
                  }
                }}
                disabled={rerunDisabled}
                aria-label={
                  model.targetUnit
                    ? `${HERO_COPY.footer.targetInputAria} (${model.targetUnit})`
                    : HERO_COPY.footer.targetInputAria
                }
                className={`w-20 rounded border border-info px-2 py-0.5 ${typography.panelBody} tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:opacity-50`}
              />
              {model.targetUnit && (
                <span
                  className={`${typography.panelBody} text-text-body`}
                  data-testid="hero-target-unit"
                >
                  {model.targetUnit}
                </span>
              )}
              <button
                type="button"
                // Keep focus on the input during a mouse press so the
                // container blur-revert cannot race the click away. Without
                // this, browsers that do not focus a button on mousedown
                // (Safari) blur the input with relatedTarget=null, the
                // group onBlur unmounts the editor, and the click never
                // lands — the commit is silently lost. preventDefault fires
                // only for pointer input; keyboard activation still reaches
                // onClick with the button focused. Single commit either way.
                onMouseDown={(e) => e.preventDefault()}
                onClick={commitTarget}
                disabled={rerunDisabled}
                aria-label={HERO_COPY.footer.targetApply}
                title={HERO_COPY.footer.targetApply}
                className="flex h-5 w-5 items-center justify-center rounded text-success transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:opacity-50"
              >
                <Check aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
              {/* Rerun disclosure BEFORE commit — applying is analysis-affecting. */}
              <span className={`${typography.panelMeta} text-text-light`}>
                {HERO_COPY.footer.targetRerunNote}
              </span>
            </span>
          ) : onApplyTarget ? (
            <button
              type="button"
              onClick={() => {
                setTargetDraft('')
                setTargetEditing(true)
              }}
              disabled={rerunDisabled}
              data-testid="hero-focus-target"
              className={`${typography.panelBody} inline-flex items-center gap-1.5 text-text-body hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:opacity-50`}
            >
              <Target aria-hidden="true" className="h-3.5 w-3.5 text-info" />
              {HERO_COPY.footer.focusTarget}
            </button>
          ) : (
            <p
              className={`${typography.panelBody} text-text-body`}
              data-testid="hero-focus-target"
            >
              {HERO_COPY.footer.focusTarget}
            </p>
          )
        ) : model.focusAction ? (
          /* Named Focus-next — PRODUCER/coaching-contract text rendered
             verbatim (issue 220); live adapter sets null until the
             contract exists, so this slot is fixture-only today. */
          <p className={`${typography.panelBody} text-text-body`} data-testid="hero-focus-action">
            {dashSafe(model.focusAction)}
          </p>
        ) : nextRecommendation ? null : focusTargetPresent && focusPanelSelector ? (
          /* Generic Focus-next scroll line — superseded by the Next-step
             row below whenever a top Strengthen entry exists. */
          <button
            type="button"
            onClick={() => scrollToPanel(focusPanelSelector)}
            aria-label={HERO_COPY.footer.focusNextAria}
            data-testid="hero-focus-next"
            className={`${typography.panelBody} inline-flex items-center gap-1.5 text-text-body hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
          >
            <Crosshair aria-hidden="true" className="h-3.5 w-3.5 text-info" />
            {HERO_COPY.footer.focusNext}
          </button>
        ) : (
          <p className={`${typography.panelBody} text-text-body`} data-testid="hero-focus-next">
            {HERO_COPY.footer.focusNext}
          </p>
        )}
      </div>
      )}

      {/* Next-step route row (prototype §5 .analysis-next-route): mirrors
          the TOP active Strengthen entry; Open scrolls to the panel below.
          The Open control renders only when the scroll target is verifiably
          mounted (fail-closed — never a dead button); the row itself still
          names the entry as plain text otherwise. */}
      {nextRecommendation && (
        <div
          data-testid="hero-next-rec"
          className="flex items-center gap-2 border-t border-panel-border pt-2"
        >
          <Target aria-hidden="true" className="h-3.5 w-3.5 flex-none text-info" />
          <span className="min-w-0 flex-1">
            <span className={`${typography.panelMeta} block text-text-light`}>
              {HERO_COPY.nextRec.label}
            </span>
            <span
              data-testid="hero-next-rec-title"
              className={`${typography.panelBody} block truncate font-semibold text-text-header`}
            >
              {nextRecommendation}
            </span>
          </span>
          {focusTargetPresent && focusPanelSelector && (
            <button
              type="button"
              data-testid="hero-next-rec-open"
              onClick={() => scrollToPanel(focusPanelSelector)}
              aria-label={HERO_COPY.nextRec.openAria}
              className={`${typography.panelMeta} flex-none rounded-full border border-panel-border bg-transparent px-2.5 py-1 text-text-body transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            >
              {HERO_COPY.nextRec.open}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

export default AnalysisHeroPanel
