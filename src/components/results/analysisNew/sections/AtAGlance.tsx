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
import { EXCLUDED_LABEL_NAME_CAP } from '../../utils/goalAnchorCopy'
import { NOT_ANALYSED_BADGE } from '../../utils/notAnalysedCopy'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { GLANCE_PROVENANCE_COPY } from '../glanceProvenanceCopy'
import { methodForRecommendation } from '../recommendationMethod'
import type { AtAGlance as AtAGlanceModel } from '../analysisNewTypes'

/** Verdict tone → the accent that carries it. */
const TONE_PILL: Record<string, string> = {
  stable: 'bg-success/10 text-success',
  mixed: 'bg-warning/10 text-warning',
  sensitive: 'bg-warning/10 text-warning',
}

/**
 * The same word, with the reassurance taken out of it.
 *
 * Used only for a STALE `stable` verdict — see `reassuranceIsStale` below.
 */
const TONE_PILL_STALE = 'bg-panel-hover text-text-light'

/**
 * ⭐⭐ A STALE RUN MAY NOT REASSURE, BUT IT MUST STILL WARN.
 *
 * Witnessed live: after a user replaced a value Olumi had invented, every
 * subsequent rerun failed silently and this panel kept the previous result on
 * screen — a green tick, "Stable", and "came out ahead in 91% of simulated
 * scenarios". Four different inputs, including a flipped risk profile, produced
 * byte-identical output. The chat surface said the honest thing at the same
 * moment ("I've stopped rather than show you a confident wrong answer"), so the
 * two surfaces disagreed and the one a user is more likely to read was the
 * wrong one. The result was stale *precisely because the user tried to improve
 * it*, which inverts the product's own principle.
 *
 * This block already knew about staleness — the eyebrow reframes to "As last
 * analysed" and the present-tense headline is suppressed (rule 3). The verdict
 * pill was simply never given the same treatment, which is trap 21: two parts
 * of one surface answering "is this current?" differently.
 *
 * ⚠ AND IT IS DELIBERATELY ASYMMETRIC, BECAUSE THE TWO DIRECTIONS ARE NOT THE
 * SAME HARM. Demoting a stale `stable` removes false reassurance. Demoting a
 * stale `sensitive` or `mixed` would mute a TRUE warning and make a fragile
 * result look calmer than it is — the mirror defect, and the worse one. One
 * predicate, two opposite harms, so only the reassuring tone is demoted.
 *
 * The word itself stays. Removing information is not the same as removing the
 * anchor: under a ribbon that already says the model has moved — or that we
 * cannot confirm it has not — a neutral "Stable" is a record of what the last
 * run found. A green tick is a claim about the model in front of you.
 *
 * ⚠ THIS USED TO CITE THE EYEBROW ("As last analysed"), which was this panel's
 * SECOND statement of one fact and has been retired; the ribbon is now the only
 * place the panel says it. The justification is unchanged in substance — only
 * the surface carrying it is different.
 */
function reassuranceIsStale(tone: string, isStale: boolean): boolean {
  return isStale && tone === 'stable'
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

/**
 * How many excluded options these rows name at rest.
 *
 * ⭐ THE REGISTER'S CONSTANT, NOT A SECOND NUMBER. This was a literal `2`,
 * justified by the scope note naming every option these rows name. Bounding
 * that note made the justification false and left two caps each resting on the
 * other's completeness. They are now one value.
 *
 * ⚠ SCOPE, EXACTLY — an earlier draft of this note said the two "cannot drift
 * apart", which overstated it and was caught in review. What the shared
 * constant fixes is HOW MANY each side names at rest. It does not by itself
 * make the two sides agree about the REMAINDER: the sentence counts every
 * missing option (`total - analysed`) while this list can only hold the ones
 * carrying a usable label. That gap is closed separately, by the unnamed-
 * remainder row below — not by this constant.
 */
export const EXCLUDED_OPTION_VISIBLE_CAP = EXCLUDED_LABEL_NAME_CAP

export interface AtAGlanceProps {
  glance: AtAGlanceModel
  onFocusTarget?: (targetId: string) => void
  driverTotal?: number
  primaryIntervention?: {
    id: string
    label: string
    why: string
    /** The producer's `signal_code` on a phase-3 finding; absent on the UI's
     * own triggers. Carried so the primary card can name a technique when the
     * producer's code names one — see `recommendationMethod.ts`. */
    signalCode?: string
  } | null
  onRunIntervention?: (recommendationId: string) => void
  /** The displayed run predates the current model. Reframes the answer. */
  isStale?: boolean
  /**
   * WHY the report may not match the model. Defaults to 'unconfirmed', which is
   * the honest reading of a caller that did not say — never 'changed', because
   * that would assert a fact from an absence.
   */
  staleKind?: 'changed' | 'unconfirmed' | null
  /** The producer disclosed the result as partial. */
  isProvisional?: boolean
  /** Which results did not come back, already named for this surface. */
  missingResults?: readonly string[]
  testId?: string
}

/**
 * The small label above a block.
 *
 * ⚠ THE FIRST DRAFT BROKE DS v5 §2.4 THREE WAYS ON ONE LINE — an arbitrary
 * 10px size, a raw weight, and a caps transform — caught by the
 * shell-conformance guard and the DS ratchet. Panel scope renders exactly three
 * sizes, and only from `panelHeader` / `panelBody` / `panelMeta`.
 *
 * ⚠ AND THE GUARD SCANS COMMENTS TOO. Naming the offending utilities literally
 * here re-triggered both checks on a file that no longer uses any of them, so
 * this note describes them instead of quoting them.
 *
 * The eyebrow still reads as an eyebrow: it is the smallest step, the lightest
 * colour, and slightly tracked. The hierarchy comes from the scale and the
 * spacing, which is what the scale is for.
 */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className={`${typography.panelMeta} text-text-light tracking-wide m-0`}>{children}</p>
  )
}

export function AtAGlance({
  glance,
  onFocusTarget,
  driverTotal,
  primaryIntervention,
  onRunIntervention,
  isStale = false,
  staleKind = 'unconfirmed',
  isProvisional = false,
  missingResults = [],
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

  // Rule 3 + 4. One ribbon, in the order a reader needs it: freshness first
  // (it invalidates the tense), completeness second (it bounds the claim).
  //
  // ⚠⚠ BUILT BEFORE `hasAnything`, AND THAT ORDER IS THE POINT — IT IS THE ONLY
  // FRESHNESS STATEMENT THIS PANEL MAKES. It used to be built AFTER the early
  // return below, so a run whose glance had no content dropped the trust bar
  // entirely and left the freshness claim to a row badge two sections down. The
  // bar is a claim about the RUN, not about the glance; gating it on the
  // glance's own content is what made it droppable, and once the restatements
  // go it would have been droppable to ZERO. `ribbon.length > 0` now counts as
  // content, so the invariant "a run that is not current says so, exactly once"
  // holds structurally rather than by luck.
  const ribbon: Array<{ testId: string; text: string }> = []
  /**
   * ⚠⚠ THIS USED TO ASSERT "the model has changed" ON A CANNOT-CONFIRM RUN.
   * The dock collapses `'stale'` and `'unknown'` into one boolean
   * (`OutputsDock.tsx:981`), so an absence of evidence was rendering as a
   * statement of fact — on this panel's FIRST line. The dock's own comment
   * forbids it and the old Analysis tab honours it with strict equality.
   */
  if (isStale) {
    ribbon.push(
      staleKind === 'changed'
        ? { testId: 'analysis-new-status-stale', text: COPY.status.stale }
        : { testId: 'analysis-new-status-freshness-unknown', text: COPY.status.freshnessUnknown },
    )
  }
  if (isProvisional) {
    // Name them when we can; the generic sentence stands when we cannot.
    ribbon.push({
      testId: 'analysis-new-status-provisional',
      text:
        missingResults.length > 0
          ? COPY.status.provisionalNaming(missingResults)
          : COPY.status.provisional,
    })
  }

  /**
   * ⚠⚠ THE PRIMARY INTERVENTION COUNTS AS SOMETHING, AND LEAVING IT OUT MADE
   * THIS SURFACE MUTE BEFORE A RUN. Witnessed on deployed `5f2d9703`, guest,
   * on a live-drafted model: pre-run this tab rendered its placeholder
   * sentence and a collapsed "Strengthen the reasoning · 1" — and nothing
   * else. The one real, producer-grounded move ("Define what success looks
   * like") was in the view model and never reached the screen.
   *
   * The cause is that the two modules answered different questions under one
   * name. `buildAnalysisNewViewModel` blanks every RUN-DERIVED field pre-run
   * and, in terms, does NOT blank `strengthen` — "it is derived from the
   * MODEL, which exists before any run". This guard then tested only
   * run-derived fields, so it discarded the one thing its own component
   * renders that is not a reading of a run. Neither module was wrong alone;
   * the guard was simply answering "did a run produce anything?" while the
   * component's contract is "have I anything to show?" (CLAUDE.md trap 21).
   *
   * Adding it here rather than opening the collapsed section is deliberate:
   * `SectionShell`'s default-closed rule exists because this panel measured
   * 1,584px against a 769px viewport, and reopening a section would spend
   * that fix. One card is not a section.
   */
  const hasAnything =
    glance.headline ||
    glance.verdict ||
    glance.drivers.length > 0 ||
    glance.condition ||
    (primaryIntervention && onRunIntervention) ||
    ribbon.length > 0
  if (!hasAnything) return null

  // Rule 2. `fraction` is relative to the strongest, so max is 1 by
  // construction; the spread is therefore 1 - min.
  const fractions = glance.drivers.map((d) => d.fraction)
  const driversDiscriminate =
    glance.drivers.length > 1 &&
    Math.max(...fractions) - Math.min(...fractions) >= DRIVER_SPREAD_MIN

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
          className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning/[0.05] px-2 py-1.5"
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
          The only large type on the surface. `headline`'s present-tense
          sentence is never rendered here (rule 3) — see the eyebrow note.

          ⚠⚠ THE EYEBROW NO LONGER SWITCHES ON FRESHNESS, AND THE REASON IS THAT
          THE SENTENCE IT WAS RE-TENSING IS NOT ON THIS SURFACE. `eyebrowStale`
          ("As last analysed") existed to put `glance.headline` — composed as
          "… currently scores higher" — into the past. But the line below renders
          `glance.leaderLabel ?? glance.headline`, and the view model sets
          `leaderLabel = headline && leader ? leader.label : null` while
          `headline` is non-null only when `leader` is: so `leaderLabel` is
          non-null exactly when `headline` is, the fallback never fires, and what
          reaches the screen is the OPTION LABEL — a noun phrase, carrying no
          tense to repair. (`freshnessSaidOnce.spec.tsx` pins that precondition
          in-test rather than trusting this paragraph.)

          What the swap DID do was cost the reader the role label on exactly the
          runs where the reading is hardest: a stale panel named an option and
          no longer said it was the leading one. The freshness condition is
          stated once, in the ribbon directly above, where it scopes the whole
          panel instead of one line — three statements of one fact is noise, and
          noise crowds out the only useful response, which is to re-run. */}
      {showAnswer ? (
        <div>
          <Eyebrow>{COPY.glance.eyebrowLeading}</Eyebrow>
          <p
            className={`${typography.panelHeader} mt-1 mb-0 text-text-header text-balance`}
            data-testid={`${testId}-headline`}
          >
            {glance.leaderLabel ?? glance.headline}
          </p>
        </div>
      ) : null}

      {/* ── HOW MUCH TO RELY ON IT ─────────────────────────────────────────
          The share AS A SENTENCE with a bar, the verdict word as a pill beside
          it, the producer's own reason sentence beneath.

          ⚠⚠ THIS BLOCK RENDERED THE SHARE AS A BARE NUMERAL IN THE PANEL'S
          LARGEST TYPE UNTIL 2026-08-31, and that was the defect, not the
          styling. Olumi's alignment principle says the product must mitigate
          anchoring — "especially anchoring on a number the AI supplied" — and
          on a fresh run every input feeding this share is Olumi's own estimate,
          not the user's. A percentage set larger than everything around it is
          read as the answer, which is the one thing this panel is not for.

          The fix is not a smaller numeral: it is `winShare`, the producer-
          gated sentence the view model already composed and nothing rendered
          ("Ahead in 66% of simulated futures"). The number survives intact —
          it is simply no longer the largest thing on screen, and it now
          arrives inside a claim that says what it ranges over. The separate
          caption beneath it went with it; the sentence subsumes it. */}
      {glance.verdict ? (
        <div data-testid={`${testId}-verdict`} data-verdict-tone={glance.verdict.tone}>
          <div className="flex items-start gap-2">
            {glance.winShare ? (
              <span
                className={`${typography.panelBody} text-text-header`}
                data-testid={`${testId}-win-share`}
              >
                {glance.winShare}
              </span>
            ) : null}
            <span
              className={`${typography.panelMeta} shrink-0 rounded-full px-2 py-0.5 ${
                reassuranceIsStale(glance.verdict.tone, isStale)
                  ? TONE_PILL_STALE
                  : TONE_PILL[glance.verdict.tone]
              }`}
              data-testid={`${testId}-verdict-line`}
              // The producer's own verdict, unchanged — the demotion is a
              // display decision about currency, never a re-reading of what the
              // analysis found.
              data-verdict-demoted={
                reassuranceIsStale(glance.verdict.tone, isStale) ? 'stale' : undefined
              }
            >
              {reassuranceIsStale(glance.verdict.tone, isStale) ? null : glance.verdict.tone ===
                'stable' ? (
                <CheckCircle className="inline w-3 h-3 -mt-px mr-1" aria-hidden="true" />
              ) : (
                <AlertTriangle className="inline w-3 h-3 -mt-px mr-1" aria-hidden="true" />
              )}
              {glance.verdict.label}
            </span>
          </div>

          {glance.winFraction !== null ? (
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
          ) : null}

          {glance.verdict.reason ? (
            <p
              className={`${typography.panelMeta} text-text-light mt-1 mb-0`}
              data-testid={`${testId}-verdict-reason`}
            >
              {glance.verdict.reason}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ── WHAT IT RESTS ON ───────────────────────────────────────────────
          ⭐⭐ THE ANTECEDENT, AND IT BELONGS HERE RATHER THAN ANYWHERE ELSE.

          Olumi's alignment principle is conditional in form: analysis describes
          what the model implies GIVEN its assumptions and evidence, and what
          the product invented must stay distinguishable from what the user
          knows. This panel had the consequent in its largest type and the
          antecedent nowhere — on a run driven 30 Aug 2026 every factor was
          Olumi's own estimate, and the surface stating "Ahead in 68% of
          simulated futures" said so in no place a reader would reach.

          It sits immediately beneath the share, not in a disclosure and not at
          the foot of the panel, for the same reason the scope note does: it
          changes what the sentence above means, so a reader who sees one must
          see the other.

          ⚠ IT DOES NOT GO QUIET WHEN THE PRODUCER DOES. That was the defect:
          a run whose factor rows the producer left unsettled — the commonest
          real payload, 9 of the 25 factor-bearing captures in this repo —
          rendered no line at all, so the share above sat with its basis stated
          nowhere and read as though something had established it. That run now
          resolves to the `undetermined` kind and says so.

          ⚠ STILL SILENT WHERE SILENCE IS THE TRUTH. `inputProvenance` is null
          when there are no factor rows to describe, and this renders nothing
          at all in that state. There is no fallback wording, because every
          wording that attributes the figures to somebody is a claim.

          ⚠ GATED ON A READING BEING PRESENT. A bare statement of what the
          inputs were, with no conclusion above it to condition, is a caveat
          orphaned from its claim. */}
      {glance.inputProvenance &&
      (showAnswer || glance.verdict || glance.drivers.length > 0) ? (
        <p
          className={`${typography.panelMeta} text-text-light m-0`}
          data-testid={`${testId}-input-provenance`}
          data-input-provenance={glance.inputProvenance}
        >
          {GLANCE_PROVENANCE_COPY[glance.inputProvenance]}
        </p>
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
            {/* ⭐ THE OPTIONS THIS LIST CANNOT NAME, so the section adds up.
                `excluded` is filtered to options with a usable label
                (`buildAnalysisNewViewModel.ts` drops a blank label and one that
                is merely the node's own id). The scope sentence above counts
                ALL of them — "…and 28 others were left out" — so without this
                row the sentence and the list below it report two different
                populations, and the disclosure control offers to reveal 3 when
                the sentence just said 28. Same defect class as the two caps
                this change bound together, one level out. */}
            {(() => {
              const s = glance.comparisonScope.scope
              const unnameable = s.total - s.analysed - glance.comparisonScope.excluded.length
              return unnameable > 0 ? (
                <li
                  className={`${typography.panelMeta} text-text-light flex items-start gap-1.5`}
                  data-testid={`${testId}-excluded-unnamed`}
                >
                  <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-text-light" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    {COPY.disclosure.unnamedExcluded(unnameable)}
                  </span>
                </li>
              ) : null
            })()}
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
                <span className="text-text-header">{COPY.glance.couldChangeIf}</span>{' '}
                {glance.condition!.text}
              </span>
              {focusable ? (
                <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-text-light" aria-hidden="true" />
              ) : null}
            </>
          )
          return (
            <div
              className="rounded-md border border-warning/30 bg-warning/[0.04] px-2 py-1.5"
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
                    /* ⚠ THE BAR USED TO WIDEN ON THE VIEWPORT, NOT THE PANEL.
                       This lives in a dock whose floor is 278px, and the
                       breakpoint it branched on is satisfied by any desktop
                       window — so on the narrowest, shipped default it took the
                       WIDER size and the label beside it, which is truncated,
                       lost the room. The bar is decoration; the driver's name is
                       the information. A panel-aware branch is available
                       (`usePanelWidth`) if a wide dock should ever get more. */
                    <span
                      className="h-1.5 w-16 shrink-0 rounded-full bg-panel-hover overflow-hidden"
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
                      className="h-1.5 w-16 shrink-0 rounded-full bg-panel-hover overflow-hidden"
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
                <span className="text-text-header">{COPY.glance.couldChangeIf}</span>{' '}
                {glance.condition!.text}
              </span>
              {focusable ? (
                <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-text-light" aria-hidden="true" />
              ) : null}
            </>
          )
          return (
            <div
              className="rounded-md border border-warning/30 bg-warning/[0.04] px-2 py-1.5"
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
            <span className={`${typography.panelHeader} text-text-header block`}>
              {primaryIntervention.label}
            </span>
            {/* ⭐ THE MOST PROMINENT COACHING CARD NAMES ITS TECHNIQUE. This is
                the one move a reader meets without opening anything, so if any
                card should say WHICH science-grounded method it is, it is this
                one. Rendered as a label rather than a control: the card is
                already a button, and a nested button is invalid markup — the
                card's own click runs the intervention, which is the same
                destination the chip would have offered.

                `null` for most findings by design (`recommendationMethod.ts`);
                nothing renders then, never a default technique. */}
            {(() => {
              const method = methodForRecommendation(
                primaryIntervention.id,
                primaryIntervention.signalCode,
              )
              return method ? (
                <span
                  className={`${typography.panelMeta} inline-flex items-center rounded-full bg-info/10 px-2 py-0.5 text-info mt-1`}
                  data-testid={`${testId}-primary-method`}
                  data-method-id={method.id}
                >
                  {method.title}
                </span>
              ) : null
            })()}
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
