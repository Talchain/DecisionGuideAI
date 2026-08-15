# Model tab v2 — the structured model editor

**Status:** DESIGN, for Paul's veto — **§7 is the removal review; nothing is removed until he rules.**
**Lane:** PX-D (design-first). **Derived at:** UI `staging` tip `a3c71513`, 15 Aug 2026.

**What exists in code, stated precisely so this header cannot drift into a false claim.** Nothing on
the Model tab changes, and **nothing in this design is mounted**: no route, no tab registration, no
import from any live surface. What does exist is an **unmounted component set** under
`src/canvas/model-tab-v2/` — the row (§4.2), the outline and its tier (§4.3), the detail region
(§4.4), keyboard navigation (§5.2) and the repair-queue lists (§5.3), all render-only, all taking
typed read-only projections as props. **Every write waits for the frozen transaction API** (§8, §9.1):
each control that would cause one renders **disabled, with a label saying why**. A guard spec proves
both halves of that claim — no live file imports this directory, and no file in it writes the store
or constructs a success state. **`src/canvas/model-tab-v2/` is deletable in one `rm -rf` if Paul
vetoes the design**, which is the property that makes building it before the verdict safe.
**Supersedes:** nothing. The complement to the ROADMAP 2.121 work recorded in
`olumi-docs/docs-designs/MODEL-TAB-REDESIGN-2026-07-29.md` (a different repo): that fixed the
*write path*; this fixes the *surface*.

**⚠ Path note:** this file lives in `docs/Design/` (capital D) — the repo's real, tracked design
directory. `docs/design/` does not exist; on a case-insensitive macOS filesystem the lowercase path
silently resolves here, and on Linux CI it would have created a third near-identical directory
beside `docs/Design/` and `docs/designs/`.

---

## 1. Verdict

The Model tab is not an editor. It is a **report with a few editable numbers**, and four
independently-derived facts explain Paul's "the more I play with it, the less I feel like I can
actually directly edit the decision model":

1. **You cannot change the model's structure from it at all.** No add, no delete, for any element.
   The two "+ Add" affordances send a chat message.
2. **The chat message goes into a panel that stays hidden.** Nothing on the tab fronts Olumi.
   So the only structural affordance the tab has terminates in silence.
3. **Editing costs up to three nested disclosures**, one of which has no visible affordance.
4. **Identical-looking edits have different consequences.** A factor value reaches the server.
   An edge strength, an option's intervention value and the goal target do not. Nothing says which.

And the advanced toggle overwhelms non-scientists because **it is two controls wearing one switch**:
it changes the scientific detail *and* the layout mode at the same time.

**The v2 proposal:** replace the accordion-of-report-sections with **one filterable outline of the
model's contents**, where every element is a row, the row's primary value is editable in place, and
all scientific parameters live behind **one consistently-placed Advanced block** that never changes
the layout.

---

## 2. What the tab is today (derived, not remembered)

Every claim below was derived at the bytes at `a3c71513`. Absence claims carry contrast controls.

| # | Finding | Evidence |
|---|---|---|
| **F1** | The advanced toggle drives **two orthogonal things**: layout mode *and* scientific detail. | `ModelTabBody.tsx:116-122` (`makeSectionProps` returns `{}` when expert ⇒ multi-open; controlled ⇒ single-open) and `:761` (`showDetail={expertMode}` → `DetailToggleContext`). The control itself is the `</>` pill in the dock chrome, `OutputsDock.tsx:2078-2091`, persisted `localStorage['olumi.expertMode']`. |
| **F2** | Default view is a **single-open accordion**; opening Options closes Factors. | `ModelTabBody.tsx:114` — `useState<string\|null>('factors')`. |
| **F3** | **The search box filters nothing.** | Complete manifest: `searchQuery` occurs in `ModelTabBody.tsx` at exactly two lines — `:110` (declaration) and `:861` (prop to `ModelFooter`). It is passed to no section. Scope searched: `ModelTabBody.tsx` + all `*.tsx` in `model-tab/`. Claim type: **no-consumer**. Contrast control green (`ModelFooter.tsx` has 5 hits). |
| **F4** | **No structural editing anywhere.** | `addNode\|addEdge\|removeNode\|deleteNode\|removeEdge\|deleteEdge\|onAdd\|onDelete\|"Add ` → **zero** hits across `ModelTabBody.tsx` + all `model-tab/*.tsx`. Contrast control green: `src/canvas/store.ts` = 9 hits. |
| **F5** | **No send-to-AI affordance fronts the Olumi panel** — on the tab that has the most of them. | `revealOlumiSurface()` (`src/canvas/conversation/revealOlumi.ts`) is the estate's fronting primitive. Production call sites (specs excluded): **10, across 4 consuming modules** — `InspectorCoaching.tsx` ×2, `pre-analysis-v3/hooks/useConversationActions.ts` ×5, `focus-now/useFocusNow.ts` ×1, `AnalysisHeroV17.tsx` ×1. In the model-tab scope: **zero**. Contrast control green — the same scope has **12** `onSendMessage` call sites. So four other surfaces front the panel before they send, and the one with the most hand-offs never does. The Olumi tab stays mounted but `hidden` (`OutputsDock.tsx:2797-2805`), and the one auto-expand path requires `dockCollapsed`, which is false while the Model tab is visible. |
| **F6** | **Only one class of edit reaches CEE.** | `sendSystemEvent` in `model-tab/*.tsx`: **FactorsSection only** (`:177/:254/:260`, emitting `factor_value_edit`). Zero in Goal / Options / Relationships / Risks. Plus `edge_adjudication` from the container (`ModelTabBody.tsx:579-671`). In `useInspectorMutations.ts`, `sendSystemEvent` is called at exactly one line (`:235`, inside `setPriorRange`); every other setter — including all five edge setters — is a local store write. |
| **F7** | **Three independent disclosure axes**, one of them invisible. | (i) section accordion; (ii) per-card `cardExpanded`, toggled by clicking the card body with **no chevron and no visible affordance** (`FactorsSection.tsx:157/:352`, `RelationshipsSection.tsx:106/:268`); (iii) global `showDetail`, whose control lives **outside the tab** in the dock chrome. An edge's detail row needs all three. |
| **F8** | The same human gesture is stamped **two different ways** on two surfaces. | Model tab's Confirm writes `setObservedSource('user')` (`FactorsSection.tsx:334`) → class `edited` → pill **"User edited"**. Pre-analysis writes `'user_confirmed'` (`PreAnalysisPanel.tsx:1154`) → class `confirmed` → pill **"Confirmed by you"**. Classifier: `src/canvas/domain/valueProvenance.ts:117-138`. |
| **F9** | **A factor with no value cannot be given one from its card.** | `FactorsSection.tsx` renders static `Not set` text (testid `factor-{id}-not-set`) instead of an `InlineEdit`. |
| **F10** | **"Refine range" is a dead end.** | It only calls `focusNodeById` (`FactorsSection.tsx`, testid `factor-{id}-refine-range`). |
| **F11** | The attention bar **scrolls to collapsed sections**. | `StatusBar.tsx:27-30/:101` does `querySelector(...).scrollIntoView` and does **not** open the target accordion. Under the single-open default, clicking "3 contested" scrolls to a closed Relationships section. |
| **F12** | Dead or mis-wired surfaces. | `isContested` pill is always passed `false` (`RelationshipsSection.tsx:795`); `postRunRepairs` is never passed to `ModelAdjustments`; the Accordion `tierLabel` tooltip is hardcoded to a confidence-about-factors sentence (`src/components/results/Accordion.tsx:183`) and is wrong on Relationships and Model card; `likelihoodColour` (`RelationshipsSection.tsx:208-210`) hand-copies `EDGE_VALUE_BAND_CUTS` instead of calling `edgeValueBand()`; two different strength vocabularies coexist (`model-tab/strengthBands.ts` vs `inspector-v2/inspectorStrings.ts:98`). |
| **F13** | The container's elaborate sort **orders the clipboard, not the screen** — and says the opposite. | `sortedFactors` / `sortedEdges` (`ModelTabBody.tsx:478-499` / `:503-538`) are built with provenance-gated comparators and consumed **only** by `handleCopyText` (`:678`, `:686`) and `handleCopyJson` (`:700`, `:713`). The sections receive the **unsorted** `grouped.factor` (`:789`) and `causalEdges` (`:803`) and re-sort internally (`FactorsSection.tsx:671-694`, `RelationshipsSection.tsx:627-646`). The in-file comment at `:522-523` claims it "brings the on-screen order into line with the copied JSON". It does not. Contrast control: `grouped.option` IS passed to a renderer at `:780`, so passing from these memos is possible — these two simply are not passed. |
| **F14** | The container's own children have **no error boundary**, while all six sections do. | `SectionErrorBoundary` is imported at `ModelTabBody.tsx:27` and **never used** — one hit in the file. So the run cover, header, status bar, entity bar, adjustments, diagnostics, re-analyse bar and footer are unprotected. Contrast control green: the same symbol is used in `GoalSection.tsx:297`, `OptionsSection.tsx:538`, `FactorsSection.tsx:760`, `RelationshipsSection.tsx:842`, `RisksSection.tsx:158`, `ModelHealthSection.tsx:318`. |
| **F15** | A **stale type nobody imports** still describes this tab. | `model-tab/types.ts`'s `ModelTabProps` has no importer anywhere in `src/` (scope: `rg -al '\bModelTabProps\b' src/ --glob '!**/__tests__/**'` → its own file only). It has drifted from the live inline `ModelTabBodyProps` (`ModelTabBody.tsx:56-75`): it declares `critique?: CritiqueItemV1[]` and lacks `expertMode` and `onSendMessage`. Contrast control green: `ObservedState` and `FactorInfluenceMap`, from the same file, resolve to real importers. |

### The interaction budget today

| Target | Interactions from tab open |
|---|---|
| Goal target | 1 |
| Factor value · Confirm ✓ · prior min/max | 1 |
| Factor baseline | 2 — via the **invisible** card-expand |
| Option intervention value | 2 — and expanding Options **collapses Factors** |
| Edge strength · likelihood · direction | **3** — open section → open card → open field |
| Any scientific parameter | 3 + a toggle that lives outside the tab |
| Set a factor that currently has no value | **impossible** (F9) |
| Add or remove any element | **impossible** (F4); the CTA messages a hidden panel (F5) |

---

## 3. The job

> A capable non-scientist opens the Model tab, sees the whole model, finds the thing they want to
> change, changes it, and can tell what happened — without learning what a β coefficient is.

Two modes of use, one surface:
- **Fast structured editing** — repair and adjust many values quickly.
- **Deep inspection** — understand where one value came from and what it does.

Both act on **the same canonical model**. The canvas remains the rich structural view; this is its
tabular twin.

---

## 4. Information architecture

### 4.1 Shape

One scroll container. No single-open accordion. Seven groups, all present, each collapsible and
**independently remembered** (multi-open always, in both tiers).

```
┌─ HEADER (sticky) ───────────────────────────────────────────────────┐
│ 12 factors · 18 relationships · 3 options · 2 risks                  │
│ [🔍 Filter the model…                    ]      ( Plain | Advanced ) │
│ [6 to verify] [4 option values missing] [2 contested] [3 fragile]    │  ← attention chips
└─────────────────────────────────────────────────────────────────────┘
┌─ BODY (one scroll) ─────────────────────────────────────────────────┐
│ ▾ Goal                                                              │
│ ▾ Options                                                           │
│ ▾ Factors                                                           │
│ ▾ Outcomes & risks                                                  │
│ ▾ Relationships                                                     │
│ ▾ Assumptions & provenance                                          │
│ ▾ Evidence & review state                                           │
└─────────────────────────────────────────────────────────────────────┘
┌─ Re-analyse bar (sticky, unchanged) ────────────────────────────────┐
```

The seven groups map 1:1 onto the brief's IA: goal · options · factors · outcomes/risks ·
relationships · assumptions/provenance · evidence/review state.

### 4.2 The row — one anatomy for every element

```
[◇]  Reach £2m ARR by Q4        £2,000,000 ▸   (From brief)   
[○]  Hire two AEs               3 changes  ▸   (AI estimate)  ⚠
[●]  Sales cycle length         45 days    ▸   (AI estimate)  ⚠
[→]  Sales cycle → Revenue      Strong positive effect ▸  (Set by you)
[▲]  Key account churns         Triggered by: Renewal rate
```

- **glyph** — element kind, reusing the shapes `EntityBar` already teaches (◇ goal, □ decision,
  ○ option, ● factor, ▲ risk, ★ outcome, → relationship).
- **label** — click focuses the element on the canvas (keeps today's `focusNodeById` behaviour).
- **primary value** — **editable in the row itself**. One interaction. Plain language: a
  relationship reads "Strong positive effect", not `β = 0.71`.
- **provenance chip** — `SourceProvenancePill`, **reused unchanged**. It is the estate's best
  provenance artefact: a `Record` that is *total* over `ValueProvenanceKind`, so a new kind is a
  type error rather than a silent "Not set".
- **attention marker** — present when the row needs the user: no value · unconfirmed AI estimate ·
  contested · fragile · missing intervention. It is the same predicate the attention chips count,
  derived once.

Clicking anywhere else on the row **selects** it and opens the detail region.

### 4.3 Two tiers, and only two

| | Plain (default) | Advanced |
|---|---|---|
| What it shows | values, labels, units, plain-language qualifiers, provenance chips, what-changed | parameters and scientific detail |
| Examples | "Strong positive effect", "45 days", "Confirmed by you", "Olumi adjusted this" | priors, std/σ, β/signed effect, exists-probability, elasticity, rank-flip rate, attribution stability, quality sub-scores, seed, response hash, node/edge IDs |
| Where it lives | the row and the top of the detail region | **one block, always last, always titled the same way**: *"Advanced — model parameters"* |

**Three rules that make the tier survive contact:**

1. **Advanced is a content switch, never a layout switch.** It adds and removes the Advanced block.
   It must never change how many groups are open, how rows are ordered, or which cards expand.
   This is the direct fix for F1.
2. **Never mixed inline.** A parameter never appears beside a plain value in the same row.
   If a parameter must be visible in Plain (e.g. a unit), it is not a parameter.
3. **One tier control, in the tab.** A `Plain | Advanced` segmented control in the tab header.
   *(This deliberately re-splits the product-wide expert mode — see Open question 1.)*

### 4.4 The detail region — replacing the invisible third axis

Selecting a row opens **one** detail region (a right rail where width allows, otherwise an expanded
region beneath the selected row). It replaces `cardExpanded` entirely, which kills the invisible
disclosure (F7) and drops the axes from three to two: **group open/closed** and **selection**.

Detail content, in fixed order:
1. **What this is** — label, kind, description, editable.
2. **Its value** — primary value, unit, and every secondary value that is still plain (baseline,
   likelihood, direction, per-option fit).
3. **Where it came from** — provenance chip, the basis sentence, what Olumi adjusted and why
   (reusing `ModelAdjustments`' `sanitiseDetail`, which strips engine field paths from user-facing
   text and is worth keeping).
4. **What it affects** — influence bar, the relationships it participates in, the risks it triggers.
5. **Advanced — model parameters** — the single block. Absent entirely in Plain.

---

## 5. Editing grammar

### 5.1 The three-beat, uniform across every field

```
   inline edit            proposal chip                    receipt
┌──────────────┐   ┌───────────────────────────┐   ┌─────────────────────┐
│ 45 → [ 60 ]  │ → │ 45 → 60  [Confirm][Discard]│ → │ 60   (Set by you)   │
│  type, Enter │   │  nothing has changed yet   │   │  provenance flips   │
└──────────────┘   └───────────────────────────┘   └─────────────────────┘
```

This matches the transactional pattern: **intent → validate → propose → confirm →
server-authoritative write**. The row never writes the model itself.

**Row edit state** (the contract the row component takes):

`idle → editing → proposed → inflight → applied | refused`

- `proposed` — the user has stated an intent; the model is unchanged; the old value stays visible
  beside the new one.
- `inflight` — dispatched; the row is marked pending and is not re-editable.
- `applied` — receipt received; provenance chip flips; pending mark clears.
- `refused` — the server declined; **the row says so in words and reverts**. A refusal must never
  look like a success, and must never look like nothing happened.

This is what makes F6 impossible to reproduce: a row can only render `applied` when a receipt says
so, so an edit with no server authority cannot silently masquerade as one that has it.

### 5.2 Keyboard

Enter commits intent · Escape cancels · Tab moves to the next editable value in the outline
(the outline is a list, so tab-through-and-fix is the fast path) · `⌘/Ctrl+Enter` confirms a
proposal without reaching for the button.

### 5.3 The repair queues — Paul's two cases, as one-click-per-item lists

A queue is **a filtered view of the same outline**, entered from an attention chip. Not a modal, not
a separate screen, no forked state — the user never loses their place, and there is only ever one
rendering of a row.

**Queue A — "Set option values"** *(chip: "N option values missing")*

```
Hire two AEs — 2 factors have no target value
  Sales cycle length     45 days now  →  [ 30      ] days   [Apply]
  Pipeline coverage      3.0x now     →  [ 4.0     ] x      [Apply]
                                                     [Apply all shown]
```
One row per (option × factor) lacking an intervention, prefilled with the factor's baseline, one
input and one Apply each. This replaces the current `allUnmapped` coaching card, which tells the
user to go and talk to the AI and offers no way to do the thing.

**Queue B — "Confirm estimates"** *(chip: "N to verify")*

```
Sales cycle length       Olumi estimated 45 days     [Confirm]  [Change]
   Inferred from model structure
Win rate                 Olumi estimated 22%         [Confirm]  [Change]
   Based on general domain knowledge
                                          [Confirm all shown]
```
One row per factor whose `observed_state.source` is absent or `cee_inference` — exactly the existing
`countFactorsToVerify` predicate (`model-tab/utils.ts:118-124`), so the tab badge and the queue can
never disagree. **This is the first time that badge becomes actionable.**

Confirming must stamp `user_confirmed`, not `user` — closing F8, so the pill reads
**"Confirmed by you"** rather than **"User edited"**, which is what actually happened.

**Queue C — "Contested relationships"** *(chip: "N contested")* — already exists and already works.
`ContestedEdgeCard` is kept **wholesale**; it is the best-designed artefact on the tab (four named
verdicts, band quick-sets, a signed slider, an EVOI sentence gated on the number existing, and
provenance discipline that stamps an accepted producer estimate `cee` rather than laundering it as
`user`). It is simply hosted in the queue instead of buried in a collapsed section.

**Queue D — "Factors with no value"**, from the root-node warning the Model card already computes
(`ModelHealthSection.tsx:182-195`: *"N factors have no value set. This reduces analysis
reliability."*). Today that sentence is a dead end; it becomes a queue, and it also closes F9.

### 5.4 Re-analysis

Unchanged: the sticky `ReanalyseBar` stays exactly as it is, and stays the tab's only re-analyse
control. A queue that applies eight edits produces one "Model changed. Results may be out of date."
state, not eight. *(Whether a confirmed edit should ever auto-run is Open question 3.)*

---

## 6. Send-to-AI rule

**No Model-tab control may call `onSendMessage` directly.** Every hand-off goes through one helper:

```ts
handOffToOlumi({ message, reason }): 'fronted' | 'deferred'
```

which **fronts the Olumi panel first, then sends** — and returns whether the panel actually moved,
so the tab never claims Olumi is working on something while the user is looking at a surface that
did not change.

This closes F5 across the whole tab. Measured at `a3c71513`: **12 `onSendMessage` call sites in
6 components, carrying 11 distinct messages** — Options 4 (one message is duplicated across two
mutually-exclusive branches), Relationships 2, Risks 2, Factors 2, Goal 1, Model card 1.

It matters most for the structural CTAs — "Add a factor", "Add a relationship", "Map interventions",
"Explore other strategies". Those terminate in a conversation, not a mutation, so if the
conversation is invisible the affordance is a dead end. **A hand-off that cannot front the panel
must say so rather than send silently.**

PX-A owns the dock mechanism; the contract I need from it is in §9.2.

---

## 7. KEEP / CUT — every current Model-tab surface

**⭐ THIS SECTION IS PAUL'S REMOVAL-ONLY REVIEW.** Read §7.0 alone to veto; §7.1–§7.5 are the
complete backing manifest.

**Verdicts:** **KEEP** (as-is) · **KEEP+FIX** (survives, defect repaired) · **MERGE** (folded into a
v2 group, no copy deleted) · **DEMOTE** (moves behind the Advanced switch, still one click away) ·
**CUT** (gone).

**Scope and method, stated precisely.** Derived at `a3c71513` by reading, in full, `ModelTabBody.tsx`
(the container) plus all 19 `.ts`/`.tsx` files directly in `src/canvas/components/model-tab/`
(`__tests__/` excluded). Every surface those files render is listed below with a verdict — sections,
cards, rows, buttons, pills, badges, chips, coaching cards, warnings, disclosures, inputs, toggles,
tooltips and blocks of copy. **Two surface families are rendered BY in-scope files but DEFINED
outside `model-tab/`** — `Accordion` (which supplies the section chrome) and four leaf visuals — and
they are carried in §7.4 rather than dropped, because a review that silently excluded the chrome
would be reviewing less than the user sees. **Absence claims below carry contrast controls.**

**⚠ THE FIRST DRAFT OF THIS SECTION WAS INCOMPLETE, AND ITS WORST OMISSION WAS IN THE REMOVAL LIST
ITSELF.** It cut `ModelTabHeader` with the justification *"Nothing visible changes"* and *"its two
jobs (count line, context provider)"*. The header in fact renders **seven** surfaces, three of them
visible and none of them a count line: an `· expert` indicator, a `header-sort-note` that prints the
literal word `alphabetical`, and an **expert framing border that wraps every section**. A removal
review that understates what disappears is worse than no removal review, because it converts a veto
into a rubber stamp. The row is corrected in §7.0 and §7.2, and the general lesson is recorded here:
**the removal list is derived from the component tree, never from memory of what the tab looks like.**

### 7.0 ⭐ WHAT DISAPPEARS — the removal-only review

*Everything proposed for removal is in this sub-section. Nothing else is.*

**A. Gone entirely, and the user loses something that is on screen today (13 items)**

| # | What goes | What the user loses | Why it should go |
|---|---|---|---|
| 1 | `EntityBar` — the 6px composition bar, its hover tooltip and its legend | A decorative bar and a legend showing node-type proportions | Purely decorative: no buttons, no handlers. Its counts move into the header summary line, so the information survives; the bar does not. |
| 2 | Options' `options-unmapped-coaching` card, its option list and its `option-{id}-map-cta` | A sentence telling you to go and talk to the AI, plus a button that sends a chat message | This is the dead end Paul hit. Replaced by **Queue A**, which lets you actually set the values. |
| 3 | Factors' click-the-card-body to expand (`cardExpanded`) | The only route to a factor's baseline, influence and stability | **No chevron, no visible affordance** — undiscoverable by design accident (F7). Replaced by row selection. |
| 4 | Factors' static `factor-{id}-not-set` text | Nothing — it is an inert label | It occupies the slot where the editor belongs, so a factor with no value **cannot be given one** (F9). |
| 5 | Factors' `factor-{id}-refine-range` button | A button that looks like it edits the prior range | It only focuses the node on the canvas (F10). A button that does not do what it says is worse than no button. |
| 6 | Factors' `factor-{id}-coaching-dismiss` (`×`) | The ability to dismiss the defaulted-factor nag | The nag becomes a **queue item**, and a queue item is resolved by fixing it, not by hiding it. Dismissal is how a real gap becomes invisible. |
| 7 | Relationships' click-the-card to reveal editing | The only route to an edge's strength, direction and likelihood | Costs 3 interactions. Editing moves into the row at 1. |
| 8 | Relationships' `relationships-show-more` ("+N more relationships") | A one-way "show the rest" button | **One-way — no re-collapse** — in a list you are trying to edit. Replaced by the working filter. |
| 9 | Relationships' `relationships-separator` ("All relationships") | A divider between contested and ordinary edges | Contested edges move into **Queue C**, so there are no longer two piles to divide. |
| 10 | Options' "The AI hasn't mapped how this option changes your factors yet" | A sentence describing a gap | Same dead end as item 2 at the single-option level; becomes a row attention marker + Queue A. |
| 11 | `ModelTabHeader`'s `· expert` indicator | A word appearing beside the counts when expert mode is on | The v2 tier control is a labelled `Plain \| Advanced` switch **in the tab**. A separate word reporting the state of a control you can see is redundant. |
| 12 | `ModelTabHeader`'s **expert framing border** (`border border-info/40` wrapping every section) | A blue frame around the sections when expert mode is on | **This is F1 in its purest form** — a *detail* toggle silently changing the *layout*. It is the clearest single thing to delete to make the tier a content switch. |
| 13 | `ModelAdjustments`' per-row "Details / Hide details" local disclosure | An in-card expander for one adjustment's technical detail | A fourth disclosure axis inside a card inside a section. Its content moves to the detail region, which is where "where did this come from" already lives. |

**B. Gone as a standalone component; every word of copy is preserved (7 items)**
`GoalSection` · `OptionsSection` · `FactorsSection` · `RelationshipsSection` · `RisksSection` ·
`ModelHealthSection` · `ModelAdjustments` — each becomes a **group** in the single outline. The
accordion chrome goes; the content does not. **No user-visible loss.**

**C. Dead or internal — removal is invisible to the user (9 items)**
`EdgeCard`'s `isContested` pill (always passed `false`) · `ModelAdjustments`' `postRunRepairs`
disclosure and list (prop never passed) · `likelihoodColour`'s hand-copied band thresholds ·
`ModelTabBody`'s single-open `openSection` state and `makeSectionProps` mode switch ·
`model-tab/types.ts`'s `ModelTabProps` (no importer anywhere in `src/`; a drifted mirror of the live
inline props) · `utils.ts`'s `mapSourceToTooltip` and `isGenericUnit` (no production importer) ·
`StatusBar`'s stale docstring segment.

**D. Moved behind the Advanced switch — NOT removed, still one click away**
Goal's normalised target / unit / node ID · Options' normalised-targets grid and node ID · Factors'
inline normalised readout, `(normalised)` labels, cap, prior range, sensitivity block (elasticity,
rank-flip, confidence), attribution stability and node ID · Relationships' signed scalar, σ and p
inline readouts, e-value, signed effect, std, exists-probability, provenance grid and edge ID ·
`ContestedEdgeCard`'s parameter grid · Risks' node ID · Model card's quality sub-scores, full audit
trail, methodology line and stability-penalty tail · `StatusBar`'s stability segment · the Text/JSON
copy buttons.

**E. Explicitly NOT removed** — `ContestedEdgeCard` (kept wholesale), `SourceProvenancePill` (reused
unchanged), `ReanalyseBar`, `StreamingDiagnostics`, `CoachingCard`, `InlineEdit`, `DeltaChip`,
`RangeDerivationBadge`, the goal-fit block, and **every honesty resolver**.

**The shape of the removal:** of the 13 user-visible losses, **three are dead ends** (2, 5, 10),
**three are undiscoverable or one-way** (3, 7, 8), **one blocks the job outright** (4), **two are
disclosure axes being collapsed** (13, and the card-expands in 3/7), **two are the tier-as-layout
defect** (11, 12), **one is a dismissal that hides a real gap** (6), and **two are replaced by
something cheaper in the same place** (1, 9).

### 7.1 The container — `ModelTabBody.tsx`

| Current surface | Verdict | One-line justification |
|---|---|---|
| `model-tab` root + `aria-busy` | **KEEP** | Correct busy semantics; the v2 outline mounts inside it. |
| `AnalysisRunStateCover` (running banner / `analysis-run-skeleton`) | **KEEP** | Honest run-state cover, retains content when nodes exist. Out of scope. |
| sections wrapper `div.space-y-4` | **MERGE** | Becomes the single scroll container of §4.1. |
| `openSection` single-open state | **CUT** | F2 — opening Options closes Factors. Multi-open always. |
| `makeSectionProps` accordion-mode switch | **CUT** | F1 — this is the code that makes the detail toggle a layout toggle. |
| `pendingModelTabSection` deep-link effect (opens **and** scrolls) | **KEEP + PROMOTE** | The mechanism F11 needs and `StatusBar` does not use. Becomes the chips' navigation path. |
| `searchQuery` state | **KEEP+FIX** | Held and passed, read by nothing (F3). Wire it to the filter. |
| `handleCopyText` / `handleCopyJson` | **KEEP** | Work correctly; the JSON export carries provenance stamps beside values. Demoted to an overflow menu (§7.3). |
| `sortedFactors` / `sortedEdges` | **KEEP+FIX** | ⚠ **New finding (F13).** Elaborate provenance-gated comparators that order **the clipboard only** — the sections receive unsorted collections and re-sort internally. The in-file comment claims it "brings the on-screen order into line with the copied JSON"; it does not. The outline should consume them, making the claim true. |
| `handleResolveContested` (`edge_adjudication`) | **KEEP** | Server-authoritative, with the provenance discipline intact. |
| its direct `updateEdge` call | **KEEP** | A rowed, documented deviation: no sanctioned setter writes edge `validation`, and `setStrength` would launder a producer estimate as `user`. |
| `SectionErrorBoundary` import | **KEEP+FIX** | ⚠ **New finding (F14).** Imported and **never used** — so the container's own children (run cover, header, status bar, entity bar, adjustments, diagnostics, re-analyse bar, footer) have **no error boundary**, while all six sections do. Contrast control: the same symbol is used in six sibling files. |

### 7.2 Chrome

| Current surface | Verdict | One-line justification |
|---|---|---|
| `ModelTabHeader` — count line | **MERGE** | Becomes the header summary line. |
| — `· {n} fragile` | **MERGE** | Becomes an attention chip. |
| — `header-contested-count` | **MERGE** | Becomes an attention chip. |
| — `header-expert-indicator` (`· expert`) | **CUT** | Redundant beside a labelled, visible tier control. |
| — `header-sort-note` (prints `alphabetical`) | **KEEP+FIX** | An order note belongs on the group whose order it describes, and it is only true pre-analysis. |
| — expert framing border | **CUT** | F1 at its purest: a detail toggle changing layout. |
| — `DetailToggleContext.Provider` | **KEEP, re-source** | Same context, fed by the in-tab tier control. |
| `StatusBar` container | **KEEP+FIX** | Becomes the attention-chip row. |
| — `status-verify` | **KEEP + PROMOTE** | Opens **Queue B**. First time this badge becomes actionable. |
| — `status-fragile` | **KEEP + PROMOTE** | Opens the filtered outline. |
| — `status-contested` | **KEEP + PROMOTE** | Opens **Queue C**. |
| — `status-stability` (`{n}% stability`) | **DEMOTE** | A model-quality figure, not a repair prompt; it belongs with the evidence. |
| — its navigation (`scrollIntoView` only) | **KEEP+FIX** | F11 — must **open** the target and apply the filter. `uiStore.requestModelTabSection(id)` already does both and `StatusBar` has zero references to it. |
| — colour dot | **KEEP** | `aria-hidden`, decorative, cheap. |
| `EntityBar` (container, bar, tooltip, legend) | **CUT** | Purely decorative — no buttons, no handlers. Counts fold into the header. |
| `ModelFooter` bar | **CUT** | Its three contents relocate; the bar itself has no other job. |
| — `model-search` | **KEEP+FIX** | Move to the header and **wire it** (F3). A working filter is the backbone of fast structured editing. |
| — `model-copy` (Text) | **DEMOTE** | Works; simply not primary. |
| — `model-copy-json` (JSON) | **DEMOTE** | Works, and correctly carries provenance stamps beside values. |
| `ReanalyseBar` | **KEEP UNCHANGED** | Sticky, honest, `aria-live`, and the tab's only re-analyse control. |
| — its `disabled` state | **KEEP** | Unreachable in production (`onReanalyse` is always supplied); harmless, and correct in isolation. |
| `StreamingDiagnostics` | **KEEP UNCHANGED** | Shift+D dev surface, DEV-only, out of scope. |
| `CoachingCard` | **KEEP** as a primitive | Still wanted for genuinely advisory content; not for actionable repairs. |
| `SourceProvenancePill` | **KEEP UNCHANGED — REUSE** | Total over `ValueProvenanceKind`. Do not fork it. |
| `InlineEdit` | **KEEP+EXTEND** | Add `proposed / inflight / applied / refused`. Preserve its numeric-aware no-op guard (`0.40` ≡ `0.4`). |
| `DetailToggleContext` | **KEEP, re-source** | Same context, new source. |

### 7.3 Sections and cards

**Goal**

| Current surface | Verdict | One-line justification |
|---|---|---|
| `GoalSection` card | **MERGE** → Goal group | Content is sound; the bespoke card layout becomes rows. |
| — goal diamond icon | **MERGE** | Becomes the row's `◇` glyph. |
| — goal label heading | **KEEP+FIX** | A model editor must be able to rename its goal. |
| — `Target:` label | **KEEP** | |
| — `goal-threshold` InlineEdit | **KEEP+FIX** | Needs `proposeGoalTarget`; today it is a local write (F6). |
| — `goal-threshold-not-set` InlineEdit | **KEEP+FIX** | Already the right pattern — a null value that can still be set. Keep it and give it the authority. |
| — `SourceProvenancePill` | **KEEP** | Correctly `showWhenAbsent={false}` here. |
| — `goal-threshold-coaching` | **MERGE** | Becomes a row attention marker. |
| — `goal-fit-parity` block + per-option rows | **KEEP** | Honest per-option fit, real complete-field gate, and a `< 1%` floor that never prints `0%`. |
| — `goal-fit-modelled-caveat` | **KEEP** | States the basis; deleting it would leave the figures over-claiming. |
| — `goal-feasibility-warning` | **KEEP** | Cheap, true, and fires only on a derived condition. |
| — `goal-discuss` | **KEEP+FIX** | Route through `handOffToOlumi` (F5). |
| — `showDetail` grid (normalised target, unit, node ID) | **DEMOTE** | Textbook Advanced content. |

**Options**

| Current surface | Verdict | One-line justification |
|---|---|---|
| `OptionsSection` Accordion | **MERGE** → Options group | |
| — `options-unmapped-coaching` + its option list | **CUT** → Queue A | The dead end Paul hit: it names the gap and offers no way to close it. |
| — `option-{id}-map-cta` | **CUT** → Queue A | Sends a chat message into a hidden panel (F5). |
| — `options-explore-cta` | **KEEP+FIX** | ⚠ **One testid, two render sites** (mutually exclusive branches). Collapse to one and route through `handOffToOlumi`. |
| — `options-discuss` | **KEEP+FIX** | `handOffToOlumi`. |
| — `option-card` | **KEEP** re-skinned as a row | The content is right; the nesting is not. |
| — option name button (`focusNodeById`) | **KEEP** | The row keeps click-to-focus-on-canvas. |
| — `conditional-winner-{id}` | **KEEP** | States only the bucket fact the producer established; no "leads overall" claim. |
| — pre-analysis coaching ("Run analysis to see when each option leads and lags") | **KEEP** | True, and correctly gated on there being no analysis. |
| — "The AI hasn't mapped how this option changes your factors yet" | **CUT** | Becomes an attention marker + Queue A. |
| — `option-status-quo-{id}` ("No changes to any factors") | **KEEP** | A real, derived fact about a real option. |
| — `option-interventions-{id}` list | **MERGE** | Becomes rows. |
| — factor-name button, baseline span, `ArrowRight` | **KEEP** | |
| — `intervention-{opt}-{factor}` InlineEdit | **KEEP+FIX** | **Queue A depends on `proposeOptionIntervention`**; today it is local-only and reaches CEE as a value-less ping (F6). |
| — `DeltaChip` | **KEEP** | Its cross-unit-space suppression — refusing to subtract a raw baseline from a normalised target — is exactly the honesty we want. |
| — `showDetail` normalised-targets grid + node ID | **DEMOTE** | |

**Factors**

| Current surface | Verdict | One-line justification |
|---|---|---|
| `FactorsSection` Accordion | **MERGE** → Factors group | |
| — `tierLabel` "{n} to verify" pill | **MERGE** | Becomes an attention chip. |
| — `coaching-card-factors-verify` | **MERGE** → chip + Queue B | A dismissible nag becomes an actionable queue. |
| — `factors-add-cta` ("+ Add a factor") | **KEEP+FIX** | Route through `handOffToOlumi`; direct add is Open question 2. |
| — `factors-discuss` | **KEEP+FIX** | `handOffToOlumi`. |
| — `factor-card` collapsed row | **KEEP** → becomes *the* row | Its collapsed state is already almost exactly the v2 row anatomy. |
| — `cardExpanded` (click body, no chevron) | **CUT** | The invisible third disclosure axis (F7). |
| — label button | **KEEP** | |
| — `CategoryBadge` (Controllable / Observable / External) | **KEEP** | Plain-language, and absent when the category is unknown rather than guessed. |
| — `SourceProvenancePill` | **KEEP+FIX** | Here it defaults to `showWhenAbsent`, so an unstamped factor gets a **"Not set"** chip asserting a fact about its provenance. Absence should render as absence. |
| — `RangeDerivationBadge` ("Estimated range") | **KEEP** | Correctly scoped to non-confirmed derivation tiers. |
| — `Prior` label + `prior-min` / `prior-max` InlineEdits | **KEEP+FIX** | `proposePriorRange` exists and is carry-only; keep the pair, always commit both bounds. |
| — "· from model repair" | **KEEP** | Honest provenance for a synthesised prior. |
| — `factor-{id}-default-range` ("0 – 1 (uniform)") | **KEEP** | States the default rather than hiding it. |
| — `factor-{id}-normalised-range` / `-normalised-label` ("(normalised)") | **DEMOTE** | Model-space vocabulary. |
| — `factor-{id}-refine-range` | **CUT** (fix) | F10 — it only focuses the node. Replaced by a real prior-range editor in the row. |
| — `Value` label + `raw-value` / `value` InlineEdits | **KEEP+FIX** | The reference edit path (`factor_value_edit`); gains propose→confirm. |
| — `factor-{id}-not-set` static text | **CUT** (fix) | F9 — the single most damning gap: a factor with no value cannot be given one. |
| — `factor-{id}-inline-norm` ("n:0.42") | **DEMOTE** | |
| — `factor-{id}-confirm` (✓) | **KEEP+FIX** | Must stamp **`user_confirmed`, not `user`** (F8) and become a real proposal→confirm. **Queue B depends on it.** |
| — `factor-{id}-coaching` (defaulted controllable) | **MERGE** → marker + Queue D | |
| — `factor-{id}-coaching-dismiss` | **CUT** | A queue item is resolved by fixing it, not by hiding it. |
| — `Baseline` InlineEdit | **KEEP+FIX** | Moves into the detail region — reachable, rather than behind an invisible expander. |
| — influence bar + `{n}%` | **KEEP** | Plain-language, and absent (not defaulted) when the factor is not in the map. |
| — `AttributionStabilityPill` | **DEMOTE** | Keep its "suppress unless >1 distinct label" rule — it refuses to render a non-differentiating badge. |
| — detail: Current state / prior range / normalised value / cap | **DEMOTE** | |
| — detail: Sensitivity — uncertainty drivers, elasticity, rank-flip, confidence | **DEMOTE** | |
| — detail: Metadata / node ID | **DEMOTE** | |

**Relationships**

| Current surface | Verdict | One-line justification |
|---|---|---|
| `RelationshipsSection` Accordion | **MERGE** → Relationships group | |
| — empty-state Accordion + `relationships-empty-state` | **KEEP+FIX** | Keep the copy; give it the add affordance it describes. |
| — `tierLabel` "{n} contested · {n} fragile" | **MERGE** | Becomes attention chips. |
| — `relationships-summary` (3 variants) | **KEEP** | Including the EVOI variant, which is gated on the number existing. |
| — `coaching-card-relationships-fragile` | **MERGE** | Becomes an attention chip. |
| — `ContestedEdgeCard` list | **MERGE** → Queue C | Hosted in the queue instead of buried in a collapsed section. |
| — `relationships-separator` | **CUT** | No two piles to divide once contested edges live in a queue. |
| — first-5 cap on the edge list | **CUT** | Replaced by the working filter + a virtualised list. |
| — `relationships-show-more` | **CUT** | A one-way expander in a list you are trying to edit is a trap. |
| — `relationships-add-cta` | **KEEP+FIX** | `handOffToOlumi`. |
| — `relationships-discuss` | **KEEP+FIX** | `handOffToOlumi`. |
| — `edge-card` + its card-expand gate | **CUT** | The whole reason edge editing costs 3 interactions. |
| — edge label button (`focusEdgeById`) | **KEEP** | |
| — `isContested` pill | **CUT** | Dead: always passed `false` (F12). |
| — `fragile` pill + tooltip | **KEEP** | States the flip probability it is derived from. |
| — `edge-{id}-evalue` chip | **DEMOTE** | A scientific quantity with a scientific tooltip. |
| — `edge-{id}-summary` collapsed row | **MERGE** | Becomes the row. |
| — semantic strength label | **KEEP** | "Strong positive effect" is exactly the plain-language target. |
| — signed scalar text | **DEMOTE** | |
| — `edge-{id}-inline-std` (σ) / `-inline-p` (p) | **DEMOTE** | |
| — likelihood `{n}%` | **KEEP** | Plain and understandable. |
| — `Strength` label + `edge-{id}-weight` InlineEdit | **KEEP+FIX** | Needs `proposeEdgeStrength`; **`preserveDirection` semantics must survive — a magnitude never carries a sign.** |
| — direction toggle group (`dir-positive` / `dir-negative`) | **KEEP+FIX** | Needs `proposeEdgeDirection`; local-only today (F6). |
| — `StrengthBar` | **KEEP** | |
| — `edge-{id}-strength-notset` / `-likelihood-notset` | **KEEP** | Renders nothing as nothing. Load-bearing honesty. |
| — `Likelihood` label + InlineEdit + bar | **KEEP+FIX** | Needs `proposeEdgeLikelihood`; local-only today (F6). |
| — "Source: {provenance}" | **KEEP** | |
| — detail: Effect / signed effect / std / exists probability | **DEMOTE** | |
| — detail: Provenance heading + row | **DEMOTE** | |
| — detail: E-value | **DEMOTE** | |
| — detail: Causal claim | **KEEP** | Plain-language; belongs in the detail region's "What this is". |
| — detail: Repairs applied | **MERGE** → Assumptions & provenance | It is a provenance record, not an edge parameter. |
| — detail: Metadata / edge ID | **DEMOTE** | |
| — `likelihoodColour`'s hand-copied band cuts | **CUT** (fix) | Call `edgeValueBand()`; a hand-copied threshold mirror is the estate's dominant defect class. |
| — the honesty resolvers (`resolveEdgeValueDisplay`, `resolveEdgeDirectionDisplay`, unset-sorts-last) | **KEEP — do not touch** | Direction is never inferred from a sign; unstamped values render nothing. |

**Contested relationships**

| Current surface | Verdict | One-line justification |
|---|---|---|
| `ContestedEdgeCard` — the whole card | **KEEP WHOLESALE** → Queue C | The best artefact on the tab: four named verdicts, band quick-sets, a signed slider, an EVOI sentence gated on the number existing, and provenance discipline that stamps an accepted producer estimate `cee` rather than laundering it as `user`. |
| — `contested-why-{id}` `<details>` disclosure | **KEEP** | A genuine, labelled, native disclosure — the opposite of the invisible card-expand. |
| — its `showDetail` parameter grid | **DEMOTE + FIX** | Also fix: it currently renders even after the edge is resolved. |

**Outcomes & risks**

| Current surface | Verdict | One-line justification |
|---|---|---|
| `RisksSection` Accordion | **MERGE** → Outcomes & risks group | |
| — empty Accordion + `risks-empty-coaching` | **KEEP** | A good provoking question ("what would guarantee this decision fails?"). |
| — `risks-add-cta` | **KEEP+FIX** | `handOffToOlumi`. |
| — `risks-fragile-coaching` | **MERGE** | Becomes an attention chip. |
| — `risks-discuss` | **KEEP+FIX** | `handOffToOlumi`. |
| — `risk-card-{id}` row + label button | **KEEP** | |
| — "Triggered by: {factors}" | **KEEP** | |
| — node ID | **DEMOTE** | |
| — its read-only-ness | **KEEP+FIX** | `setProbability` and `setImpact` already exist and **nothing on this tab uses them**. |

**Assumptions & provenance**

| Current surface | Verdict | One-line justification |
|---|---|---|
| `ModelAdjustments` (single-item and multi-item forms) | **MERGE** → Assumptions & provenance | The "what did Olumi change and why" ledger belongs with provenance, not floating between sections. |
| — header toggle + counts | **MERGE** | Becomes the group header. |
| — "Constraints applied" / "Auto-fixes applied" groups | **KEEP** | |
| — repair-action bullets | **KEEP** | |
| — `AdjustmentRow` bullet, headline, target line | **KEEP** | |
| — per-row "Details / Hide details" disclosure | **CUT** | A fourth disclosure axis; its content moves to the detail region. |
| — `sanitiseDetail` | **KEEP** | Strips engine field paths out of user-facing copy. Good artefact — and the v2 detail region depends on it. |
| — `post-run-repairs-toggle` + `post-run-repairs-list` | **CUT** | Dead: the prop is never passed (F12). |

**Evidence & review state**

| Current surface | Verdict | One-line justification |
|---|---|---|
| `ModelHealthSection` ("Model card") | **MERGE** → Evidence & review state | |
| — `tierLabel` "{n}% stability · {n}/10" | **MERGE** | Becomes chips / group summary. |
| — `model-card-pre-analysis` block | **KEEP** | Correctly says what is not yet known. |
| — "Based on {n} factors and {n} relationships" | **MERGE** | Becomes the header summary line. |
| — "{n} factor(s) need(s) your input" | **MERGE** | Becomes the verify chip + Queue B. |
| — "Run analysis to see stability, confidence, and reproducibility data" | **KEEP** | |
| — `model-card-methodology` ("Based on {n} Monte Carlo simulations") | **DEMOTE** | |
| — `root-node-warning` | **KEEP + PROMOTE** | Becomes an attention chip and **Queue D** — closing F9's other half. Today the sentence is a dead end. |
| — its "Penalty: {n}x stability" tail | **DEMOTE** | |
| — quality sub-scores ×4 (`quality-row-*`) | **DEMOTE** | |
| — `model-health-audit` grid: seed, response hash, simulations, stability, auto-noise row, stability penalty, repairs summary, inference warnings | **DEMOTE** | The audit trail is the canonical Advanced block content. |
| — every row's `!= null` gate | **KEEP** | Never a placeholder. |
| — `modelcard-discuss` | **KEEP+FIX** | `handOffToOlumi`. |

### 7.4 Chrome defined outside `model-tab/` but rendered by it

Listed because a review that excluded them would be reviewing less than the user sees.

| Current surface | Verdict | One-line justification |
|---|---|---|
| `Accordion` — chevron, `testId`, `aria-expanded`, title | **MERGE** | Becomes the v2 group header (multi-open, independently remembered). |
| — `badgeCount` pill | **KEEP** | Becomes the group's count. |
| — `tierLabel` pill | **KEEP+FIX** | Its tooltip is **hardcoded** to a confidence-about-factors sentence and is wrong on Relationships and Model card (F12). |
| — `icon` | **KEEP** | |
| — `subtitle` | **no action** | Supported by the component and **never supplied by any model-tab caller**. Shared component — not this tab's to delete. |
| `AnalysisRunStateCover`, `DataBar`, `StrengthBar`, `SignedStrengthSlider` | **KEEP** | External leaf visuals, reused as-is. Out of scope for removal. |

### 7.5 Helper modules (no surface of their own)

| Module | Verdict | One-line justification |
|---|---|---|
| `utils.ts` | **KEEP** | Produces the value strings, the "to verify" count and the edge tone/sign. Load-bearing. |
| — `mapSourceToTooltip`, `isGenericUnit` | **CUT** | No production importer (contrast control: `formatValueWithUnit` resolves to 10 files). |
| `strengthBands.ts` | **KEEP + unify** | The copy source for every strength, confidence, existence, basis and contested-reason sentence. Two strength vocabularies coexist across surfaces (F12); the model editor speaks one. |
| `buildGoalFitRows.ts` | **KEEP** | Complete-field gated — returns `null` rather than a partial row set. Exactly the honesty the goal block needs. |
| `synthesisedPriorHelpers.ts` | **KEEP** | Supplies fallback prior bounds and the "· from model repair" annotation. |
| `types.ts` — `ObservedState`, `FactorInfluenceMap`, `DetailContext` | **KEEP** | Live, imported. |
| — `ModelTabProps` | **CUT** | **No importer anywhere in `src/`**; a drifted mirror of the live inline `ModelTabBodyProps` (it declares a `critique` field and lacks `expertMode` / `onSendMessage`). A stale type nobody uses is the next session's false map. |

### 7.6 The interaction budget after

| Target | Today | v2 |
|---|---|---|
| Goal target | 1 | 1 |
| Factor value · Confirm · prior min/max | 1 | 1 |
| Option intervention value | 2 (+ collapses Factors) | **1** |
| Edge strength · likelihood · direction | **3** | **1** |
| Factor baseline | 2 (invisible) | 2 (select row → detail) |
| Any scientific parameter | 3 + an out-of-tab toggle | **2** (tier switch → select row) |
| Set a factor that has no value | **impossible** | **1** |
| Confirm every AI estimate | N × (find it yourself) | **1 per item in a queue** |
| Add / remove an element | **impossible**, into a hidden panel | Open question 2 — at minimum, the CTA fronts Olumi |

Every inspectable/editable thing meets the brief's **≤2 interactions from tab open**.

## 8. What I deliberately do NOT redesign

- **The graph.** The canvas stays the rich structural model. This tab is its tabular twin, not its
  replacement, and every row keeps today's click-to-focus-on-canvas behaviour.
- **The write authority.** Codex's transactional-edit vertical owns it. Every edit here is an
  *intent* dispatched to that authority. **No new local writers.** No file in this design's scope
  touches `edge_strength_edit`, the system-events modules, PR #714's files, or
  `useResultsSectionData.ts`.
- **Analysis surfaces.** PX-C owns the Analysis tab, results, and anything that explains an outcome.
  This tab shows *what the model says*, never *what the analysis concluded*.
- **The conversation dock.** PX-A owns fronting and layout. I name the event I need; I do not build it.
- **The honesty resolvers and provenance classifier.** `edgeValueProvenance`, `valueProvenance`,
  `driverConfidenceDisplayPolicy` are reused verbatim. They are the reason this tab does not lie.

---

## 9. Contracts this design needs

**How to answer this section.** Every ask below has an **ID**, an **exact shape**, and a **closed
question**. Each question is answerable **yes** or **no** without reading the rest of this document;
where the answer is *no*, the useful reply is *"no — here is the shape you get instead"*. Nothing
here asks the answering lane to adopt this design, and nothing here is a request to build UI: these
are the seams the v2 surface binds to, and the v2 components already compile against them
(`src/canvas/model-tab-v2/contracts.ts`, which is the machine-readable copy of §9.1).

**Why the questions are this specific.** Four of the fifteen defects in §2 are seams where two
things that look identical behave differently — an edit that reaches the server and one that does
not (F6), one human gesture stamped two ways (F8), a magnitude that must not carry a sign, and a
producer's estimate that must not be laundered as the user's. A contract answered at the level of
"yes, there's an edit API" would reproduce every one of them.

### 9.1 From the write authority (Codex's transactional-edit vertical)

**The operations.** Status column derived at UI `staging` `a3c71513`.

| ID | Operation | Status today | The closed question |
|---|---|---|---|
| **C1** | `proposeFactorValue(nodeId, typedValue)` | **exists** — `factor_value_edit`, server-authoritative with optimistic revert | Will this be reachable through the uniform handle (C10) with its current semantics unchanged? |
| **C2** | `proposePriorRange(nodeId, min, max)` | **exists** — `prior_range_edit`, **carry-only** (CEE persists a typed fact and writes no graph) | When CEE persists the fact but writes no graph, does the handle settle `applied` or something weaker? ⚠ **The row renders whatever you answer**, so "applied" must mean the model changed — if it did not, the design needs a distinct outcome rather than a green tick over a no-op. |
| **C3** | `resolveContestedEdge(edgeId, verdict, value?)` | **exists** — `edge_adjudication` | Will the provenance discipline stay exactly as it is — an accepted *producer* estimate stamped `cee`, never `user`? |
| **C4** | `proposeEdgeStrength(edgeId, signedMean, { directionStated })` | **in flight on your lane** — `edge_strength_edit` | With `directionStated: false`, will the magnitude be written **alone**, leaving the direction and its stamp untouched, so the edge keeps reading "direction not stated"? **A magnitude must never carry a sign.** |
| **C5** | `proposeEdgeLikelihood(edgeId, p)` — `p ∈ [0,1]` | **no** — local only (`setExistsProbability`) | Will this exist? |
| **C6** | `proposeEdgeDirection(edgeId, 'positive' \| 'negative')` | **no** — local only (`setDirection`) | Will this exist? |
| **C7** | `proposeOptionIntervention(optionId, factorId, value)` | **no** — local only (`setIntervention`); reaches CEE **only** as the debounced, **value-less** `direct_graph_edit` ping | Will this exist and carry **the value**? ⚠ **Queue A is unbuildable without it** — a queue that applies eight intervention values through a value-less ping is eight lies. |
| **C8** | `proposeGoalTarget(nodeId, raw, unit?)` | **no** — local only (`setGoalThresholdAndUpdateNode`) | Will this exist, and does it take the **raw** target plus unit (not a pre-normalised number)? |
| **C9** | `proposeFactorConfirmation(nodeId)` | **no** — a local annotation, and **stamped wrong** | Will confirming stamp **`user_confirmed`**, not `user`? ⚠ Today the Model tab writes `'user'` → class `edited` → pill **"User edited"**, for a gesture that ratified *somebody else's* number; pre-analysis writes `'user_confirmed'` → **"Confirmed by you"** for the identical act (F8). **Queue B depends on this.** |

**The shape.** These five are asked once and apply to all of C1–C9.

| ID | The ask | The closed question |
|---|---|---|
| **C10** | A handle `{ state, receipt?, error? }` where `state` is the discriminated union `idle \| editing \| proposed \| inflight \| applied \| refused` | Will each operation return a handle from which the row can render its state, so `applied` is reachable **only** because the authority said so? ⚠ This is the single most important ask in the section: it is what makes F6 structurally impossible rather than merely fixed. |
| **C11** | `receipt: { appliedValue, provenanceLiteral }` | Will the receipt carry the **stored** value and the **raw provenance stamp**? ⚠ The row must not re-derive either from the number it sent — an echo rendered as a receipt is an optimistic write wearing a confirmation. `provenanceLiteral` is the raw stamp (`'user_confirmed'`, `'cee'`, …), classified for display by the one shared classifier, never a pre-classified kind. |
| **C12** | `proposeBatch(edits): Promise<readonly EditProposalHandle[]>` — **per-item** outcomes | Will a batch report **per item**, and count as **one** undo step and **one** re-analysis invalidation? ⚠ Not a convenience: without it "Apply all shown" over eight rows is eight turns, eight undo steps and eight invalidations for **one** user gesture. A batch that returns one aggregate verdict cannot tell the user which three of the eight were refused. |
| **C13** | `error`: a refusal reason **in user-facing words** | Will refusals carry prose a user can read, and **which side sanitises it**? The estate already has `ModelAdjustments.sanitiseDetail`, which strips engine field paths out of user-facing copy — the design reuses it rather than writing a second, but needs to know whether it is receiving raw engine text or already-clean prose. |
| **C14** | Concurrency semantics for one field | If a second proposal arrives for a field with one already `inflight`, is it rejected, queued, or does it supersede? ⚠ The row renders one `EditCommitState` per value, so it needs to know whether two can ever be live at once — and tab-through-and-fix (§5.2) makes this reachable in ordinary use, not just under stress. |

**Not a wire contract, but owed by whoever mounts v2 first.** When `src/canvas/model-tab-v2/`
becomes live, **widen `model-tab/__tests__/modelTabNoRawStoreWrites.sourceScan.spec.ts`** to cover
it. That guard is derived from `src/canvas/components/model-tab/` and is **recursive within that
directory only**, so a v2 tree living elsewhere is **unguarded** against raw
`updateNode` / `updateEdge` / `updateEdgeData` writes — which is precisely how the class was
re-opened last time: the inspector was fixed, the Model tab kept its own hand-rolled writes, and the
killed defect stayed live through a different door. *(This lane ships its own boundary guard over the
v2 directory in the meantime — `__tests__/modelTabV2Boundary.sourceScan.spec.ts` — but that guard is
scoped to this directory and does not replace widening the original.)*

### 9.2 From PX-A (panel fronting)

One call, owned by PX-A, that survives the dock rework:

```ts
frontOlumiPanel(opts?: { reason?: string }): 'fronted' | 'deferred'
```

| ID | The ask | The closed question |
|---|---|---|
| **D1** | The call exists with that signature and fronts the Olumi conversation whether it is **docked, floating or collapsed** | Will it exist, and does it cover all three states? `revealOlumiSurface()` is the current primitive and the natural basis. |
| **D2** | Origin is **`'user'`** | Will it avoid stamping `outputSurfaceOrigin: 'assistant'` and avoid raising the `AssistantOpenedNotice`? ⚠ These are user gestures. Telling the user Olumi opened something *they* opened is a lie on the one channel whose entire purpose is truthfulness. |
| **D3** | The return value is **truthful about what the user can now see** | Does `'fronted'` mean the panel is actually in front of the user at the moment it returns — not merely that a request was dispatched? ⚠ The whole value of the return is that a hand-off which could not front the panel can **say so** instead of sending into silence. A return that optimistically reports success is worse than no return at all. |

**Why D1–D3 matter more than they look.** Measured at `a3c71513`: **12 `onSendMessage` call sites
across 6 Model-tab components, carrying 11 distinct messages**, every one of them posting a real turn
into a panel that stays `hidden` — the Olumi tab is mounted but hidden
(`OutputsDock.tsx:2797-2805`) and the one auto-expand path requires `dockCollapsed`, which is false
while the Model tab is visible. `revealOlumiSurface()` has **10 production call sites across 4
modules**, and **zero** of them are on the Model tab. Contrast control: the same scope has **12**
`onSendMessage` sites. So four other surfaces front the panel before they send, and the one with the
most hand-offs never does (F5).

**I need the call and its return contract. I do not need, and will not build, any dock mechanism.**

---

## 10. Open questions — for Paul only

**1. Does the Model tab get its own `Plain | Advanced` control, or keep obeying the global `</>`?**
ROADMAP 2.581 deliberately unified expert mode across the product after a split control caused a real
misreading. This design re-splits it — on purpose, because the Model tab's tier must be a *content*
switch while the global one also changes *layout*, and because a control that governs this tab should
be in this tab. But it reverses a ratified decision, so it is your call.

**2. Should the Model tab be able to add and delete model elements directly?**
Today it cannot (F4), and the "+ Add" buttons message a hidden panel (F5). Direct add/delete is the
single biggest change to "I can actually edit the decision model", and it fits *"humans remain the
authors"*. It is also the largest new surface here and it changes who authors the model — Olumi
drafting versus the user building. My recommendation is **yes, for factors and relationships**
(delete behind a confirm), and **no** for goal/decision. Your call on scope.

**3. Should a confirmed edit ever re-run the analysis automatically?**
Today it never does — the sticky Re-analyse bar is always explicit, and that is honest. But a repair
queue that fixes eight factors leaves the user staring at eight-edits-worth of stale results. Options:
stay explicit (safe, current) · auto-run once when a queue is emptied · offer "Apply all and
re-analyse". This is a cost/latency judgement, not an evidence question.

---

## 11. Build sequence (if Paul approves)

Ordered so each step is independently shippable and each one is visible to a user.

1. **Header + working filter + attention chips that open their target.** Closes F3 and F11. No new
   write path. Smallest change with the largest felt effect.
2. **Multi-open groups; tier control moved in-tab; layout decoupled from detail.** Closes F1 and F2.
3. **The row: primary value editable in place for edges and interventions.** Closes the 3-interaction
   cost. Still on today's write paths.
4. **The detail region replaces `cardExpanded`.** Closes F7.
5. **Propose→confirm states in `InlineEdit`, wired to Codex's authority as each operation lands.**
   Closes F6 progressively; rows tell the truth about which edits are authoritative.
6. **Queues A–D.** Closes F9 and makes the badges actionable.
7. **`handOffToOlumi` on all 12 call sites.** Closes F5. *(Can ship at any point once PX-A's call
   exists — it is the cheapest item on this list and independently valuable.)*

## 12. Acceptance

The rebuild is done when a capable non-scientist can, on staging, in one sitting:
- find any element of the model by typing part of its name;
- change its primary value in ≤2 interactions and see, in words, whether the change was applied;
- clear the "to verify" badge to zero without leaving the tab;
- give a value to a factor that had none;
- see every scientific parameter by flipping one switch, and see none of them by flipping it back;
- and hand any of it to Olumi with the panel actually in front of them.

Stop when that holds. This is a PoC surface, not a product-grade editor.
