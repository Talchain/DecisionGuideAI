/**
 * ⭐ A LINK'S SIZE, AND WHOSE IT IS — one resolver for every surface that says it (Canvas lane, 4 Oct 2026, beat 1).
 *
 * The magnitude contract (MG #70 5845713522) stores a link's size in the target's own units on `edge.provenance`
 * (`natural_effect`) with its author (`magnitude`: `user_stated` / `olumi_estimate` / `olumi_placeholder`), and
 * `readWireNaturalEffect` keeps both on `edge.data.naturalEffect` at every ingestion hop. Until now only the Model
 * tab said it; the canvas hover card and the link inspector said "Olumi's estimate" of all four sizes the user
 * stated in journey 4's brief, because they read the β's stamp (`weightSource`), which never looks at `magnitude`.
 *
 * Nothing here converts β or re-derives a size: it is `naturalEffectPhraseParts` behind the same gates the Model
 * tab row used (a moved β, an unstated direction or a contradicting sign → null → the band speaks).
 *
 * `resolveEdgeStrengthEditSeed` moved here from `model-tab-v2/adapters.ts` (which re-exports it) so the canvas can
 * read a link's size without importing the Model tab's adapters.
 */
import { resolveEdgeDirectionDisplay, resolveEdgeValueDisplay } from '../domain/edgeValueProvenance'
import { NaturalEffectSchema, composeNaturalEffectPhrase, naturalEffectPhraseParts, type NaturalEffectAuthor } from '../domain/naturalEffect'
import { isStrengthDefinitional } from '../domain/strengthDefinitional'

/**
 * The NUMBER behind a relationship row's label, and whether the edge's direction
 * is STATED — resolved together, once.
 *
 * ⭐⭐ THE TWO HALVES ARE RETURNED AS ONE FACT ON PURPOSE, and this is the whole
 * reason the function exists rather than two call sites reading two resolvers.
 * The number's MEANING depends on the flag: with a stated direction the seed is
 * SIGNED and the editor is a signed control; without one the seed is a bare
 * MAGNITUDE and the editor may not mint a sign. Deriving the seed in one place
 * and the flag in another is trap 21 waiting to happen — a magnitude edited as
 * though it were signed is precisely "a sign taken off a number", which the
 * `proposeEdgeStrength` contract forbids in capitals.
 *
 * ⚠ `edgeValue` ABOVE IS BUILT FROM THIS, not beside it. The label the row shows
 * and the number its editor opens with are then the same derivation by
 * construction; they cannot drift into disagreeing about what the row means.
 * `RelationshipStrengthEditSeed.directionStated` is exactly
 * `resolveEdgeDirectionDisplay(...).show`, which is also what decides whether the
 * label reads "... positive effect" or "... effect, direction not stated" — so a
 * user reading the row and the authority writing the model consult one answer.
 *
 * ⚠ THE GATES ARE THE POINT, AND THEY ARE NOT MINE. An unstamped weight resolves
 * to NOTHING rather than to the UI default (`resolveEdgeValueDisplay`), and a
 * direction is never inferred from a sign (`resolveEdgeDirectionDisplay`). This
 * surface must not be the one place in the estate that re-fabricates what those
 * two resolvers exist to suppress — the Model tab printed "Strong positive
 * effect" over exactly that fabrication before they were written.
 *
 * ⚠ THIS IS A DISPLAY-SIDE ANSWER AND MAY NOT BE USED FOR `expected`. It says
 * what the row shows; it says NOTHING about what the server holds. That question
 * belongs to `conversation/edgeServerStatedStrength.ts`, and substituting one for
 * the other is the defect #1295 was the fix-forward for.
 */
export interface RelationshipStrengthEditSeed {
  /** Signed when the direction is stated, a bare magnitude when it is not. */
  readonly seed: number
  /** Whether anyone has STATED this edge's direction — never read off a sign. */
  readonly directionStated: boolean
}

export function resolveEdgeStrengthEditSeed(
  data: Record<string, unknown> | undefined,
): RelationshipStrengthEditSeed | null {
  const weight = resolveEdgeValueDisplay(data, 'weight')
  if (!weight.show) return null

  const direction = resolveEdgeDirectionDisplay(data)
  // A magnitude with no stated direction is a magnitude, not an effect.
  if (!direction.show) return { seed: weight.value, directionStated: false }

  return {
    seed: direction.direction === 'negative' ? -weight.value : weight.value,
    directionStated: true,
  }
}

export interface EdgeSizePhrase {
  /** The whole sentence, author words included: "Decrease of about £300 / month per 1 customer · from your brief". */
  readonly sentence: string
  /** The size alone: "Decrease of about £300 / month per 1 customer". */
  readonly size: string
  /** Whose size, in words ("from your brief" / "your figure" / "Olumi's estimate" / "by definition"); may be ''. */
  readonly whose: string
  /** A user's written range the size is one end of (" · the low end of your …"), or ''. */
  readonly ofRange: string
  readonly author: NaturalEffectAuthor
  /** The size is the USER's own (stated in the brief or entered): the β beside it was sized from their figure. */
  readonly usersFigure: boolean
}

/** The link's size and author, or null when it must not be said (then the band speaks, as before). */
export function edgeSizePhrase(data: Record<string, unknown> | undefined): EdgeSizePhrase | null {
  const seed = resolveEdgeStrengthEditSeed(data)
  if (seed === null) return null
  // Re-parsed here: persisted edge data is not proof of shape.
  const natural = NaturalEffectSchema.safeParse(data?.naturalEffect)
  if (!natural.success) return null
  const definitional = isStrengthDefinitional(data)
  const parts = naturalEffectPhraseParts(natural.data, seed.seed, resolveEdgeDirectionDisplay(data), definitional)
  if (parts === null) return null
  return {
    sentence: composeNaturalEffectPhrase(parts),
    ...parts,
    author: natural.data.author,
    usersFigure: natural.data.author === 'user' && !definitional,
  }
}
