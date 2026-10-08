/**
 * ⭐ ONE EDGE PROVENANCE CLASSIFIER (data layer Phase 1, defect 3; DL design ced112bd, approved 8 Oct).
 *
 * "Whose is this link's strength?" was answered by 33 files from 10 predicates, and the three surfaces that show it
 * disagreed: an Olumi estimate was "ai" on the canvas icon, "olumi" on the inspector chip and UNMARKED in the Model tab
 * (raw `weightSource: 'cee'` is not an observed-state literal); a template strength was "From brief" on the icon and
 * "Example figure" on the chip; a strength sized from the user's stated figure was "brief" on the icon and "user" on
 * the chip. This module composes the existing predicates ONCE, in one order, and every surface reads its answer.
 *
 * Each predicate keeps its own staleness rule (it retires when the strength drawn is no longer the one it describes).
 * ORDER (first match wins; DL calls 8 Oct: template → example, stated figure → brief):
 *   1 weight set by the person (`weightSource: 'user'`)            → user
 *   2 an example figure, or a template's strength                  → example
 *   3 holds by definition (`isStrengthDefinitional`)               → definitional
 *   4 exact by an evaluated identity (`strengthIdentityExact`)     → exact   (PR3: no writer yet)
 *   5 CEE's placeholder (`isStrengthPlaceholder`)                  → placeholder
 *   6 the user's own natural effect: from their brief → brief; entered in the edit panel → user
 *   7 sized from the user's stated figure (`isStrengthStated`)      → brief
 *   8 Olumi's estimate the user accepted (`isStrengthAccepted`)     → accepted
 *   9 Olumi's (`weightSource: 'cee'` or natural author Olumi)       → olumi_estimate
 *  10 otherwise                                                      → null (no strength set / unknown author)
 *
 * WORDS AND MARKS LIVE ONLY IN `EDGE_PROVENANCE` BELOW. A surface asks for the kind's mark, chip or Model-tab
 * literal; it never maps a source itself. (The UI workstream restyles marks here, in one place.)
 */
import type { ProvenanceKind } from '../ui/inspector-v2/shared/ProvenanceChip'
import { edgeSizePhrase } from '../edges/edgeSizePhrase'
import { edgeValueSource, resolveEdgeSignedStrengthDisplay, type EdgeValueDisplay } from './edgeValueProvenance'
import { NaturalEffectSchema, naturalEffectStrengthIsCurrent } from './naturalEffect'
import { isStrengthAccepted } from './strengthAccepted'
import { isStrengthDefinitional } from './strengthDefinitional'
import { isStrengthPlaceholder } from './strengthPlaceholder'
import { isStrengthStated } from './strengthStated'
import type { ValueProvenanceKind } from './valueProvenance'

export type EdgeProvenanceKind =
  | 'user' | 'brief' | 'olumi_estimate' | 'accepted' | 'placeholder' | 'definitional' | 'exact' | 'example'

export interface EdgeProvenance {
  readonly kind: EdgeProvenanceKind
}

interface EdgeProvenanceEntry {
  /** The canvas source icon and Model-tab mark (`VALUE_PROVENANCE_LABEL` words); null = no mark. */
  readonly mark: ValueProvenanceKind | null
  /** The inspector chip (`ProvenanceChip`); null = no chip (the sentence carries it). */
  readonly chip: ProvenanceKind | null
  /** The observed-state literal the Model tab's row classifies (`classifyValueProvenance`); undefined = none. */
  readonly modelTabSource: string | undefined
}

/** THE table. Total over the kinds, so a new kind is a type error here, not a silent gap on a surface. */
export const EDGE_PROVENANCE: Readonly<Record<EdgeProvenanceKind, EdgeProvenanceEntry>> = Object.freeze({
  user: { mark: 'human', chip: 'user', modelTabSource: 'user' },
  brief: { mark: 'brief', chip: 'brief', modelTabSource: 'brief_extraction' },
  olumi_estimate: { mark: 'ai', chip: 'olumi', modelTabSource: 'cee_inference' },
  accepted: { mark: 'accepted', chip: 'olumi', modelTabSource: 'cee_inference' },
  placeholder: { mark: null, chip: 'unsized', modelTabSource: undefined },
  definitional: { mark: null, chip: null, modelTabSource: undefined },
  exact: { mark: null, chip: null, modelTabSource: undefined },
  example: { mark: null, chip: 'example', modelTabSource: undefined },
})

/** Whose this link's strength is, now. null = no strength set, or an author nothing here can attest. */
export function edgeProvenance(
  data: Record<string, unknown> | undefined | null,
  /** The caller's resolved strength display (the inspector passes its live store value); default: resolved from data. */
  display?: EdgeValueDisplay,
): EdgeProvenance | null {
  if (!data) return null
  const source = edgeValueSource(data, 'weight')
  if (source === 'user') return { kind: 'user' }
  if (source === 'template' || edgeSizePhrase(data)?.exampleFigure === true) return { kind: 'example' }
  if (isStrengthDefinitional(data)) return { kind: 'definitional' }
  if (typeof data.strengthIdentityExact === 'string' && data.strengthIdentityExact !== '' && source === 'cee') return { kind: 'exact' }
  if (isStrengthPlaceholder(data)) return { kind: 'placeholder' }
  const shown = display ?? resolveEdgeSignedStrengthDisplay(data)
  const parsed = NaturalEffectSchema.safeParse(data.naturalEffect)
  const natural = parsed.success && shown.show && naturalEffectStrengthIsCurrent(shown.value, parsed.data.strengthMean)
    ? parsed.data : null
  if (natural?.author === 'user') return { kind: natural.userOrigin === 'brief' ? 'brief' : 'user' }
  if (isStrengthStated(data)) return { kind: 'brief' }
  if (source === 'cee' && isStrengthAccepted(data)) return { kind: 'accepted' }
  if (source === 'cee' || natural?.author === 'olumi_estimate') return { kind: 'olumi_estimate' }
  return null
}

/** This link's mark kind, or null. */
export function edgeProvenanceMark(data: Record<string, unknown> | undefined | null): ValueProvenanceKind | null {
  const p = edgeProvenance(data)
  return p === null ? null : EDGE_PROVENANCE[p.kind].mark
}
