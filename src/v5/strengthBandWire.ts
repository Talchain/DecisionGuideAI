/**
 * UI-SEM-098 — the ONE translation between the canvas strength-band vocabulary
 * and the contract's `StrengthBand` (`@talchain/schemas`, `causal-claims`).
 *
 * The two vocabularies name the SAME four bands with different spellings:
 *
 *   canvas `CanvasStrengthBandId`   contract `StrengthBand`
 *   'slight'                        'slight'
 *   'moderate'                      'moderate'
 *   'strong'                        'strong'
 *   'veryStrong'                    'very_strong'
 *
 * Same bands, not merely same words: CEE's own band table
 * (`olumi-assistants-service` `src/orchestrator-v5/format/edge-strength-bands.ts`)
 * cuts |β| at 0.2 / 0.4 / 0.7 with midpoints 0.10 / 0.30 / 0.55 / 0.85 —
 * identical to `CANVAS_STRENGTH_BANDS` in `canvas/domain/vocabulary.ts`. So this
 * is a spelling conversion at the wire boundary (same class as UI-SEM-094), not
 * a re-banding.
 *
 * NOT WIRED YET, deliberately. `edge_strength_edit.band` arrives in schemas
 * 0.60.0, and the UI must not SEND it until CEE's `edge_strength_edit` band
 * handler is served (producer sequencing, #70 5857739727). Until then nothing
 * imports this from a writer; `adaptEdgeStrengthEdit` (`buildPayload.ts`) still
 * sends no `band`.
 *
 * Out of scope on purpose: `components/model-tab/strengthBands.ts`'s local
 * `'strong' | 'moderate' | 'weak' | 'negligible'`. Its ids never reach the wire —
 * every writer that uses it (ModelRowView band pills, ContestedEdgeCard) sends
 * the numeric `STRENGTH_BAND_MIDPOINTS` magnitude, not the id — so it needs no
 * translation, and giving it one would be a second translation.
 *
 * Exhaustive in BOTH directions, at compile time:
 *  - `satisfies Record<CanvasStrengthBandId, StrengthBand>` fails when the canvas
 *    gains a band this table does not map;
 *  - `_EveryContractBandIsReachable` fails when the contract gains a band no
 *    canvas band maps to.
 * `__tests__/strengthBandWire.spec.ts` proves the same at runtime against the
 * contract's own enum values and the canvas table's own ids.
 */
import type { StrengthBand } from '@talchain/schemas'
import type { CanvasStrengthBandId } from '../canvas/domain/vocabulary'

const CANVAS_TO_CONTRACT = {
  slight: 'slight',
  moderate: 'moderate',
  strong: 'strong',
  veryStrong: 'very_strong',
} as const satisfies Record<CanvasStrengthBandId, StrengthBand>

type _EveryContractBandIsReachable =
  Exclude<StrengthBand, (typeof CANVAS_TO_CONTRACT)[CanvasStrengthBandId]> extends never ? true : never
const _everyContractBandIsReachable: _EveryContractBandIsReachable = true
void _everyContractBandIsReachable

const CONTRACT_TO_CANVAS: Readonly<Record<StrengthBand, CanvasStrengthBandId>> = Object.freeze(
  Object.fromEntries(
    (Object.entries(CANVAS_TO_CONTRACT) as [CanvasStrengthBandId, StrengthBand][]).map(
      ([canvas, contract]) => [contract, canvas],
    ),
  ) as Record<StrengthBand, CanvasStrengthBandId>,
)

/** Canvas band id → the contract's wire spelling. */
export function toContractStrengthBand(band: CanvasStrengthBandId): StrengthBand {
  return CANVAS_TO_CONTRACT[band]
}

/** Contract wire spelling → canvas band id. */
export function fromContractStrengthBand(band: StrengthBand): CanvasStrengthBandId {
  return CONTRACT_TO_CANVAS[band]
}
