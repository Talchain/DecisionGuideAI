/**
 * The SHAPE rule the card and an option target share, as a pure module — moved out of `FactorValueFigure.tsx` (30 Sep
 * 2026) so a reader of the rule (`optionTargetDisplay`, and through it the results hook) does not pull the component's
 * file into the workspace shell's import closure (`tests/ci-guards/shell-conformance.spec.ts` raw typography).
 */
import { classifyUnit } from '../../../utils/unitClassifier'
import { isSuppressedUnit } from '../../utils/labelUtils'

const BARE_NUMBER = /^-?(\d+(\.\d+)?|\.\d+)$/

/**
 * The SHAPE half of `readoutIsBareModelScale`, with no provenance gate: the
 * readout is ONE bare number inside 0–1 AND the factor node declares no real
 * unit (absent, a suppressed descriptor, or a placeholder such as `scale`).
 * Split out (28 Sep 2026, DIFF N7) so an option TARGET on this factor can ask
 * the same shape question — its provenance lives in the intervention
 * vocabulary (`cee_hypothesis`, `user_specified`), which the node-vocabulary
 * gates above must never be fed (see `InterventionRow`'s T-VOCAB).
 */
export function readoutIsBareModelFigure(readout: string | null, data: unknown): boolean {
  if (readout === null) return false
  const text = readout.trim()
  if (!BARE_NUMBER.test(text)) return false
  const n = Number(text)
  if (!Number.isFinite(n) || n < 0 || n > 1) return false
  const d = data as Record<string, unknown> | null | undefined
  const obs = (d?.observedState ?? d?.observed_state) as Record<string, unknown> | undefined
  const rawUnit = typeof obs?.unit === 'string' ? obs.unit : typeof d?.unit === 'string' ? (d.unit as string) : null
  // The card's own display guard: an internal descriptor ("other") is no unit.
  const unit = rawUnit !== null && !isSuppressedUnit(rawUnit) ? rawUnit : null
  const unitKind = classifyUnit(unit).kind
  return unitKind === 'none' || unitKind === 'placeholder'
}
