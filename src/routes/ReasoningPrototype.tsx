/**
 * ReasoningPrototype — INTERNAL side-by-side for the Reasoning tab's
 * information architecture. `/#/dev/reasoning-prototype`, behind `devRoutes`.
 *
 * ⭐ WHY THIS IS A ROUTE AND NOT AN HTML MOCK. The previous prototype
 * (`Reasoning Panel v2.html`) went stale because nothing bound it to the
 * product: it could drift from the contract silently and did. This renders
 * BOTH arms from the SAME typed `ResultsSectionDataReturn` fixture through the
 * SAME `buildAnalysisNewViewModel`, so the compiler refuses a prototype that
 * has drifted, and approving it ships it — there is no second build.
 *
 * LEFT is the live composition (`AnalysisNewTabBody`, unmodified). RIGHT is
 * the proposal (`ReasoningPanelV3`). Same data, same components, same view
 * model. The ONLY difference between the columns is order and weight.
 *
 * ⚠ FIXTURE DATA, NEVER ANALYSIS OUTPUT. Every scenario below is a typed
 * fixture already used by the suite; none of it came off a wire.
 */
import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { typography } from '@/styles/typography'
import { isDevRoutesEnabled } from '@/flags'
import { AnalysisNewTabBody } from '../components/results/analysisNew/AnalysisNewTabBody'
import { ReasoningPanelV3 } from '../components/results/analysisNew/prototype/ReasoningPanelV3'
import { buildAnalysisNewViewModel } from '../components/results/analysisNew/buildAnalysisNewViewModel'
import { buildStrengthenInputsForAnalysisNew } from '../components/results/analysisNew/buildStrengthenInputsForAnalysisNew'
import { buildRecommendations } from '../components/results/strengthen/buildRecommendations'
import { buildBiasGrounding } from '../components/results/analysisNew/biasGrounding'
import { useCanvasStore } from '../canvas/store'
import { richFixture } from '../__fixtures__/resultsPanelV7.rich.hook'
import { sensitiveFixture } from '../__fixtures__/resultsPanelV7.sensitive.hook'
import { normalisedFixture } from '../__fixtures__/resultsPanelV7.normalised.hook'
import type { ResultsSectionDataReturn } from '../components/results/useResultsSectionData'
import type { Recommendation } from '../components/results/strengthen/strengthenTypes'

/** Real OutputsDock content width: 416px default dock − 24px body padding. */
const DOCK_CONTENT_WIDTH = 392

/**
 * ⚠ FIXTURE INTERVENTIONS. `buildRecommendations` is the real engine and this
 * route runs it (below), but it needs producer guidance the shared fixtures do
 * not carry, so on fixture data it correctly returns none. These two stand in
 * so the ONE ACT block can be reviewed; they are shaped exactly as the engine's
 * output and are IN PRIORITY ORDER, which is the property the block relies on.
 */
const FIXTURE_INTERVENTIONS: Recommendation[] = [
  {
    id: 'fx-define-success',
    helpType: 'clarify',
    title: 'Say what a good outcome would be',
    signal: 'No success target is set on the goal',
    whyNow:
      'Without a target the run can rank the options but cannot say whether any of them is good enough.',
    tryThis: 'Set the revenue figure you would need to see for this to have been worth doing.',
    sourceLine: 'Goal has no threshold',
    action: { kind: 'open-modal', label: 'Set a success target' },
    targetId: 'goal-arr',
    priority: 1,
  },
  {
    id: 'fx-challenge-hinge',
    helpType: 'challenge',
    title: 'Test the assumption the answer turns on',
    signal: 'One factor accounts for most of the movement between options',
    whyNow: 'If that estimate is wrong, the ranking changes; nothing else in the model does.',
    tryThis: 'Ask what evidence would move it, and who disagrees with the current figure.',
    sourceLine: 'Tech lead hired is the hinge',
    action: { kind: 'ai-dialogue', label: 'Challenge this estimate' },
    targetId: null,
    priority: 2,
  },
]

/**
 * ⭐ THE WORKAROUND THAT WAS HERE IS GONE, AND THAT IS THE POINT OF A PROTOTYPE
 * BOUND TO THE PRODUCT. This route used to patch `completeness` onto each
 * fixture because all three omitted a field `ResultsSectionDataReturn` declares
 * REQUIRED — hidden by a baselined TypeScript error, and a runtime throw rather
 * than a degraded render. The fixtures now carry it and the builder's two reads
 * of that field agree, so there is nothing left to patch.
 */
/**
 * ⚠ FIXTURE BIAS FINDINGS. The live tab reads `ceeAnalysisReady.bias_findings`
 * off the canvas store, which no route-level prototype has. These are shaped
 * exactly as the producer sends them and go through the SAME
 * `buildBiasGrounding` parser, so the section renders what it would render —
 * but the CONTENT is invented for the review and is not from any run.
 */
const FIXTURE_BIAS_FINDINGS: readonly unknown[] = [
  {
    id: 'DSK-B-003',
    mechanism:
      'Early figures anchor later ones: the first number named in a discussion pulls every subsequent estimate towards it, even when the group knows it was arbitrary.',
    citation: 'Tversky & Kahneman (1974), Judgment under Uncertainty',
    intervention: {
      steps: [
        'Have each person write their estimate before anyone speaks.',
        'Reveal all estimates at once, then discuss the spread rather than the average.',
      ],
      estimated_minutes: 10,
    },
  },
  {
    id: 'DSK-B-011',
    mechanism:
      'Confidence in a plan rises with the detail of the plan, not with the evidence for it. A richer model can feel more certain while resting on the same assumptions.',
    citation: 'Kahneman & Lovallo (1993), Timid Choices and Bold Forecasts',
    intervention: {
      steps: ['Name the three assumptions that would most change the answer if wrong.'],
      estimated_minutes: 5,
    },
  },
]

const SCENARIOS: ReadonlyArray<{ id: string; label: string; data: ResultsSectionDataReturn }> = [
  { id: 'rich', label: 'Rich run', data: richFixture },
  { id: 'sensitive', label: 'Sensitive run', data: sensitiveFixture },
  { id: 'normalised', label: 'Normalised run', data: normalisedFixture },
  /**
   * ⭐ THE TRUST LINE IN ITS ORDINARY STATE. The three shared fixtures carry no
   * `robustnessVerdict`, so the glance correctly has no verdict and the line
   * reads "Basis not established" — honest, and not the state worth reviewing.
   * This variant sets the producer field and nothing else, so the line renders
   * the producer's own word and its `display_verdict_reason`.
   */
  {
    id: 'verdict',
    label: 'Run with a robustness verdict',
    data: ({
      ...richFixture,
      recommendation: {
        ...richFixture.recommendation,
        robustnessVerdict: 'moderate',
        robustnessVerdictReason:
          'The ranking holds across most sampled futures but flips when demand growth is at the low end.',
      },
    } as ResultsSectionDataReturn),
  },
]

export function ReasoningPrototype() {
  if (!isDevRoutesEnabled()) return <Navigate to="/" replace />
  return <ReasoningPrototypeBody />
}

function ReasoningPrototypeBody() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id)
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]

  /**
   * ⭐ THE SAME ENGINE THE TAB RUNS. `buildRecommendations` is the authority on
   * what a grounded intervention is; this route runs it over the fixture and
   * renders the result, exactly as `useAnalysisNewViewModel` does. It never
   * adds one of its own.
   */
  const recommendations = useMemo(
    () =>
      buildRecommendations(
        buildStrengthenInputsForAnalysisNew({
          data: scenario.data,
          guidanceItems: [],
          biasSignals: [],
          currentStage: null,
        }),
      ),
    [scenario],
  )

  const vm = useMemo(
    () =>
      buildAnalysisNewViewModel({
        data: scenario.data,
        recommendations: recommendations.length > 0 ? recommendations : FIXTURE_INTERVENTIONS,
        isPreRun: false,
        isRunning: false,
        isStale: false,
      }),
    [scenario, recommendations],
  )

  const biasItems = useMemo(() => buildBiasGrounding(FIXTURE_BIAS_FINDINGS), [])

  /**
   * ⭐ SEEDED SO THE LEFT COLUMN SHOWS THE REAL TAB'S COACHING STATE. The live
   * tab reads `ceeAnalysisReady.bias_findings` off the canvas store, so without
   * this the restructured tab renders its coaching group closed over an empty
   * message — which is the one state NOT worth reviewing. Same fixture the
   * right column uses, through the same parser.
   */
  useEffect(() => {
    useCanvasStore.setState({
      ceeAnalysisReady: { bias_findings: FIXTURE_BIAS_FINDINGS },
    } as never)
  }, [])

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6" data-testid="reasoning-prototype">
      <header className="space-y-2">
        <h1 className={`${typography.panelHeader} text-text-header`}>
          Reasoning tab — information architecture proposal
        </h1>
        <p className={`${typography.panelBody} text-text-light`}>
          Fixture data only. Both columns render the same typed fixture through the same view-model
          builder and the same section components. The only difference is order and weight.
        </p>
        <div className="flex gap-2 pt-1">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScenarioId(s.id)}
              aria-pressed={s.id === scenarioId}
              className={
                s.id === scenarioId
                  ? 'px-2.5 py-1 rounded-full bg-primary text-text-on-color focus:outline-none focus-visible:ring-2 focus-visible:ring-info'
                  : 'px-2.5 py-1 rounded-full border border-panel-border hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info'
              }
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-wrap gap-6">
        <section className="space-y-2" data-testid="proto-now">
          <h2 className={`${typography.panelBody} text-text-header`}>Reasoning tab — restructured (live code)</h2>
          <p className={`${typography.panelMeta} text-text-light`}>
            The real AnalysisNewTabBody. Answer first, then three named groups, closed.
          </p>
          <div
            className="rounded-lg bg-panel-hover/40 p-3 max-h-[75vh] overflow-y-auto"
            style={{ width: DOCK_CONTENT_WIDTH + 24 }}
          >
            <AnalysisNewTabBody
              resultsSectionData={scenario.data}
              isPreRun={false}
              isRunning={false}
              isStale={false}
            />
          </div>
        </section>

        <section className="space-y-2" data-testid="proto-next">
          <h2 className={`${typography.panelBody} text-text-header`}>
            V3 reference composition
          </h2>
          <p className={`${typography.panelMeta} text-text-light`}>
            The trust line and one-act ideas, not yet ported into the tab.
          </p>
          <div
            className="rounded-lg bg-panel-hover/40 p-3 max-h-[75vh] overflow-y-auto"
            style={{ width: DOCK_CONTENT_WIDTH + 24 }}
          >
            <ReasoningPanelV3 vm={vm} biasItems={biasItems} />
          </div>
        </section>
      </div>
    </div>
  )
}

export default ReasoningPrototype
