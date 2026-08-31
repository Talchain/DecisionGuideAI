/**
 * "What Olumi assumed" — the OPTION→FACTOR EFFECT VALUES THE MODEL CHOSE.
 *
 * ⭐ WHY THIS EXISTS. Journey-witnessed on the deployed build: a numberless
 * "build vs buy" brief reached a completed analysis in which 15 of 15
 * interventions carried `source: 'cee_hypothesis'` and `value_confidence:
 * 'low'`, with the producer's own reasoning saying no stated figure was cited
 * for the option→factor effect. The analysis then rendered win probabilities
 * (69.7% / 18.6% / 11.7%) and the sentence "…came out ahead in 70% of runs of
 * this model" — computed ENTIRELY from those 15 invented numbers.
 *
 * The Inspector and the Model tab disclose this, one click into an option node
 * ("Estimated by Olumi" / "AI estimate"). The ANALYSIS RESULT surface did not —
 * and it was worse than silent, because its own subtitle ("Top drivers, the
 * values Olumi assumed, and what could change") PROMISED the disclosure and
 * then rendered nothing. Measured on the deployed capture: the subtitle
 * appeared once, the group heading "What Olumi assumed" appeared ZERO times,
 * while its sibling group "What could change" appeared twice.
 *
 * ⚠ THE GROUP WAS NEVER MISSING — IT WAS EMPTY. `DecisionBriefSection` already
 * declares it and already mounts it; `.filter(group => group.items.length > 0)`
 * dropped it because its only source, the producer's `defaulted_assumptions`
 * array, was empty. This module supplies the SECOND source for the same
 * question, from data the browser already holds.
 *
 * ⚠⚠ THIS IS NOT THE PRODUCER'S `value_defaulted` ARRAY AND MUST NOT BE MERGED
 * INTO IT. `readDefaultedAssumptions` walks `brief.defaulted_assumptions`,
 * whose rows carry the producer's own token and its own prose about a FACTOR
 * whose starting value was defaulted. These rows are INTERVENTIONS — an option's
 * effect on a factor — they live on the CANVAS NODES, not in the brief, and no
 * producer stamps `value_defaulted` on them. Widening that reader's `source`
 * test changes nothing, because the records are not in the array it reads.
 * (Measured; it was the first fix attempted and it was refuted.)
 *
 * ⚠ NOR IS THIS `AssumedStrengthCard`. That surface is about EDGE STRENGTH, fed
 * from `enrichment.robustness.fragile_edges`; on the witnessed draw 0 of its 6
 * rows were option→factor edges (contrast control: 4 of 6 were factor→*, so its
 * classifier does discriminate). It accounts for none of the 15 invented values.
 * Two different data, two different surfaces — CLAUDE.md trap 21.
 */

import { classifyInterventionProvenance } from '@/canvas/domain/valueProvenance'
import { resolveNodeTypeLiteral } from '@/canvas/domain/nodes'
import { unwrapInterventionValue } from '@/canvas/utils/labelUtils'
import { containsRawIdentifier } from './decisionBriefViewModel'

/**
 * One option→factor effect whose number the MODEL chose rather than the user.
 *
 * The ids are carried for identity — every assertion about this row binds to
 * them rather than to the note text, so a test cannot pass on a different row
 * that happens to read the same (CLAUDE.md trap 19).
 */
export interface EstimatedInterventionView {
  optionId: string
  factorId: string
  optionLabel: string
  factorLabel: string
  note: string
}

/**
 * ⭐ THE SHIPPED VOCABULARY, REUSED VERBATIM — NOT A THIRD PHRASING.
 * `INSPECTOR_INTERVENTION_PROVENANCE_LABEL.ai` is "Estimated by Olumi" and the
 * Model tab says "AI estimate". A user who clicks from this surface into the
 * Inspector must meet the SAME words about the SAME number; minting a third
 * synonym for one concept is how an estate ends up with seven vocabularies for
 * one thing. Exported so the spec binds to the constant, not to a copy of it.
 */
export const ESTIMATED_INTERVENTION_MARK = 'Estimated by Olumi'

/**
 * Cap, matching `MAX_DEFAULTED_ASSUMPTIONS` — the two sources feed one group and
 * a shared ceiling keeps the group's length predictable. TRUNCATE, never empty:
 * the cap is a display bound, not a validity test (the defect this surface has
 * already shipped once, where `length > max` returned `[]`).
 */
const MAX_ESTIMATED_INTERVENTIONS = 10

/** Matches the view model's own label ceiling, for the same reason. */
const MAX_LABEL_LENGTH = 300

/** A node as this selector needs to see it — the canvas store's ReactFlow shape. */
export interface EstimatedInterventionNode {
  id: string
  type?: string
  data?: unknown
}

function readLabel(data: unknown): string | null {
  if (data === null || typeof data !== 'object') return null
  const label = (data as { label?: unknown }).label
  if (typeof label !== 'string') return null
  if (label.trim().length === 0 || label.length > MAX_LABEL_LENGTH || label.includes('\0')) return null
  /**
   * ⚠ AN ID-SHAPED LABEL IS WITHHELD, NEVER PRETTIFIED. The view model applies
   * the same rule to producer prose for the same reason: this surface never
   * turns an identifier into an invented name. A row we cannot name honestly is
   * a row we drop — the `voiRanking` precedent in `useResultsSectionData`.
   */
  if (containsRawIdentifier(label)) return null
  return label
}

/**
 * The user-facing sentence.
 *
 * ⚠ NO CONFIDENCE CLAIM, NO NUMBER. The wire says `value_confidence: 'low'` and
 * this copy neither upgrades it nor renders it: a score or percentage here would
 * be a second invented quantity layered over the first, and the sibling spec
 * `DecisionBriefSection.spec.tsx` already asserts this section renders no
 * "confidence"/"probability" language and no "%" at all.
 *
 * What it DOES say is the thing the founder's framing requires and the surface
 * was omitting: OLUMI SUPPLIED THIS NUMBER AND YOU DID NOT. A vague hedge would
 * not mitigate anchoring on a figure the model chose; naming the author does.
 */
export function formatEstimatedInterventionNote(optionLabel: string, factorLabel: string): string {
  return `${ESTIMATED_INTERVENTION_MARK}: the effect of "${optionLabel}" on "${factorLabel}". `
    + 'No figure for this was stated in your brief.'
}

/**
 * Select the interventions whose value the MODEL chose, from the canvas nodes.
 *
 * ⭐⭐ THE DISCRIMINATION IS THE POINT, AND IT RUNS BOTH WAYS. On the same
 * witnessed run, the contrast brief — the same decision WITH figures — produced
 * 7 `cee_hypothesis`/low rows AND 1 `brief_extraction`/high row. Labelling the
 * second as an Olumi estimate would be the exact inverse harm of the defect
 * being closed: the machine claiming authorship of a number the USER stated.
 * Two opposite harms, so the predicate is not a hedge — it is the producer's own
 * literal, classified by the ONE authority:
 *
 *   · `cee_hypothesis`  → kind `ai`     → DISCLOSED
 *   · `brief_extraction`→ kind `brief`  → silent (the user's own figure)
 *   · `user_specified`  → kind `edited` → silent (the user set it)
 *   · absent / unknown  → `null`        → silent (the record does not say)
 *
 * ⚠ FAIL CLOSED ON ABSENCE, DELIBERATELY. `classifyInterventionProvenance`
 * returns `null` rather than a guessed class, and an unstamped intervention is
 * NOT disclosed. `normaliseOptionFromCEE` used to stamp `'brief_extraction'` on
 * CEE's bare flattened numbers — inventing provenance — and that was corrected
 * upstream (see `UIInterventionValue.source`): the flattened form now carries no
 * source at all. So on that path there is nothing to disclose and this selector
 * says nothing, which is the honest answer rather than a convenient one. THE
 * CLAIM THIS MODULE SUPPORTS IS THEREFORE SCOPED: it discloses the model-chosen
 * values whose provenance SURVIVED to the canvas, i.e. the nested V3 form.
 *
 * ⚠ A FINITE VALUE IS REQUIRED, and not as tidiness. `unwrapInterventionValue`
 * defers to `interventionNumericValue`, the SAME predicate the PLoT request edge
 * uses, so "has a usable value" here means exactly "this number reached the
 * analysis". An intervention with no usable value contributed nothing to the
 * probabilities on screen, and there is no invented number to disclose.
 */
export function selectEstimatedInterventions(
  nodes: readonly EstimatedInterventionNode[] | null | undefined,
): EstimatedInterventionView[] {
  if (!Array.isArray(nodes)) return []

  const labelById = new Map<string, string>()
  for (const node of nodes) {
    const label = readLabel(node?.data)
    if (label !== null) labelById.set(node.id, label)
  }

  const out: EstimatedInterventionView[] = []

  for (const node of nodes) {
    if (out.length >= MAX_ESTIMATED_INTERVENTIONS) break
    // Interventions belong to options. An unrecognised type resolves to `null`
    // and is skipped, so an unknown node kind fails closed rather than being
    // described as an option's effect.
    if (resolveNodeTypeLiteral(node) !== 'option') continue

    const optionLabel = labelById.get(node.id)
    if (optionLabel === undefined) continue

    const raw = (node.data as { interventions?: unknown } | undefined)?.interventions
    if (raw === null || typeof raw !== 'object') continue

    for (const [factorId, rawValue] of Object.entries(raw as Record<string, unknown>)) {
      if (out.length >= MAX_ESTIMATED_INTERVENTIONS) break

      const { value, source } = unwrapInterventionValue(rawValue)
      if (value == null) continue

      const provenance = classifyInterventionProvenance(source)
      if (provenance?.kind !== 'ai') continue

      const factorLabel = labelById.get(factorId)
      if (factorLabel === undefined) continue

      out.push({
        optionId: node.id,
        factorId,
        optionLabel,
        factorLabel,
        note: formatEstimatedInterventionNote(optionLabel, factorLabel),
      })
    }
  }

  return out
}
