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
import { INFLUENCE_EXPLANATION_RELATIVE } from '../../../components/results/influenceScaleCopy'

/**
 * The four nouns the canvas may caption a number with.
 *
 * Sentence case throughout — `NodeMetricRow` records that as the
 * design-system-guarded rule (`ci:guard:ds` forbids a CSS text-transform
 * outright), and `FactorNode`'s influence row already shipped it. The two
 * `strength` captions were the outliers, not the rule.
 */
/**
 * The canvas's name for the comparative result family — never `Support`
 * (ED #63 5799353114, decision 2: "Rename Support → Current model wherever that
 * result family remains visible"). Declared ABOVE its readers: the legend rows
 * below are evaluated at module load, so a later `const` would be in its TDZ.
 */
export const CURRENT_MODEL_NOUN = 'Current model'

export const METRIC_NOUN = {
  /**
   * The comparative quantity — how much of the simulated evidence supports an
   * option.
   *
   * ⭐ RENAMED FROM `ahead` ON 7 Sep 2026, KEY AND VALUE TOGETHER. Paul:
   * *"There's never a winner… Terminology like 'winner' is wrong."* Leaving
   * the KEY as `ahead` while the value read `Support` would have been the
   * estate's signature defect — one name answering a question it no longer
   * asks — so the next lane would inherit the race word as canonical.
   *
   * ⭐ BY REFERENCE. See the header: this must stay `COMPARATIVE_COPY.anchor`
   * itself, never its value re-typed.
   */
  support: COMPARATIVE_COPY.anchor,
  /** Achievement probability — how often the goal target was reached. */
  chance: 'Chance',
  /** How much a factor moves the result. Already correct; here so it is one set. */
  influence: 'Influence',
  /**
   * Bridge weight — how strongly a risk or outcome connects to the goal.
   *
   * ⭐ 'Link strength', NOT 'Strength' (locked Canvas design, 23 Sep 2026; ED
   * 11:52Z point 5: "if strength is shown on-node, call it **link strength**").
   * The noun names the LINK, so it can never be read as the node's own
   * likelihood or value. One value, so `EdgePills`, the edge hover and the
   * legend's row heading move together. (The outcome/risk card row that also
   * read it is gone: contract v3.1, gap U1.)
   */
  strength: 'Link strength',
} as const

/**
 * ⭐ THE LABEL A RUN-DERIVED FIGURE OR RANK CARRIES ONCE THE MODEL HAS CHANGED
 * SINCE THAT RUN.
 *
 * Paul's Ruling 3 (ROADMAP 2.651, quoted at
 * `components/results/analysisState/analysisStateContract.ts`): "out-of-date
 * results are labelled, not withheld … No dimming, no aria-disabled lockout."
 * So a stale `Influence 62%` or `Key driver 1` stays on the card and SAYS which
 * run it belongs to, rather than asserting it about the model now on screen.
 *
 * ⚠ THE STRING IS THE OPTION CARD'S, NOT A NEW ONE. `OptionNode`'s leading pill
 * already renders `Last run · Most supported` from a literal; this is that
 * literal, and `staleRun.labelsLastRun.spec.tsx` pins the pill against this
 * constant so the two cannot drift into two wordings for one state.
 *
 * ⚠ THE LICENCE IS `useModelChangedSinceRun()` (`canvas/hooks`) — the composed
 * verdict's `'changed'`, never `!useAnalysisResultsAreCurrent()`, whose `false`
 * also covers never-run and cannot-confirm (ED 02:31Z, Q2: `changed` only).
 *
 * ⭐ LOCKED DESIGN (23 Sep 2026): the factor card's `FactorDriverLine`, its
 * turning-point track and its reduced line carry this prefix on `changed`
 * (visual contract v3: "retain valid historical figures with Last run · when a
 * model change is known"); never-run and cannot-confirm withhold them.
 */
export const LAST_RUN_PREFIX = 'Last run · '

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
 * ✅ THE COARSENESS OF THE SURVIVING CHANNEL WAS A KNOWN, ROWED GAP AND IS NOW
 * CLOSED (18 Sep 2026). Thickness carries the magnitude and `vectorEffect:
 * 'non-scaling-stroke'` makes it a SCREEN width, so it is one of the few
 * channels that does not degrade at low zoom (where this metric row sits at
 * ~8.8px). This note used to continue: *"`weightMagnitudeToStrokeWidth` still
 * has three bands (≥0.7→3, ≥0.4→2, else 1.5), so across the 24 starter
 * magnitudes (0.18–0.65) there are still only TWO distinguishable measured
 * widths."* Two things have happened since. The widths moved to 2/3/4 on
 * 14 Sep (so that sentence's numbers were already stale), and the ladder gained
 * a FOURTH rung cut at `0.20` — the vocabulary's own *Slight | Moderate*
 * boundary — so the same 0.18–0.65 span now draws THREE distinguishable widths.
 * The cuts are no longer restated in that function at all: they come from
 * `CANVAS_STRENGTH_BANDS` (`domain/vocabulary.ts`), which is what makes the picture
 * and the words one answer rather than two.
 *
 * ✅ THE OTHER HALF IS BUILT (8 Sep 2026). This note used to continue: *"and
 * `UNSET_EDGE_STROKE_WIDTH` is 1.5 — IDENTICAL to the weakest band … one of
 * them ambiguous with 'unset'. ⛔ DELIBERATELY NOT BUILT. Whether 'unset'
 * should be visually distinct from 'weakest' is a live product question with
 * Paul."* Paul cleared it; `UNSET_EDGE_STROKE_WIDTH` is now strictly below
 * every measured band, so the "unset" ambiguity is gone and width reads as a
 * total order — unset < slight < moderate < strong < very strong.
 *
 * ⚠ THE PARENTHETICAL THAT USED TO SIT HERE SUGGESTED DASH, AND THE BUILD LANE
 * MEASURED IT AND REFUSED. *"The canvas already uses DASH to mean uncertainty"*
 * is precisely the problem: `EDGE_DASH_RULES` already carried `contested`,
 * `existence_certainty` and `visual_props` (since Paul 23 Sep contract feedback
 * point 4 the rules are structural → existence_unset → existence_certainty:
 * dash means existence certainty only), and `resolveEdgeDash` returns the
 * FIRST match — so a fourth rule would be invisible on exactly the edges most
 * in question. Recorded so the dead suggestion is not re-proposed.
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
 * ⭐⭐ A PART OF THE MODEL THAT DOES NOT EXIST IS NOT A QUANTITY NOBODY SUPPLIED.
 *
 * `METRIC_UNSET` above is the canvas's word for **not estimated** — the thing
 * is in the model and no one has said how big it is. This constant is the word
 * for the other absence: **not modelled** — the thing is not in the model at
 * all, so there is no quantity to withhold.
 *
 * ⛔ WHY IT HAD TO BE SEPARATED. `BaseNode`'s `isIncomplete` admits four node
 * types and rendered ONE pill for all four — `needs-input-pill`, label
 * "Needs input", title "Missing required input". Three of those arms are
 * quantitative (a factor with no value, a goal with no target, an option with
 * no interventions). The fourth is not: a decision with no options linked is
 * missing OPTION NODES, and `BaseNode.needsJudgementBadge.spec.tsx` already
 * says so in writing — *"a decision node's incompleteness is the ONLY one of
 * the four that is a property of the GRAPH rather than of the node's own
 * data"*. The codebase had already named the distinction and still drew both
 * absences the same way.
 *
 * The cost is the next step, which is the whole point of drawing absences
 * apart. "Missing required input" tells a reader to supply a value to this
 * card. On an optionless decision there is no value to supply: the repair is
 * to CREATE the alternatives being compared. A reader who cannot tell "nobody
 * estimated this" from "this was never modelled" takes the wrong action, or
 * none.
 *
 * ⚠ ONE STRING, TWO SURFACES, AND THAT IS THE POINT. The decision card's own
 * resting line already said the true thing — `DECISION_RESTING_COPY.noOptionsLine`
 * — while the pill in its corner said the pooled thing. Both now READ THIS
 * CONSTANT rather than spelling their own, so the card cannot go back to
 * disagreeing with itself (CLAUDE.md trap 12: a word in two places drifts, and
 * the drift always reads as green). The value is byte-identical to the line
 * that already shipped, so nothing on the resting line changes.
 *
 * ⚠ NO NEW HUE AND NO NEW GEOMETRY. The pill keeps the amber needs-judgement
 * treatment already ruled for this estate: an unbuilt comparison wants the
 * user's attention for the same reason an unset value does. Only the WORDS and
 * the testid change, so the corner stack's pinned child count is untouched.
 */
export const STRUCTURAL_UNSET = {
  /**
   * THE CAUSE, for the card body — what is absent, and the line the `Add
   * options` CTA sits under. `DECISION_RESTING_COPY.noOptionsLine` reads this.
   */
  noOptions: 'No options linked yet',
  /**
   * ⭐ THE CONSEQUENCE, for the corner pill — AND THE SECOND FORM EXISTS
   * BECAUSE THE FIRST ONE, REUSED VERBATIM, SHIPPED A DEFECT THAT THE EXISTING
   * SUITE CAUGHT.
   *
   * The first cut of this change gave the pill `noOptions` itself, on the
   * anti-drift reasoning that one fact deserves one string.
   * `DecisionNode.readinessSummary.spec.tsx:454` went RED on
   * `getByText(noOptionsLine)` finding TWO elements — because the pill and the
   * resting line both render on the same card at the same moment, so the card
   * said one sentence twice. Height and width are the scarcest resources on
   * this canvas and `FactorNode` already rules on exactly this: saying it
   * twice costs a line and adds nothing.
   *
   * ⚠ SO WHY NOT DROP THE PILL AND KEEP THE LINE, which is the shorter fix?
   * Because the line is not always the one showing. `DecisionNode`'s resting
   * state is a FIRST-MATCH chain — an UNNAMED optionless decision renders
   * `unnamedLine`, never `noOptionsLine`. On that card the pill is the only
   * channel carrying the structural absence at all, so removing it would
   * reopen the gap the pill was added to close.
   *
   * ⚠ TWO FORMS, ONE FACT, ONE OWNER — which is this file's whole job. They sit
   * adjacent in one record precisely so they cannot drift into contradicting
   * each other, the same construction `METRIC_UNSET` uses for its `standalone`
   * / `inline` pair. Not derived by string surgery: dropping a word from the
   * cause does not produce an honest consequence.
   *
   * ⚠ AND IT IS IN THE PILL'S DOCUMENTED REGISTER. `BaseNode` argues, for the
   * exclusion pill, that a pill "states the CONSEQUENCE rather than the cause"
   * — "Needs input" tells a user something is missing, the consequence tells
   * them what it costs. For an optionless decision the cost is exact: there is
   * nothing being compared. "compare" is the estate's own word for it
   * (`DECISION_RESTING_COPY.noOptionsAsk` — "Suggest options to compare here"),
   * not one minted here.
   *
   * ⛔⛔ THIS STRING IS THE PILL'S *ONLY* STRING — `noOptions` MUST NOT BE
   * HANDED TO THE SAME PILL AS A `title`, AND THAT IS A CORRECTION TO THE
   * PARAGRAPH ABOVE RATHER THAN A GLOSS ON IT. The first cut of the split did
   * exactly that, on the reasoning that the pill could state the consequence
   * and carry the cause in its tooltip. `StatusPill` composes
   * `aria-label={title ?? label}`, so the "tooltip" is also the ACCESSIBLE
   * NAME: the pill then announced `noOptions` verbatim while the body line
   * announced it too, and the card a screen-reader user hears said one sentence
   * twice — the defect the split exists to remove, moved rather than removed.
   * Worse, the assertion that certified the split was `getByText`, which reads
   * text content and cannot see `aria-label`, so the visible channel went green
   * while the a11y channel never moved.
   *
   * ⚠ SO THE RULE THIS RECORD NOW CARRIES: one surface, one member. The corner
   * pill renders `nothingCompared` and passes NO `title`, so its visible label,
   * its tooltip and its accessible name are one string and cannot drift; the
   * card body renders `noOptions`. A THIRD form invented for the tooltip would
   * be this same defect one round later, invisible to every sighted reviewer.
   * Pinned as literals in `BaseNode.needsJudgementBadge.spec.tsx` §5.
   */
  nothingCompared: 'Nothing to compare yet',
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
 * ⚠ NOT EXHAUSTIVE, AND SAYING SO. ~~`#1`/`#2` sensitivity ranks and~~ `est.`
 * are here because they are numerals-with-a-meaning that a reader meets on the
 * card; `Stability` is not, because it renders with its noun spelled out in
 * full beside it and needs no key. If a fifth captioned quantity is added,
 * this list is where it goes.
 *
 * ⚠⚠ THE ADMISSION TEST ABOVE NO LONGER EXPLAINS WHY THE RANK ROW IS HERE, AND
 * THAT IS WORTH SAYING RATHER THAN QUIETLY REWRITING. The rank badge now
 * renders `Key driver 1` — its noun spelled out in full, which is the exact
 * property the sentence gives for EXCLUDING `Stability`. By that test the row
 * should have left with the numeral.
 *
 * It stays, because the test was never the whole reason. A key is earned by a
 * marking whose MEANING is not recoverable from the card, and spelling the
 * noun out closes only half of this one: `Key driver 1` says which set the
 * number indexes, and still not WHAT ORDERS THE SET. Ranked by sensitivity —
 * so `1` is the factor the result moves most on, which is very often the
 * factor the team has the least evidence about. That is the sentence
 * `SENSITIVITY_RANK_CLAUSE` carries and no badge has room for.
 *
 * `Stability` needs no key because its noun IS its meaning. This one's is not.
 */
export interface MetricLegendRow {
  /** The word (or numeral) as the card renders it. */
  noun: string
  /** One line: what the number counts. */
  gloss: string
}

/**
 * ⭐⭐ THE TWO CLAUSES THE LEGEND AND THE BADGES BOTH SPEAK — ONE AUTHORITY.
 *
 * ⚠ THIS EXISTS BECAUSE A COMMENT CLAIMED IT ALREADY DID. `#1414` gave the two
 * canvas badges accessible names and wrote, at both call sites, that the
 * wording was "DERIVED from the legend's own gloss … so the two cannot drift
 * into saying different things about the same badge". **There was no import.**
 * Both `aria-label`s were template literals that happened to repeat the
 * legend's words — a hand-maintained mirror (CLAUDE.md trap 12) whose comment
 * asserted the derivation that would have made it safe. The comments are
 * preserved and corrected forward at those sites rather than deleted; what
 * they say is now true because of these two constants, not because of them.
 *
 * ⛔ THE DRIFT IS SILENT AND IT LANDS ON ONE READER ONLY. Nothing tested the
 * badge against the legend: `ORDINAL_ROW_MUST_STATE_MINT` is only ever applied
 * to `row.gloss`. So a legend rewrite kept the mint guard green, left the
 * badges on the old wording, and told a screen-reader user something different
 * from what a sighted user reads in the popover — the two surfaces disagreeing
 * about the same badge, with no red anywhere.
 *
 * ⚠ SCOPE, STATED NARROWLY. These constants couple the legend row and the
 * badge name for the SAME badge. They are not a general copy register — that
 * is `METRIC_NOUN` — and they do not make the sentences correct, only
 * identical. The clauses' truth is guarded separately: the ordinal's mint
 * qualifier by `ORDINAL_ROW_MUST_STATE_MINT`, and the residual O1 limit is
 * still open in the ⚠⚠ block above.
 *
 * The rows below are built from these, so the register reads exactly as it
 * did — the change is where the words live, never what they say.
 */
export const SENSITIVITY_RANK_CLAUSE = 'the factors the result is most sensitive to'
export const ORDINAL_MINT_CLAUSE = 'the order the options were first laid out in'

/**
 * ⭐⭐ THE NOUN THE RANK BADGE NOW SAYS OUT LOUD — MINTED NOWHERE, PROMOTED
 * FROM THE SENTENCE THAT ALREADY SAID IT.
 *
 * ⛔ THE DEFECT, measured on deployed staging 18 Sep 2026: the badge rendered
 * `#1` / `#2` / `#3` and nothing else. **`#1` reads as BEST.** It means MOST
 * SENSITIVE — which on a factor card is usually the thing the team knows
 * LEAST about, and therefore the thing they should argue with rather than
 * trust. The glyph inverted its own meaning on the cards that matter most,
 * and it did so in the one channel a reader cannot opt out of: the number was
 * the whole of the visible copy.
 *
 * ⚠ THE HALF THAT WAS ALREADY RIGHT, AND WHY NOTHING IS MINTED HERE. The
 * accessible name has said `Key driver #N` since #1414 — so a screen-reader
 * user was told which badge this is and a sighted user was not. The word
 * existed; it was simply never rendered. "Key driver" is also the estate's
 * standing noun for this quantity (`driversAdapter.ts`'s `Key drivers`,
 * `DriverChips`'s `aria-label`), so promoting it costs no new vocabulary —
 * the alternative, inventing a canvas-only word, is how this file's own
 * header describes the four-vocabularies defect it exists to close.
 *
 * ⛔ AND THE `#` GOES, IN BOTH CHANNELS, WHICH IS THE POINT RATHER THAN A
 * TIDY-UP. `#` is the placing sigil: `#1` in ordinary English is a placing
 * even when the noun beside it is not a contest. With the noun rendered,
 * `Key driver 1` reads as an index into a named set; `Key driver #1` reads as
 * the winner of one. Dropping it also makes the visible string a LITERAL
 * PREFIX of the accessible name (WCAG 2.5.3 Label in Name) — true by
 * construction below, not by two authors agreeing.
 */
export const SENSITIVITY_RANK_NOUN = 'Key driver'

/**
 * What the badge RENDERS. One builder, two consumers — the visible text and
 * the accessible name below — so the card and the screen reader cannot be
 * given different words for the same badge.
 *
 * ⭐ `fromLastRun` (the card's `useModelChangedSinceRun()`) opens the badge
 * with `LAST_RUN_PREFIX` — a stale rank is LABELLED, never withdrawn (Paul's
 * Ruling 3, ROADMAP 2.651). It lives HERE rather than at the call site so the
 * accessible name, built from this string, still opens with the visible one
 * by construction (WCAG 2.5.3) on the stale arm too. That drift is not hypothetical
 * here: it is exactly what #1414 shipped, and the comment block above
 * `SENSITIVITY_RANK_CLAUSE` is its post-mortem.
 */
export const sensitivityRankBadgeLabel = (rank: number, fromLastRun = false): string =>
  `${fromLastRun ? LAST_RUN_PREFIX : ''}${SENSITIVITY_RANK_NOUN} ${rank}`

/**
 * The legend's row heading for this badge. `MetricLegendRow.noun` is
 * documented as "the word (or numeral) as the card renders it", so it is
 * BUILT from the badge's own noun rather than re-typed: a heading reading
 * `#1, #2, #3` beside a card reading `Key driver 1` is a key that does not
 * match the thing it is a key for, and the reader opens the key PRECISELY
 * when the badge already puzzles them.
 *
 * ⭐ Exported because `CanvasLegendPopover`'s `METRIC_ROW_VISIBLE` is KEYED BY
 * NOUN, and its own docblock names this row as one of three keys that are
 * "re-typed literals with no exported constant … a hand-maintained mirror of
 * a register in another file (trap 12)". This makes one of the three derived.
 */
export const SENSITIVITY_RANK_LEGEND_NOUN = 'Driver N of M'
// ⭐ LOCKED DESIGN (23 Sep 2026; ED 02:31Z D1a): the corner "Key driver N" badge
// is RETIRED and the rank is stated once, on the factor card's driver line —
// "Driver N of M ranked in this run" (`DRIVER_LINE_COPY.rank`, contract v3.1 pt 5). The legend heading
// moves with it, so the key names the marking a reader actually meets.

/**
 * The rank badge's accessible name. Built from the visible label, so the
 * spoken string opens with the string on screen and then says what the badge
 * counts — the part a badge has no room for.
 *
 * ⚠ The historic note this replaced said `BaseNode` "renders `#N` and nothing
 * else, so without this a screen reader gets the bare string '#1'". That was
 * true when written and is the record of why this builder exists; what has
 * changed is that the sighted reader is no longer the one left with the bare
 * numeral.
 */
export const sensitivityRankBadgeAccessibleName = (rank: number, fromLastRun = false): string =>
  `${sensitivityRankBadgeLabel(rank, fromLastRun)}: one of ${SENSITIVITY_RANK_CLAUSE}`

/**
 * The option ordinal badge's accessible name. Deliberately NOT a bare
 * "Option N", which reads as a rank; the trailing clause is what distinguishes
 * it from `sensitivityRankBadgeAccessibleName` above.
 *
 * ⚠ The separator is an EM DASH (—), matching what ships today.
 */
export const optionOrdinalBadgeAccessibleName = (optionNumber: number): string =>
  `Option ${optionNumber} — ${ORDINAL_MINT_CLAUSE}, not a ranking`

export const METRIC_LEGEND_ROWS: readonly MetricLegendRow[] = [
  {
    noun: CURRENT_MODEL_NOUN,
    // ⭐ Locked design (ED 11:52Z point 4; ED 5799353114 decision 2): the canvas
    // never captions this "Support" — cards read "Current model · N% of runs".
    // The row names the quantity in the card's words and says it is
    // conditional on the model and its assumptions, not a recommendation.
    gloss: 'on option cards “N% of runs”: runs favouring this option under this model’s assumptions; not a recommendation',
  },
  {
    noun: METRIC_NOUN.chance,
    // ⚠ THE REFERENT IS LOAD-BEARING AND WAS PRESERVED THROUGH THE RE-FRAME.
    // This gloss said "the leading option", which names the option with the
    // highest comparative figure — NOT any option. Dropping the qualifier to
    // shed the race word would have widened the claim to something false.
    // "the most-supported option" is the same referent in the new vocabulary.
    gloss: 'how often the option most runs favoured reached the goal target across the runs',
  },
  {
    noun: METRIC_NOUN.influence,
    // Derived from the results-surface authority rather than re-worded, and the
    // noun is stripped back off to keep this list's shape uniform — the row
    // renders "<noun>: <gloss>" like every other.
    //
    // ⛔⛔ WAS `INFLUENCE_EXPLANATION_GENERIC`, AND THAT IS THE ONE FALSEHOOD
    // THIS LEGEND EXISTED TO PREVENT. The generic constant reads *"how much this
    // factor affects the outcome"* — an ABSOLUTE claim about a figure PLoT
    // max-normalises (`factor-influence.ts:556`, `Math.abs(influence) /
    // maxAbsInfluence`), so the top factor reads 100% on every board BY
    // CONSTRUCTION. The correct constant sat one line away in the same module
    // and was never selected.
    //
    // ⭐ AND THE LEGEND IS THE LOAD-BEARING SURFACE HERE, not a nicety: it is
    // the ONLY explanation of Influence that survives a shared link, because
    // every other channel is a <Tooltip>, a `title` or an aria-label — and on a
    // shared board nobody hovers, and on touch there is no hover at all.
    // Shipping the card's basis-aware noun ("Relative influence", see
    // `influenceBasisNoun`) WITHOUT this would leave a card whose own key
    // contradicts it.
    gloss: INFLUENCE_EXPLANATION_RELATIVE.replace(/^Influence:\s*/, ''),
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
    // ⭐ THE HEADING IS NOW THE BADGE'S OWN WORDS, BY CONSTRUCTION. It read
    // `#1, #2, #3` while the badge rendered the same numerals; the badge now
    // says `Key driver 1`, so a re-typed heading here would have been a key
    // naming a marking that is no longer on any card.
    noun: SENSITIVITY_RANK_LEGEND_NOUN,
    // ⭐ SHARED WITH THE BADGE'S OWN ACCESSIBLE NAME, by import rather than by
    // repetition — see SENSITIVITY_RANK_CLAUSE above. Byte-identical to the
    // literal it replaced.
    gloss: SENSITIVITY_RANK_CLAUSE,
  },
  {
    noun: '1, 2, 3 on an option',
    // ⚠ THE QUALIFIER IS LOAD-BEARING — see ORDINAL_ROW_MUST_STATE_MINT below.
    // ⭐ The first clause is shared with the badge's accessible name
    // (ORDINAL_MINT_CLAUSE above). The two sentences below it are the legend's
    // alone: a badge name has no room for them. Byte-identical to the literal
    // it replaced.
    gloss: `${ORDINAL_MINT_CLAUSE}. Not a ranking, and it stays with a card when you move it.`,
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
 * ⭐⭐ BOTH "VERB SURVIVORS" ARE GONE. RE-DERIVED 8 Sep 2026 AT THIS TIP.
 *
 * This section used to disclose two deliberate survivors and argue for them on
 * part-of-speech grounds. Both claims are now false, and the second was
 * already false when it was written:
 *
 *   · `DecisionNode` — "{X} leads in N% of scenarios". CHANGED 8 Sep 2026 to
 *     the register's own `COMPARATIVE_COPY.clause`, so the card's sentence and
 *     the card's bar caption are one vocabulary. It was ONE number, read from
 *     ONE binding, captioned twice eight pixels apart. The part-of-speech
 *     defence is sound in general and did not hold here: a verb and a noun
 *     describing the SAME quantity on the SAME card are not two ideas.
 *   · `OptionNode` — "Leads via {factor}, the #1 driver" was already absent
 *     in the 8 Sep sweep; "Supported by {factor}" remained at that point.
 *     On 9 Sep the option refinement replaces that residual with "Factor to
 *     examine": global factor importance supports navigation, not an
 *     option-specific causal explanation. No vocabulary export changes.
 *
 * ⭐ SO "Leads" IS RETIRED AS A CAPTION *AND* HAS NO LIVE PROSE USE ON THE
 * CANVAS. The narrower ruling is kept below because it is the right rule — a
 * register governs captions, not every verb — but no survivor now relies on it.
 * `RETIRED_METRIC_NOUNS` still retires "Leads" AS A CAPTION only.
 *
 * ⚠ THE COST THIS SECTION USED TO STATE ("a reader sees `Ahead 47%` and
 * `Leads via …` on one card") IS PAID OFF, not argued away.
 *
 * ⭐ `strength` (LOWER CASE) IS IN THIS LIST, AND IT IS RETIRED BY CASE RATHER
 * THAN BY WORD. `Strength` is live; the lower-case caption that shipped on the
 * risk and outcome cards is not. It is listed here — rather than left as a
 * hand-written regex in the guard spec — because the guard now DERIVES its ban
 * list from this array, and a ban list maintained in two places is the
 * hand-maintained mirror this whole file exists to abolish (CLAUDE.md trap 12).
 *
 * ⚠ THE CASE DISTINCTION IS LOAD-BEARING AND THE GUARD RELIES ON IT. The sweep
 * is case-SENSITIVE on purpose: `EdgePills` renders "Link strength", which is
 * ordinary English that must survive. (The other example named here was
 * `DecisionNode`'s "{X} leads in N% of scenarios" — reworded 8 Sep 2026, so
 * `EdgePills` now carries this justification alone. It is enough; the rule is
 * not weakened, its second witness simply went away.)
 *
 * ⚠ `Chance of leading` is on the option INSPECTOR, not a card. It is retired
 * for the same reason as the rest — it was a third word for the first
 * quantity — but note it was the most *explanatory* of the three, and the
 * inspector has room the card does not. What replaces it is the shared noun
 * plus the legend; if that reads as a loss on the inspector specifically, the
 * fix is a gloss there, not the synonym back.
 */
export const RETIRED_METRIC_NOUNS = [
  'Leads',
  'Achievement',
  'Chance of leading',
  'strength',
  // ⭐ Added 7 Sep 2026. `Ahead` was the LIVE caption for the comparative
  // quantity until Paul's no-contest ruling retired the frame itself. It is
  // in this list — rather than simply changed at the register — so the
  // derived sweep REDs if it is ever re-typed onto a card.
  'Ahead',
] as const

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

/* ══════════════════════════════════════════════════════════════════════════
 * THE LOCKED NODE-CARD DESIGN (Experience Design, 22–23 Sep 2026) — the copy
 * every card face now reads, held in ONE register so a card, its reduced line
 * and its guard cannot drift into four wordings for one idea again.
 *
 * Authority: `docs/designs/canvas-final-v2/olumi-canvas-overnight-implementation-spec.md`
 * (branch `docs/canvas-final-visual-contract`) and the ED rulings on
 * olumi-programme-docs#63 (5787931376 at 02:31Z, 5794306145 at 11:52Z). Where a
 * ruling refines the spec, the ruling wins, and each constant below names the
 * ruling it follows.
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * `Last run · ` — licensed ONLY when the model is known to have CHANGED since
 * the run (ED 02:31Z, "Goal stale rule: align to Q2 — `changed` only").
 * `cannot_confirm` and never-run must not manufacture a "last run" claim.
 *
 * ⚠ ONE DECLARATION: `LAST_RUN_PREFIX` is declared once, near `METRIC_NOUN`
 * above (#1891 and #1915 each added the same constant; the design integration
 * keeps one owner). This register reads it; it does not re-declare it.
 */

/**
 * The factor driver line. ED 02:31Z: "`Driver N of M`, not `Driver #N of M`";
 * ED 11:52Z: "model-relative driver treatment, e.g. `Driver 1 of 4 in this
 * model` … no pseudo-precise `% influence` on the face."
 *
 * ⚠ The disclosure is basis-aware rather than the spec's verbatim sentence
 * ("Relative model sensitivity in this analysis…"): on the `influence_score`
 * basis the figure is STRUCTURAL and computed before the run, and
 * `influenceScaleCopy.ts` (#1221) forbids attributing it to "this analysis".
 * The relative/not-absolute half of the spec sentence is kept word for word.
 */
export const DRIVER_LINE_COPY = {
  // ⭐⭐ CONTRACT v3.1 POINT 5 (DESIGN-GAP-v31 #37, Canvas WS4, 26 Sep):
  // "Driver N of M ranked in this run"; stale "Last run · Driver N of M ranked"
  // (the caller owns `LAST_RUN_PREFIX`; the stale form drops "in this run",
  // which would be false of a known-changed model). M is the RANKED count
  // (`rankFactor`'s `rankedSetSize`, via `driverRankFor`) — the words and the
  // number move together, because "of 6 ranked" when the run ranked 3 is false.
  // ⚠ RULING CONFLICT, NAMED: this reverses ED #63 5806207128 (24 Sep), which
  // had retired exactly this form for `Driver 1 of 6 analysed` ("Denominator =
  // eligible analysed factors, not 'number of ranks we happen to render'"). The
  // lane brief applies v3.1 over the code's documented rulings; the change is
  // one commit the lane owner can drop whole.
  rank: (rank: number, rankedCount: number, fromLastRun = false): string =>
    fromLastRun ? `Driver ${rank} of ${rankedCount} ranked` : `Driver ${rank} of ${rankedCount} ranked in this run`,
  // Contract v3.1 pt 5: "A factor the run did not rank shows no rank, and its
  // detail says 'Not ranked in this run'". The stale form mirrors the rank's
  // (the caller prefixes `LAST_RUN_PREFIX`).
  notRanked: (fromLastRun = false): string => (fromLastRun ? 'Not ranked' : 'Not ranked in this run'),
  relativeDisclosure:
    'Relative to the strongest factor in this model, not an absolute causal percentage.',
  rankBasis:
    'Ranked by how strongly the comparison responds to each factor in this model.',
  question: 'How sure are you of its value?',
} as const

/** The turning-point mini-visual (spec §3, precedence 1). */
export const TURNING_POINT_COPY = {
  caption: 'Turning point',
  /**
   * The producer found a flip but its value is on the model's internal scale
   * (`value_scale !== 'display'`). ROADMAP 2.1371: a raw `0.5` printed on a
   * headcount is the acceptance failure — so no number, and the sentence says why.
   */
  internalScale:
    'The point is on the model’s internal scale, so no number is shown.',
  question: 'How likely is that?',
} as const

/**
 * Relationship strength ON A NODE is the LINK's strength, never the node's own
 * likelihood or value (ED 11:52Z: "if strength is shown on-node, call it
 * **link strength**"). MT-15b: an unconfirmed producer value reads as Olumi's
 * estimate — one wording, not "Not set yet" beside an edge that shows a value.
 */
export const LINK_STRENGTH_COPY = {
  /** The register's one noun — the legend heading reads the same value. */
  noun: METRIC_NOUN.strength,
  olumiEstimate: 'Olumi’s estimate',
  /** A producer value that is not Olumi's (e.g. a template's), not yet confirmed. */
  unconfirmedEstimate: 'Estimate, not confirmed',
  /**
   * The EDGE hover's author words for a non-Olumi unconfirmed strength
   * (`edges/connectorCopy.ts` `linkStrengthCaption`, #1910 R8): a template's
   * figure, and the agentless word for an unrecognised source. Held here so
   * every link-strength word has ONE owner (design integration, 23 Sep 2026);
   * the card row's `unconfirmedEstimate` is a different sentence for the same
   * state and is NOT unified here — that is copy, not a join (rowed for ED).
   */
  templateEstimate: 'template estimate',
  estimate: 'estimate',
  /** No value at all — the register's own unset wording, inline form. */
  notSet: METRIC_UNSET.inline,
} as const

/**
 * The option card's at-rest result. ED 11:52Z: "Do not use `Support` as the
 * result label. It reads as endorsement. Any result shown at rest must be
 * explicitly model-relative, e.g. `Current model · 55% of runs`."
 *
 * The caption follows the run's currency, and each arm is only what the state
 * supports: `changed` → `Last run` (the one state that licenses it);
 * `cannot_confirm` → `Model result`, which asserts neither currency nor a
 * later model.
 */
export const OPTION_RESULT_COPY = {
  current: CURRENT_MODEL_NOUN,
  lastRun: 'Last run',
  unconfirmed: 'Model result',
  share: (formatted: string): string => `${formatted} of runs`,
  sentence: (formatted: string): string =>
    `In ${formatted} of the simulated runs, the model favoured this option over the others. ` +
    'A finding about the model as it stands, not a recommendation.',
  unconfirmedNote: 'Olumi can’t confirm this run reflects the current model.',
  /**
   * ⭐ GOAL-ONLY, WHEN THE LIMIT VERDICT WITHHOLDS THE LEADER CLAIM (RC #63
   * 5803875794 P0 #3(c); Paul's 23 Sep staging test: "£20k MRR" + "churn < 4%",
   * `leader_claim: { permitted: false, withheld_reason:
   * 'constraint_verdict_withheld' }`, cards showing 81% / 17% / 2% bare).
   * True in all three producer states behind that token: the win share is
   * computed on the goal outcome alone, so it never claims WHICH of
   * infeasible / unevaluated / unmatched happened (`analysisNewCopy.ts`).
   */
  /**
   * ⭐ ED #63 5806207128 / 5806266691 choice 3 + NODE-ANATOMY v3.2 (Option):
   * the SHORT per-result form, visible at rest on the share line beside
   * `N% of runs` (it replaces #1921's second line). Its full meaning is
   * `goalOnlyNote`, on hover, keyboard focus and in the accessible name — never
   * only in a tooltip, and never styled as a verdict.
   */
  goalOnly: 'Goal only',
  /**
   * The full meaning of `goalOnly`. ⛔ It must be true of EVERY cause the token
   * covers: CEE emits `constraint_verdict_withheld` whenever its claim-safety
   * verdict is not entitled, including an automatic first run on a brief with
   * NO limits (DL #63 5825413732; Panel bundle 3 rewords the shared cause the
   * same way). ED's original "Your limits aren't in this share" presumed limits
   * the user may never have set, so it states only what the share IS.
   */
  goalOnlyNote: 'This share compares the options on the goal alone.',
  changedNote: 'The model has changed since this run.',
  /**
   * Visual contract v3 §02, the stale option state — verbatim (design-gap row
   * 22). The LAST run's result stays on the card as `Last run` + share (ED 11:52Z
   * point 8: kept, labelled, never deleted); this line says there is no
   * comparison of the model as it now stands.
   */
  lastRunNoNewComparison: 'Last run · no new comparison yet',
  /** The same state in the share line's accessible name and tooltip. */
  noNewComparisonNote: 'No new comparison yet.',
} as const

/**
 * Visual contract v3 §02, the baseline option — verbatim (design-gap row 22).
 * Said only of the ONE declared baseline (`is_baseline === true`).
 */
export const OPTION_BASELINE_REFERENCE = 'Reference for the other alternatives.'

/**
 * A factor card before ANY analysis (visual contract v3 §02 draft; design-gap
 * row 10) — its value is a working assumption no run has used yet.
 */
export const FACTOR_NO_ANALYSIS_YET = 'Working assumption · no analysis yet'

/**
 * The one attention cue (spec §2 "Attention cue — add"; ED 11:52Z point 7).
 * It reads as "worth thinking about", never as a warning or an error.
 */
export const WORTH_REVIEWING = 'Worth reviewing'
