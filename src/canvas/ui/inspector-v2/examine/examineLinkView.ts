/**
 * ⭐ EXAMINE THIS LINK — the link-side twin of `examineAssumptionView.ts` (slice 1, 52f8cd; Paul "go" 1 Oct 10:1xZ).
 *
 * The same reasoning step on a relationship: name how strong the model assumes the link is, say why it is worth
 * examining on an explicit basis, and offer ONE route to the user's own view through the existing Agent path.
 * WITNESSED on served `8943c32` (guest b13175d0, 52f8cd): the prefilled ask → Olumi asks what the user knows → "I think
 * this link is strong" → card "Record this link" → pressed → stored as the user's own estimate (`user_specified`).
 * A natural-effect sentence ("1 more conversation every 2 months") is refused by today's link door, so the limit line
 * names the route that works — a strength in words — and never promises more.
 *
 * Five bases, each from a fact the client already holds; never a score this module invents:
 *   · `example`        — the example decision's live strength (`edgeSizePhrase` `exampleFigure`).
 *   · `analysis`       — the last Run found the comparison could change with this link's strength (`isEdgeFragile`).
 *   · `placeholder`    — Olumi has not sized the link; it carries a starting strength (`isStrengthPlaceholder`).
 *   · `accepted`       — Olumi's strength the user accepted (`isStrengthAccepted`, gate 5): still Olumi's figure, so
 *                        still worth examining, said in the factor twin's words (`EXAMINE_WHY.accepted`).
 *   · `olumi_estimate` — the strength is Olumi's (`edgeValueSource(…, 'weight') === 'cee'`).
 * ⛔ A strength SIZED FROM THE USER'S OWN FIGURE (`edgeSizePhrase` `usersFigure`, `magnitude: user_stated`) is not
 * Olumi's: it gets no Olumi basis, so the pane never says "Olumi estimated" beside "From your brief: £49" (RA
 * `21-j4-49-inspector.txt`, gate 5 item 2). Fragile, it is still examined, on the `analysis` basis.
 * ⛔ The why line never says "you haven't confirmed it": a review the canvas does not hold (one made before it was
 * carried, or on another path) would read falsely. `olumi_estimate` says what stays true after any confirmation (origin ≠
 * acceptance); a review the canvas DOES hold (`isStrengthAccepted`) has its own basis, `accepted`.
 * ⛔ A SOUND LINK GETS NO CHALLENGE: the user's own (or a starter's) strength with nothing flagged, a structural link, a
 * link that holds BY DEFINITION (`isStrengthDefinitional`, MG 0ebb952a — arithmetic, not a belief; CEE refuses any change
 * to it, fragile or not), or a link with no stated strength returns `null` — no section, no warning chrome.
 * ⛔ The strength is said as its BAND WORD only, never the internal 0–1 number (AIQ 5923931082; CEE #2434).
 */
import { edgeValueSource, resolveEdgeSignedStrengthDisplay } from '../../../domain/edgeValueProvenance'
import { isStrengthPlaceholder } from '../../../domain/strengthPlaceholder'
import { isStrengthDefinitional } from '../../../domain/strengthDefinitional'
import { getStrengthLabel } from '../../../domain/vocabulary'
import { isStrengthAccepted } from '../../../domain/strengthAccepted'
import { isStrengthStated } from '../../../domain/strengthStated'
import { edgeSizePhrase } from '../../../edges/edgeSizePhrase'
import { EXAMINE_WHY } from './examineAssumptionView'

export type ExamineLinkBasis = 'example' | 'analysis' | 'placeholder' | 'accepted' | 'olumi_estimate'

export interface ExamineLinkView {
  /** The strength as a band word (`getStrengthLabel`), never a number. */
  readonly value: string
  readonly basis: ExamineLinkBasis
  /** One sentence: why this link is worth examining, on `basis`. */
  readonly why: string
  /** The message the action prefills. The user sends it; nothing is sent here. */
  readonly prepare: { readonly label: string; readonly text: string }
}

export const EXAMINE_LINK_HEADING = 'Examine this link'
export const EXAMINE_LINK_ACTION = 'Examine with Olumi'
export const EXAMINE_LINK_LIMIT =
  'Olumi will ask what you know. Say how strong you think it is, for example “strong” or “slight”. Nothing changes until you approve it.'

export const EXAMINE_LINK_WHY: Readonly<Record<ExamineLinkBasis, string>> = Object.freeze({
  example: 'This is an example figure, not a figure about your situation. Change it to see how much it matters.',
  analysis: 'Your last Run found the comparison could change if this link is stronger or weaker than assumed.',
  placeholder: 'Olumi hasn’t sized this link yet. It uses a starting strength, not an estimate.',
  accepted: EXAMINE_WHY.accepted,
  olumi_estimate: 'Olumi estimated how strong this link is. It is an estimate, not a measurement.',
})

export function buildExamineLinkView(input: {
  readonly sourceLabel: string
  readonly targetLabel: string
  /** The edge's `data`. */
  readonly data: Record<string, unknown> | undefined
  /** `isStructuralEdge` — organisational wiring, not a belief anyone holds. */
  readonly structural: boolean
  /** The last Run's robustness found this link fragile (`isEdgeFragile`). */
  readonly fragile: boolean
}): ExamineLinkView | null {
  if (input.structural || !input.data || isStrengthDefinitional(input.data)) return null
  const display = resolveEdgeSignedStrengthDisplay(input.data)
  if (!display.show) return null
  const size = edgeSizePhrase(input.data)
  const example = size?.exampleFigure === true
  const olumis = edgeValueSource(input.data, 'weight') === 'cee' &&
    size?.usersFigure !== true && !example && !isStrengthStated(input.data)
  if (!input.fragile && !olumis && !example) return null
  const basis: ExamineLinkBasis = example
    ? 'example'
    : input.fragile
      ? 'analysis'
      : isStrengthPlaceholder(input.data)
        ? 'placeholder'
        : isStrengthAccepted(input.data)
          ? 'accepted'
          : 'olumi_estimate'
  const band = getStrengthLabel(Math.abs(display.value))
  return {
    value: band,
    basis,
    why: EXAMINE_LINK_WHY[basis],
    prepare: {
      label: `Examine ${input.sourceLabel} → ${input.targetLabel}`,
      text:
        `Help me examine the link from "${input.sourceLabel}" to "${input.targetLabel}" (currently ${band.toLowerCase()}). ` +
        'What is it based on, and how strong is it really?',
    },
  }
}
