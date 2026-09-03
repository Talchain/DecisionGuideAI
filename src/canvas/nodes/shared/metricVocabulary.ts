/**
 * ⭐ ONE NOUN PER IDEA, ON THE CANVAS.
 *
 * Paul, 31 Aug 2026, looking at a screenshot of the board: "Four different
 * number vocabularies on one screen, none explained." His ruling for the fix
 * was two-part, and this file is the first part: **one noun per idea, and a
 * legend where the model is — not in a panel.**
 *
 * WHAT WAS ACTUALLY ON SCREEN. Four quantities, eight words:
 *
 *   win probability      `Leads` (decision card) · `Ahead` (option card)
 *                        · `Chance of leading` (option inspector)
 *   achievement          `Chance` (goal card) · `Achievement:` (outcome card)
 *   bridge strength      `strength` (risk + outcome cards, lower case)
 *                        against the design system's sentence-case rule
 *   factor influence     `Influence` — the one that was already right
 *
 * The decision card's own comment CONCEDED the first one in writing: "this is
 * the same field, for the same option, that the winning OptionNode renders as
 * `Ahead 47%`". The synonym was known, documented at the call site, and
 * shipped anyway — because there was nowhere to put the shared word. That is
 * the gap this file closes.
 *
 * ⚠ WHY A REGISTER AND NOT A RENAME. There was no authority to rename. Every
 * one of those words was a bare literal at its own render site, which is the
 * hand-maintained mirror this estate keeps paying for (CLAUDE.md trap 12): a
 * word in N places drifts silently, and the drift always reads as green. The
 * fix is one exported object plus a source sweep
 * (`metricNounVocabulary.canvas.spec.ts`) that REDs on a re-typed literal, so
 * the ninth word cannot be added quietly.
 *
 * ⭐ `ahead` IS A REFERENCE, NOT A COPY, AND THAT IS LOAD-BEARING.
 * `COMPARATIVE_COPY.anchor` already owns this word: it is the authority the
 * OptionNode reads, and it exists because two call sites had previously done
 * their own casing surgery inline. Copying its VALUE here would create exactly
 * the second authority this file exists to abolish — the two would agree on
 * the day it was written and drift on some later one, with no red anywhere.
 * `metricVocabulary.spec.ts` pins the identity with `toBe`, so a copy REDs.
 *
 * The import direction is already established: canvas nodes read
 * `components/results/utils` today (`goalAnchorCopy`, `goalFitBasisCaveatCopy`),
 * so this adds no new layering.
 *
 * ⛔ WHAT THIS FILE IS NOT. It is not a claim that the four quantities MEAN the
 * same thing — they do not, and the legend below is careful to say what each
 * one counts. It is a claim that one quantity gets one word. A reader who sees
 * `Ahead` on an option and `Ahead` on the decision is entitled to compare them
 * by eye; a reader who saw `Ahead` and `Leads` had no way to know they could.
 */
import { COMPARATIVE_COPY } from '../../../components/results/utils/goalAnchorCopy'
import { INFLUENCE_EXPLANATION_GENERIC } from '../../../components/results/influenceScaleCopy'

/**
 * The four nouns the canvas may caption a number with.
 *
 * Sentence case throughout — `NodeMetricRow` records that as the
 * design-system-guarded rule (`ci:guard:ds` forbids a CSS text-transform
 * outright), and `FactorNode`'s influence row already shipped it. The two
 * `strength` captions were the outliers, not the rule.
 */
export const METRIC_NOUN = {
  /**
   * Win probability — how often an option came out in front.
   *
   * ⭐ BY REFERENCE. See the header: this must stay `COMPARATIVE_COPY.anchor`
   * itself, never its value re-typed.
   */
  ahead: COMPARATIVE_COPY.anchor,
  /** Achievement probability — how often the goal target was reached. */
  chance: 'Chance',
  /** How much a factor moves the result. Already correct; here so it is one set. */
  influence: 'Influence',
  /** Bridge weight — how strongly a risk or outcome connects to the goal. */
  strength: 'Strength',
} as const

/**
 * ⭐ WHAT A CAPTIONED QUANTITY SAYS WHEN NOBODY HAS SET IT.
 *
 * ⚠⚠ THE CANONICAL ROOT-CAUSE RECORD FOR THIS CHANGE LIVES HERE, AND THE FOUR
 * OTHER FILES THAT TOUCH IT POINT AT IT RATHER THAN RESTATING IT. Round 1 of
 * PR #1174 wrote the diagnosis out five times and got it wrong in all five.
 *
 * THE DEFECT THIS CLOSES, witnessed on a real canvas (3 Sep 2026): five cards
 * read `Strength 50% est.` and each drew a progress bar EXACTLY HALF FULL. A
 * proportional bar is measurement grammar — the same grammar an option's
 * computed win share uses two cards along. The product was drawing an estimate
 * nobody had confirmed as though it had been assessed.
 *
 * ⛔ AND THE SENTENCE THAT USED TO SIT HERE — *"`0.5` is the no-information
 * default… nothing had assessed it"* — IS REFUTED, BY MEASUREMENT, 3 Sep 2026.
 * It is withdrawn wherever it appears.
 *
 *   1. A BARE `DEFAULT_EDGE_DATA.weight` CANNOT REACH THIS ROW AT ALL. The
 *      provenance gate is `resolveEdgeSignedStrengthDisplay`, which refuses an
 *      unstamped weight (`{show:false, reason:'not_set'}`), and
 *      `DEFAULT_EDGE_DATA` deliberately carries no stamp. An unset default
 *      renders NO ROW — never `Strength 50%`. For that string to appear, a wire
 *      value must have arrived.
 *
 *   2. ⚠ AND THE STAMP IS THE UI'S OWN INFERENCE, NOT SOMETHING CEE WROTE. It
 *      is tempting to describe these as "producer-stamped `cee`"; that is also
 *      wrong. `weight_source` is written NOWHERE in CEE (0 occurrences, against
 *      a contrast control of `strength_mean` in 273 files). The `'cee'` stamp
 *      is applied HERE, by `applyDraftResult.mapDraftEdgeToCanvas`, keyed
 *      purely on `wireSuppliedStrength` — the mere PRESENCE of a wire figure.
 *      So the numbers are the drafting model's own output, passed through and
 *      labelled by our ingestion. "A producer supplied it" is true; "a producer
 *      declared its provenance" is not.
 *
 *   3. SO THE HONEST CLAIM IS THE NARROWER ONE: something DID assess these —
 *      the drafting model did — and NO HUMAN HAS SETTLED IT. That is what the
 *      row's own disclosure says, and it is the only claim the data licenses.
 *      It is also why the predicate is `strengthIsHumanSettled` and not a
 *      value-provenance read: see `canvas/domain/edgeStrengthSettlement.ts`.
 *
 * ⚠⚠ THE WITNESSED FLAT CANVAS IS THE MODAL FAILURE, NOT A CONSTANT — AND THIS
 * IS THE CLAIM ROUND 1 MOST OVERSTATED. The five cards that prompted this change
 * were the five outcome/risk nodes, each with exactly one outgoing edge — to the
 * goal — all at `strength_mean` 0.5: everything UPSTREAM of the goal was
 * differentiated and everything CONNECTING to it was flat. Measured across 12
 * independent draws (orchestrator's bundle analysis,
 * `CEE-GOAL-EDGE-STRENGTH-2026-09-03.md`), goal edges range −0.6 to +0.9 and
 * VARY WITHIN most draws; **4 of 12 flatten completely.** So the correct
 * statement is *"on drafts where the goal layer flattens — 4 of 12 draws
 * measured"*. It is NOT "nearly every strength row", and NOT "the five most
 * decisive relationships" — both were written before anything counted.
 *
 *   ⭐ The committed starters CORROBORATE that flatness is draw-dependent rather
 *   than structural: measured over all five (`strength.mean` on all 24), the
 *   values are a genuine spread — 0.18, 0.20, 0.22×2, 0.30×2, 0.35×3, 0.40×4,
 *   0.45×3, 0.50×2, 0.55×5, 0.65 — so only **2 of 24** are 0.5 at all.
 *
 * ⚠⚠ THE BLAST RADIUS OF THE RENDERING CHANGE, MEASURED AND NOT SOFTENED — AND
 * IT IS A DIFFERENT QUESTION FROM THE FLATTENING ABOVE. Withholding is decided
 * by SETTLEMENT, not by the value, so it does not care whether a draw flattened:
 * of the 24 risk/outcome→goal bridge edges across the five committed starters,
 * **24 of 24 — 100% — lose their bar and their on-face figure**, because not one
 * carries `validation`, `userReviewedStrength` or `weightSource: 'user'` (163
 * starter edges scanned; contrast control: the same scan reports the keys that
 * ARE present). The figure is DEMOTED to the row's `title` and screen-reader
 * phrase, not deleted.
 *
 * ⭐ AND THAT 100% IS THE POINT, NOT AN EMBARRASSMENT TO BE SOFTENED. A user
 * looking at the five edges that determine the answer, each declaring itself
 * unset, above a computed 62%/38%, is the product's real epistemic position
 * BECOMING VISIBLE. It was always true; it was previously hidden behind a
 * half-full bar. Whether to keep that visibility is a PRODUCT call at 100%
 * reach — Paul's to take — and it is stated in those terms rather than left for
 * a later session to discover.
 *
 * ⭐⭐ AND THE STRONGEST ARGUMENT FOR IT IS A PRECEDENT THIS RECORD DID NOT CITE:
 * THE ESTATE ALREADY TOOK THIS EXACT DECISION ONE CHANNEL ALONG.
 * `StyledEdge.tsx:1082`, ROADMAP 2.954 — in the causal lens an unset strength
 * draws at FLOOR WIDTH *"so thickness never reports the `weight` default as a
 * measurement."* Withholding a bar for an unsettled strength is the same
 * refusal, on the card instead of the line. That is a much better justification
 * than the flattening statistics above, which describe how OFTEN the old
 * behaviour looked wrong rather than why it WAS wrong.
 *
 * ⚠ THE COARSENESS OF THE SURVIVING CHANNEL IS A KNOWN, ROWED GAP — NOT FIXED
 * HERE. Thickness still carries the magnitude and `vectorEffect:
 * 'non-scaling-stroke'` makes it a SCREEN width, so it is one of the few
 * channels that does not degrade at low zoom (where this metric row sits at
 * ~8.8px). But `weightMagnitudeToStrokeWidth` has three bands (≥0.7→3, ≥0.4→2,
 * else 1.5) and `UNSET_EDGE_STROKE_WIDTH` is 1.5 — IDENTICAL to the weakest
 * band. Across the 24 starter magnitudes (0.18–0.65) that is exactly TWO
 * distinguishable widths, one of them ambiguous with "unset".
 *
 * ⛔ DELIBERATELY NOT BUILT. Whether "unset" should be visually distinct from
 * "weakest" is a live product question with Paul, and changing
 * `UNSET_EDGE_STROKE_WIDTH` or the band scheme would pre-empt it from a lane
 * scoped to a card row. Rowed, not built. (An in-repo middle exists if he wants
 * one: the canvas already uses DASH to mean uncertainty, so a visibly unsettled
 * bar — hatched or ghosted, clearly outside measurement grammar — would keep 24
 * edges comparable at a glance while still refusing the claim. Unexamined here.)
 *
 * ⛔ WHY A SHARED CONSTANT AND NOT A LITERAL AT EACH SITE. Three surfaces say
 * this — the risk card, the outcome card, and the reduced line both of them
 * declare below the legibility floor. That is exactly the hand-maintained
 * mirror this file exists to abolish (CLAUDE.md trap 12): a word in three
 * places drifts, and the drift always reads as green.
 *
 * ⚠ `inline` IS DERIVED FROM `standalone`, NEVER RE-TYPED. The reduced line
 * reads `Strength not set yet` — one leaf, so the state follows the noun in
 * running text and must lower-case its first letter. Deriving it means a
 * rewording of the card cannot leave the zoomed-out line saying something else.
 *
 * ⚠ AND WHY "yet". "Not set" is a deficit; "not set yet" is an invitation. The
 * strength of a connection is the user's judgement to make — the row's own
 * disclosure names the way to make it — and a card that reads as an apology for
 * missing data teaches a reader to ignore it.
 */
const UNSET_STANDALONE = 'Not set yet'

export const METRIC_UNSET = {
  /** The card row's own text, standing alone in the value column. */
  standalone: UNSET_STANDALONE,
  /** The same state following a noun in the reduced line: "Strength not set yet". */
  inline: `${UNSET_STANDALONE.charAt(0).toLowerCase()}${UNSET_STANDALONE.slice(1)}`,
} as const

/**
 * ⭐ THE LEGEND — the second half of Paul's ruling: "a legend where the model
 * is, not in a panel."
 *
 * `CanvasLegendPopover` is the toolbar's "How to read this" disclosure. It
 * already explains types, connections, thickness, direction, colour and the
 * provenance glyphs — every visual channel the canvas uses, and NONE of the
 * numbers. A reader could learn what a dashed line meant and still have no way
 * to find out what `Ahead 47%` counted.
 *
 * ⚠ COPY CONSTRAINTS, DERIVED NOT GUESSED — three of them bite here:
 *
 * 1. NO "node" / "edge" / "graph". The popover's own spec lowercases the whole
 *    rendered container and matches `\bnode\b`, `\bedge\b`, `\bgraph\b`. This
 *    is why the strength row says "connects to the goal" rather than naming
 *    the edge, and why the ordinal row says "on the board".
 *
 * 2. NO POSSESSIVE VOICE around a goal figure. `basisWithholdsPossessive`
 *    (`selectGoalProbability.ts`) is the one mapping from a basis to "must a
 *    rendered number withhold the possessive" — "your goal" is a claim about
 *    whose target was met, and it is not always earned. A LEGEND cannot read a
 *    basis: it is static copy shown for every run at once. So the `chance` row
 *    is written basis-NEUTRAL — "the goal target", never "your goal" — which
 *    is true under every basis and therefore needs no gate. A legend that
 *    needed a gate would be a legend that lies on some runs.
 *
 * 3. `influence` is DERIVED FROM THE PRODUCER, not re-worded.
 *    `INFLUENCE_EXPLANATION_GENERIC` already spells this sentence for the
 *    results surfaces; writing a second one here would be the same drift the
 *    nouns above just had fixed.
 *
 * ⚠⚠ THE ORDINAL ROW — AND THE QUALIFIER I DROPPED FROM IT (review of #1160).
 *
 * The first draft of this row read *"its place on the board, left to right"*.
 * That is **false for any board a user has touched**, and it was false because
 * this file's own note said "POSITIONAL IDENTITY **at mint**" and the
 * user-facing gloss silently dropped the qualifier.
 *
 * `assignStableOptionNumbers` (`canvas/store/stableOptionNumbers.ts`) spreads
 * `previous` VERBATIM and mints `max + 1` only for ids it has not seen;
 * `registerOptionNumbering` (`canvas/store.ts`) then skips the write entirely
 * when nothing is new. So a number is assigned once and **never moves again**.
 * Measured against those functions, badges read left-to-right:
 *
 *     at mint                      [1, 2, 3]   ✅ the only case the old row described
 *     after dragging one card      [2, 3, 1]   ❌
 *     after adding one at the left [4, 1, 2, 3] ❌
 *     after deleting the middle    [1, 3]      ❌ (the old row implied contiguity)
 *
 * Dragging a card is ordinary use, and this is the row a reader opens
 * PRECISELY WHEN THE NUMBERS ALREADY LOOK WRONG TO THEM. A legend that
 * asserts a falsehood is worse than no legend: it converts a reader's correct
 * suspicion into a wrong explanation.
 *
 * ⛔ THE FIX IS THE COPY, NOT THE BEHAVIOUR. Making the sentence true by
 * renumbering on every move is a separate and much larger decision — it would
 * make `Option 2` mean a different option from one minute to the next, which
 * is the property `HeroOptionRow` and the stable-numbering PR deliberately
 * bought. Out of scope here; the row now describes the product as it behaves.
 *
 * `ORDINAL_ROW_MUST_STATE_MINT` pins the qualifier so the next "friendlier"
 * rewrite cannot quietly delete it.
 *
 * ⚠⚠ TWO RESIDUALS IN THIS LIST, ROWED RATHER THAN BUILT (review of #1160,
 * round 2, O1 and O2). Both are copy that is true of what it names and
 * narrower than what a reader will infer. Neither is fixed here — the first
 * because the fix is a behaviour change, the second because the fix is a
 * basis-aware legend, and a legend cannot read a basis (see constraint 2
 * above). They are written down so the next session inherits the limit rather
 * than rediscovering it.
 *
 *   · O1 — "it stays with a card when you move it" HOLDS WITHIN A SESSION
 *     ONLY. `optionNumbering` has no `persist()` and is reset to `{}` by
 *     `importCanvas`, the new-decision path, `loadScenario` and
 *     `hydrateGraphSlice`, then re-minted from the THEN-CURRENT reading order.
 *     So after a drag AND A RELOAD the number does move. The sentence is true
 *     of the action it names — dragging — and that is the connection round 1
 *     required it to make; narrowing it to survive a reload would drop the
 *     drag clause and reopen that finding. The honest fix is persistence, in
 *     the lane that owns `optionNumbering`, not a vaguer sentence here.
 *
 *   · O2 — the `chance` gloss is basis-neutral about the POSSESSIVE but not
 *     about the QUANTITY. `achievementProbability` is whatever
 *     `selectGoalProbability` chose, and under `joint_goal_constrained` the
 *     figure is P(ALL constraints jointly satisfied) while the gloss says
 *     "reached the goal target". Same class of error the possessive reasoning
 *     avoided, one level down — and it needs the same treatment the possessive
 *     got, which is a basis-aware surface rather than a legend row.
 *
 * ⚠ NOT EXHAUSTIVE, AND SAYING SO. `#1`/`#2` sensitivity ranks and `est.` are
 * here because they are numerals-with-a-meaning that a reader meets on the
 * card; `Stability` is not, because it renders with its noun spelled out in
 * full beside it and needs no key. If a fifth captioned quantity is added,
 * this list is where it goes.
 */
export interface MetricLegendRow {
  /** The word (or numeral) as the card renders it. */
  noun: string
  /** One line: what the number counts. */
  gloss: string
}

export const METRIC_LEGEND_ROWS: readonly MetricLegendRow[] = [
  {
    noun: METRIC_NOUN.ahead,
    gloss: 'how often an option came out ahead of the others across the simulated runs',
  },
  {
    noun: METRIC_NOUN.chance,
    gloss: 'how often the leading option reached the goal target across the simulated runs',
  },
  {
    noun: METRIC_NOUN.influence,
    // Derived from the results-surface authority rather than re-worded. That
    // constant is itself `'Influence: how much this factor affects the
    // outcome'`, so the noun is stripped back off to keep this list's shape
    // uniform — the row renders "<noun>: <gloss>" like every other.
    gloss: INFLUENCE_EXPLANATION_GENERIC.replace(/^Influence:\s*/, ''),
  },
  {
    noun: METRIC_NOUN.strength,
    // ⛔ THE CLAUSE THAT USED TO END THIS ROW — "; the same measure as line
    // thickness" — IS NOW FALSE, AND IT WAS THIS CHANGE THAT FALSIFIED IT.
    //
    // The two channels ask DIFFERENT QUESTIONS (CLAUDE.md trap 21, and the
    // separation is already written down in `domain/edgeStrengthSettlement.ts`):
    //
    //   this row      HAS A HUMAN SETTLED IT?   `strengthIsHumanSettled`
    //   line width    WHOSE NUMBER IS THIS?     `edgeValueSource(data,'weight')`
    //                                           via `resolveEdgeSignedStrengthDisplay`
    //
    // Before this change both surfaces reported the producer's figure, so the
    // identity claim held. This change made the ROW refuse an unsettled
    // strength while thickness — untouched, and deliberately so — keeps drawing
    // the producer's magnitude (`StyledEdge` gates width on `.show`, which is
    // provenance, not settlement). On a drafted board that is the SAME
    // connection reading "Not set yet" on the card beside a line drawn at its
    // magnitude. A key asserting the two are one measure turns that into a
    // contradiction the reader cannot resolve.
    //
    // The identity claim is DROPPED rather than repaired, and the divergence is
    // disclosed once, on the `METRIC_UNSET.standalone` row below — which is the
    // row a reader is looking at when they meet the divergence.
    gloss: 'how strongly a risk or outcome connects to the goal',
  },
  {
    noun: '#1, #2, #3',
    gloss: 'the factors the result is most sensitive to',
  },
  {
    noun: '1, 2, 3 on an option',
    // ⚠ THE QUALIFIER IS LOAD-BEARING — see ORDINAL_ROW_MUST_STATE_MINT below.
    gloss: 'the order the options were first laid out in. Not a ranking, and it stays with a card when you move it.',
  },
  {
    noun: METRIC_UNSET.standalone,
    // ⚠ NO "node" / "edge" / "graph" — the popover's own spec bans all three,
    // which is why this names "the line" and "this strength" rather than the
    // thing they belong to.
    //
    // ⭐ THE MIDDLE SENTENCE IS THE ONE THAT STOPS THIS KEY CONTRADICTING THE
    // CANVAS, and it is here rather than on the `Strength` row because this is
    // the row on screen at the moment the reader meets the divergence.
    //
    // A drafted board arrives with a producer's figure on every bridge and a
    // human's verdict on none. This row therefore says "Not set yet" while the
    // line beside it is drawn at that figure's magnitude in its polarity
    // colour. Both are correct — width answers "whose number is this?" and this
    // row answers "has anyone settled it?" — but a reader given only the first
    // half concludes one of the two surfaces is broken.
    //
    // "may still", not "does": width falls back to `UNSET_EDGE_STROKE_WIDTH` in
    // grey when NOTHING supplied a figure (`resolveEdgeSignedStrengthDisplay` →
    // `.show === false`), which is the separate state the thickness key's own
    // "No strength suggested" row describes.
    //
    // ⚠ THE DEFINITION IS NOT RESTATED HERE, AND THAT IS THE BUDGET TALKING.
    // `MAX_GLOSS_LENGTH` is 110 and a first draft carrying both the definition
    // and this disclosure measured 135 — the guard caught it, which is what it
    // is for. The definition lives one row up on `Strength`, in the same
    // popover, so dropping it here loses nothing a reader cannot see.
    gloss: 'nobody has set this strength. The line may still show a suggestion. Open the details to set it.',
  },
  {
    noun: 'est.',
    gloss: 'a number filled in for you, not yet confirmed. Open the details to set it.',
  },
] as const

/**
 * The nouns this change RETIRED. Exported so the guard spec can assert their
 * absence by reference rather than re-typing them, and so a reader of this
 * file can see what the board used to say.
 *
 * ⚠⚠ TWO LIVE USES OF "Leads" SURVIVE ON PURPOSE, AND BOTH ARE VERBS.
 * Disclosed here because the review found the second one and the residual
 * section had named only `lodMetricLine`:
 *
 *   · `DecisionNode` — the sentence "{X} leads in N% of scenarios", locked by
 *     the eight-surface owned-leader-claim corpus.
 *   · `OptionNode:1601` — "Leads via {factor}, the #1 driver", beneath the
 *     `Ahead 47%` anchor on the recommended option.
 *
 * ⭐ THE DISTINCTION IS PART OF SPEECH, NOT TASTE. This register governs the
 * NOUN that CAPTIONS A NUMBER — the word in the column beside a bar, where a
 * reader must be able to tell that two cards show the same quantity. Neither
 * survivor captions a number: both are verbs inside sentences, and "leads" is
 * ordinary English for what the option is doing. Renaming a verb to match a
 * column heading would make the prose worse to make a table look tidier.
 *
 * ⚠ THE COST, STATED: a reader sees "Ahead 47%" and "Leads via …" on one card.
 * That is a real if minor friction, and it is the strongest argument against
 * this decision. It is left standing because the alternative touches a locked
 * corpus for a copy preference — a bigger and differently-reviewed change.
 * `RETIRED_METRIC_NOUNS` therefore retires "Leads" AS A CAPTION only.
 *
 * ⭐ `strength` (LOWER CASE) IS IN THIS LIST, AND IT IS RETIRED BY CASE RATHER
 * THAN BY WORD. `Strength` is live; the lower-case caption that shipped on the
 * risk and outcome cards is not. It is listed here — rather than left as a
 * hand-written regex in the guard spec — because the guard now DERIVES its ban
 * list from this array, and a ban list maintained in two places is the
 * hand-maintained mirror this whole file exists to abolish (CLAUDE.md trap 12).
 *
 * ⚠ THE CASE DISTINCTION IS LOAD-BEARING AND THE GUARD RELIES ON IT. The sweep
 * is case-SENSITIVE on purpose: `DecisionNode:718` renders the sentence
 * "{X} leads in N% of scenarios" and `EdgePills` renders "Link strength", and
 * both are ordinary English that must survive.
 *
 * ⚠ `Chance of leading` is on the option INSPECTOR, not a card. It is retired
 * for the same reason as the rest — it was a third word for the first
 * quantity — but note it was the most *explanatory* of the three, and the
 * inspector has room the card does not. What replaces it is the shared noun
 * plus the legend; if that reads as a loss on the inspector specifically, the
 * fix is a gloss there, not the synonym back.
 */
export const RETIRED_METRIC_NOUNS = ['Leads', 'Achievement', 'Chance of leading', 'strength'] as const

/**
 * The qualifier the ordinal row MUST carry, pinned so a rewrite cannot drop it.
 *
 * This exists because dropping it is exactly what happened once: the register's
 * own comment said "at mint" and the user-facing sentence did not. A phrase in
 * a comment is not a guard. See the ⚠⚠ block above METRIC_LEGEND_ROWS.
 */
export const ORDINAL_ROW_MUST_STATE_MINT = /first laid out/

/**
 * ⭐ THE POPOVER IS WIDER FOR THESE ROWS, AND NOTHING IN jsdom CAN CHECK IT.
 *
 * `CanvasLegendPopover` went `w-56` → `w-72` (224px → 288px) to fit prose rows
 * beside the icon rows. **This is the one claim in this change with no
 * automated witness**: the popover is `absolute left-full bottom-0`, and jsdom
 * proves nothing about layout (CLAUDE.md trap 3). No test pinned the old width
 * either, so nothing REDded when it moved.
 *
 * The gloss-length cap below is therefore a PROXY, not a proof — it bounds the
 * text so a row stays a line or two at the new width. It is stated in the
 * width it now renders at, because the first version of this constant's
 * comment still said "224px popover" after the popover had stopped being 224px
 * — a stale mirror inside the change that exists to abolish stale mirrors.
 */
export const LEGEND_POPOVER_WIDTH_PX = 288
export const MAX_GLOSS_LENGTH = 110
