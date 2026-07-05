/**
 * AnalysisHeroPanel — presentational, prop-driven, STORE-FREE.
 *
 * Renders the answer-first hero: headline + tension subline, lens tabs,
 * axis, option rows (disclosure detail), caption, and the compressed footer
 * strip (Main reason / Focus next). Also renders the curated non-chart
 * states (partial / failed / blocked). Every number shown comes from the
 * model built by buildHeroModel — this component adds layout and copy
 * composition only.
 *
 * Lens switching and row disclosure are LOCAL render state: no fetch, no
 * analysis rerun, no selector recomputation, and the row DOM persists across
 * lens switches (values morph via transform/opacity in HeroOptionRow).
 *
 * Stale treatment (no hero-owned banner — AnalysisFreshnessNotice owns the
 * wording): the chart area is dimmed and inert, lens and row interactions
 * are locked, and Focus next becomes the Re-run analysis action.
 *
 * Trust discipline: no trust/stability wording is rendered anywhere in this
 * panel — no producer-supplied display-safe label exists today (see
 * ROBUSTNESS-VERDICT-CONTRACT), so the trust line is omitted rather than
 * derived. Raw 0-1 stability/confidence floats are never displayed.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { ArrowDown, Check, FlaskConical, Info, RefreshCw, Target } from 'lucide-react'
import { typography } from '@/styles/typography'
import { HERO_COPY } from './heroCopy'
import { HeroLensTabs, tabId } from './HeroLensTabs'
import { HeroOptionRow, HERO_ROW_GRID } from './HeroOptionRow'
import type { HeroChartModel, HeroLens, HeroStatusModel } from './heroTypes'

export interface AnalysisHeroPanelProps {
  model: HeroChartModel | HeroStatusModel
  isStale: boolean
  onRerun: () => void
  rerunDisabled: boolean
  /**
   * Whether the coaching panel below is actually mounted (its flag is on).
   * Gates the Focus-next scroll affordance so the hero never renders a dead
   * link — with the panel absent the line degrades to plain text.
   */
  focusPanelMounted: boolean
  /**
   * Existing apply-target route (OutputsDock handleApplyThreshold: sets the
   * goal threshold and reruns — the same handler the Options Compare target
   * row used). When absent, the promoted Focus-next target line degrades to
   * plain text; the hero never invents an action route of its own.
   */
  onApplyTarget?: (value: number) => void
}

/** The coaching panel container the focus-next affordance scrolls to. */
const FOCUS_PANEL_SELECTOR = '[data-testid="focus-now-panel"]'

/** Scroll to the coaching panel below; no-op when the target is absent. */
function scrollToFocusPanel() {
  const el = document.querySelector(FOCUS_PANEL_SELECTOR)
  if (!el) return
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
}

function StatusState({ model }: { model: HeroStatusModel }) {
  return (
    <div data-testid={`hero-status-${model.variant}`} className="space-y-1">
      <h3 className={`${typography.panelHeader} text-text-header`}>{model.headline}</h3>
      <p className={`${typography.panelBody} text-text-light`}>{model.body}</p>
    </div>
  )
}

export function AnalysisHeroPanel({
  model,
  isStale,
  onRerun,
  rerunDisabled,
  focusPanelMounted,
  onApplyTarget,
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
    const parsed = parseFloat(targetDraft)
    if (!Number.isNaN(parsed)) onApplyTarget?.(parsed)
    setTargetEditing(false)
  }

  // `focusPanelMounted` only says the coaching panel's flag is on. The
  // focus-next affordance must never be an enabled no-op for keyboard and
  // screen-reader users, so the actual scroll target's presence is confirmed
  // post-commit (its error boundary may have replaced it) and the line
  // degrades to plain text when the target is absent. Re-checked on every
  // commit; React's setState equality bail-out keeps this loop-free.
  const [focusTargetPresent, setFocusTargetPresent] = useState(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately dependency-less: the scroll target can appear/vanish without any prop changing (error boundary swap), so the check must run on every commit; the setState equality bail-out keeps it loop-free
  useEffect(() => {
    setFocusTargetPresent(
      focusPanelMounted && document.querySelector(FOCUS_PANEL_SELECTOR) != null,
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
  const interactive = !isStale

  // Constraint presence picks the goal-lens copy variant once for both
  // the axis and the caption (the two share key structure in HERO_COPY).
  const goalKey = model.hasConstraints ? ('goalWithLimits' as const) : ('goalOnly' as const)
  // Axis labels per lens: Stability rows carry the producer's own readout
  // labels, so no generic axis is drawn for them; What changed compares the
  // same outcome quantities as Likely outcome.
  const axis =
    lens === 'goal'
      ? HERO_COPY.axis[goalKey]
      : lens === 'outcome' || lens === 'whatChanged'
        ? HERO_COPY.axis.outcome
        : null
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
          ? null
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
              {model.statusChip}
            </span>
          )}
        </div>
        {model.subline && (
          <p className={`${typography.panelBody} text-text-light`} data-testid="hero-subline">
            {model.subline}
          </p>
        )}
      </div>

      {/* Chart area — dimmed and inert while stale (soft-disable; the tab's
          AnalysisFreshnessNotice carries the stale wording). */}
      <div
        data-testid="hero-chart-area"
        className={`space-y-2 ${isStale ? 'pointer-events-none opacity-45' : ''}`}
      >
        {/* Full prototype lens strip — always rendered; lenses without
            data are muted but selectable and explain themselves below. */}
        <HeroLensTabs
          available={model.lenses}
          active={lens}
          onSelect={setLensState}
          interactive={interactive}
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
               unlocks it. Never a fabricated chart. */
            <p
              data-testid="hero-lens-unavailable"
              className={`${typography.panelBody} flex items-start gap-1.5 py-2 text-text-light`}
            >
              <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-none text-info" />
              {unavailableBody}
            </p>
          ) : (
            <>
              {/* Axis labels (decorative; values live in the row readouts).
                  Shares the row grid template so the track columns align. */}
              {axis && (
                <div aria-hidden="true" className={`${HERO_ROW_GRID} items-end py-0`}>
                  <span />
                  <span
                    className={`${typography.panelMeta} relative flex justify-between text-text-light`}
                  >
                    <span>{axis.left}</span>
                    <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-text-body">
                      {axis.mid}
                    </span>
                    <span>{axis.right}</span>
                  </span>
                  <span />
                  <span />
                </div>
              )}

              <div className="space-y-0.5" data-testid="hero-chart-rows">
                {model.rows.map((row) => (
                  <HeroOptionRow
                    key={row.id}
                    row={row}
                    lens={lens}
                    isLeader={row.id === leaderId}
                    isOpen={openRowId === row.id}
                    onToggle={() => setOpenRowId((cur) => (cur === row.id ? null : row.id))}
                    interactive={interactive}
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

      {/* Footer strip: Main reason · Trust slot · Focus next. The trust
          line renders PRODUCER-SUPPLIED text verbatim (issues 219/221) —
          the live adapter sets null until such a label exists, so the slot
          is fixture-only today; the hero never authors trust wording. */}
      <div className="space-y-1.5 border-t border-panel-border pt-2">
        {model.mainReason && (
          <p className={`${typography.panelBody} text-text-body`} data-testid="hero-main-reason">
            {model.mainReason}
          </p>
        )}
        {model.trustLine && (
          <p className={`${typography.panelBody} text-text-light`} data-testid="hero-trust-line">
            {model.trustLine}
          </p>
        )}
        {isStale ? (
          <button
            type="button"
            onClick={onRerun}
            disabled={rerunDisabled}
            data-testid="hero-rerun"
            className={`${typography.panelMeta} inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-text-on-color transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:opacity-50`}
          >
            <RefreshCw
              aria-hidden="true"
              className={`h-3.5 w-3.5 ${
                rerunDisabled ? 'animate-spin motion-reduce:animate-none' : ''
              }`}
            />
            {HERO_COPY.footer.rerun}
          </button>
        ) : model.showGoalHint ? (
          /* Promoted single-lens unlock: the Focus-next slot carries the
             success-target action (fires ONLY when no target exists — never
             for producer gaps). Actionable solely through the existing
             apply route; without it the line is plain text, never a dead
             control. */
          targetEditing && onApplyTarget ? (
            <span
              className="inline-flex items-center gap-1.5"
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
                aria-label={HERO_COPY.footer.targetInputAria}
                className={`w-24 rounded border border-info px-2 py-0.5 ${typography.panelBody} tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:opacity-50`}
              />
              <button
                type="button"
                onClick={commitTarget}
                disabled={rerunDisabled}
                aria-label={HERO_COPY.footer.targetApply}
                title={HERO_COPY.footer.targetApply}
                className="flex h-5 w-5 items-center justify-center rounded text-success transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:opacity-50"
              >
                <Check aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
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
            {model.focusAction}
          </p>
        ) : focusTargetPresent ? (
          <button
            type="button"
            onClick={scrollToFocusPanel}
            aria-label={HERO_COPY.footer.focusNextAria}
            data-testid="hero-focus-next"
            className={`${typography.panelBody} inline-flex items-center gap-1.5 text-text-body hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
          >
            <ArrowDown aria-hidden="true" className="h-3.5 w-3.5 text-info" />
            {HERO_COPY.footer.focusNext}
          </button>
        ) : (
          <p className={`${typography.panelBody} text-text-body`} data-testid="hero-focus-next">
            {HERO_COPY.footer.focusNext}
          </p>
        )}
      </div>
    </section>
  )
}

export default AnalysisHeroPanel
