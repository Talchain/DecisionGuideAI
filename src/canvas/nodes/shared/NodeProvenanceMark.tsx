import { classifyNodeProvenance, VALUE_PROVENANCE_LABEL } from '../../domain/valueProvenance'
import {
  VALUE_PROVENANCE_ICON,
  PROVENANCE_ICON_SIZE_CLASSES,
} from '../../domain/valueProvenanceIcon'

/**
 * ⭐⭐ WHO PUT THIS ELEMENT HERE — on the card, at a fixed position, on every
 * node type whose `provenance` is about a value.
 *
 * THE PROBLEM THIS ANSWERS, from driving deployed staging: **every element on a
 * canvas card is a CONCLUSION.** `Influence 100%`, `Ahead 48%`, `Strength 50%`,
 * a `#1` rank badge — six type sizes on one card and all of them results.
 * Nothing on the card says where any of it CAME FROM. A user therefore could
 * not tell their own model from Olumi's guesses at a glance — which is the
 * difference between a diagram of a brief and a surface you can review.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ IT IS A GLYPH, NOT A WORD — AND THE FIRST VERSION SHIPPED A RATIFIED-SPEC
 * VIOLATION ON EVERY CARD (1 Sep 2026)
 * ─────────────────────────────────────────────────────────────────────────────
 * Measured on deployed `d4ff3683`, a real 14-node model: **9 of 14 cards read
 * "AI estimate"**, 4 read "From brief", 1 read "Set by you". The founder:
 * *"There's lots of text with things like AI Estimate and From Brief, when they
 * should all be icons with hoverover states."* His standing ruling is that copy
 * identical on every card is furniture, not information. The CLAIM was right;
 * the text pill was the wrong carrier for it, at fourteen repetitions.
 *
 * ⛔ AND THE PILL WAS ALREADY FORBIDDEN. `DESIGN_SYSTEM.md` §"Pills and Badges
 * (v4 §8.5)" lists `className="border border-danger/30 text-danger"` as an
 * explicit ❌ WRONG example — *"Text on pills is always `text-text-body` —
 * never `text-{colour}`. Colour is carried by the border only."* This
 * component's `BORDER` map was exactly that anti-pattern
 * (`border-info/40 text-info`, `border-warning/40 text-warning`,
 * `border-success/40 text-success`). Converting the pill to an icon RESOLVES it
 * rather than relocating it: §Iconography governs icons, and there is no pill
 * left to put coloured text on.
 *
 * ⚠ THE HUE DID NOT SURVIVE THE MOVE, AND THAT IS A MEASUREMENT, NOT A TASTE.
 * §Iconography's colour rule allows a status icon to take `text-warning` /
 * `text-success`. Against the card's own fill `--bg-panel` #FEFEFE those
 * tokens measure **1.92:1** and **2.02:1**; SC 1.4.11 asks **3:1** for a
 * graphic that carries meaning. The old pill got away with the hue because the
 * WORD carried the meaning and the colour was decoration — an icon has no word
 * behind it, so hue-as-meaning at 1.92:1 would be a NEW access defect
 * introduced by a readability fix. `text-text-light` measures **5.23:1**, the
 * SHAPE carries the meaning, and shape is the channel a colour-blind reader
 * keeps. (§Iconography: *"`text-text-light` at rest for neutral contexts"*.)
 * There is a second reason: on the canvas amber is RATIFIED as "needs your
 * judgement" on the BORDER, so an amber glyph would put a second amber channel
 * on one card — the conflation §"Border vocabulary" forbids.
 *
 * ⚠ THE SIZE IS THE DS's 14px, CARRIED THROUGH THE CANVAS COUNTER-SCALE. A bare
 * `w-3.5` would reach the user at **7px** on the default whole-model view,
 * because node DOM sits inside React Flow's viewport transform and a post-draft
 * auto-fit parks at `LABEL_LEGIBLE_ZOOM` (0.50). The counter-scale is what makes
 * the ratified size TRUE on the canvas rather than nominal — the same mechanism
 * the canvas type tokens carry. Derivation: `domain/valueProvenanceIcon.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠⚠ NOT A BUTTON, NOT FOCUSABLE — AND THE WORDS ARE STILL REACHABLE
 * ─────────────────────────────────────────────────────────────────────────────
 * `EstimateMarker` records the same decision in the same words: a status marker,
 * whose detail is reachable through the node's quick actions and the inspector
 * (both keyboard-reachable), and a second tab stop per node would cost more than
 * it gives. Diverging here would give the canvas two rules for two marks that
 * sit 20px apart.
 *
 * But a HOVER-ONLY tooltip on a non-focusable element is unreachable by keyboard
 * AND by touch, and this is a PROVENANCE claim — the one thing on the card a
 * reader is entitled to. Trading an honesty problem for an access one is not a
 * fix. So the resolution is to stop relying on hover for the claim at all:
 *
 *   · `role="img"` + `aria-label` puts the FULL canonical label in the
 *     accessible name, which needs no focus and no hover. This is strictly
 *     BETTER than the pill it replaces, where the label was rendered text and
 *     the raw producer literal was hover-only.
 *   · `title` keeps the mouse tooltip, and still carries the raw literal for
 *     anyone debugging what the producer actually sent.
 *   · `CanvasLegendPopover` — a real toolbar BUTTON, reachable by keyboard and
 *     by touch — now keys these three glyphs. Replacing words with a private
 *     code would be the worse trade; the legend is what makes it a public one.
 *
 * The one reader genuinely worse off is a sighted touch user who never opens
 * the legend, and that is named here rather than hidden.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ NOTHING CLASSIFIED HERE, AND THAT IS DELIBERATE
 * ─────────────────────────────────────────────────────────────────────────────
 *   · `classifyNodeProvenance` — the ONE authority on what a `CEEProvenance`
 *     literal means (`user_set` → human, `from_brief` → brief, `ai_inferred` →
 *     ai). Not re-decided here; a change to the vocabulary reaches this mark
 *     for free.
 *   · `VALUE_PROVENANCE_LABEL` — the canonical copy, now carried in the
 *     accessible name rather than as rendered text.
 *   · `VALUE_PROVENANCE_ICON` — the canonical glyph. A second picture for "AI
 *     estimate" is how one idea comes to have two names, exactly as a second
 *     spelling would be.
 *
 * ⛔ ABSENT PROVENANCE RENDERS NOTHING, NEVER A GUESS. `classifyNodeProvenance`
 * returns null for any literal it does not recognise, and this returns null with
 * it. A mark that defaulted to "AI estimate" would be inventing an attribution —
 * the exact class of claim this component exists to make honest. Fail-closed is
 * the whole point: silence is a state a reader can interpret, a wrong
 * attribution is not.
 */
export interface NodeProvenanceMarkProps {
  /** The node's raw `provenance` literal, straight off `data`. */
  provenance: unknown
}

export function NodeProvenanceMark({ provenance }: NodeProvenanceMarkProps) {
  // ⚠ THIS TYPE GUARD IS DEFENSIVE, NOT LOAD-BEARING, and a mutation test
  // proved it: removing it kills no assertion. `classifyNodeProvenance`
  // compares with `===` against three string literals, so a number, an object
  // or undefined all fall through to its `return null` and this component
  // returns null with it — the guard changes nothing observable.
  //
  // Recorded rather than quietly counted as a biting mutant. An equivalent
  // mutant has to be DEMONSTRATED, and the demonstration is: the only other use
  // of `raw` is the `title`, which is never reached when `cls` is null. It stays
  // because it makes the contract legible at the call site (`data.provenance`
  // is `unknown`), not because a test depends on it.
  const raw = typeof provenance === 'string' ? provenance : null
  const cls = classifyNodeProvenance(raw)
  if (!cls) return null

  const label = VALUE_PROVENANCE_LABEL[cls.kind]
  const Icon = VALUE_PROVENANCE_ICON[cls.kind]

  return (
    <span
      data-testid="node-provenance-mark"
      data-provenance-kind={cls.kind}
      // The claim itself, available with no hover and no focus.
      role="img"
      aria-label={label}
      title={`${label} — source: ${raw}`}
      className="inline-flex shrink-0 items-center text-text-light"
    >
      {/* `aria-hidden` because the accessible name is on the wrapper — without
          it a screen reader would announce the mark twice. */}
      <Icon aria-hidden="true" className={PROVENANCE_ICON_SIZE_CLASSES} />
    </span>
  )
}
