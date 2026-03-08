/**
 * useBriefSignals — 5-element brief detection for the guidance strip.
 *
 * Wraps the existing extractRealtimeSignals engine with a new model:
 * Goal, Options, Metric, Constraints, Risks.
 *
 * Readiness scores only the 3 core elements (goal, options, metric):
 *   0–1 detected = low, 2 = medium, 3 = high.
 *
 * Returns null outside the framing stage.
 */

import { useMemo } from 'react'
import { useDebounce } from '../../../hooks/useDebounce'
import { extractRealtimeSignals } from '../../../signals/realtime-signals'
import { isFramingStage } from '../../../signals/stage-helpers'
import { DECISION_FRAMING_PHRASES } from '../../../signals/detection-patterns'
import type { ScenarioStage } from '../../../types/scenario'
import type { BriefElementKind } from '../primitives/NodeShape'

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface BriefElement {
  kind: BriefElementKind
  detected: boolean
  label: string
  coachingTip: string
}

export type BriefReadiness = 'low' | 'medium' | 'high'

export interface BriefSignalsResult {
  elements: BriefElement[]
  readiness: BriefReadiness
  bias: 'sunk_cost' | 'anchoring' | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Goal detection (not in existing extractRealtimeSignals)
// ─────────────────────────────────────────────────────────────────────────────

/** Scaffold label prefixes — match only if content follows the colon. */
const SCAFFOLD_LABELS = [
  'the decision i\'m facing is:',
  'my goal is:',
  'the options i\'m considering are:',
  'the factors that could influence this are:',
  'the potential risks are:',
  'the outcome i\'m looking for is:',
]

function isScaffoldOnly(text: string): boolean {
  const trimmed = text.trim().toLowerCase()
  return SCAFFOLD_LABELS.some(label => trimmed === label)
}

/**
 * Goal phrases that indicate the user has stated their goal.
 * Requires content after a contextual verb — bare scaffold labels don't count.
 */
const GOAL_VERBS = [
  'reach', 'achieve', 'want to', 'aiming for', 'aiming to',
  'trying to', 'target', 'objective is', 'goal is',
  'need to', 'hope to', 'plan to', 'intend to',
]

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Check if there is meaningful content after a match position, on the same line only.
 * Strips any leading colon and whitespace before measuring.
 */
function hasContentAfterOnLine(text: string, startIdx: number): boolean {
  const rest = text.slice(startIdx).split('\n')[0]
  const stripped = rest.replace(/^[:\s]+/, '').trim()
  return stripped.length > 2 && /\w/.test(stripped)
}

export function detectGoal(text: string): boolean {
  if (!text.trim()) return false

  const lower = text.toLowerCase()

  // Decision framing phrases — require same-line content after the phrase
  for (const phrase of DECISION_FRAMING_PHRASES) {
    const re = new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'i')
    const match = re.exec(lower)
    if (match && hasContentAfterOnLine(lower, match.index + match[0].length)) return true
  }

  // Goal verbs — require same-line content after the verb (not scaffold on subsequent lines)
  for (const verb of GOAL_VERBS) {
    const re = new RegExp(`\\b${escapeRegex(verb)}\\b`, 'i')
    const match = re.exec(lower)
    if (match && hasContentAfterOnLine(lower, match.index + match[0].length)) return true
  }

  // Scaffold label with content after the colon on the same line
  for (const label of SCAFFOLD_LABELS) {
    const idx = lower.indexOf(label)
    if (idx >= 0 && hasContentAfterOnLine(lower, idx + label.length)) return true
  }

  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// Coaching tips per element
// ─────────────────────────────────────────────────────────────────────────────

const COACHING_TIPS: Record<BriefElementKind, string> = {
  goal:        'State the decision you need to make and what you want to achieve.',
  options:     'List at least two alternatives you are considering.',
  metric:      'Include a measurable outcome with a number or percentage.',
  constraints: 'Mention any limits such as budget, timeline, or resources.',
  risks:       'Note potential risks or downsides you want to avoid.',
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param text Raw composer text (debounced internally at 500ms if no externalDebouncedText provided).
 * @param stage Current scenario stage.
 * @param externalDebouncedText Optional pre-debounced value from the caller. When provided,
 *   the internal debounce timer is bypassed and this value is used directly. This allows
 *   ChatComposer to share a single 500ms debounce across both useBriefSignals and extractLocalBIL.
 */
export function useBriefSignals(
  text: string,
  stage: ScenarioStage,
  externalDebouncedText?: string,
): BriefSignalsResult | null {
  const internalDebounced = useDebounce(text, 500)
  const debouncedText = externalDebouncedText ?? internalDebounced

  return useMemo(() => {
    if (!isFramingStage(stage)) return null

    const input = debouncedText?.trim() || ''
    // Skip detection for bare scaffold labels
    if (isScaffoldOnly(input)) {
      return buildResult(false, false, false, false, false, null)
    }

    const signals = extractRealtimeSignals(input)

    const goalDetected = detectGoal(input)
    const optionsDetected = signals.has_alternative
    const metricDetected = signals.has_measurable_outcome
    const constraintDetected = signals.has_constraint
    const riskDetected = signals.has_risk

    return buildResult(goalDetected, optionsDetected, metricDetected, constraintDetected, riskDetected, signals.bias_detected)
  }, [debouncedText, stage])
}

function buildResult(
  goal: boolean, options: boolean, metric: boolean,
  constraint: boolean, risk: boolean,
  bias: 'sunk_cost' | 'anchoring' | null,
): BriefSignalsResult {
  const elements: BriefElement[] = [
    { kind: 'goal',        detected: goal,       label: 'Goal',        coachingTip: COACHING_TIPS.goal },
    { kind: 'options',     detected: options,     label: 'Options',     coachingTip: COACHING_TIPS.options },
    { kind: 'metric',      detected: metric,      label: 'Metric',      coachingTip: COACHING_TIPS.metric },
    { kind: 'constraints', detected: constraint,  label: 'Constraints', coachingTip: COACHING_TIPS.constraints },
    { kind: 'risks',       detected: risk,        label: 'Risks',       coachingTip: COACHING_TIPS.risks },
  ]

  // Readiness: only the 3 core elements count
  const coreCount = [goal, options, metric].filter(Boolean).length
  const readiness: BriefReadiness =
    coreCount >= 3 ? 'high' :
    coreCount >= 2 ? 'medium' : 'low'

  return { elements, readiness, bias }
}
