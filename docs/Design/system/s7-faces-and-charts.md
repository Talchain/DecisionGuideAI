# Card faces, charts, lines and tab tools

This page is binding. Every brief that touches a card face, a chart, a link line or a right-hand tab cites the ID it implements. The forms below are the only ones allowed. A new form needs a new row here first, and `ci:guard:forms` fails any form drawn without a registered ID (see Conformance).

This page transcribes decisions already made. It does not redesign them. Sources:

- the chart system v6 (23 Nov 20:25, S4; published as the "Olumi Chart System" artifact);
- the chart inventory (CHART-MAP, 23 Nov);
- `components/LinkLine.md`;
- Paul's rulings of 17, 18, 23 and 26 Nov.

Anything Paul has not judged is marked **open**, not decided.

## Rules for every form

1. **Visual first, words second.** A value is a mark, an unknown is an empty dashed track, a state is an icon, and whose it is shows as a mark (README principle 5). Running text lives in the Olumi panel. The canvas and the other tabs show pictures and tools (Paul, 23 Nov).
2. **The UI draws, Core decides.** Every word on a face, chart or line is Core's string, drawn verbatim. The UI picks a form by a typed field or an id. It never by matching, splitting, de-duplicating or composing text (Paul, 26 Nov: "a thin display layer").
3. **Two tiers, one form.** Each quantity has a glance (one mark plus one number or short word, readable without hovering) and a look-harder view: the same picture with more on it, one press away (Paul, 23 Nov).
4. **One form per quantity.** No second chart for a quantity that already has a form here.
5. **Design-system values only.** Type is 12, 14 and 18 from `typography.*`. Spacing is `--space-1` to `--space-5`. Colour means meaning only, with solid fills or solid borders over transparent interiors and no pastel tints. Multi-row charts share one label | track | value grid that lines up at 1232 and at 1.33 scale.
6. **Panels echo the canvas.** A row or chip that names a card carries the kind's shape. Options keep their letters, and link direction keeps green and pink (Paul, 23 Nov).

## Card faces (FACE)

At rest a card shows its **title**, its **value or a mark**, and **at most one short chip**. Every sentence goes to the hover, the details box or the Olumi panel (Paul, 26 Nov, link 27: "What's with all the text on the graph nodes? It's too overwhelming").

| ID | Card and state (typed field) | Mark at rest | Chip | Hover |
|---|---|---|---|---|
| FACE-chance | option, `headline.state` chance | CH-chance glance | Core's value ("about 17%") | `headline.title` |
| FACE-fixed | option, `headline.state` fixed | filled or hollow end mark | Core's short words | `headline.title` |
| FACE-noresult | option, `headline.state` none | hollow CH-chance glance | Core's short reason | `headline.why` / `add` |
| FACE-shared | aim, every option blocked by one shared reason | hollow mark on the aim | Core's short reason, on the aim only | the shared sentence |
| FACE-value | quantity, `figure.text` set | value in whose-tone | none | `figure.title` |
| FACE-range | quantity with a range | CH-range glance | none | `figure.title` |
| FACE-unsized | quantity, empty figure | empty dashed track | "not sized yet" (Core) | `figure.title` |
| FACE-waits | quantity, `figure.state` waits | waiting icon | Core's short words | what it waits on |
| FACE-whatif | a marked what-if figure | Olumi mark on the value | none (the mark says it) | Core's what-if sentence |
| FACE-bound | aim, `bound.measured` true | outlined bound pill | none | `bound.title` |
| FACE-notcounted | aim, `bound.measured` false | dashed bound outline | "not checked yet" (Core) | the whole sentence |
| FACE-tips | the figure named by `run.tipping[].figure` | orange tick (CH-tip glance) | Core's tip words in its units | the tipping sentence |

- **Status: open.** The chip words need Core's typed `face.chip {state, text, title}`, asked of lead-poc on 26 Nov.
- Until that field lands, a face draws the mark from the typed field and puts the sentence on the hover, with no chip words of the UI's own.
- These come off the face with this table:
  - `face.line` on option cards;
  - `noChanceLineOf`, `onceWords`, `chanceParts` and `sharedNoChanceOf` as face text;
  - the tipping paragraph on option cards.

## Charts (CH)

| ID | Shows | Glance, and where | Look harder, and where | Core fields | Component | Status |
|---|---|---|---|---|---|---|
| CH-chance | chance of meeting an aim | option card | Analysis: every option on one axis, a whisker for spread | `rows[kind=chance].chance/value`, `headline` | `v12/scale/ChanceDots.tsx` | **open**: the 23 Nov system says a bar with a %; ten dots are built on 4310 (fa2481af) for Paul to compare |
| CH-range | a figure's value and whose it is | figure card: value and middle-80% track | details: you vs Olumi on one axis | `figure`, `figureRange`, `author`, `olumi` | `v12/scale/RangeBar.tsx` | built; one form across faces still to converge |
| CH-rests | how much rests on guesses | option card chip (mostly guesses / mixed / mostly yours) | Reasoning: figures ranked by the uncertainty they drive | `run.rests`, `rests_on` | to build | planned |
| CH-tip | what would change the choice | orange tick on the flipping figure (FACE-tips) | Analysis: the tip point, the side that changes it, the figure's range | `run.tipping`, `rows[].tips*` | `v12/scale/TipPoint.tsx` | look-harder built on 4310; its number labels wait for Core's display strings (F1); the glance tick is not built |
| CH-tested | how well it has been tested | six segments on the question card | Reasoning: each method by its registry icon | `reasoning.examined`, `session.methods`, `pre_mortem` | to build | planned |
| CH-differ | where people differ | "views differ" chip on the card | Team: each person's range on one axis, with the flip point | `collab.shared`, `dissent`, `card.disputed` | to build | planned |
| CH-worth | what is worth finding out first | chip on the most-worth-checking figure | Analysis: checks ranked by how far they could move the chance | `run.find_out`, `card.worth_checking` | to build | planned |
| CH-status | reasoning that is a state | up to three chips: whose, evidence, examined | Reasoning: one row shape for every state | assumption, evidence, examined, next | to build | planned |

Build order, from the chart system:
1. The reasoning loop (CH-status).
2. CH-chance and CH-range with the one-press whisker.
3. CH-tip, CH-tested and CH-differ.
4. Retire the legacy forms.

## Link lines (LN)

The anatomy is in `components/LinkLine.md`. Each registered style:

| ID | Line |
|---|---|
| LN-raise | `edge-positive`, arrow end |
| LN-lower | `edge-negative`, arrow end |
| LN-unsigned | `edge-neutral` |
| LN-goal | `goal` tone: measures or targets an aim, no end for measures |
| LN-driver | `text-header`, a driver link |
| LN-input | dot end |
| LN-doubt | dash `5 4` |
| LN-reason | dotted `0.1 6` round |
| LN-leader | dash `2 3` at 1px |

The halos (alert orange, Olumi `info`) are states, not styles. Any other stroke, dash or end is unregistered.

Crossing lines and lines behind cards are a layout fault, not a style. They are planned with the whole-model fit.

## Tab tools (TT)

The chat is the only place for running text. The other right-hand tabs become tools (S4, 26 Nov 14:51):

| ID | Tool | Status |
|---|---|---|
| TT-check | What to check (CH-worth and CH-status in one list; a press asks Olumi how) | planned, first |
| TT-compare | Compare | planned |
| TT-stress | Stress-test | planned |
| TT-differ | Where we differ, inside Team (CH-differ) | planned |

## Legacy forms

The chart inventory of 23 Nov listed 22 chart-like forms. They are frozen: the guard lists them by file, re-derived at the head it lands on, each with the ID that replaces it. A legacy form may be deleted or converged. It may not be copied into a new place.

## Conformance

- **`ci:guard:forms`** (`tools/ci-guards/check-forms.mjs`) checks against the registry in `docs/Design/system/forms.json`. It scans `src/olumiView`, `src/olumiCore` and `src/canvas`. It fails when:
  - an element carries a `data-form` ID that is not in the registry;
  - a registered component lacks its ID;
  - a new chart-like file or link style appears that is neither registered nor on the frozen legacy list.
- **A face-text spec** renders fixture Views and counts the words at rest on each card family. Each family has a ratcheted budget that only goes down.
- Both join the enforcing gate and `ci:all`. Each was shown failing on a planted breach before it was accepted.
