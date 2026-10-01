/**
 * ⭐ EXAMINE THIS ASSUMPTION — the pure view of one factor's figure, and why it is worth questioning (slice 1, 52f8cd).
 *
 * The inspector already says WHAT a figure is and, after a Run, what the analysis flags about it. This section adds
 * the step a reasoning partner takes next: name the assumption, say why it is worth examining on an explicit basis,
 * and offer ONE route to a defensible alternative — through the existing Agent path (prefill → the user sends →
 * Olumi asks what the figure rests on and for the user's own figure → it proposes THAT figure → the user approves →
 * canonical write). Olumi never chooses the replacement (CEE #2413; AIQ 5921113788: never script a figure Olumi chose).
 * Nothing here sends, writes or approves.
 *
 * Two bases, each from a fact the client already holds; never a score this module invents:
 *   · `analysis`       — the last Run flagged the figure itself (`top_driver` / `turning_point`, `nodeAttention`).
 *   · `olumi_estimate` — the figure is Olumi's (`ai`), or Olumi's that the user accepted (`accepted`): acceptance is
 *                        not a measurement, so it stays worth checking (origin ≠ acceptance, #2377).
 * ⛔ A SOUND FIGURE GETS NO CHALLENGE. The user's own figure with nothing flagged returns `null`: the section is
 * absent, with no warning chrome and no forced question (plan F7).
 */
import { classifyObservedValueProvenance, VALUE_PROVENANCE_LABEL } from '../../../domain/valueProvenance'
import type { AttentionReason } from '../../../nodes/shared/nodeAttention'

export type ExamineBasis = 'analysis' | 'olumi_estimate'

export interface ExamineAssumptionView {
  /** The figure as the card shows it (`factorDisplayText`). */
  readonly value: string
  /** Who the figure is from, in the provenance key's own words; `null` when no source is recorded (no row drawn). */
  readonly origin: string | null
  readonly basis: ExamineBasis
  /** One sentence: why this figure is worth examining, on `basis`. */
  readonly why: string
  /** The message the action prefills. The user sends it; nothing is sent here. */
  readonly prepare: { readonly label: string; readonly text: string }
}

export const EXAMINE_HEADING = 'Examine this assumption'
export const EXAMINE_ACTION = 'Examine with Olumi'
/** Served `7686dc0` (52f8cd, guest 61a8c07c): Olumi asked what the figure rests on and for the user's own number. */
export const EXAMINE_LIMIT = 'Olumi will ask what you know. If you give a different figure, nothing changes until you approve it.'

export const EXAMINE_WHY: Readonly<Record<'analysis' | 'ai' | 'accepted', string>> = Object.freeze({
  analysis: 'Your last Run flags this figure as one that matters to the result.',
  ai: 'Olumi estimated this figure. Nobody has checked it against your own data yet.',
  accepted: 'You accepted Olumi’s estimate. It is still an estimate, not a measurement.',
})

const ANALYSIS_KINDS: ReadonlySet<AttentionReason['kind']> = new Set(['top_driver', 'turning_point'])

export function buildExamineAssumptionView(input: {
  readonly label: string
  /** `factorDisplayText(node.data)`; `null` when the factor has no figure. */
  readonly valueText: string | null
  /** The node's whole `observedState` — the accepted fact lives beside the source literal. */
  readonly observed: unknown
  readonly reasons: readonly AttentionReason[]
}): ExamineAssumptionView | null {
  const value = input.valueText?.trim()
  if (!value) return null
  const kind = classifyObservedValueProvenance(input.observed)?.kind
  const flagged = input.reasons.some((r) => ANALYSIS_KINDS.has(r.kind))
  const olumis = kind === 'ai' || kind === 'accepted'
  if (!flagged && !olumis) return null
  const basis: ExamineBasis = flagged ? 'analysis' : 'olumi_estimate'
  const why = flagged ? EXAMINE_WHY.analysis : EXAMINE_WHY[kind as 'ai' | 'accepted']
  return {
    value,
    origin: kind ? VALUE_PROVENANCE_LABEL[kind] : null,
    basis,
    why,
    prepare: {
      label: `Examine ${input.label}`,
      text:
        `Help me examine my assumption for "${input.label}" (currently ${value}). ` +
        'What is it based on, and what would make a different figure more defensible?',
    },
  }
}
