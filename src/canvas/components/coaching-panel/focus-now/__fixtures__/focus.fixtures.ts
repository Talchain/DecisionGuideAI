/**
 * Focus Now — test + Storybook fixtures.
 *
 * Includes deliberately "unsafe" SERVER fixtures (banned terms, HTML-looking
 * strings) to prove the UI renders server-supplied data verbatim as TEXT and
 * never scans or rewrites it (F.6 / claim-safety boundary). These are NOT
 * UI-authored copy and are NOT scanned by the copy-hygiene suite.
 */
import type { CoachingSignal } from '../../types'
import type { FocusBannerState, FocusRow } from '../focusTypes'

/** A fully-populated structured coaching signal (future Lane-A shape). */
export const signalFull: CoachingSignal = {
  signal_id: 'sig-options',
  move: 'add',
  source: 'analysis',
  grounding: { observation: 'Your options rely on the same lever.' },
  target_kind: 'option',
  target_label: 'Hybrid plan',
  priority_reason: 'A genuinely different route tends to make the choice clearer.',
  suggested_actions: [{ label: 'Sketch a different kind of option' }],
}

/** A minimal valid signal — observation only. */
export const signalMinimal: CoachingSignal = {
  signal_id: 'sig-minimal',
  move: 'review',
  source: 'structural',
  grounding: { observation: 'One outcome carries most of the weight here.' },
}

/** Unusable signal — empty observation, must be dropped by the mapper. */
export const signalNoObservation: CoachingSignal = {
  signal_id: 'sig-empty',
  move: 'noop',
  source: 'structural',
  grounding: { observation: '   ' },
}

/** Two signals to assert received-order preservation (no ranking). */
export const signalsOrdered: CoachingSignal[] = [
  { signal_id: 'sig-a', move: 'review', source: 'analysis', grounding: { observation: 'First, as received.' }, priority: 1 },
  { signal_id: 'sig-b', move: 'review', source: 'analysis', grounding: { observation: 'Second, as received.' }, priority: 99 },
]

/** A pre-built server row, for render tests. */
export const serverRow: FocusRow = {
  id: 'signal:sig-options',
  ownership: 'server_sourced',
  source: 'coaching_signal',
  primary: 'Your options rely on the same lever.',
  whyItMatters: 'A genuinely different route tends to make the choice clearer.',
  tryThis: 'Sketch a different kind of option',
  targetKind: 'option',
  targetLabel: 'Hybrid plan',
  action: { kind: 'prefill', label: 'Try this', prefillText: 'Sketch a different kind of option' },
}

/**
 * A GATED row (science-heavy). The mapper never emits one; this exists so tests
 * can pass it in and assert it is dropped and never rendered.
 */
export const gatedRow: FocusRow = {
  id: 'gated:influence',
  ownership: 'gated',
  source: 'coaching_signal',
  primary: 'This factor has the most influence on the result',
  noticed: 'Sensitivity analysis shows this drives the outcome.',
}

/** SERVER prose with banned terms — must render verbatim (not scanned/rewritten). */
export const forbiddenSummary =
  'The recommended winner is option A, based on the graph nodes and edges and its EVPI.'

/** SERVER prose that looks like HTML — must render as literal text, parse no elements. */
export const xssSummary =
  '<img src=x onerror="alert(1)"> this should appear as text <script>noop()</script>'

/** Long server prose to exercise wrapping/clamp. */
export const longSummary =
  'Across the latest pass several of your estimates lean optimistic, and a couple of the figures bundle a few different things together, so it is worth a careful second look before you commit to a direction here.'

export const bannerStale: FocusBannerState = { kind: 'stale', canRerun: true }
export const bannerCannotConfirm: FocusBannerState = { kind: 'cannot_confirm' }
export const bannerNone: FocusBannerState = { kind: 'none' }
