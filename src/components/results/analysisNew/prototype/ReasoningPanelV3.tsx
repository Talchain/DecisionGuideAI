/**
 * ReasoningPanelV3 — the PROPOSED information architecture for the Reasoning
 * tab, composed from the sections that already ship.
 *
 * ⭐ WHAT THIS CHANGES, AND IT IS ONLY ONE THING: the ORDER AND THE WEIGHT.
 * Every section below is the component the live tab already renders, taking
 * the same slice of the same `AnalysisNewViewModel`. Nothing new computes
 * anything; nothing here derives a claim about the model that the live tab
 * does not already derive. If this reads better, it reads better for
 * structural reasons alone — which is the point of showing it this way.
 *
 * THE DEFECT IT ADDRESSES. The live tab renders TWENTY top-level blocks in a
 * flat stack, every one at the same visual weight, and SEVEN of them answer a
 * single question — *how far can I trust this?* (`RobustnessCaveat`,
 * `WhatWeChecked`, uncertainty, `CritiqueWarningStrip`, `InferenceWarningStrip`,
 * `ModelHeldUp`, `WhatIWasGiven`). A reader who wants that answer must
 * assemble it from seven headings spread down a page. That is not a copy
 * problem and no amount of rewriting fixes it.
 *
 * THE SHAPE. Four blocks are always open, in the order a reader asks for them:
 *
 *     what does this say  ->  how far do I trust it  ->  what do I do
 *
 * Everything else sits behind four `Accordion`s, closed. `Accordion` is the
 * Results panel's own disclosure primitive (`components/results/Accordion.tsx`)
 * and the Reasoning tab has never called it — the machinery for this existed
 * before the tab did.
 *
 * ⛔ THE TRUST LINE INVENTS NO VERDICT. It renders `atAGlance.verdict.label`
 * and `verdict.reason`, both producer-owned — the reason is
 * `robustness.display_verdict_reason` VERBATIM — plus two COUNTS of things
 * already on screen. A count of rendered rows is not a claim about the model.
 * Where the producer sent no verdict the line says the basis was not
 * established and offers the detail; it never fills the gap.
 */
import { useId, useState } from 'react'
import { typography } from '@/styles/typography'
import Accordion from '../../Accordion'
import { CritiqueWarningStrip } from '../../CritiqueWarningStrip'
import { InferenceWarningStrip } from '../../InferenceWarningStrip'
import { AtAGlance } from '../sections/AtAGlance'
import { BiasGrounding } from '../sections/BiasGrounding'
import { ModelImplication } from '../sections/ModelImplication'
import { OptionsComparison } from '../sections/OptionsComparison'
import { StrengthenTheReasoning } from '../sections/StrengthenTheReasoning'
import { WhatWeChecked } from '../sections/WhatWeChecked'
import { AnalysisNewSection } from '../sections/AnalysisNewSection'
import { DriverInfluenceChart } from '../sections/DriverInfluenceChart'
import { ANALYSIS_NEW_COPY } from '../analysisNewCopy'
import type { AnalysisNewViewModel } from '../analysisNewTypes'
import type { BiasGroundingItem } from '../biasGrounding'

export interface ReasoningPanelV3Props {
  vm: AnalysisNewViewModel
  /** Producer bias findings, already parsed by `buildBiasGrounding` upstream. */
  biasItems?: readonly BiasGroundingItem[]
}

/**
 * ⚠ COUNTS OF RENDERED ROWS, NEVER A SCORE. Each number below is the length of
 * a list this panel already shows; none is a judgement and none is combined
 * with another into one. A single "trust score" would be exactly the derived
 * claim this surface must not make.
 */
function trustCounts(vm: AnalysisNewViewModel): { checks: number; open: number } {
  return {
    checks: vm.checks.items.length,
    open: vm.uncertainty.findings.length,
  }
}

export function ReasoningPanelV3({ vm, biasItems = [] }: ReasoningPanelV3Props) {
  const panelId = useId()
  const [openMethod, setOpenMethod] = useState(false)
  const verdict = vm.atAGlance.verdict
  const counts = trustCounts(vm)

  /**
   * ⭐ THE ONE ACT. `strengthen.interventions` arrives in PRIORITY order (the
   * builder sorts it), so the first row is the producer's own highest-priority
   * move rather than whichever happened to be built first. The rest stay
   * reachable one accordion down — nothing is removed, one thing is promoted.
   */
  const oneAct = vm.strengthen.interventions.slice(0, 1)
  const remainingActs = vm.strengthen.interventions.slice(1)

  return (
    <div className="space-y-3" data-testid="reasoning-v3">
      {/* ── 1. WHAT THIS SAYS ────────────────────────────────────────────── */}
      <AtAGlance
        glance={vm.atAGlance}
        isStale={false}
        isRunning={false}
        reanalyseBlocked={false}
        reanalyseBlockedReason={null}
      />

      <ModelImplication implication={vm.modelImplication} />

      <OptionsComparison options={vm.optionsComparison} defaultOpen />

      {/* ── 2. HOW FAR TO TRUST IT — one line, seven sections behind it ──── */}
      <div
        className="rounded-lg border border-panel-border px-3 py-2"
        data-testid="reasoning-v3-trust-line"
        role="status"
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={`${typography.panelBody} text-text-header font-medium`}>
            {verdict != null ? verdict.label : 'Basis not established'}
          </span>
          {verdict?.reason != null && (
            <span className={`${typography.panelMeta} text-text-light`}>{verdict.reason}</span>
          )}
        </div>
        <div className={`${typography.panelMeta} text-text-light mt-0.5`}>
          {counts.checks} {counts.checks === 1 ? 'check' : 'checks'} ran ·{' '}
          {counts.open} {counts.open === 1 ? 'open question' : 'open questions'}
          {' · '}
          <button
            type="button"
            className="rounded text-info underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
            aria-expanded={openMethod}
            aria-controls={`${panelId}-method`}
            onClick={() => setOpenMethod((v) => !v)}
            data-testid="reasoning-v3-how-worked-out"
          >
            How this was worked out
          </button>
        </div>
      </div>

      {/* ── 3. WHAT TO DO — one act ──────────────────────────────────────── */}
      {oneAct.length > 0 && (
        <StrengthenTheReasoning
          interventions={oneAct}
          defaultOpen
          testId="reasoning-v3-one-act"
        />
      )}

      {/* ── ON DEMAND ────────────────────────────────────────────────────── */}

      <Accordion
        title="Coaching and method"
        subtitle="Where this reasoning comes from"
        badgeCount={biasItems.length + vm.keyInsights.insights.length}
        defaultExpanded={false}
      >
        <BiasGrounding items={[...biasItems]} />
        <AnalysisNewSection
          title={ANALYSIS_NEW_COPY.sections.keyInsights}
          findings={vm.keyInsights.insights}
          testId="reasoning-v3-key-insights"
        />
      </Accordion>

      <Accordion
        title="What would change this"
        subtitle="The assumptions the answer turns on"
        badgeCount={vm.sensitivity.findings.length + vm.drivers.findings.length}
        defaultExpanded={false}
      >
        <AnalysisNewSection
          title={ANALYSIS_NEW_COPY.sections.sensitivity}
          findings={vm.sensitivity.findings}
          testId="reasoning-v3-sensitivity"
        />
        <AnalysisNewSection
          title={ANALYSIS_NEW_COPY.sections.drivers}
          subtitle={ANALYSIS_NEW_COPY.sectionSubtitles.drivers}
          findings={vm.drivers.findings}
          testId="reasoning-v3-drivers"
        />
        <DriverInfluenceChart
          rows={vm.drivers.influenceRows}
          onCommitOutcome={() => {}}
          testId="reasoning-v3-driver-chart"
        />
      </Accordion>

      <Accordion
        title="How this was worked out"
        subtitle="Checks, gaps and what the model was given"
        badgeCount={counts.checks + counts.open}
        defaultExpanded={openMethod}
      >
        <div id={`${panelId}-method`}>
          <CritiqueWarningStrip critiques={vm.deeper.critiques} className="mb-2" />
          <InferenceWarningStrip warnings={vm.deeper.caveats} className="mb-2" />
          <WhatWeChecked checks={vm.checks} />
          <AnalysisNewSection
            title={ANALYSIS_NEW_COPY.sections.uncertainty}
            subtitle={ANALYSIS_NEW_COPY.sectionSubtitles.uncertainty}
            findings={vm.uncertainty.findings}
            testId="reasoning-v3-uncertainty"
          />
        </div>
      </Accordion>

      {remainingActs.length > 0 && (
        <Accordion
          title="Other ways to strengthen this"
          badgeCount={remainingActs.length}
          defaultExpanded={false}
        >
          <StrengthenTheReasoning
            interventions={remainingActs}
            testId="reasoning-v3-other-acts"
          />
        </Accordion>
      )}
    </div>
  )
}
