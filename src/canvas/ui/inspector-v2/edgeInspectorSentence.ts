import {
  edgeValueSource,
  resolveEdgeDirectionDisplay,
  type EdgeValueDisplay,
} from '../../domain/edgeValueProvenance'
import { NaturalEffectSchema, naturalEffectStrengthIsCurrent } from '../../domain/naturalEffect'
import { isStrengthDefinitional } from '../../domain/strengthDefinitional'
import { isStrengthPlaceholder } from '../../domain/strengthPlaceholder'
import { isStrengthStated } from '../../domain/strengthStated'
import { getStrengthLabel } from '../../domain/vocabulary'
import { readContestedState } from '../../edges/edgePresentation'
import { edgeSizePhrase } from '../../edges/edgeSizePhrase'
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
  /** IDENTITY-EXACT (DL 8 Oct): the ruled words when the current Run evaluated this link's identity; else absent/null. */
  readonly identityExact?: string | null
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

  if (typeof input.identityExact === 'string') {
    // The identity fixes this link: its arithmetic, never a size ask (the link is not unsized) nor a band.
    sentence = `${input.identityExact}.`
    chip = null
  } else if (isStrengthDefinitional(data)) {
    sentence = `${target} follows from ${source} by definition.`
    chip = null
  } else if (isStrengthPlaceholder(data) || !strengthDisplay.show) {
    sentence = direction.show
      ? `As ${source} increases, ${target} ${direction.direction === 'positive' ? 'increases' : 'decreases'}. This link isn't sized in the model yet. How strong do you think it is?`
      : `${source} affects ${target}, but this link isn't sized in the model yet. How strong do you think it is?`
    chip = 'unsized'
  } else {
    const band = getStrengthLabel(Math.abs(strengthDisplay.value)).toLowerCase()
    sentence = direction.show
      ? `As ${source} increases, ${target} ${direction.direction === 'positive' ? 'increases' : 'decreases'}: ${band}.`
      : `${source} has a ${band} effect on ${target}; the direction isn't stated.`

    // A direct user setting takes precedence over retained producer metadata.
    // Example attribution asks the same live predicate as Examine's why-line.
    const strengthSource = edgeValueSource(data, 'weight')
    const size = edgeSizePhrase(data)
    const natural = NaturalEffectSchema.safeParse(data?.naturalEffect)
    const currentNatural = natural.success &&
      naturalEffectStrengthIsCurrent(strengthDisplay.value, natural.data.strengthMean)
      ? natural.data
      : null
    chip = strengthSource === 'user'
      ? 'user'
      : strengthSource === 'template' || size?.exampleFigure === true
        ? 'example'
        : currentNatural?.author === 'user'
          ? currentNatural.userOrigin === 'brief' ? 'brief' : 'user'
          : isStrengthStated(data)
            ? 'user'
            : strengthSource === 'cee' || currentNatural?.author === 'olumi_estimate'
              ? 'olumi'
              : null
  }

  if (readContestedState(data?.validation).directionDisputed) {
    sentence += ' Two reviews disagree about its direction.'
  }
  return { sentence, chip }
}
