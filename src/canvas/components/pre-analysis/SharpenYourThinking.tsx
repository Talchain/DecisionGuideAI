/**
 * SharpenYourThinking — Brief 5.8A D5.
 *
 * T2 collapsed accordion that surfaces deterministic bias and framing cards.
 * Bias rows come from the D2-filtered `biasTriggers` list (single source) so
 * we never re-derive or re-filter them locally. Framing cards are derived
 * from structural conditions on the goal node (no baseline value, no
 * success target).
 *
 * The accordion suppresses entirely when both lists are empty, so an empty
 * container never renders.
 *
 * All copy strings live in `docs/brief-5_8a-d5-copy.md` and are reproduced
 * inline in the templates below — no external string source. Card budget:
 * up to 4 visible (bias rows fill first; framing rows fill the remainder).
 */

import { type ReactNode, useMemo } from 'react'
import { Accordion } from './primitives/Accordion'
import { typography } from '@/styles/typography'
import { DiscussWithAiButton } from './DiscussWithAiButton'
import type { NormalisedBiasTrigger } from './PreAnalysisPanel'

const TOTAL_CARD_BUDGET = 4

type FramingKind = 'no_baseline' | 'no_target'

interface FramingCardSpec {
  kind: FramingKind
  question: string
  chipLabel: string
  onAction: () => void
}

interface SharpenCardEntry {
  id: string
  label: 'Bias' | 'Framing'
  question: string
  chip: ReactNode
  testId: string
}

interface SharpenYourThinkingProps {
  /** D2-filtered bias triggers — supplied from the panel as the single source */
  biasTriggers: readonly NormalisedBiasTrigger[]
  /** Whether the goal node has a baseline `observedState.value` set */
  hasGoalBaseline: boolean
  /** Whether a success target / threshold is set on the goal */
  hasSuccessTarget: boolean
  /** Whether the goal carries a quantitative hint (so missing-target is meaningful) */
  goalHasQuantitativeHint: boolean
  /** Action when "Set current value" chip is clicked (no_baseline framing card) */
  onSetCurrentValue: () => void
  /** Action when "Set target" chip is clicked (no_target framing card) */
  onSetTarget: () => void
}

function buildFramingCards({
  hasGoalBaseline,
  hasSuccessTarget,
  goalHasQuantitativeHint,
  onSetCurrentValue,
  onSetTarget,
}: {
  hasGoalBaseline: boolean
  hasSuccessTarget: boolean
  goalHasQuantitativeHint: boolean
  onSetCurrentValue: () => void
  onSetTarget: () => void
}): FramingCardSpec[] {
  const cards: FramingCardSpec[] = []
  if (!hasGoalBaseline) {
    cards.push({
      kind: 'no_baseline',
      question:
        'No baseline value set on the goal. Without one, analysis shows absolute probability, not improvement from today.',
      chipLabel: 'Set current value',
      onAction: onSetCurrentValue,
    })
  }
  if (!hasSuccessTarget && goalHasQuantitativeHint) {
    cards.push({
      kind: 'no_target',
      question:
        'No success target set. Analysis can rank options but cannot show probability of success.',
      chipLabel: 'Set target',
      onAction: onSetTarget,
    })
  }
  return cards
}

function buildBiasCard(trigger: NormalisedBiasTrigger, index: number): SharpenCardEntry {
  // Brief 5.8A post-D7 ChatGPT-feedback round 2: the React `id` (used as
  // map key) and the data-testid both must be sanitized. CEE can stamp
  // `raw.id` (which flows into trigger.id via `cee_bias_${stableId}`) with
  // values containing factor / option / node prefixes — those would leak
  // into the DOM via the testid attribute. Local 0-based index keeps both
  // attributes prefix-free.
  return {
    id: `sharpen-bias-${index}`,
    label: 'Bias',
    question: trigger.subtitle,
    chip: (
      <DiscussWithAiButton
        element={{
          kind: 'bias',
          biasType: trigger.title,
          microInterventionStep: trigger.microInterventionStep,
        }}
      />
    ),
    testId: `sharpen-bias-${index}`,
  }
}

function buildFramingCardEntry(spec: FramingCardSpec): SharpenCardEntry {
  return {
    id: `sharpen-framing-${spec.kind}`,
    label: 'Framing',
    question: spec.question,
    chip: (
      <button
        type="button"
        onClick={spec.onAction}
        className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-2.5 py-0.5 hover:bg-info/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info`}
      >
        {spec.chipLabel}
      </button>
    ),
    testId: `sharpen-framing-${spec.kind}`,
  }
}

export function SharpenYourThinking(props: SharpenYourThinkingProps) {
  const {
    biasTriggers,
    hasGoalBaseline,
    hasSuccessTarget,
    goalHasQuantitativeHint,
    onSetCurrentValue,
    onSetTarget,
  } = props

  const cards = useMemo<SharpenCardEntry[]>(() => {
    const biasCards = biasTriggers.map((trigger, index) => buildBiasCard(trigger, index))
    const framingSpecs = buildFramingCards({
      hasGoalBaseline,
      hasSuccessTarget,
      goalHasQuantitativeHint,
      onSetCurrentValue,
      onSetTarget,
    })
    const framingCards = framingSpecs.map(buildFramingCardEntry)
    // Bias fills first; framing fills the remainder up to the total budget.
    const merged = [...biasCards, ...framingCards]
    return merged.slice(0, TOTAL_CARD_BUDGET)
  }, [biasTriggers, hasGoalBaseline, hasSuccessTarget, goalHasQuantitativeHint, onSetCurrentValue, onSetTarget])

  // Preview line: highest-priority bias category : detail; fall back to the
  // first framing question when no bias triggers exist. Hook MUST run on
  // every render (Rules of Hooks) — keep it above the cards.length === 0
  // early return below.
  const preview = useMemo<ReactNode>(() => {
    const firstBias = biasTriggers[0]
    if (firstBias) {
      return (
        <span>
          <strong className="text-text-body font-semibold">{firstBias.title}:</strong>{' '}
          {firstBias.subtitle}
        </span>
      )
    }
    const firstFramingCard = cards.find(c => c.label === 'Framing')
    if (firstFramingCard) {
      return (
        <span>
          <strong className="text-text-body font-semibold">Framing:</strong>{' '}
          {firstFramingCard.question}
        </span>
      )
    }
    return null
  }, [biasTriggers, cards])

  if (cards.length === 0) return null

  return (
    <Accordion
      title="Sharpen your thinking"
      testId="sharpen-your-thinking"
      defaultExpanded
      rightContent={
        <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full border border-panel-border text-text-body">
          {cards.length}
        </span>
      }
      previewLine={preview}
    >
      <div className="flex flex-col gap-2">
        {cards.map(card => (
          <div
            key={card.id}
            className="flex flex-col gap-1 p-2.5 border border-panel-border rounded-[10px]"
            data-testid={card.testId}
          >
            <span className={`text-[10px] text-text-light`}>{card.label}</span>
            <p className={`${typography.panelBody} text-text-body leading-snug`}>
              {card.question}
            </p>
            <div className="flex items-center gap-2">{card.chip}</div>
          </div>
        ))}
      </div>
    </Accordion>
  )
}
