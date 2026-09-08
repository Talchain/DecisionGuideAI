/**
 * Model tab v2 — SPLIT A DIRECTIONAL EFFECT LABEL SO THE DIRECTION CANNOT BE
 * TRUNCATED AWAY.
 *
 * ⭐⭐ THE DEFECT, MEASURED ON THE DEPLOYED BUILD `d0f4628b`, NOT IMAGINED.
 * Guest board, Model tab, Relationships group, panel width 414px (the width the
 * dock actually opens at): ELEVEN of eleven relationship rows rendered their
 * effect value as the byte-identical string
 *
 *     "Moderat…"
 *
 * Six of those were "Moderate negative effect" and five were "Moderate positive
 * effect". The two are INDISTINGUISHABLE ON SCREEN, and there is no `title`
 * attribute anywhere on the row, so the direction is not recoverable by hover
 * either. A causal model whose relationships do not say whether a factor helps
 * or hurts is not a weaker model; on that row it is not a model at all.
 *
 * ⚠ AND THE ESTATE ALREADY BELIEVED THE OPPOSITE, IN WRITING. `ModelRowView`'s
 * `valueMayShrink` header justifies letting the phrase shrink like this:
 *
 *     "a multi-word qualitative PHRASE has none [no atomicity]: 'Moderate
 *      positive effect' truncates to 'Moderate positive…' and still says what
 *      it means."
 *
 * The TRADE that comment makes is right and is NOT reversed here — the identity
 * track is the only flexible one, so every pixel an immovable value takes comes
 * out of the row's label, and a row whose identity is unreadable is worse. What
 * was wrong was the PREMISE about what survives: the cell is 80px, the phrase
 * needs 138–142px, and the cut lands at character 8 — five characters before
 * the word that carries the meaning. The guard was sound; the sentence about
 * what it receives was never measured. (CLAUDE.md trap 22: verify WHAT STRING A
 * GUARD ACTUALLY RECEIVES, not that it is present and correct.)
 *
 * ⭐ DERIVED FROM THE PRODUCER, NEVER SPELLED HERE. The table below is built by
 * CALLING `getDirectionalStrengthLabel` across every band midpoint and both
 * directions, so if that function's wording changes this parser follows it
 * automatically and a stale copy cannot drift (CLAUDE.md trap 12 — the estate's
 * dominant defect is the hand-maintained mirror). `ModelRowView`'s own
 * `valueMayShrink` corpus is derived the same way; this is that pattern, reused.
 *
 * ⚠ WHAT THIS DELIBERATELY DOES NOT MATCH, and each omission is the producer's
 * own distinction, kept:
 *   · "Negligible effect"                      — carries no direction to lose.
 *   · "<magnitude> effect, direction not stated" — the producer EXPLICITLY
 *     declined to state one. Marking it with an arrow would invent the very
 *     claim that string exists to withhold.
 * Both fall through to `null` and render exactly as they do today.
 */
import {
  STRENGTH_BAND_MIDPOINTS,
  getDirectionalStrengthLabel,
} from '../components/model-tab/strengthBands'
import type { EdgeDirectionDisplay } from '../domain/edgeValueProvenance'

/** A direction the producer has positively STATED. Never inferred. */
export type StatedEffectDirection = 'positive' | 'negative'

export interface SplitEffectLabel {
  /** The stated direction, carried by a mark that cannot shrink. */
  readonly direction: StatedEffectDirection
  /**
   * The phrase with only the direction WORD removed — still the producer's own
   * string, minus the part the mark now carries. This is what keeps shrinking,
   * so the label beside it keeps the width the 6 Sep measurement bought it.
   */
  readonly remainder: string
}

const SPLIT_BY_LABEL: ReadonlyMap<string, SplitEffectLabel> = (() => {
  const table = new Map<string, SplitEffectLabel>()
  for (const midpoint of Object.values(STRENGTH_BAND_MIDPOINTS)) {
    for (const direction of ['positive', 'negative'] as const) {
      // `source` is required by the type and unread by the function; any real
      // member is honest here because the label depends only on `show` and
      // `direction`.
      const display: EdgeDirectionDisplay = { show: true, direction, source: 'cee' }
      const label = getDirectionalStrengthLabel(
        direction === 'negative' ? -midpoint : midpoint,
        display,
      )
      const remainder = label.replace(` ${direction}`, '').trim()
      // If the producer ever stops embedding the direction word, `remainder`
      // equals `label` and this entry is DROPPED rather than shipping a mark
      // beside a phrase that still spells the direction out.
      if (remainder !== label && remainder.length > 0) {
        table.set(label, { direction, remainder })
      }
    }
  }
  return table
})()

/**
 * The exact labels this module recognises, derived. Exported so a test can
 * assert the set is non-empty and covers both directions — an empty table would
 * make every consumer silently fall through to today's behaviour and the fix
 * would be invisible rather than broken (CLAUDE.md trap 13: an absence probe
 * needs a positive control).
 */
export const RECOGNISED_EFFECT_LABELS: readonly string[] = [...SPLIT_BY_LABEL.keys()]

/** `null` for anything that does not carry a stated direction. Never throws. */
export function splitEffectLabel(display: string | null | undefined): SplitEffectLabel | null {
  if (typeof display !== 'string') return null
  return SPLIT_BY_LABEL.get(display.trim()) ?? null
}
