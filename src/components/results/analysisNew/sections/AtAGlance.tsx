/**
 * At a glance — the strategic snapshot that IS the first viewport.
 *
 * ── WHY THIS WAS REBUILT (30 Aug 2026) ─────────────────────────────────────
 * The previous version rendered every element at the same typographic weight,
 * stacked with `space-y-2`. Everything was `panelMeta` or `panelBody`, so the
 * answer, the caveats, the scope note, the drivers and the action all competed
 * equally — and because every honesty mechanism had earned its own paragraph,
 * the caveats won on volume. Paul's read of the deployed surface: "an absolute
 * dog's dinner… a travesty".
 *
 * Nothing analytical changed. Every value below comes from the same view-model
 * field it came from before. This is a RENDERING change: rank, typeset, encode.
 *
 * ── THE FOUR RULES IT ENFORCES ─────────────────────────────────────────────
 * 1. ONE DOMINANT ANSWER. The leading option is the only large type on screen.
 *    Five equal answers in a 280px column is the density we came from.
 * 2. NO CHART UNLESS THE VALUES DIFFER. The deployed surface drew three driver
 *    bars all at 100% — three identical bars is three times no information.
 *    Bars render only when the spread clears `DRIVER_SPREAD_MIN`; otherwise the
 *    ranked labels stand alone and NOTHING is claimed about their equality.
 * 3. STALE KILLS THE PRESENT TENSE. `headline` is composed here in the present
 *    ("currently scores higher"), which is false on a run that predates the
 *    model. When stale, the eyebrow reframes it and the sentence is not used.
 * 4. ONE FACT, ONE PLACE. Stale and partial are a single ribbon attached to the
 *    answer, not two separate banners above it.
 *
 * ── WIDTH ──────────────────────────────────────────────────────────────────
 * Designed at the 280px floor first. The dock is NOT fixed at ~320: it is
 * 280-416 and drags to 480 (measured on the deployed build). Every rule here is
 * fluid or clamped; nothing assumes a single width.
 */

import { useState } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle, ChevronRight, Sparkles } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { ComparisonScopeNote } from '../../ComparisonScopeNote'
import { NOT_ANALYSED_BADGE } from '../../utils/notAnalysedCopy'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { AtAGlance as AtAGlanceModel } from '../analysisNewTypes'

/** Verdict tone → the accent that carries it. One ramp, used everywhere. */
const TONE_CLASS: Record<string, string> = {
  stable: 'text-success',
  mixed: 'text-warning',
  sensitive: 'text-warning',
}
const TONE_PILL: Record<string, string> = {
  stable: 'bg-success/10 text-success',
  mixed: 'bg-warning/10 text-warning',
  sensitive: 'bg-warning/10 text-warning',
}

/**
 * Below this spread, driver bars are not drawn.
 *
 * `fraction` is each driver against the STRONGEST in the run, so the leader is
 * always 1. A spread under 5 percentage points means every bar renders within
 * a few pixels of every other at these widths — visually identical, and read as
 * "these are the same" whether or not that is what the producer meant.
 */
export const DRIVER_SPREAD_MIN = 0.05

export const EXCLUDED_OPTION_VISIBLE_CAP = 2

export interface AtAGlanceProps {
  glance: AtAGlanceModel
  onFocusTarget?: (targetId: string) => void
  driverTotal?: number
  primaryIntervention?: { id: string; label: string; why: string } | null
  onRunIntervention?: (recommendationId: string) => void
  /** The displayed run predates the current model. Reframes the answer. */
  isStale?: boolean
  /** The producer disclosed the result as partial. */
  isProvisional?: boolean
  testId?: string
}

/** A small tracked eyebrow. The only place this surface uses uppercase. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-light m-0">
      {children}
    </p>
  )
}

export function AtAGlance({
  glance,
  onFocusTarget,
  driverTotal,
  primaryIntervention,
  onRunIntervention,
  isStale = false,
  isProvisional = false,
  testId = 'analysis-new-glance',
}: AtAGlanceProps) {
  const [showAllExcluded, setShowAllExcluded] = useState(false)
  const excludedKey =
    glance.comparisonScope.kind === 'partial'
      ? JSON.stringify(glance.comparisonScope.excluded.map((o) => o.id))
      : ''
  const [seenExcludedKey, setSeenExcludedKey] = useState(excludedKey)
  if (seenExcludedKey !== excludedKey) {
    setSeenExcludedKey(excludedKey)
    setShowAllExcluded(false)
  }

  const hasAnything =
    glance.headline || glance.verdict || glance.drivers.length > 0 || glance.condition
  if (!hasAnything) return null

  // Rule 2. `fraction` is relative to the strongest, so max is 1 by
  // construction; the spread is therefore 1 - min.
  const fractions = glance.drivers.map((d) => d.fraction)
  const driversDiscriminate =
    glance.drivers.length > 1 &&
    Math.max(...fractions) - Math.min(...fractions) >= DRIVER_SPREAD_MIN

  // Rule 3 + 4. One ribbon, in the order a reader needs it: freshness first
  // (it invalidates the tense), completeness second (it bounds the claim).
  const ribbon: Array<{ testId: string; text: string }> = []
  if (isStale) ribbon.push({ testId: 'analysis-new-status-stale', text: COPY.status.stale })
  if (isProvisional) {
    ribbon.push({ testId: 'analysis-new-status-provisional', text: COPY.status.provisional })
  }

  /**
   * ⭐ WHAT COULD CHANGE IT OUTRANKS DRIVERS THAT DO NOT DISCRIMINATE.
   *
   * A tipping point ("the ordering changes if X moves to 0.8") is a different
   * and far more actionable quantity than a structural-influence ranking — and
   * when the influence values are all within `DRIVER_SPREAD_MIN` of each other
   * the ranking is telling the reader nothing at all. In that state the
   * condition is promoted above it. When the drivers DO discriminate, the
   * original order stands: the ranking is then the better orientation.
   */
  const conditionFirst = Boolean(glance.condition) && !driversDiscriminate

  const showAnswer = Boolean(glance.leaderLabel ?? glance.headline)

  return (
    <section className="space-y-3" data-testid={testId} aria-label={COPY.sections.atAGlance}>
      {ribbon.length > 0 ? (
        <div
          className="flex items-start gap-1.5 rounded-md bg-warning/10 px-2 py-1.5"
          role="status"
          data-testid={`${testId}-ribbon`}
        >
          <AlertTriangle className="w-3 h-3 mt-[3px] shrink-0 text-warning" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            {ribbon.map((r, i) => (
              <span
                key={r.testId}
                className={`${typography.panelMeta} text-warning`}
                data-testid={r.testId}
              >
                {i > 0 ? ' ' : null}
                {r.text}
              </span>
            ))}
          </span>
        </div>
      ) : null}

      {/* ── THE ANSWER ─────────────────────────────────────────────────────
          The only large type on the surface. On a stale run the eyebrow
          reframes it in the past and `headline`'s present-tense sentence is
          deliberately not rendered (rule 3). */}
      {showAnswer ? (
        <div>
          <Eyebrow>{isStale ? COPY.glance.eyebrowStale : COPY.glance.eyebrowLeading}</Eyebrow>
          <p
            className="mt-1 mb-0 text-[17px] leading-[1.25] font-semibold text-text-header text-balance"
            data-testid={`${testId}-headline`}
          >
            {glance.leaderLabel ?? glance.headline}
          </p>
        </div>
      ) : null}

      {/* ── HOW MUCH TO RELY ON IT ─────────────────────────────────────────
          The share as a NUMBER with a bar, the verdict word as a pill beside
          it, the producer's own reason sentence beneath. Previously all three
          were one run-on line of 11px meta text. */}
      {glance.verdict ? (
        <div data-testid={`${testId}-verdict`} data-verdict-tone={glance.verdict.tone}>
          <div className="flex items-center gap-2">
            {glance.winPercentLabel ? (
              <span
                className="text-[26px] leading-none font-semibold text-text-header tabular-nums"
                data-testid={`${testId}-win-share`}
              >
                {glance.winPercentLabel}
              </span>
            ) : null}
            <span
              className={`${typography.panelMeta} shrink-0 rounded-full px-2 py-0.5 font-medium ${TONE_PILL[glance.verdict.tone]}`}
              data-testid={`${testId}-verdict-line`}
            >
              {glance.verdict.tone === 'stable' ? (
                <CheckCircle className="inline w-3 h-3 -mt-px mr-1" aria-hidden="true" />
              ) : (
                <AlertTriangle className="inline w-3 h-3 -mt-px mr-1" aria-hidden="true" />
              )}
              {glance.verdict.label}
            </span>
          </div>

          {glance.winFraction !== null ? (
            <>
              <span
                className="mt-1.5 block h-1 w-full rounded-full bg-panel-hover overflow-hidden"
                aria-hidden="true"
                data-testid={`${testId}-win-bar`}
              >
                <span
                  className={`block h-full rounded-full ${glance.verdict.tone === 'stable' ? 'bg-success' : 'bg-warning'}`}
                  style={{ width: `${Math.round(glance.winFraction * 100)}%` }}
                />
              </span>
              <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`}>
                {COPY.glance.winShareCaption}
              </p>
            </>
          ) : null}

          {glance.verdict.reason ? (
            <p
              className={`${typography.panelMeta} ${TONE_CLASS[glance.verdict.tone]} mt-1 mb-0`}
              data-testid={`${testId}-verdict-reason`}
            >
              {glance.verdict.reason}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ── SCOPE ──────────────────────────────────────────────────────────
          Excluded options were two full prose paragraphs each repeating the
          same sentence. They are now rows in a list: same facts, same
          sanctioned copy, a fraction of the visual mass. */}
      {glance.comparisonScope.kind === 'partial' && glance.comparativeClaim !== 'none' ? (
        <div data-testid={`${testId}-scope`}>
          <ComparisonScopeNote
            scope={glance.comparisonScope.scope}
            surface="analysisNew"
            withDetail={glance.comparativeClaim === 'value'}
          />
          <ul className="mt-1 space-y-0.5 list-none p-0 m-0">
            {(showAllExcluded
              ? glance.comparisonScope.excluded
              : glance.comparisonScope.excluded.slice(0, EXCLUDED_OPTION_VISIBLE_CAP)
            ).map((o) => (
              <li
                key={o.id}
                className={`${typography.panelMeta} text-text-light flex items-start gap-1.5`}
                data-testid={`${testId}-excluded-option`}
                data-option-id={o.id}
                title={o.reasonCopy}
              >
                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-text-light" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="text-text-body">{o.label}</span>
                  {' — '}
                  {NOT_ANALYSED_BADGE}
                  <span className="sr-only">{`. ${o.reasonCopy}`}</span>
                </span>
              </li>
            ))}
          </ul>
          {glance.comparisonScope.excluded.length > EXCLUDED_OPTION_VISIBLE_CAP ? (
            <button
              type="button"
              onClick={() => setShowAllExcluded((v) => !v)}
              aria-expanded={showAllExcluded}
              className={`${typography.panelMeta} text-text-light mt-1 rounded underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
              data-testid={`${testId}-excluded-more`}
            >
              {showAllExcluded
                ? COPY.disclosure.collapse
                : COPY.disclosure.moreExcluded(
                    glance.comparisonScope.excluded.length - EXCLUDED_OPTION_VISIBLE_CAP,
                  )}
            </button>
          ) : null}
        </div>
      ) : null}

      {conditionFirst ? (
        <>
      {/* ── WHAT COULD CHANGE IT ───────────────────────────────────────────── */}
      {glance.condition ? (
        (() => {
          const focusable = Boolean(glance.condition.targetId && onFocusTarget)
          const Row = (
            <>
              <AlertTriangle
                className="w-3.5 h-3.5 mt-[3px] shrink-0 text-warning"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="text-text-header font-medium">{COPY.glance.couldChangeIf}</span>{' '}
                {glance.condition!.text}
              </span>
              {focusable ? (
                <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-text-light" aria-hidden="true" />
              ) : null}
            </>
          )
          return (
            <div
              className="rounded-md border-l-2 border-warning/40 bg-warning/[0.04] py-1.5 pl-2 pr-1"
              data-testid={`${testId}-condition`}
            >
              {focusable ? (
                <button
                  type="button"
                  onClick={() => onFocusTarget!(glance.condition!.targetId!)}
                  className={`${typography.panelBody} text-text-body w-full flex items-start gap-1.5 text-left rounded hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                  data-testid={`${testId}-condition-focus`}
                >
                  {Row}
                </button>
              ) : (
                <p
                  className={`${typography.panelBody} text-text-body w-full flex items-start gap-1.5 m-0`}
                >
                  {Row}
                </p>
              )}
            </div>
          )
        })()
      ) : null}
      {/* ── WHAT IS SHAPING IT ─────────────────────────────────────────────── */}
      {glance.drivers.length > 0 ? (
        <div data-testid={`${testId}-drivers`}>
          <div className="flex items-baseline justify-between gap-2">
            <Eyebrow>{COPY.glance.whatMattersMost}</Eyebrow>
            {driversDiscriminate ? (
              <span
                className={`${typography.panelMeta} text-text-light shrink-0`}
                title={
                  glance.influenceIsSetRelative
                    ? COPY.glance.basisRelativeExplain
                    : COPY.glance.basisAbsoluteExplain
                }
                data-testid={`${testId}-basis`}
              >
                {glance.influenceIsSetRelative
                  ? COPY.glance.basisRelative
                  : COPY.glance.basisAbsolute}
              </span>
            ) : null}
          </div>
          <ul className="mt-1.5 space-y-1 list-none p-0 m-0">
            {glance.drivers.map((d) => {
              const focusable = Boolean(d.targetId && onFocusTarget)
              const Row = (
                <>
                  <span className="min-w-0 flex-1 truncate text-left" title={d.label}>
                    {d.label}
                  </span>
                  {driversDiscriminate ? (
                    <span
                      className="h-1.5 w-16 shrink-0 rounded-full bg-panel-hover overflow-hidden sm:w-24"
                      aria-hidden="true"
                      data-testid={`${testId}-driver-bar`}
                    >
                      <span
                        className="block h-full rounded-full bg-info"
                        style={{ width: `${Math.round(d.fraction * 100)}%` }}
                      />
                    </span>
                  ) : null}
                  {focusable ? (
                    <ArrowRight
                      className="w-3 h-3 shrink-0 text-text-light opacity-0 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  ) : null}
                </>
              )
              return (
                <li key={d.id} data-testid={`${testId}-driver`} data-driver-id={d.id}>
                  {focusable ? (
                    <button
                      type="button"
                      onClick={() => onFocusTarget!(d.targetId!)}
                      className={`${typography.panelBody} group text-text-body w-full flex items-center gap-2 rounded hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                      data-testid={`${testId}-driver-focus`}
                    >
                      {Row}
                    </button>
                  ) : (
                    <span
                      className={`${typography.panelBody} group text-text-body w-full flex items-center gap-2`}
                    >
                      {Row}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          {typeof driverTotal === 'number' && driverTotal > glance.drivers.length ? (
            <p
              className={`${typography.panelMeta} text-text-light mt-1 mb-0`}
              data-testid={`${testId}-drivers-more`}
            >
              {COPY.glance.moreDrivers(driverTotal - glance.drivers.length)}
            </p>
          ) : null}
        </div>
      ) : null}
        </>
      ) : (
        <>
      {/* ── WHAT IS SHAPING IT ─────────────────────────────────────────────── */}
      {glance.drivers.length > 0 ? (
        <div data-testid={`${testId}-drivers`}>
          <div className="flex items-baseline justify-between gap-2">
            <Eyebrow>{COPY.glance.whatMattersMost}</Eyebrow>
            {driversDiscriminate ? (
              <span
                className={`${typography.panelMeta} text-text-light shrink-0`}
                title={
                  glance.influenceIsSetRelative
                    ? COPY.glance.basisRelativeExplain
                    : COPY.glance.basisAbsoluteExplain
                }
                data-testid={`${testId}-basis`}
              >
                {glance.influenceIsSetRelative
                  ? COPY.glance.basisRelative
                  : COPY.glance.basisAbsolute}
              </span>
            ) : null}
          </div>
          <ul className="mt-1.5 space-y-1 list-none p-0 m-0">
            {glance.drivers.map((d) => {
              const focusable = Boolean(d.targetId && onFocusTarget)
              const Row = (
                <>
                  <span className="min-w-0 flex-1 truncate text-left" title={d.label}>
                    {d.label}
                  </span>
                  {driversDiscriminate ? (
                    <span
                      className="h-1.5 w-16 shrink-0 rounded-full bg-panel-hover overflow-hidden sm:w-24"
                      aria-hidden="true"
                      data-testid={`${testId}-driver-bar`}
                    >
                      <span
                        className="block h-full rounded-full bg-info"
                        style={{ width: `${Math.round(d.fraction * 100)}%` }}
                      />
                    </span>
                  ) : null}
                  {focusable ? (
                    <ArrowRight
                      className="w-3 h-3 shrink-0 text-text-light opacity-0 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  ) : null}
                </>
              )
              return (
                <li key={d.id} data-testid={`${testId}-driver`} data-driver-id={d.id}>
                  {focusable ? (
                    <button
                      type="button"
                      onClick={() => onFocusTarget!(d.targetId!)}
                      className={`${typography.panelBody} group text-text-body w-full flex items-center gap-2 rounded hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                      data-testid={`${testId}-driver-focus`}
                    >
                      {Row}
                    </button>
                  ) : (
                    <span
                      className={`${typography.panelBody} group text-text-body w-full flex items-center gap-2`}
                    >
                      {Row}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          {typeof driverTotal === 'number' && driverTotal > glance.drivers.length ? (
            <p
              className={`${typography.panelMeta} text-text-light mt-1 mb-0`}
              data-testid={`${testId}-drivers-more`}
            >
              {COPY.glance.moreDrivers(driverTotal - glance.drivers.length)}
            </p>
          ) : null}
        </div>
      ) : null}
      {/* ── WHAT COULD CHANGE IT ───────────────────────────────────────────── */}
      {glance.condition ? (
        (() => {
          const focusable = Boolean(glance.condition.targetId && onFocusTarget)
          const Row = (
            <>
              <AlertTriangle
                className="w-3.5 h-3.5 mt-[3px] shrink-0 text-warning"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="text-text-header font-medium">{COPY.glance.couldChangeIf}</span>{' '}
                {glance.condition!.text}
              </span>
              {focusable ? (
                <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-text-light" aria-hidden="true" />
              ) : null}
            </>
          )
          return (
            <div
              className="rounded-md border-l-2 border-warning/40 bg-warning/[0.04] py-1.5 pl-2 pr-1"
              data-testid={`${testId}-condition`}
            >
              {focusable ? (
                <button
                  type="button"
                  onClick={() => onFocusTarget!(glance.condition!.targetId!)}
                  className={`${typography.panelBody} text-text-body w-full flex items-start gap-1.5 text-left rounded hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                  data-testid={`${testId}-condition-focus`}
                >
                  {Row}
                </button>
              ) : (
                <p
                  className={`${typography.panelBody} text-text-body w-full flex items-start gap-1.5 m-0`}
                >
                  {Row}
                </p>
              )}
            </div>
          )
        })()
      ) : null}
        </>
      )}

      {/* ── WHAT TO THINK ABOUT NEXT ───────────────────────────────────────── */}
      {primaryIntervention && onRunIntervention ? (
        <button
          type="button"
          onClick={() => onRunIntervention(primaryIntervention.id)}
          className="w-full flex items-start gap-2 rounded-lg bg-info/[0.06] px-2.5 py-2 text-left hover:bg-info/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
          data-testid={`${testId}-primary-intervention`}
          data-recommendation-id={primaryIntervention.id}
        >
          <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-info" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className={`${typography.panelBody} text-text-header font-medium block`}>
              {primaryIntervention.label}
            </span>
            {primaryIntervention.why ? (
              <span className={`${typography.panelMeta} text-text-light block mt-0.5`}>
                {primaryIntervention.why}
              </span>
            ) : null}
          </span>
          <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-text-light" aria-hidden="true" />
        </button>
      ) : null}
    </section>
  )
}
