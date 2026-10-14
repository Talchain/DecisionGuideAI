import {
  resolveEdgeDirectionDisplay,
  type EdgeValueDisplay,
} from '../../domain/edgeValueProvenance'
import { isStrengthDefinitional } from '../../domain/strengthDefinitional'
import { isStrengthPlaceholder } from '../../domain/strengthPlaceholder'
import { getStrengthLabel } from '../../domain/vocabulary'
import { EDGE_PROVENANCE, edgeProvenance } from '../../domain/edgeProvenance'
import { readContestedState } from '../../edges/edgePresentation'
import { EDGE_LINK_NOTICES, resolveEdgeLinkTemplate } from './inspectorStrings'
import type { ProvenanceKind } from './shared/ProvenanceChip'

export interface EdgeInspectorSentenceInput {
  readonly sourceLabel: string
  readonly targetLabel: string
  readonly data: Record<string, unknown> | undefined
  /** The panel's existing resolved display, including its live store value. */
  readonly strengthDisplay: EdgeValueDisplay
  /** The panel's existing link-kind classification; no second structural test. */
  readonly linkKind?: 'causal' | 'organisational' | 'intervention'
}

export interface EdgeInspectorSentence {
  readonly sentence: string
  readonly chip: ProvenanceKind | null
}

/**
 * Plain wording over the existing owners of direction, magnitude and provenance.
 * A strength hidden by its owner or marked as a placeholder licenses no band assertion.
 */
export function buildEdgeInspectorSentence(input: EdgeInspectorSentenceInput): EdgeInspectorSentence {
  const { sourceLabel: source, targetLabel: target, data, strengthDisplay } = input
  if (input.linkKind === 'organisational') {
    return { sentence: EDGE_LINK_NOTICES.organisational.body, chip: null }
  }
  if (input.linkKind === 'intervention') {
    return { sentence: resolveEdgeLinkTemplate(input), chip: null }
  }

  const direction = resolveEdgeDirectionDisplay(data)
  let sentence: string
  let chip: ProvenanceKind | null

  if (isStrengthDefinitional(data)) {
    sentence = `${target} follows from ${source} by definition.`
    chip = null
  } else if (isStrengthPlaceholder(data) || !strengthDisplay.show) {
    sentence = direction.show
      ? `As ${source} increases, ${target} ${direction.direction === 'positive' ? 'increases' : 'decreases'}. This link isn't sized in the model yet. How strong do you think it is?`
      : `${source} affects ${target}, but this link isn't sized in the model yet. How strong do you think it is?`
    chip = EDGE_PROVENANCE.placeholder.chip
  } else {
    const band = getStrengthLabel(Math.abs(strengthDisplay.value)).toLowerCase()
    sentence = direction.show
      ? `As ${source} increases, ${target} ${direction.direction === 'positive' ? 'increases' : 'decreases'}: ${band}.`
      : `${source} has a ${band} effect on ${target}; the direction isn't stated.`

    // Data layer Phase 1: the ONE edge provenance classifier decides the chip (`edgeProvenance.ts`), so the inspector,
    // the canvas icon and the Model tab say the same thing about whose this strength is.
    const provenance = edgeProvenance(data, strengthDisplay)
    chip = provenance === null ? null : EDGE_PROVENANCE[provenance.kind].chip
  }

  if (readContestedState(data?.validation).directionDisputed) {
    sentence += ' Two reviews disagree about its direction.'
  }
  return { sentence, chip }
}
