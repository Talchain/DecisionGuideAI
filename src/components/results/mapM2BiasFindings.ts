/**
 * mapM2BiasFindings — the single mapping site for M2 bias findings, and the
 * ONLY place `micro_intervention` is read on the analysis-results path.
 *
 * ## Why this module exists (a RE-HOMED surface, not a new one)
 *
 * `components/results/v7/V7BiasSection.tsx` (deleted; preserved at `ca8cb0c1`)
 * was the ONLY surface in the product that rendered a bias finding's
 * `micro_intervention.steps` — the numbered concrete steps — and its
 * `estimated_minutes` effort estimate. Its builder `buildV7Bias.ts` read both
 * defensively and rendered them, in its own words, "verbatim (spec row 11)".
 *
 * When v7 was retired those two fields lost their last consumer. The live
 * surface (`analysis-hero/actOnIt`'s reflect rows) shows a finding's TYPE and
 * DESCRIPTION only — and the loss happened HERE, at the adapter: the
 * `m2BiasFindings` mapping projected five fields and discarded everything else,
 * so no downstream renderer COULD have shown the steps even had it tried.
 * `canvas/components/pre-analysis/__tests__/biasSurfaceLiveness.spec.tsx`
 * §1.5(3) is an explicit anti-deletion gate over this surface, so the steps and
 * the estimate are re-homed rather than dropped.
 *
 * ## Producer field path — TRACED AT THE BYTES, not assumed
 *
 *   PLoT `/v2/run` response
 *     → `V2RunResponse.m1_review`        `adapters/plot/v2/types.ts:595`
 *     → `runMeta.m1ReviewAssumptions`    `hooks/hydrateAnalysis.ts:131`
 *                                        `canvas/hooks/useV2Run.ts:944`
 *     → `.bias_findings`                 `canvas/store.ts:338` (typed `unknown[]`)
 *     → THIS MAPPER
 *     → `confidence.m2BiasFindings`      `components/results/types.ts`
 *     → `reflectRows()`                  `analysis-hero/actOnIt/rankActOnItRows.ts`
 *     → the rendered row                 `analysis-hero/actOnIt/ActOnItSection.tsx`
 *
 * ⚠ THE SEAM IS UNTYPED AND THE DECLARED TYPE IS NARROWER THAN THE WIRE.
 * `V2BiasFinding` (`adapters/plot/v2/types.ts:393`) declares exactly five
 * fields and does NOT declare `micro_intervention`, while the store types the
 * array as `unknown[]` — the estate's known-open passthrough seam. Every read
 * below is therefore DEFENSIVE, field by field, and invents nothing. Both wire
 * shapes `buildV7Bias.ts` handled are handled here: a step is a plain string,
 * OR a `{ text }` object.
 *
 * ⚠ HONEST ABSENCE (the load-bearing rule). A finding with no usable
 * `micro_intervention` gets NO `microIntervention` property at all — never an
 * empty steps array, never a fabricated step, never a default minute count. The
 * renderer's only correct behaviour on an absent intervention is to draw
 * nothing, and it can only be trusted to do that if absence arrives as absence.
 *
 * ## Two deliberate differences from `buildV7Bias.ts`, and why
 *
 * 1. **No finding is dropped.** v7 dropped a finding carrying neither a
 *    description nor a step ("never an empty coaching shell") because it OWNED
 *    its own section. Here the mapping is 1:1 with the producer array and the
 *    consumer decides: `reflectRows()` keys its rows by producer INDEX
 *    (`reflect-<i>`) and supplies its own fallback reason, so silently
 *    compacting the array would renumber every row after the dropped one.
 * 2. **Step text is sanitised, not verbatim.** v7 read the untyped CEE
 *    passthrough; this is the PLoT M1/M2 path, where `sanitizeCoachingText` is
 *    the declared convention for coaching-facing text ("Use for any M1/M2 text
 *    surfaced in the coaching UI" — `utils/cleanFactorLabel.ts:170`) and is
 *    already applied to `description` in this very mapping. It normalises
 *    arrows, em dashes and encoding notation; it never invents or removes
 *    content. A step that sanitises to empty is dropped rather than rendered as
 *    a blank list item.
 */

import { safeArray } from '../../lib/array-utils'
import { sanitizeCoachingText } from './utils/cleanFactorLabel'

/**
 * The producer's micro-intervention: what to actually DO about the bias, and
 * roughly how long it takes. Present only when the producer supplied at least
 * one of the two — see the honest-absence rule above.
 */
export interface M2MicroIntervention {
  /** `micro_intervention.steps`, in producer order. Never empty when present. */
  steps: string[]
  /** `micro_intervention.estimated_minutes`, or null when the producer sent none. */
  estimatedMinutes: number | null
}

/** One mapped M2 bias finding. */
export interface M2BiasFinding {
  type: string
  source: string
  description: string
  affectedElements: string[]
  linkedCritiqueCode: string
  /**
   * ABSENT when the producer sent no usable micro-intervention. Never an empty
   * shell — a consumer may treat presence as proof there is something to show.
   */
  microIntervention?: M2MicroIntervention
}

/** Normalise a step that may be a plain string OR a `{ text }` object. */
function stepText(step: unknown): string | null {
  const raw =
    typeof step === 'string'
      ? step
      : step && typeof step === 'object' && 'text' in step
        ? (step as { text: unknown }).text
        : null
  if (typeof raw !== 'string') return null
  const cleaned = sanitizeCoachingText(raw)
  return cleaned.trim().length > 0 ? cleaned : null
}

/**
 * Read `micro_intervention` off one raw finding, or return undefined when the
 * producer supplied nothing usable.
 *
 * `estimated_minutes` is read from the intervention FIRST and from the finding
 * root SECOND — the same two locations, in the same order, that
 * `buildV7Bias.ts` read them from.
 */
function readMicroIntervention(f: Record<string, unknown>): M2MicroIntervention | undefined {
  const micro =
    f.micro_intervention && typeof f.micro_intervention === 'object'
      ? (f.micro_intervention as Record<string, unknown>)
      : null

  const steps = safeArray(micro?.steps)
    .map(stepText)
    .filter((s): s is string => s != null)

  const rawMinutes = micro?.estimated_minutes ?? f.estimated_minutes
  const estimatedMinutes =
    typeof rawMinutes === 'number' && Number.isFinite(rawMinutes) ? rawMinutes : null

  // Honest absence: nothing to show ⇒ no property at all.
  if (steps.length === 0 && estimatedMinutes == null) return undefined
  return { steps, estimatedMinutes }
}

/**
 * Map `m1_review.bias_findings` (untyped) into the UI's M2 findings.
 *
 * Returns `undefined` — not `[]` — for an absent or empty producer array, which
 * is the shape `confidence.m2BiasFindings` has always had and which the
 * downstream `?? []` guards depend on.
 */
export function mapM2BiasFindings(raw: unknown): M2BiasFinding[] | undefined {
  const findings = safeArray(raw)
  if (findings.length === 0) return undefined
  return findings.map((f: any) => {
    const finding: M2BiasFinding = {
      type: f?.type ?? '',
      source: f?.source ?? '',
      description: f?.description ? sanitizeCoachingText(f.description) : '',
      affectedElements: safeArray(f?.affected_elements),
      linkedCritiqueCode: f?.linked_critique_code ?? '',
    }
    const micro =
      f && typeof f === 'object' ? readMicroIntervention(f as Record<string, unknown>) : undefined
    if (micro) finding.microIntervention = micro
    return finding
  })
}
