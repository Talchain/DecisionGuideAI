# Card faces, charts, lines and tab tools

This page is binding. Every brief that touches a card face, a chart, a link line or a right-hand tab cites the ID it implements. The forms below are the only ones allowed. A new form needs a new row here first. `ci:guard:forms` fails unregistered forms within the limits stated under Conformance.

This page transcribes decisions already made. It does not redesign them. Sources:

- the chart system v6 (23 Nov 20:25, S4; published as the "Olumi Chart System" artifact);
- the chart inventory (CHART-MAP, 23 Nov);
- `components/CardFace.md` for card face anatomy;
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

At rest a Simple card shows its **title**, its **value or a mark**, **at most one short chip**, and **Olumi's author mark** wherever Olumi contributed to the card. Every sentence goes to the hover, the details box or the Olumi panel (Paul, 26 Nov, link 27: "What's with all the text on the graph nodes? It's too overwhelming").

The chip's words and the choice between some marks need Core's typed `card.face.chip = { state, text, title } | null`. lead-poc accepted the contract on 26 Nov, and Core builds it after two root-cause fixes.
- `text`: Core's short words, at most 20 characters.
- `title`: the whole sentence, for the hover.
- `state`, by family:
  - option: `chance`, `always_met`, `never_met`, `no_route`, `needs_input`, `no_measure`;
  - quantity: `unsized`, `waits`, `whatif`, `tips`;
  - goal: `not_counted`, `open_question`, `shared_blocker` (the reason every option on this aim shares; those options' chips are then null).
- `null` where the value or bound is itself the face.

Until the field lands, a row marked **interim** draws from the typed field named in that row, puts every sentence on the hover, and draws no chip words.

| ID | Card and state | Selected by (typed) | Mark at rest | Chip | Status |
|---|---|---|---|---|---|
| FACE-chance | option with a chance | `headline.state === 'chance'` | CH-chance glance | the chance value (`face.chip.text`) | interim: the face splits the chance row's `value` with `chanceParts` (falling back to `headline.text`) and draws its qualifier at rest; breach F5, retired by the chip |
| FACE-fixed | option always or never meeting its aim | `face.chip.state` `always_met` or `never_met` | filled or hollow end mark | Core's short words | **waits on chip**: `headline.state === 'fixed'` does not say which; the face is unchanged until then |
| FACE-noresult | option with no result | `headline.state === 'none'` | **open**: interim draws an empty dashed outline of the dots' footprint, for Paul to judge on 4310 (ChanceDots.md draws no dots here) | Core's short reason (chip) | interim |
| FACE-shared | aim whose options share one blocker | `face.chip.state === 'shared_blocker'` on the aim | the same dashed outline, on the aim | Core's short reason | **waits on chip**: interim keeps today's `sharedNoChanceOf`, which compares `headline.text` (a known breach, retired by the chip) |
| FACE-value | quantity with a single figure | `figure.text !== ''`, no range | the figure as a number, in whose-tone (README principle 5) | none | built |
| FACE-range | quantity with an input range | `card.figure.range` | CH-range glance | none | built |
| FACE-bands | calculated figure per option | `card.values[].p10/p50/p90` | middle-80% bands, one per option | none | built |
| FACE-unsized | quantity with no figure | `figure` non-null, `figure.text === ''`, not `waits` | empty dashed track | "not sized yet" (chip; the interim draws no words, and never cuts it out of `figure.title`) | interim |
| FACE-waits | calculated figure waiting on inputs | `figure.state === 'waits'` | the same dashed track | Core's short words (chip) | interim |
| FACE-whatif | a figure tried as a what-if | `face.chip.state === 'whatif'` (View v3 has no figure-level what-if state; `useTryOn` is a preview, not authorship) | Olumi mark only where `author.by === 'olumi'` | none | **waits on chip** |
| FACE-bound | aim with a measured bound | `bound.measured === true` | outlined bound pill | none | built |
| FACE-notcounted | aim with nothing counted | `bound.measured === false` | **open**: interim draws an empty dashed bound outline (today Simple draws a quiet line with no border) | "not checked yet" (chip) | interim |
| FACE-tips | the figure that would flip the choice | the card whose id is `run.tipping[].figure.id` | orange tick | Core's unit words (chip, merged with F1); today `tipping[]` has only `line` and `hover` | **waits on chip** |

Off the face once the chip lands: `face.line` on option cards, the description line, and the tipping paragraph. The text helpers `noChanceLineOf`, `onceWords`, `chanceParts`, `fixedParts` and `sharedNoChanceOf`, and the description and quote matching in `SimpleFace.tsx` and `CoreCard.tsx`, are deleted then.

## Charts (CH)

| ID | Shows | Glance, and where | Look harder, and where | Core fields | Component | Status |
|---|---|---|---|---|---|---|
| CH-chance | chance of meeting an aim | option card | Analysis: every option on one axis. The whisker is **conditional sensitivity** (the chance at the driver's low and high, `rows[].driver.low/high`), never a confidence interval | `rows[kind=chance].chance/value`, `headline` | `v12/scale/ChanceDots.tsx` | **open**: the 23 Nov system says a bar with a %; ten dots are built on 4310 for Paul to compare |
| CH-range | an input figure's range and whose it is | figure card track | details: you vs Olumi on one axis | `card.figure.range`, `author`, `olumi` (an input range carries no percentile meaning) | `v12/scale/RangeBar.tsx` | built |
| CH-bands | a calculated figure per option | figure card stacked bands | Analysis: one row per option | `card.values[].p10/p50/p90`, `values_withheld` | inline in `v12/SimpleFace.tsx`; one component is still to extract | built, to converge |
| CH-rests | how much rests on guesses | one chip on the option card | Reasoning: figures ranked by the uncertainty they drive | `run.rests[]`, `rests_on` | to build | planned |
| CH-tip | what would change the choice | **open**: the 23 Nov system puts an orange tick on the flipping figure, while TipPoint.md draws Core's sentence plus the picture at glance | the tip point, the side that changes it, the figure's range | `run.tipping[]`, `rows[].tips*` | `v12/scale/TipPoint.tsx` | the picture is built on 4310; its number labels wait for Core's display strings (F1) |
| CH-tested | how well it has been tested | six segments on the question card | Reasoning: each method by its registry icon | `reasoning.examined`, `session.methods`, `pre_mortem` (exact paths fixed in its own brief) | to build | planned |
| CH-differ | where people differ | one chip on the card | Team: each person's range on one axis, with the flip point | `collab.shared`, `dissent`, `card.disputed` | to build | planned |
| CH-worth | what is worth finding out first | one chip on the figure most worth checking | Analysis: checks ranked by how far they could move the chance | `run.find_out`, `card.worth_checking` | to build | planned |
| CH-status | reasoning that is a state | one chip, under the one-chip face rule (the 23 Nov system's three chips are **open** against it) | Reasoning: one row shape for every state | fixed in its own brief | to build | planned |

Build order, from the chart system:
1. The reasoning loop (CH-status).
2. CH-chance and CH-range with the one-press whisker.
3. CH-tip, CH-tested and CH-differ.
4. Retire the legacy forms.

## Link lines (LN)

Anatomy: `components/LinkLine.md`. Styles: `v12/links/styles.ts` `LINK_STYLES`. Precedence: `src/canvas/edges/ViewLinkEdge.tsx`.

| ID | Line | Code |
|---|---|---|
| LN-effect | effect: neutral until signed, arrow end | `LINK_STYLES.effect` |
| LN-raise / LN-lower | signed effect: `edge-positive` / `edge-negative`, arrow end | `ViewLinkEdge` sign branch |
| LN-input | input: grey, dot end | `LINK_STYLES.input` |
| LN-measures | gold, no end | `LINK_STYLES.measures` |
| LN-target | gold, arrow end | `LINK_STYLES.target` |
| LN-size | grey, no end, the label `size` (a UI literal today; **open**: Core should own it) | `LINK_STYLES.size` |
| LN-driver | `text-header` ink, only where no styled or modelled branch applies | `ViewLinkEdge` |
| LN-reason | dotted `0.1 6` round; the alert form has an orange stroke | `ViewLinkEdge` / `olumiLook.css` |
| LN-doubt | dash `5 4`; wins over LN-reason when both apply | `ViewLinkEdge` |
| LN-leader | dash `2 3` at 1px | `olumiLook.css` |
| LN-fallback | an unstyled link draws the marker it is given, else the local arrow | `ViewLinkEdge` markers |

**States, not styles:** the 3px lit path, the alert halo (orange) and the Olumi-proposed halo (`info`). Any other stroke, dash or end is unregistered.

**Open:** the `size` label and the link hover are assembled in the UI. Core should own those words.

Crossing lines and lines running behind cards are a layout fault, not a style. They are planned with the whole-model fit.

## Tab tools (TT)

The chat is the only place for running text. The other right-hand tabs become tools (S4, 26 Nov 14:51):

| ID | Tool | Status |
|---|---|---|
| TT-check | What to check (CH-worth and CH-status in one list; a press asks Olumi how) | planned, first |
| TT-compare | Compare | planned |
| TT-stress | Stress-test | planned |
| TT-differ | Where we differ, inside Team (CH-differ) | planned |

## Legacy forms

The chart inventory of 23 Nov listed 22 chart-like forms. The guard's legacy list records the files that matched a primitive when it landed, with a replacement ID where one is clear. A legacy form may be deleted or converged. It may not be copied into a new place. Edit the registry by hand. `node tools/ci-guards/check-forms.mjs --list` prints the current primitive matches.

## Conformance

Status: **built** for both `ci:guard:forms` and the face-text budget spec.

- **`ci:guard:forms`** (`tools/ci-guards/check-forms.mjs`, with the registry in `docs/Design/system/forms.json`) is static, and so only checks what a scan can see:
  - every literal `data-form` ID is in the registry;
  - each registered component root carries its ID;
  - the guard scans the current tree for chart primitive imports, class names and SVG drawing outside the renderer and legacy files in the registry. The SVG scan skips directories named `icon`, `icons`, `marker` and `markers`;
  - `LINK_STYLES` roles must match the registry, and literal dash values must be registered. Marker definitions and edge precedence remain governed by the LN table.
  - Scope: `src/olumiView`, `src/olumiCore` and `src/canvas`.
- It **cannot** see visible words, an inline HTML or CSS chart built from unregistered parts, or whether a string is Core's verbatim.
- **`faceTextBudget.spec.tsx`** renders Simple cards at rest at the full level of detail and counts runs of letters or digits in their visible DOM text. It excludes hover-only text, `aria-hidden` subtrees and screen-reader-only text. It counts the title separately from the face. The fixture title allowance and the per-family, per-row face caps live in `src/olumiView/v12/__tests__/faceTextBudget.json`. Each cap must equal the highest measured fixture count. When that count falls, lower the corresponding JSON entry.
- With stylesheets disabled under Vitest, the DOM walker skips hidden subtrees and mirrors the resting rules in `olumiLook.css` for card actions, the corner slot and the rail. Descendants that set `visibility: visible` are still skipped.
- The spec measures option, quantity, aim (goal and limit), and question cards in these fixture Views at rest:
  - `src/olumiView/fixtures/cardface/studio.view3.json`
  - `src/olumiView/v12/__tests__/fixtures/issue7-e499eff6-studio.view3.json`
  - `src/olumiView/v12/__tests__/fixtures/issue7-e499eff6-bakery-asked.view3.json`
  - `src/olumiView/v12/__tests__/fixtures/issue7-e499eff6-app-launch.view3.json`
  - Typed variants of cardface Studio exercise a qualified chance, an individual withheld result, a shared blocker, an unsized fee, a fee range with empty figure text, a fee waiting on an input and an unmeasured bound.
- The fixtures cover FACE-chance, FACE-fixed, FACE-noresult, FACE-shared, FACE-value, FACE-range, FACE-bands, FACE-unsized, FACE-waits, FACE-bound, FACE-notcounted, and the board question. **Uncovered** are FACE-whatif and FACE-tips, whose typed FACE states the current View cannot express. Coverage is limited to the resting states in these fixtures. The DOM count does not measure clipping.
- The interim selectors are `headline.state === 'fixed'` for FACE-fixed and `sharedNoChanceOf(model, aimId, 'typed')` for FACE-shared. FACE-shared has separate caps for the aim that displays the shared blocker and the options whose individual chips are suppressed. The option letter drawn by CSS `::before` counts once toward the face budget via the rendered `data-option-letter` value.
- A planted sentence in the class fee's typed figure text exercises the same budget check and reports the card, family, row, count and cap. The spec is included by the Vitest discovery glob used by the enforcing suite and by `test:full` in `ci:all`. `ci:guard:forms` also runs in `ci:all`. Its own spec exercises planted breaches and the real tree.
