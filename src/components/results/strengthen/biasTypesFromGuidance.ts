/**
 * The producer's cognitive-bias findings, as bias TYPES the engine can act on.
 *
 * ⭐⭐ WHY THIS EXISTS — the one CREATIVE move in the product was structurally
 * dark, and it was dark on exactly the runs that called for it.
 *
 * `strengthen:broaden` ("Find a route that works differently") is the only
 * builder of the eight that asks for a NEW idea rather than a more complete
 * one. It fires when `biasFindingTypes` contains a narrow-framing code — and
 * that list was fed from ONE source: `useCanvasStore(s => s.draftCoaching
 * ?.biasSignals)`.
 *
 * ⚠ MEASURED ON DEPLOYED `cffe418d`, driving a real completed run as a guest:
 * `draftCoaching` is **NULL** on the re-draft path, so `biasFindingTypes` was
 * `[]` and broaden could not fire. Meanwhile the producer HAD sent bias
 * findings — the panel rendered two, titled "Narrow framing" and
 * "Overconfidence" — which arrived on the PHASE-3 GUIDANCE channel instead.
 *
 * So the product was told "your options are narrowly framed", and the move it
 * has for precisely that could not see it. Two channels carrying the same fact,
 * and the trigger subscribed to the one that was empty.
 *
 * ⚠⚠ NOTHING HERE INVENTS A BIAS. Two producer facts are required, and both are
 * the producer's own:
 *   1. `coaching_kind === 'bias_signal'` — a REQUIRED field on coaching blocks,
 *      and the only STRUCTURAL marker that a finding is about a bias at all. An
 *      assumption check or a calibration prompt is not admitted.
 *   2. the block's `title`, which for a bias signal IS the bias name
 *      ("Narrow framing", "Overconfidence") — matched against
 *      `BIAS_SIGNAL_REGISTRY`, the estate's ONE canonical bias registry.
 *
 * ⭐ THE REGISTRY IS INVERTED, NOT COPIED. A hand-written title→code list here
 * would be the hand-maintained mirror this codebase keeps paying for (trap 12)
 * — and it is the very defect an audit found one directory over, where a
 * strengthen bias allowlist recognised 3 of the 9 biases the registry names.
 * Inverting means every bias the registry knows is covered for free, today and
 * after the next one is added, and a renamed title stops matching loudly rather
 * than silently drifting.
 *
 * An unrecognised title yields NOTHING. The registry never invents a title and
 * this never invents a code; a bias we do not know is a bias we do not claim.
 */
import { BIAS_SIGNAL_REGISTRY } from '../../../canvas/shared/biasSignalTitles'
import type { StrengthenPhase3Item } from './strengthenTypes'

/** The producer's `coaching_kind` for a cognitive-bias card. */
export const BIAS_COACHING_KIND = 'bias_signal'

/**
 * title (normalised) → every canonical code that names it.
 *
 * Several codes share a title by design (`framing`, `framing_bias` and
 * `narrow_framing` are all "Narrow framing"), and ALL of them are emitted: the
 * sole consumer tests MEMBERSHIP (`biasFindingTypes.some(t => NARROW_TYPES
 * .includes(t))`), never a count, so emitting each spelling makes the match
 * independent of which one a given consumer happens to list. Verified at the
 * bytes: `biasFindingTypes` has exactly one reader.
 */
const CODES_BY_TITLE: ReadonlyMap<string, readonly string[]> = (() => {
  const byTitle = new Map<string, string[]>()
  for (const [code, entry] of Object.entries(BIAS_SIGNAL_REGISTRY)) {
    const key = entry.title.trim().toLowerCase()
    const codes = byTitle.get(key)
    if (codes) codes.push(code)
    else byTitle.set(key, [code])
  }
  return byTitle
})()

/** Exposed so a spec can pin the inversion without re-implementing it. */
export const KNOWN_BIAS_TITLES: readonly string[] = [...CODES_BY_TITLE.keys()]

/**
 * Canonical bias codes named by the producer's phase-3 bias-signal cards.
 *
 * Returns `[]` when the producer sent no bias signal, or named one this estate
 * has no code for. Both are honest silences.
 */
export function biasTypesFromPhase3Items(
  items: readonly StrengthenPhase3Item[],
): string[] {
  const found = new Set<string>()
  for (const item of items) {
    if (item.coachingKind !== BIAS_COACHING_KIND) continue
    const codes = CODES_BY_TITLE.get(item.title.trim().toLowerCase())
    if (!codes) continue
    for (const code of codes) found.add(code)
  }
  return [...found]
}

/**
 * The engine's `biasFindingTypes`: the draft-coaching channel UNION the
 * phase-3 channel.
 *
 * ⚠ A UNION, NOT A FALLBACK. Either channel may carry findings the other does
 * not, and a fallback would silently drop the second set whenever the first was
 * non-empty. Deduplicated, because the same bias arriving on both channels is
 * one bias.
 */
export function mergeBiasFindingTypes(
  draftCoachingSignals: ReadonlyArray<{ type: string }> | null | undefined,
  phase3Items: readonly StrengthenPhase3Item[],
): string[] {
  return [
    ...new Set([
      ...(draftCoachingSignals ?? []).map((b) => b.type),
      ...biasTypesFromPhase3Items(phase3Items),
    ]),
  ]
}
