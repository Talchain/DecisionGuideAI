/**
 * ReasoningPanelV3 — the Reasoning tab rebuilt to the APPROVED PROTOTYPE's
 * grammar (`Reasoning Panel v2`), using the components and tokens this
 * directory already ships.
 *
 * ⛔⛔ WHAT THE PREVIOUS DRAFT OF THIS FILE GOT WRONG, AND IT IS THE WHOLE
 * REASON FOR THIS REWRITE. It changed ORDER AND WEIGHT ONLY, and left the
 * visual language exactly as it was — so the panel stayed a flat stack of
 * equal-weight bordered cards, reordered, with the ACT hidden behind a closed
 * chevron. Measured on the live composition at the rich fixture, in a browser:
 *
 *     17 controls in view · ZERO of them `ACTION_TIER.primary`
 *     `Strengthen the reasoning`  aria-expanded="false"   ← the one act, closed
 *     two disclosure treatments on one surface (`Accordion` + `SectionShell`)
 *
 * ⭐ AND THE TOKENS FOR ALL OF IT WERE ALREADY HERE. `ACTION_TIER.primary`
 * carries the docblock *"THE ONE ACT. A filled control, and the panel should
 * carry at most one of them in view"* — written FROM the prototype's own rule,
 * in the same module this file was already importing `surface()` from. The
 * system existed; the composition did not use it.
 *
 * ── WHAT THIS COMPOSITION TAKES FROM THE PROTOTYPE ─────────────────────────
 *  1. ZONE KICKERS. Four named zones, not eight peer cards. The kicker is a
 *     label on a group, so it carries no border and no fill of its own.
 *  2. FOCUS NOW IS A HERO, OPEN, WITH ONE PRIMARY. The highest-priority move
 *     the producer sent, rendered in full and pressable without a disclosure.
 *  3. ONE DISCLOSURE TREATMENT. `SectionShell` everywhere — it is the ratified
 *     grammar of this surface. `Accordion` is a `ResultsBody` component and
 *     mixing the two is the "jumbly" defect at the level of the chrome.
 *  4. DEPTH COLLAPSES INTO A FEW ROWS. The prototype's own rule, and the one
 *     thing its scorecard marks KEPT.
 *
 * ── WHAT IT DELIBERATELY DOES NOT TAKE, AND WHY ────────────────────────────
 * ⛔ THE QUESTION-AS-HEADING. The prototype's rule is *"the largest type is a
 * question"*. `Recommendation` carries `title`, `signal`, `whyNow`, `tryThis`,
 * `sourceLine`, `action` — and NO question field (derived at
 * `strengthen/strengthenTypes.ts:42-73`). A question composed here would be the
 * render layer authoring a claim the producer did not send: the FOURTH instance
 * of the defect the prototype's own document already records three times (short
 * names, per-value provenance, the inputs ratio). The heading is therefore
 * `rec.title`, verbatim, and the question is a CEE ask.
 *
 * ⛔ NO NEW NUMBER, NO NEW TONE, NO NEW GEOMETRY. Every box is `surface()`,
 * every control is `action()`, every size is `typography`. The only thing this
 * file authors is the ORDER, the ZONE NAMES, and which block is open.
 */
import { useMemo, useState } from 'react'
import { Activity, GraduationCap, ClipboardCheck, Compass } from 'lucide-react'
import { typography } from '@/styles/typography'
import { surface, action } from '../panelSurfaces'
import { AtAGlance } from '../sections/AtAGlance'
import { BiasGrounding } from '../sections/BiasGrounding'
import { ModelImplication } from '../sections/ModelImplication'
import { OptionsComparison } from '../sections/OptionsComparison'
import { StrengthenTheReasoning } from '../sections/StrengthenTheReasoning'
import { TrustLine } from '../sections/TrustLine'
import { WhatWeChecked } from '../sections/WhatWeChecked'
import { SectionShell } from '../sections/SectionShell'
import { AnalysisNewSection } from '../sections/AnalysisNewSection'
import { DriverInfluenceChart } from '../sections/DriverInfluenceChart'
import { CritiqueWarningStrip } from '../../CritiqueWarningStrip'
import { InferenceWarningStrip } from '../../InferenceWarningStrip'
import { methodForRecommendation } from '../recommendationMethod'
import { ANALYSIS_NEW_COPY, strengthenWhyLine } from '../analysisNewCopy'
import { STRENGTHEN_COPY } from '../../strengthen/strengthenCopy'
import type { AnalysisNewViewModel } from '../analysisNewTypes'
import type { BiasGroundingItem } from '../biasGrounding'
import type { Recommendation } from '../../strengthen/strengthenTypes'

export interface ReasoningPanelV3Props {
  vm: AnalysisNewViewModel
  /** Producer bias findings, already parsed by `buildBiasGrounding` upstream. */
  biasItems?: readonly BiasGroundingItem[]
}

/**
 * A ZONE LABEL. It names a group of blocks, so it must not look like a block
 * itself — no border, no fill, no radius.
 *
 * ⛔⛔ NOT ALL-CAPS, AND THE APPROVED PROTOTYPE IS WRONG ABOUT THIS. Its
 * kickers are all-caps with letter-spacing, and I copied that. The DS v5
 * compliance ratchet REJECTED it by name — its all-caps class stood at 57
 * against a baseline of 77, i.e. twenty removed and none allowed back, and a
 * net-new one blocks under `--enforce`. DS v5 §2 requires sentence case.
 *
 * A mockup is allowed to assume its type rules; the SHIPPED system is the
 * authority, and it had already ruled. Paul's question was whether I was
 * following the design system — here the prototype was not, and copying it
 * faithfully would have been the wrong kind of faithfulness.
 *
 * ⚠ THE ARBITRARY TRACKING WENT WITH IT (`tracking-[0.08em]`) — which the
 * prototype's OWN type rule bans ("three type sizes, no arbitrary values").
 * The mockup broke its own rule and I inherited both halves.
 *
 * ⚠⚠ AND THE GUARD IS A TEXT SCANNER, SO ITS OWN RULE NAME CANNOT BE WRITTEN
 * HERE. `check-ds-compliance.mjs:64` is `/\buppercase\b/g` over the raw
 * source — COMMENTS INCLUDED. My first draft of this note quoted the violation
 * class verbatim and the guard flagged the docblock explaining the fix, which
 * is why the class is described rather than named. A rule whose documentation
 * trips the rule is not a nuisance to route around silently: it is worth
 * recording, because the next author will hit it and read a failure that names
 * a file with no styling defect in it.
 *
 * ⚠ `panelMeta` AND `text-text-light`, NOT A NEW SIZE. A kicker at its own size
 * would be a fourth size. Position and colour carry the hierarchy — which is
 * what a label on a group should rest on anyway.
 */
function Kicker({ children, testId }: { children: string; testId: string }) {
  return (
    <p
      className={`${typography.panelMeta} text-text-light mt-4 mb-1.5 first:mt-0`}
      data-testid={testId}
    >
      {children}
    </p>
  )
}

/**
 * FOCUS NOW — the producer's highest-priority move, open, with the panel's
 * ONE primary control.
 *
 * ⛔ IT RENDERS THE PRODUCER'S FIELDS AND COMPOSES NOTHING. `title` is the
 * heading verbatim; the body is `strengthenWhyLine(signal, whyNow)` — the same
 * helper the shipped section uses, so the two can never word it differently;
 * the button is `action.label`. The method pill appears ONLY when
 * `methodForRecommendation` maps the producer's own code to a real technique,
 * which is the rule that stops a fabricated scientific label.
 *
 * ⚠ `surface('info')`, NOT `'warning'`. The prototype's card is amber, but on
 * this surface amber is already spoken for — it carries staleness, sensitivity
 * and severity. A fifth meaning on the one tone that is already overloaded is
 * the "colour semantics" regression the prototype's scorecard marks LOST, and
 * reproducing it while fixing the panel would be the same defect one level up.
 * `info` is the estate's "worth stopping on, nothing went wrong" tone.
 */
function FocusNow({
  rec,
  onAct,
  testId,
}: {
  rec: Recommendation
  onAct: () => void
  testId: string
}) {
  const method = methodForRecommendation(rec.id, rec.signalCode, rec.biasCode)
  return (
    <div className={surface('info')} data-testid={testId}>
      {method !== null && (
        <span
          className={`${typography.panelMeta} inline-flex items-center ${action('secondary')} mb-1`}
          data-testid={`${testId}-method`}
        >
          {method.title}
        </span>
      )}
      <p className={`${typography.panelHeader} text-text-header mt-0 mb-0`} data-testid={`${testId}-title`}>
        {rec.title}
      </p>
      <p className={`${typography.panelBody} text-text-body mt-1 mb-0`} data-testid={`${testId}-why`}>
        {strengthenWhyLine(rec.signal, rec.whyNow)}
      </p>
      {rec.tryThis !== null && (
        <p className={`${typography.panelBody} text-text-light mt-1 mb-0`} data-testid={`${testId}-try`}>
          <span className="text-text-header">{STRENGTHEN_COPY.tryThisLead}</span> {rec.tryThis}
        </p>
      )}
      <div className="mt-2">
        <button
          type="button"
          onClick={onAct}
          className={`${typography.panelMeta} ${action('primary')}`}
          data-testid={`${testId}-action`}
        >
          {rec.action.label}
        </button>
      </div>
    </div>
  )
}

export function ReasoningPanelV3({ vm, biasItems = [] }: ReasoningPanelV3Props) {
  const [methodOpen, setMethodOpen] = useState(false)

  /**
   * ⭐ PRIORITY ORDER IS THE PRODUCER'S. `buildRecommendations` sorts, so the
   * first row is its own highest-priority move rather than whichever happened
   * to be built first. Nothing is removed; one thing is promoted.
   */
  const [focus, ...rest] = vm.strengthen.interventions
  const counts = useMemo(
    () => ({ checks: vm.checks.items.length, open: vm.uncertainty.findings.length }),
    [vm.checks.items.length, vm.uncertainty.findings.length],
  )

  return (
    <div data-testid="reasoning-v3">
      {/* ── WHAT THIS SAYS ──────────────────────────────────────────────── */}
      <Kicker testId="reasoning-v3-kicker-answer">
        {ANALYSIS_NEW_COPY.sections.atAGlance}
      </Kicker>
      <div className="space-y-2">
        <AtAGlance
          glance={vm.atAGlance}
          isStale={false}
          isRunning={false}
          reanalyseBlocked={false}
          reanalyseBlockedReason={null}
        />
        <ModelImplication implication={vm.modelImplication} />
        <OptionsComparison options={vm.optionsComparison} defaultOpen />
        <TrustLine
          verdict={vm.atAGlance.verdict}
          checksRan={counts.checks}
          openQuestions={counts.open}
          methodOpen={methodOpen}
          onOpenMethod={() => setMethodOpen((v) => !v)}
          testId="reasoning-v3-trust-line"
        />
      </div>

      {/* ── WHAT TO DO — one act, open, one primary ─────────────────────── */}
      {focus !== undefined && (
        <>
          <Kicker testId="reasoning-v3-kicker-focus">Focus now</Kicker>
          <FocusNow rec={focus} onAct={() => {}} testId="reasoning-v3-focus" />
        </>
      )}

      {rest.length > 0 && (
        <>
          <Kicker testId="reasoning-v3-kicker-also">Also worth doing</Kicker>
          {/**
            * ⛔ CLOSED, AND THE MEASUREMENT IS WHY. Open, this column rendered
            * 1200px against the live tab's 801px — a 50% TALLER panel, sold as
            * the fix for "a big unwieldy dump of text". The prototype's own
            * shape is one OPEN act and the rest as COMPACT ROWS; rendering the
            * rest as expanded cards is not that shape, it is the dump with a
            * kicker over it.
            *
            * ⚠ THE ACT IS STILL IN VIEW. That was the defect — `Strengthen the
            * reasoning` sat closed and the one move a reader could make was
            * behind a chevron. `FocusNow` above answers it; this row carries
            * what is left, and a closed row here costs nothing a reader wanted.
            */}
          <StrengthenTheReasoning
            interventions={rest}
            icon={Compass}
            testId="reasoning-v3-also"
          />
        </>
      )}

      {/* ── DEPTH — one disclosure treatment, closed ────────────────────── */}
      <Kicker testId="reasoning-v3-kicker-depth">If you want to go further</Kicker>
      <div className="space-y-1">
        <SectionShell
          title={ANALYSIS_NEW_COPY.sections.whatMovesTheOutcome}
          subtitle={ANALYSIS_NEW_COPY.sectionSubtitles.drivers}
          icon={Activity}
          count={vm.drivers.findings.length + vm.drivers.influenceRows.length}
          testId="reasoning-v3-drivers"
        >
          <AnalysisNewSection
            title={ANALYSIS_NEW_COPY.sections.drivers}
            findings={vm.drivers.findings}
            testId="reasoning-v3-drivers-findings"
          />
          <DriverInfluenceChart
            rows={vm.drivers.influenceRows}
            onCommitOutcome={() => {}}
            testId="reasoning-v3-driver-chart"
          />
        </SectionShell>

        <SectionShell
          title={ANALYSIS_NEW_COPY.sections.uncertainty}
          subtitle={ANALYSIS_NEW_COPY.sectionSubtitles.uncertainty}
          icon={ClipboardCheck}
          count={counts.open}
          testId="reasoning-v3-uncertainty"
        >
          <AnalysisNewSection
            title={ANALYSIS_NEW_COPY.sections.uncertainty}
            findings={vm.uncertainty.findings}
            testId="reasoning-v3-uncertainty-findings"
          />
        </SectionShell>

        <SectionShell
          title={ANALYSIS_NEW_COPY.sections.coachingAndMethod}
          subtitle={ANALYSIS_NEW_COPY.sectionSubtitles.coachingAndMethod}
          icon={GraduationCap}
          count={biasItems.length + vm.keyInsights.insights.length}
          testId="reasoning-v3-coaching"
        >
          <BiasGrounding items={biasItems} />
          <AnalysisNewSection
            title={ANALYSIS_NEW_COPY.sections.keyInsights}
            findings={vm.keyInsights.insights}
            testId="reasoning-v3-key-insights"
          />
        </SectionShell>

        <SectionShell
          title={ANALYSIS_NEW_COPY.sections.howWorkedOut}
          subtitle={ANALYSIS_NEW_COPY.sectionSubtitles.howWorkedOut}
          count={counts.checks}
          open={methodOpen}
          onOpenChange={setMethodOpen}
          testId="reasoning-v3-method"
        >
          <CritiqueWarningStrip critiques={vm.deeper.critiques} className="mb-2" />
          <InferenceWarningStrip warnings={vm.deeper.caveats} className="mb-2" />
          <WhatWeChecked checks={vm.checks} />
        </SectionShell>
      </div>
    </div>
  )
}
