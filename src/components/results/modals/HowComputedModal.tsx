/**
 * HowComputedModal — Model-Card-Lite: "How these numbers are computed"
 * (roadmap M4 / P1-9, the provenance thin-slice).
 *
 * A partner points at a number and asks "where did that come from?". This is
 * the on-screen answer: one card, plain language, no jargon a non-technical
 * buyer would bounce off.
 *
 * ⛔ HONESTY BAR — read before editing any string in this file.
 *
 *  · Every number our engines produce is described as COMPUTED FROM THE MODEL
 *    ON THE CANVAS — never as "sourced", "researched" or "evidence-based".
 *  · The card states plainly that NOTHING here is looked up: no external data,
 *    no literature, no web. That is not modesty, it is the truth of the
 *    system — the pinned contract carries no citation field on any block, and
 *    no producer emits one, so a citation rendered here would be fabricated.
 *  · The "This run" facts are DERIVED from the actual response by
 *    `buildMethodCard`. When the producer did not report a fact, the card says
 *    so out loud (`NOT_REPORTED`). It must never fall back to a plausible
 *    default — a made-up sample count on a trust surface is worse than a blank.
 *
 * Copy is exported as HOW_COMPUTED_COPY so tests assert the shipped strings
 * rather than a paraphrase of them.
 */
import { useMemo } from 'react'
import { useCanvasStore } from '../../../canvas/store'
import { typography } from '../../../styles/typography'
import { ModalShell } from './ModalShell'
import { useHowComputedStore, closeHowComputed } from './howComputedStore'
import { buildMethodCard, type MethodCardModel, type Provenanced } from './buildMethodCard'

export const HOW_COMPUTED_COPY = {
  title: 'How these numbers are computed',
  subtitle: 'What this analysis does, what it does not do, and what this run reported.',

  whatItDoesHeading: 'What the analysis does',
  whatItDoes: [
    /**
     * ⭐ THE TWO-QUESTION EXPLAINER — the anchor document for every
     * comparative label in the product (Paul's ruling, 2026-07-31).
     *
     * Modelled on CEE's own `TARGET_FIT_DEFINITION` register, which was
     * written after a live defect: an 89% comparative figure narrated as
     * target attainment on a run whose scored target fit was 29.3%
     * (scenario 90385279). CEE states it as "an option can win most often
     * yet still be unlikely to meet the target"; these two entries say the
     * same thing to the user, in the user's words.
     *
     * The order is load-bearing. The goal question comes first because it
     * is the one the user asked; the comparison comes second because it is
     * a fact about the option set, not about the goal. Every other string
     * in the change inherits this wording — if these two entries and a
     * label disagree, the label is wrong.
     */
    {
      heading: 'It answers two questions, and they are not the same question',
      body:
        'We run the model on your canvas many times over. Each run draws a different plausible value for every input you left a range on. Two readings come out of those runs. "Chance of hitting your goal" is the share of runs in which an option reached the success target you set. "Most likely outcome" is the middle of the results an option produced — half the runs landed above it, half below. An option can be ahead on one and behind on the other, so both are shown.',
    },
    {
      heading: 'It also counts which option came out ahead most often',
      body:
        'Separately from either question above, we count the runs in which each option scored higher than the rest. That is what "came out ahead in 60% of simulated scenarios" means. It compares your options with each other; it says nothing about your goal. An option can come out ahead most often and still be unlikely to reach the target you set — which is why this figure is shown below the goal figure, not above it.',
    },
    {
      heading: 'It finds what actually moves the result',
      body:
        'We vary one input at a time and measure how far the result moves. That is the ranking in Drivers: the inputs your decision is most exposed to.',
    },
    {
      heading: 'It estimates what is worth finding out',
      body:
        'For each uncertain input we estimate how much the result could shift if you pinned that one input down. That is what "worth finding out" means here — an estimate of the value of better information, not a measurement of it.',
    },
  ],

  whatItDoesNotHeading: 'What it does not do',
  whatItDoesNot: [
    /**
     * The A-anchor's availability condition, stated where the user can find
     * it. ISL computes a goal probability ONLY when a success threshold was
     * supplied, so on a run with no target there is no goal figure at all —
     * not a zero, not a fallback. Saying so here is what makes the panel's
     * "Set a success target…" line an invitation rather than an error.
     */
    'It does not produce a goal figure without a success target. "Chance of hitting your goal" needs a target to measure against. Without one, the panel shows how the options compare with each other and nothing about your goal.',
    'It does not look anything up. No external data, research, literature or web sources feed these numbers. Everything comes from the model you and Olumi built on the canvas — so there are no sources to cite here.',
    'It does not forecast what will happen. It compares options under the uncertainty you described; it has no view on the world beyond your model.',
    'It does not check whether your model is right. Wrong inputs produce confident-looking wrong answers, which is why the drivers list exists.',
    'The percentages are not calibrated. A 70% here has not been validated against how often such calls turn out right.',
  ],

  uncertaintyHeading: 'Where the uncertainty comes from',
  uncertainty: [
    'The ranges you set. Every input you gave a plausible range to becomes a distribution we sample from.',
    'Starting values you have not changed yet. New links and factors open on a default until you set them — those defaults are assumptions, not findings.',
    'The sampling itself. Running a finite number of scenarios leaves a little wobble in every figure; more samples, less wobble.',
  ],

  runHeading: 'This run',
  runNote:
    'Read from the analysis response itself. Anything the engines did not report is marked as such rather than filled in.',
  notReported: 'Not reported by this run',

  labels: {
    nSamples: 'Scenarios simulated',
    seed: 'Seed (makes the run repeatable)',
    evpiMethod: 'Value-of-information method',
    confidence: 'Confidence figures',
    stability: 'Robustness bands',
    autoNoise: 'Operational-uncertainty adjustment',
  },
} as const

/** The single place absence is rendered. Every unknown fact routes through here. */
function FactValue({ children }: { children: React.ReactNode }) {
  return <span className={`${typography.panelBody} text-text-body text-right`}>{children}</span>
}

function NotReported() {
  return (
    <span
      className={`${typography.panelBody} text-text-light text-right italic`}
      data-testid="how-computed-not-reported"
    >
      {HOW_COMPUTED_COPY.notReported}
    </span>
  )
}

/**
 * One run fact. The ONLY branch: reported → the producer's value; not
 * reported → an explicit disclosure. There is deliberately no default arm.
 */
function RunFact<T>({
  label,
  fact,
  render,
  testId,
}: {
  label: string
  fact: Provenanced<T>
  render: (value: T) => React.ReactNode
  testId: string
}) {
  return (
    <>
      <dt className={`${typography.panelMeta} text-text-light`}>{label}</dt>
      <dd className="text-right" data-testid={testId}>
        {fact.known ? <FactValue>{render(fact.value)}</FactValue> : <NotReported />}
      </dd>
    </>
  )
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-3">
      <h3 className={`${typography.panelHeader} text-text-header`}>{heading}</h3>
      {children}
    </section>
  )
}

function Bullets({ items, testId }: { items: readonly string[]; testId: string }) {
  return (
    <ul className="mt-1 flex list-disc flex-col gap-1.5 pl-4" data-testid={testId}>
      {items.map((text) => (
        <li key={text} className={`${typography.panelBody} text-text-body`}>
          {text}
        </li>
      ))}
    </ul>
  )
}

export interface HowComputedCardProps {
  model: MethodCardModel
}

/**
 * Pure body — takes the derived model, renders the card. Split from the
 * store-connected modal so tests can drive it with real captured responses.
 */
export function HowComputedCard({ model }: HowComputedCardProps) {
  const C = HOW_COMPUTED_COPY
  return (
    <div data-testid="how-computed-card">
      <Section heading={C.whatItDoesHeading}>
        <div className="mt-1 flex flex-col gap-2">
          {C.whatItDoes.map((item) => (
            <div key={item.heading}>
              <p className={`${typography.panelBody} font-semibold text-text-header`}>{item.heading}</p>
              <p className={`${typography.panelBody} text-text-body`}>{item.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section heading={C.whatItDoesNotHeading}>
        <Bullets items={C.whatItDoesNot} testId="how-computed-limits" />
      </Section>

      <Section heading={C.uncertaintyHeading}>
        <Bullets items={C.uncertainty} testId="how-computed-uncertainty" />
      </Section>

      <Section heading={C.runHeading}>
        <p className={`${typography.panelMeta} mt-0.5 text-text-light`}>{C.runNote}</p>
        <dl className="mt-1.5 grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1">
          <RunFact
            label={C.labels.nSamples}
            fact={model.nSamples}
            testId="how-computed-fact-samples"
            render={(n) => n.toLocaleString()}
          />
          <RunFact
            label={C.labels.seed}
            fact={model.seed}
            testId="how-computed-fact-seed"
            render={(s) => s}
          />
          <RunFact
            label={C.labels.evpiMethod}
            fact={model.evpiMethod}
            testId="how-computed-fact-evpi"
            // Producer's own word for its method, verbatim — "heuristic" is
            // reported as heuristic, never dressed up as a full computation.
            render={(m) => m}
          />
          <RunFact
            label={C.labels.confidence}
            fact={model.confidenceCalibration}
            testId="how-computed-fact-confidence"
            render={(c) => (c.isProvisional ? 'Provisional — not yet calibrated' : 'Calibrated')}
          />
          <RunFact
            label={C.labels.stability}
            fact={model.stabilityThresholds}
            testId="how-computed-fact-stability"
            render={(s) => (s.isProvisional ? 'Provisional thresholds' : 'Settled thresholds')}
          />
          <RunFact
            label={C.labels.autoNoise}
            fact={model.autoNoiseApplied}
            testId="how-computed-fact-autonoise"
            render={(applied) => (applied ? 'Applied' : 'Not applied')}
          />
        </dl>
      </Section>
    </div>
  )
}

/**
 * Store-connected modal. Mount ONCE (OutputsDock, beside the other results
 * modals); open from anywhere via `openHowComputed()`.
 */
export function HowComputedModal() {
  const isOpen = useHowComputedStore((s) => s.isOpen)
  const rawV2Response = useCanvasStore((s) => s.rawV2Response)
  const model = useMemo(() => buildMethodCard(rawV2Response), [rawV2Response])

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={closeHowComputed}
      title={HOW_COMPUTED_COPY.title}
      subtitle={HOW_COMPUTED_COPY.subtitle}
      titleId="how-computed-title"
      testId="how-computed-modal"
    >
      <HowComputedCard model={model} />
    </ModalShell>
  )
}

export default HowComputedModal
