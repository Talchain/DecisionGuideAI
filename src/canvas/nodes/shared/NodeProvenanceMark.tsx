import { classifyNodeProvenance } from '../../domain/valueProvenance'
import { nodeProvenanceClaim, provenanceClaimLabel } from '../../domain/nodeProvenanceClaim'
import type { NodeType } from '../../domain/nodes'
import {
  VALUE_PROVENANCE_ICON,
  PROVENANCE_ICON_SIZE_CLASSES,
} from '../../domain/valueProvenanceIcon'
import Tooltip from '../../../components/Tooltip'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'

/**
 * ⭐⭐ WHO PUT THIS ELEMENT HERE — on the card, at a fixed position, on every
 * node kind, in words that are TRUE OF THAT KIND.
 *
 * THE PROBLEM THIS ANSWERS, from driving deployed staging: **every element on a
 * canvas card is a CONCLUSION.** `Influence 100%`, `Ahead 48%`, `Strength 50%`,
 * a `#1` rank badge — six type sizes on one card and all of them results.
 * Nothing on the card says where any of it CAME FROM. A user therefore could
 * not tell their own model from Olumi's guesses at a glance — which is the
 * difference between a diagram of a brief and a surface you can review.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ TWO DEFECTS, FIXED TOGETHER, AND NEITHER FIX IS A DELETION (1 Sep 2026)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * **1. THE CLAIM WAS WRONG ON MOST KINDS.** This mark rendered
 * `VALUE_PROVENANCE_LABEL` — "AI estimate" / "From brief" / "Set by you", words
 * about a NUMBER — on every card. Over 8 deployed draft captures, **21 of 25
 * non-factor nodes carry no value key at all**: a risk, an option, an outcome
 * has nothing estimated on it. The card was asserting an estimate of a number
 * that does not exist.
 *
 * ⛔ THE FIX IS NOT SUPPRESSION, AND THE FIRST ATTEMPT AT ONE IS WITHDRAWN.
 * On an option, `provenance` answers a question the founder specifically valued
 * — *did Olumi suggest this, or did I bring it?* Deleting the mark from 21 of
 * 25 cards would destroy the signal in order to fix a sentence. So
 * `nodeProvenanceClaim` chooses the VOCABULARY per card (schema-derived, and
 * carrier-checked where the schema says optional), and the structural cards say
 * "Olumi suggested this" / "From your brief" / "You added this" instead. The
 * only kind that says nothing is `goal`, and only because the goal card already
 * renders this same wire literal in its own correctly-scoped surface.
 *
 * **2. IT WAS THE SAME THREE WORDS ON NEARLY EVERY CARD.** Measured on
 * `d4ff3683`, a real 14-node model: 9 of 14 read "AI estimate". The founder:
 * *"There's lots of text with things like AI Estimate and From Brief, when they
 * should all be icons with hoverover states."* Copy identical on every card is
 * furniture, not information — his standing ruling.
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
 * `text-success`. Against the card's own fill `--bg-panel` #FEFEFE those tokens
 * measure **1.92:1** and **2.02:1**; SC 1.4.11 asks **3:1** for a graphic that
 * carries meaning. The old pill got away with the hue because the WORD carried
 * the meaning and the colour was decoration — an icon has no word behind it, so
 * hue-as-meaning at 1.92:1 would be a NEW access defect introduced by a
 * readability fix. `text-text-light` measures **5.23:1**, the SHAPE carries the
 * meaning, and shape is the channel a colour-blind reader keeps. There is a
 * second reason: on the canvas amber is RATIFIED as "needs your judgement" on
 * the BORDER, so an amber glyph would put a second amber channel on one card —
 * the conflation §"Border vocabulary" forbids.
 *
 * ⚠ THE SIZE IS THE DS's 14px, CARRIED THROUGH THE CANVAS COUNTER-SCALE. A bare
 * `w-3.5` would reach the user at **7px** on the default whole-model view,
 * because node DOM sits inside React Flow's viewport transform and a post-draft
 * auto-fit parks at `LABEL_LEGIBLE_ZOOM` (0.50). Derivation:
 * `domain/valueProvenanceIcon.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠⚠ NOT A BUTTON, NOT FOCUSABLE — AND THE WORDS ARE STILL REACHABLE
 * ─────────────────────────────────────────────────────────────────────────────
 * `EstimateMarker` records the same decision in the same words: a status marker,
 * whose detail is reachable through the node's quick actions and the inspector
 * (both keyboard-reachable), and a second tab stop per node would cost more than
 * it gives.
 *
 * But a HOVER-ONLY tooltip on a non-focusable element is unreachable by keyboard
 * AND by touch, and this is a PROVENANCE claim. So `role="img"` + `aria-label`
 * put the full claim in the accessible name, which needs no focus and no hover;
 * the mouse tooltip carries the same sentence; and `CanvasLegendPopover` — a
 * real toolbar BUTTON — keys these glyphs so the picture is a public code, not a
 * private one.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ THE MOUSE TOOLTIP IS NO LONGER `title=` (7 Sep 2026)
 * ─────────────────────────────────────────────────────────────────────────────
 * The founder, driving the deployed canvas: *"if you hover over any individual
 * icon, it doesn't tell you what it is or what to do about it (with a hover
 * state of any kind or something like that)."*
 *
 * ⚠ THIS MARK IS THE SHARPEST INSTANCE OF THAT REPORT, AND THE REASON IS IN THIS
 * FILE'S OWN HISTORY. Defect 2 above converted a text pill into a GLYPH on his
 * standing ruling that identical copy on every card is furniture — *"they should
 * all be icons with hoverover states."* It shipped as an icon whose only hover
 * state was a native `title`: OS chrome, after the platform's ~1s dwell, with no
 * visual change on the glyph. **The words were replaced by a picture and the
 * hover state that was supposed to pay for them never arrived.** So the mark
 * answered half his ruling and the unanswered half is what he hovered.
 *
 * `title` is REMOVED rather than kept alongside: both render, so the pair paints
 * the styled bubble and then the OS tooltip on top of it with the same sentence.
 * `aria-label` is untouched, so the no-hover/no-focus channel this component
 * argues for above is exactly as reachable as it was.
 *
 * ⚠ AND IT IS STILL NOT A TAB STOP. The shared `Tooltip` adds hover and focus
 * LISTENERS via floating-ui; it does not add `tabIndex`, so the "no second tab
 * stop per node" contract this file shares with `EstimateMarker` is unchanged,
 * and its spec still asserts it. (The other in-repo `Tooltip` —
 * `canvas/components/Tooltip.tsx` — forces `tabIndex ?? 0` on its child and
 * would have broken that contract silently. It is not interchangeable, and this
 * is one of the two reasons the node surface standardises on the other one; the
 * other is that this one PORTALS, so the bubble escapes React Flow's viewport
 * transform instead of being clipped by the card and scaled to ~7px at the
 * post-draft auto-fit zoom.)
 *
 * ⚠ THE TOOLTIP NO LONGER LEAKS THE WIRE LITERAL. It used to read
 * `"AI estimate — source: ai_inferred"`, putting a producer-internal enum into
 * user-visible text on every card. `ai_inferred` is not a sentence a user can
 * do anything with, and the debugging it served is better served by
 * `data-provenance-kind`, which is on the element and is what the specs bind to.
 *
 * ⛔ ABSENT OR UNRECOGNISED PROVENANCE RENDERS NOTHING, NEVER A GUESS.
 * `classifyNodeProvenance` returns null for any literal it does not recognise,
 * and this returns null with it. Fail-closed is the whole point: silence is a
 * state a reader can interpret, a wrong attribution is not.
 *
 * ⚠ NOTHING IS CLASSIFIED HERE. `classifyNodeProvenance` remains the ONE
 * authority on what a literal MEANS; `nodeProvenanceClaim` owns only which
 * vocabulary may say it; `VALUE_PROVENANCE_ICON` owns the glyph. This component
 * composes three registers and authors nothing.
 */
export interface NodeProvenanceMarkProps {
  /** The node's kind — decides which claim the card is entitled to make. */
  nodeType: NodeType
  /** The node's `data`, straight off the node. Carries `provenance`. */
  data: unknown
}

export function NodeProvenanceMark({ nodeType, data }: NodeProvenanceMarkProps) {
  const claim = nodeProvenanceClaim(nodeType, data)
  if (claim === 'none') return null

  const provenance = (data as Record<string, unknown> | null | undefined)?.provenance
  // ⚠ This type guard is defensive, not load-bearing: `classifyNodeProvenance`
  // compares with `===` against three string literals, so a number, an object
  // or undefined all fall through to its `return null`. It stays because it
  // makes the contract legible at the call site (`data.provenance` is unknown).
  const raw = typeof provenance === 'string' ? provenance : null
  const cls = classifyNodeProvenance(raw)
  if (!cls) return null

  const label = provenanceClaimLabel(claim, cls.kind)
  const Icon = VALUE_PROVENANCE_ICON[cls.kind]

  return (
    <Tooltip asChild content={label} delay={NODE_TOOLTIP_DELAY_MS}>
      <span
        data-testid="node-provenance-mark"
        data-node-tooltip="true"
        data-provenance-kind={cls.kind}
        data-provenance-claim={claim}
        // The claim itself, available with no hover and no focus. The tooltip
        // above is the MOUSE channel for the same sentence — one source, so the
        // two cannot drift into saying different things about one glyph.
        role="img"
        aria-label={label}
        className="inline-flex shrink-0 items-center text-text-light cursor-help"
      >
        {/* `aria-hidden` because the accessible name is on the wrapper — without
            it a screen reader would announce the mark twice. */}
        <Icon aria-hidden="true" className={PROVENANCE_ICON_SIZE_CLASSES} />
      </span>
    </Tooltip>
  )
}
