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
    gloss: 'how strongly a risk or outcome connects to the goal; the same measure as line thickness',
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
 * ⚠ `Chance of leading` is on the option INSPECTOR, not a card. It is retired
 * for the same reason as the rest — it was a third word for the first
 * quantity — but note it was the most *explanatory* of the three, and the
 * inspector has room the card does not. What replaces it is the shared noun
 * plus the legend; if that reads as a loss on the inspector specifically, the
 * fix is a gloss there, not the synonym back.
 */
export const RETIRED_METRIC_NOUNS = ['Leads', 'Achievement', 'Chance of leading'] as const

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
