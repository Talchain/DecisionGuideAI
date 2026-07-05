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
import { useEffect, useId, useState } from 'react'
import { ArrowDown, Info, RefreshCw } from 'lucide-react'
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
}: AnalysisHeroPanelProps) {
  const panelId = useId()
  const [lensState, setLensState] = useState<HeroLens | null>(null)
  const [openRowId, setOpenRowId] = useState<string | null>(null)

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
        className="rounded-lg border border-panel-border bg-panel p-3"
      >
        <StatusState model={model} />
      </section>
    )
  }

  // Local lens state guarded against model changes: fall back to the model's
  // default whenever the remembered lens is no longer available.
  const lens: HeroLens =
    lensState && model.lenses.includes(lensState) ? lensState : model.defaultLens
  const interactive = !isStale
  const showTabs = model.lenses.length > 1

  // Constraint presence picks the goal-lens copy variant once for both
  // the axis and the caption (the two share key structure in HERO_COPY).
  const goalKey = model.hasConstraints ? ('goalWithLimits' as const) : ('goalOnly' as const)
  const axis = lens === 'goal' ? HERO_COPY.axis[goalKey] : HERO_COPY.axis.outcome
  // The Likely outcome lens shows option comparison only — no target line or
  // target mention (target attainment lives on the Goal fit lens). The
  // caption describes only what the chart draws: no lines → dots-only
  // wording; one line → no overlap sentence (a single range cannot
  // overlap); two-plus → the full wording.
  const caption =
    lens === 'goal'
      ? HERO_COPY.caption[goalKey]
      : model.outcomeRangedRowCount === 0
        ? HERO_COPY.caption.outcomeDotsOnly
        : model.outcomeRangedRowCount === 1
          ? HERO_COPY.caption.outcomeSingleRange
          : `${HERO_COPY.caption.outcome} ${HERO_COPY.caption.outcomeOverlap}`

  const leaderId = model.leaders[lens]

  return (
    <section
      aria-label={HERO_COPY.panelAria}
      data-testid="analysis-hero-panel"
      className="space-y-2 rounded-lg border border-panel-border bg-panel p-3"
    >
      <div className="space-y-1">
        <h3 className={`${typography.panelHeader} text-text-header`} data-testid="hero-headline">
          {model.headline}
        </h3>
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
        {showTabs && (
          <HeroLensTabs
            lenses={model.lenses}
            active={lens}
            onSelect={setLensState}
            interactive={interactive}
            panelId={panelId}
          />
        )}

        <div
          id={panelId}
          {...(showTabs ? { role: 'tabpanel', 'aria-labelledby': tabId(panelId, lens) } : {})}
          className="space-y-1"
        >
          {/* Axis labels (decorative; values live in the row readouts).
              Shares the row grid template so the track columns align. */}
          <div aria-hidden="true" className={`${HERO_ROW_GRID} items-end py-0`}>
            <span />
            <span className={`${typography.panelMeta} relative flex justify-between text-text-light`}>
              <span>{axis.left}</span>
              <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-text-body">
                {axis.mid}
              </span>
              <span>{axis.right}</span>
            </span>
            <span />
            <span />
          </div>

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
        </div>

        <p className={`${typography.panelBody} flex items-start gap-1.5 text-text-body`}>
          <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-none text-info" />
          <span data-testid="hero-caption">{caption}</span>
        </p>

        {/* Single-lens discoverability: only when the goal lens is absent
            because no success target exists (never for producer gaps). */}
        {model.showGoalHint && (
          <p
            className={`${typography.panelMeta} pl-5 text-text-light`}
            data-testid="hero-goal-hint"
          >
            {HERO_COPY.goalHint}
          </p>
        )}
      </div>

      {/* Footer strip: Main reason · Focus next. The trust line is omitted —
          no producer-supplied trust label exists (gap reported in the PR). */}
      <div className="space-y-1.5 border-t border-panel-border pt-2">
        {model.mainReason && (
          <p className={`${typography.panelBody} text-text-body`} data-testid="hero-main-reason">
            {model.mainReason}
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
