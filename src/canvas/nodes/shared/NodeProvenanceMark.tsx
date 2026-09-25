import { Fragment } from 'react'
import { classifyNodeProvenance, classifyValueProvenance } from '../../domain/valueProvenance'
import type { ValueProvenanceKind } from '../../domain/valueProvenance'
import { nodeProvenanceClaim, provenanceClaimLabel } from '../../domain/nodeProvenanceClaim'
import type { NodeProvenanceClaim } from '../../domain/nodeProvenanceClaim'
import { olumiAuthorshipIsAmbiguous } from '../../domain/olumiAuthorshipClaim'
import type { NodeType } from '../../domain/nodes'
import {
  VALUE_PROVENANCE_ICON,
  PROVENANCE_ICON_SIZE_CLASSES,
} from '../../domain/valueProvenanceIcon'
import Tooltip from '../../../components/Tooltip'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'
import { useCanvasStore } from '../../store'
import { resolveNodeTypeLiteral } from '../../domain/nodes'
import { factorValueSourceMark } from './valueSourceMark'

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
 * ⚠ AND IT IS STILL NOT A TAB STOP. [SUPERSEDED 24 Sep — see "A TAB STOP NOW"
 * below.] The shared `Tooltip` adds hover and focus
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
  /**
   * The board's default provenance kind, passed AT REST only. A card whose marks
   * all carry this kind renders none (spec §6: provenance EXCEPTIONS at rest).
   */
  hideKind?: ValueProvenanceKind | null
}

export function NodeProvenanceMark({ nodeType, data, hideKind = null }: NodeProvenanceMarkProps) {
  const marks = resolveProvenanceMarks(nodeType, data)
  if (marks.length === 0) return null
  // ⭐ MODEL-LEVEL DEFAULT + LOCAL EXCEPTIONS (locked spec §6; ED 11:52Z point 8:
  // "do not repeat noisy provenance text everywhere; model-level default + local
  // exceptions is preferred"). At rest the caller passes the board's default
  // kind, and a card whose marks all say ONLY that default renders none — the
  // same AI mark on every card conveys nothing. Any mark that differs (a user
  // value on an AI board, a disagreement pair) renders in full. Detailed and
  // the inspector always show every mark.
  if (hideKind !== null && marks.every(m => m.kind === hideKind)) return null
  return (
    <>
      {marks.map(m => (
        <Fragment key={`${m.claim}-${m.kind}`}>{renderMark(m.claim, m.kind)}</Fragment>
      ))}
    </>
  )
}

export interface ResolvedProvenanceMark {
  claim: Exclude<NodeProvenanceClaim, 'none'>
  kind: ValueProvenanceKind
}

/**
 * The marks a card is entitled to show, resolved WITHOUT rendering — extracted
 * verbatim from `NodeProvenanceMark` (23 Sep 2026) so the board-wide default
 * (`useProvenanceDefaultKind`) and the card read ONE answer.
 */
export function resolveProvenanceMarks(nodeType: NodeType, data: unknown): ResolvedProvenanceMark[] {
  const claim = nodeProvenanceClaim(nodeType, data)
  if (claim === 'none') return []

  const provenance = (data as Record<string, unknown> | null | undefined)?.provenance
  // ⚠ This type guard is defensive, not load-bearing: `classifyNodeProvenance`
  // compares with `===` against three string literals, so a number, an object
  // or undefined all fall through to its `return null`. It stays because it
  // makes the contract legible at the call site (`data.provenance` is unknown).
  const raw = typeof provenance === 'string' ? provenance : null
  const nodeAuthorship = classifyNodeProvenance(raw)

  /**
   * ⭐⭐⭐ WHEN THE CLAIM IS ABOUT A NUMBER, THE NUMBER'S OWN PROVENANCE ANSWERS IT.
   *
   * ## The defect, settled at a captured wire body (build `1690c1f`)
   *
   * Factor `6d9a37f3` "Pro Plan Monthly Price" carried
   * `provenance: "ai_inferred"` **and** `observed_state: { baseline 49,
   * source "brief_extraction", extractionType "explicit" }`, and the card
   * rendered **"AI estimate"** over the user's own £49.
   *
   * Both facts are true and they answer DIFFERENT QUESTIONS. CEE's
   * `projectNodeProvenance` decides `provenance` on
   * `provenance_class === "stated" && brief_binding === "verified"` — **who
   * authored the NODE.** "Pro Plan Monthly Price" is the model's label; the user
   * wrote "increase the Pro plan price from £49 to £59" and never coined that
   * name. So `ai_inferred` is CORRECT about the node and FALSE about the number
   * beside it — and this component was relabelling it as a VALUE claim purely
   * because the node happens to carry a number
   * (`nodeProvenanceClaim` → `'value'` → `VALUE_PROVENANCE_LABEL`).
   *
   * ⛔ ONE FIELD, TWO QUESTIONS, SPANNING TWO SERVICES — CEE writes the answer to
   * one and the UI reads it as the answer to the other, with the field name
   * identical at both ends (`adapters/cee/types.ts:700` says so outright). The
   * next person at either end will make the same read, which is why this is
   * written down rather than just fixed.
   *
   * ## Why this OVERRIDES rather than REPLACES
   *
   * `classifyValueProvenance` returns `null` for an absent or unrecognised
   * `source`. Reading it *instead of* node authorship would therefore blank the
   * badge on every node whose value source we cannot classify — and for those,
   * "AI estimate" is frequently TRUE. The identical regression stopped the
   * CEE-side attempt earlier: removing its default fixed this case and turned
   * 20 assertions' worth of genuinely honest disclosures into silence.
   *
   * ⛔ SILENCE IS THE SAFE ANSWER ONLY WHERE THE ALTERNATIVE WOULD BE A LIE.
   * Here the alternative may be the truth, so saying nothing would LOSE
   * information this component currently supplies correctly.
   *
   * So the value answer wins ONLY when it positively exists. Absent ⇒ today's
   * behaviour, byte for byte. This can only ever fix the case where the two
   * disagree; it cannot silence anything.
   */
  const valueProvenance =
    claim === 'value'
      ? classifyValueProvenance(
          ((data as { observedState?: { source?: unknown } } | null | undefined)
            ?.observedState?.source) as string | null | undefined,
        )
      : null

  /**
   * ⭐⭐⭐ TWO FACTS GET TWO MARKS — BUT ONLY WHEN THEY DISAGREE.
   *
   * ## What was lost, and it is the founder's own question
   * `const cls = valueProvenance ?? nodeAuthorship` let ONE mark arbitrate
   * between two different questions, so the losing fact vanished with no trace:
   *
   *     provenance: 'ai_inferred'  +  observed_state.source: 'brief_extraction'
   *       → rendered "From brief"
   *       → the user could not tell that OLUMI INVENTED THE NODE ITSELF
   *
   * Paul, 18 Sep: *"These are not from the user. These are the AI adding value,
   * so they need to be displayed in a different way."* The card was answering
   * *"where did this number come from?"* and silently dropping *"did Olumi
   * suggest this, or did I bring it?"* — and the second is the one he named.
   *
   * ## ⛔ WHY THE OVERRIDE STAYS FOR EVERY OTHER CASE
   * Nothing below weakens it. When the two AGREE, or when only one of them
   * exists, the output is BYTE-IDENTICAL to before — same single mark, same
   * testid, same label, same icon. Only the genuine disagreement adds a mark.
   *
   * That restraint is deliberate and was already paid for once: reading value
   * *instead of* authorship blanked the badge on every node whose value source
   * could not be classified and turned 20 honest disclosures into silence
   * (recorded above). A second mark on every card would be the same mistake
   * wearing the opposite sign — noise that teaches a reader to ignore the
   * corner, which is where the "Needs input" pill and the rank badge also live.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * ⭐ HOW OFTEN — MEASURED, BECAUSE "ONLY THE GENUINE DISAGREEMENT" WAS PROSE
   * ─────────────────────────────────────────────────────────────────────────
   * The paragraph above asserted restraint and supplied no frequency, and the
   * branch fires on `ai_inferred` + `brief_extraction` — the shape a CEE draft
   * plausibly produces for a factor the model named off a number in the brief.
   * If that were the common case, "the exception" would be most factor cards
   * and this argument would invert. So it is counted rather than claimed.
   *
   * SCOPE, STATED (trap 20): every tracked `*.json` in this repo at
   * `7dce79f3` — 192 files, 249 factor nodes, of which **198 make a `'value'`
   * claim**. Counted by replaying `SOURCE_CLASSES` / `classifyNodeProvenance` /
   * `USER_OWNED_KINDS` / `sourceQuoteRecorded` over the captured node bodies.
   *
   *   | outcome for a valued factor                  | count |
   *   |----------------------------------------------|-------|
   *   | ⭐ TWO MARKS (authorship and value disagree)  |   **1** |
   *   | agree, `ai`/`ai`                              |    97 |
   *   | agree, `brief`/`brief`                        |    12 |
   *   | both user-owned (`human`/`edited`) — exempted |     2 |
   *   | no classifiable `observedState.source`        |    53 |
   *   | no classifiable authorship literal            |    33 |
   *
   * The ONE is `6d9a37f3` "Pro Plan Monthly Price" — the node this branch was
   * written for. **1 of 198.** The restraint claim holds on everything
   * committed, and the dominant population by a wide margin is `ai`/`ai`, which
   * AGREES and has always rendered one mark.
   *
   * ⚠ AND THE LIMIT OF THAT NUMBER, WHICH MATTERS MORE THAN THE NUMBER. The
   * corpus is dominated by the five committed STARTER captures. The only
   * genuine live-wire capture in the repo
   * (`hydrate/__tests__/fixtures/pricing-provisional-poll.json`, captured
   * 2026-09-09 off UI `81dbddd0` / CEE `a03ead1`) holds FOUR factors, of which
   * exactly ONE carries a value at all — and that one is the two-mark case.
   * **n = 1 is not a frequency.** The honest statement is therefore narrow: the
   * "most factor cards" hypothesis is unsupported by anything committed, and
   * the rate on fresh CEE drafts is UNMEASURED. A live draft capture would
   * settle it; a starter corpus cannot.
   *
   * ⚠ ALSO WORTH KNOWING WHEN READING THE HEADER OF `nodeProvenanceClaim`: its
   * corpus table counts factors carrying a VALUE KEY. This branch needs a
   * classifiable `observedState.source`, which is strictly narrower — 145 of
   * the 198 have one, and only that single node disagrees.
   *
   * ⚠ NO NON-FACTOR KIND CAN REACH THIS BRANCH ON THE CAPTURED CORPUS. `risk`
   * and `constraint` also admit a `'value'` claim, but zero captured risks
   * carry `probability` and zero constraints appear at all — so the nine risks
   * that DO carry an `observed_state.source` claim `'structural'` and never
   * compute a value class.
   *
   * ## ⚠ ABSENCE IS NEVER A CLAIM
   * Both classifiers return `null` for absent or unrecognised input, so an
   * unstamped node renders NOTHING and acquires no attribution. Core measured
   * 182,015 nodes carrying no authorship field at all; a rule of "unstamped ⇒
   * the user's" would invent an attribution nobody made on every one of them.
   * The disagreement branch therefore requires BOTH to be positively present.
   *
   * ## Order
   * Authorship leads. *Who proposed this element* is the question a reader asks
   * first, and the one a number's basis cannot answer.
   */
  const disagree =
    nodeAuthorship !== null &&
    valueProvenance !== null &&
    nodeAuthorship.kind !== valueProvenance.kind &&
    // ⛔ EXCEPT WHERE BOTH ARE USER-OWNED, AND A TEST CAUGHT ME GETTING THIS WRONG.
    //
    // The first version compared `kind` alone, which made `provenance:
    // 'user_set'` (kind `human`) beside `source: 'user_override'` (kind
    // `edited`) look like a disagreement and put TWO marks on a card where both
    // facts say the same thing: a person did this. That is noise in a corner
    // that already holds the rank badge, the edited-since-run dot and the
    // "Needs input" pill — and noise there teaches a reader to ignore all of it.
    //
    // ⚠ `userOwned` alone is ALSO wrong, in the opposite direction, which is why
    // this is a conjunction rather than a swap: `from_brief` is
    // `userOwned: false` because the MODEL did the extraction, so an AI-named
    // node carrying a brief-derived number would collapse back to one mark —
    // and that is the exact case the founder named. The pair of conditions is
    // load-bearing; neither half is sufficient.
    !(nodeAuthorship.userOwned && valueProvenance.userOwned)

  /**
   * ⛔⛔⛔ MAY THE PRODUCT CLAIM THIS ELEMENT AS ITS OWN? A SECOND QUESTION, ASKED
   * SEPARATELY — AND WITHOUT IT THIS BRANCH RE-OPENED THE DEFECT IT SITS BESIDE.
   *
   * `nodeProvenanceClaim` applies `olumiAuthorshipIsAmbiguous` and its guard
   * reads `if (claim === 'structural' && …)`. That scope is correct and its
   * docblock states the premise it rests on: *"a valued factor is untouched
   * here"* — a node making a VALUE claim was never going to make a structural
   * one, so the gate had nothing to do there.
   *
   * ⚠ THE BRANCH ABOVE BREAKS THAT PREMISE. It makes a STRUCTURAL claim on a
   * node whose `claim` is `'value'`, so the authorship gate is bypassed BY
   * CONSTRUCTION — not by an oversight anywhere in the gate. A factor arriving
   * `ai_inferred` beside the user's own `source_quote`, with a number sourced
   * from the brief, rendered **"Olumi suggested this"** over the user's own
   * thinking: the exact harm `olumiAuthorshipClaim` was written to end, on the
   * surface every user meets first, re-opened one file away from the fix.
   *
   * ⭐ ASKED OF THE SHARED OWNER, NOT RE-IMPLEMENTED. A fourth copy of the
   * predicate is the hand-maintained mirror that produced three disagreeing
   * readers in the first place (CLAUDE.md trap 12) — this is the same call
   * `nodeProvenanceClaim` makes, so the two cannot drift.
   *
   * ⚠ AND IT IS `olumiAuthorshipIsAmbiguous`, NOT `!mayClaimOlumiAuthorship`.
   * Those are not negations — there are THREE states, and `mayClaim…` is FALSE
   * for `from_brief` too. Using it would silence "From your brief", a true and
   * wanted disclosure, which is the over-suppression the value branch below
   * exists to forbid.
   *
   * ⭐ THE VALUE MARK IS UNAFFECTED, DELIBERATELY. A quote about the ELEMENT
   * says nothing about a NUMBER, so suppressing "From brief" here would be the
   * one-field-two-questions conflation this component argues against, applied in
   * the opposite direction. Where authorship is unclaimable the card falls
   * through to the single value mark — byte-identical to its behaviour before
   * the two-mark branch existed.
   */
  const authorshipIsClaimable = !olumiAuthorshipIsAmbiguous(data)

  const marks: ResolvedProvenanceMark[] =
    disagree && authorshipIsClaimable
      ? [
          { claim: 'structural', kind: nodeAuthorship.kind },
          { claim: 'value', kind: valueProvenance.kind },
        ]
      : (() => {
          const cls = valueProvenance ?? nodeAuthorship
          return cls ? [{ claim, kind: cls.kind }] : []
        })()

  /**
   * ⛔ GAP-16 (DESIGN-GAP-AUDIT-20260924.md row 16; contract §03 "Show useful
   * exceptions, not the same provenance mark everywhere").
   *
   * A `claim: 'value'` mark says where a NUMBER came from — and every kind
   * that can EARN a `'value'` claim (`claimFromKindAndCarrier`: factor, risk;
   * constraint is never rendered) ALSO renders its own value-line source
   * mark right on the card body (`valueSourceMark.tsx`'s `ValueSourceMark`,
   * mounted by `FactorNode`/`RiskNode`), classified through the SAME
   * function (`classifyValueProvenance(observedState.source)`). So a
   * `'value'` header mark is not a second fact, it is the first fact painted
   * twice — once at the top of the card, once on the row that IS the number.
   *
   * `claim: 'structural'` is UNTOUCHED. It answers "who put this element on
   * the board", which nothing else on a factor/risk card states — including
   * the rare two-mark disagreement case above, where it is now the ONLY
   * mark that survives (previously the value half of that pair duplicated
   * the value line exactly as the common single-mark case did).
   *
   * Nothing here silences the FACT — `factorValueSourceMark` /
   * `ValueSourceMark` render unconditionally wherever a value exists, so the
   * number's provenance is still told, just once rather than twice. See
   * `BaseNode.gap16NoDuplicateHeaderProvenance.spec.tsx`.
   */
  //
  // ⛔ ONLY A TRUE DUPLICATE IS DROPPED (review 5822866079). The value line is
  // `factorValueSourceMark`, which is NOT the header's classifier: a stamped
  // `ai` source without `extractionType: 'inferred'`, or no source at all,
  // reads `unknown` there, while the header fell back to node authorship
  // ("AI estimate"). In those cases the header was the only mark with a kind,
  // and dropping it left "8%" with no provenance a sighted user could read
  // (53 of 198 valued factors in the corpus). Paul, 23 Sep point 1: a number
  // is never unmarked.
  const valueLine = factorValueSourceMark(data)
  const valueLineStatesTheSource = valueLine !== null && valueLine.kind !== 'unknown'
  return valueLineStatesTheSource ? marks.filter((m) => m.claim !== 'value') : marks
}

/**
 * One mark. Extracted verbatim from the single-mark return this component has
 * always had, so the agreeing case cannot drift from the disagreeing one — the
 * hand-maintained-mirror defect that two copies of this markup would create.
 *
 * `claim` is carried through to `data-provenance-claim` so a spec can bind to
 * WHICH QUESTION a mark answers by identity rather than by reading its words
 * (trap 19) — with two marks present, position is not identity.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔⛔ A FOURTH VALUE IN A THREE-MEMBER VOCABULARY — AND THE SIGNATURE IS WHY
 * ─────────────────────────────────────────────────────────────────────────────
 * This took `(label, kind, claimFor: string)`, i.e. the LABEL and the ATTRIBUTE
 * as two independent arguments, and the two-mark return passed
 * `provenanceClaimLabel('structural', …)` beside `claimFor: 'node'`. The words
 * came from one vocabulary and the attribute from another, in one call, and
 * `claimFor: string` accepted it silently.
 *
 * ⚠ THAT IS A DIFFERENT DEFECT FROM THE TS2345 ALREADY FIXED ON THIS BRANCH.
 * The earlier fix corrected the LABEL argument to `'structural'` and left the
 * attribute as `'node'` on the reasoning that the two arguments answer
 * different questions. They do not: `data-provenance-claim` is named for, and
 * read as, the claim — `NodeProvenanceClaim = 'value' | 'structural' | 'none'`
 * (`domain/nodeProvenanceClaim.ts`). `'node'` is not a member. The single-mark
 * return below has always emitted `'structural'`, and six existing assertions
 * plus the label builder all spell it that way, so the two-mark path emitted a
 * value that NOTHING ELSE IN THE ESTATE CAN SELECT — on exactly the cards this
 * feature was written for. A consumer asking
 * `[data-provenance-claim="structural"]` matched nothing.
 *
 * ⭐ THE MECHANISM IS THE SIGNATURE, NOT A CORRECTED STRING. There is now ONE
 * `claim` argument: it builds the label AND stamps the attribute, so the two
 * cannot be given different vocabularies, and it is typed
 * `Exclude<NodeProvenanceClaim, 'none'>`, so a fourth spelling is a TYPE ERROR
 * at the call site rather than an attribute nobody queries. Fixing the literal
 * alone would have left the next caller free to reintroduce it.
 */
/**
 * ⭐⭐ A TAB STOP NOW — contract v3.1 SUPERSEDES "NOT FOCUSABLE" (24 Sep 2026,
 * delta PILL-10). The contract's `.prov` mark is a focusable control and its
 * text is explicit: "Each mark has an accessible name and a hover/focus label";
 * Paul 23 Sep pt 12: "Icons need hover/focus labels and inspector access". The
 * shared `Tooltip` already listened for focus (`useFocus`) — but on a span with
 * no `tabIndex` focus could never arrive, so the keyboard half of the label was
 * wired to nothing. `tabIndex={0}` lets it arrive. Still NOT a button (there is
 * nothing to press), still `role="img"` with the claim as its name, and it only
 * renders where a mark does — the board's default kind is suppressed
 * (`useProvenanceDefaultKind`), so the stop lands on the exceptions, not every
 * card. Hover and focus take Info (the contract's `.prov:hover`), with the
 * canvas's one focus ring. No size change.
 */
function renderMark(claim: Exclude<NodeProvenanceClaim, 'none'>, kind: ValueProvenanceKind) {
  const label = provenanceClaimLabel(claim, kind)
  const Icon = VALUE_PROVENANCE_ICON[kind]
  return (
    <Tooltip asChild content={label} delay={NODE_TOOLTIP_DELAY_MS}>
      <span
        data-testid="node-provenance-mark"
        data-node-tooltip="true"
        data-provenance-kind={kind}
        data-provenance-claim={claim}
        // The claim itself, available with no hover and no focus. The tooltip
        // above is the MOUSE channel for the same sentence — one source, so the
        // two cannot drift into saying different things about one glyph.
        role="img"
        tabIndex={0}
        aria-label={label}
        className="inline-flex shrink-0 items-center rounded-sm text-text-light cursor-help hover:text-info focus-visible:text-info focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
      >
        {/* `aria-hidden` because the accessible name is on the wrapper — without
            it a screen reader would announce the mark twice. */}
        <Icon aria-hidden="true" className={PROVENANCE_ICON_SIZE_CLASSES} />
      </span>
    </Tooltip>
  )
}

/**
 * ⭐ THE BOARD'S DEFAULT PROVENANCE KIND — the single-mark kind most cards on
 * the canvas carry (a fresh AI draft: `ai`). `null` when there is no single
 * most-common kind (a tie, or no marks), so nothing is ever hidden on a guess.
 * Memoised per `nodes` array at module level: every card asks, one derivation.
 */
let defaultKindCache: { nodes: unknown; kind: ValueProvenanceKind | null } | null = null

export function provenanceDefaultKind(
  nodes: ReadonlyArray<{ type?: string; data?: unknown }> | undefined,
): ValueProvenanceKind | null {
  if (defaultKindCache && defaultKindCache.nodes === nodes) return defaultKindCache.kind
  const counts = new Map<ValueProvenanceKind, number>()
  for (const n of nodes ?? []) {
    const nodeType = resolveNodeTypeLiteral(n)
    if (!nodeType) continue
    const marks = resolveProvenanceMarks(nodeType, n.data)
    if (marks.length !== 1) continue
    counts.set(marks[0].kind, (counts.get(marks[0].kind) ?? 0) + 1)
  }
  let kind: ValueProvenanceKind | null = null
  let best = 0
  let tied = false
  for (const [k, c] of counts) {
    if (c > best) {
      kind = k
      best = c
      tied = false
    } else if (c === best) {
      tied = true
    }
  }
  // A default is a REPEATED mark: one marked card is not a pattern to suppress.
  const result = tied || best < 2 ? null : kind
  defaultKindCache = { nodes, kind: result }
  return result
}

export function useProvenanceDefaultKind(): ValueProvenanceKind | null {
  const nodes = useCanvasStore((s) => s.nodes) as unknown as ReadonlyArray<{ type?: string; data?: unknown }> | undefined
  return provenanceDefaultKind(nodes)
}
