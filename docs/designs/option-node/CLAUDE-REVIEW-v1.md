# Claude Code review — option node v1 / v2

8 September 2026. Independent adversarial review per `REVIEW-BRIEF.md`. No design version, prototype,
production design-system rule or application file was changed by this review.

---

## 1. Verdict

**Adopt v2 as the vision baseline. It is a substantial advance on v1 and on my own competing sketch, and
its honest-state model is its most valuable contribution — not its layout.**

The finding that most changes my assessment: **v2's honest states independently converge with what I
derived from the production contract, without having seen that derivation.** Two of its six states are
near-quotations of measured wire facts:

- *"A proposed value can be shown without asserting a change. No inferred `4 → 6`."*
- *"A normalised value such as 1.0 is not a headcount. Clarify the unit before visualising magnitude."*

I derived independently, from five repositories and five live staging captures, that **the "after" carries
no unit in 55 of 55 live interventions, and the set of factors that have a unit and the set of factors any
option moves do not intersect at all.** v2 had already made that a first-class state rather than an
assumption. That is the strongest signal in the package that the design reasoning is sound.

**Three material gaps remain, and one is structural.**

## Ranked recommendations

1. **Specify the representation-selection rule.** This is the only gap that blocks v2 becoming a
   specification rather than a demonstration. (§3, finding A.)
2. **Specify the coaching-selection rule.** "One contextual next move" is not yet a claim the system can
   honour. (§3, finding B.)
3. **Re-test the family on a connected graph, not a card grid.** The brief and the design notes both flag
   this; it remains the largest untested risk. (§3, finding C.)
4. **Adopt the coaching-method register proposed in the adversarial review**, and place it under the same
   owner as the design system. It is what makes a coaching prompt falsifiable.
5. **Reuse the ratified provenance glyph module rather than an illustrative register.** (§4.)
6. **Do not build a before/after real-unit display until units exist on the wire.** v2 already behaves
   correctly here; the risk is a later implementer restoring the assumption. (§3, finding D.)
7. **Fix `intervention_details.display_value` before any design consumes it.** Observed defect on the
   deployed product, not a design issue. (§3, finding E.)

---

## 2. What I actually exercised

Driven in a browser at
`docs/designs/option-node/v2/olumi-option-node-v2.html`, viewport 1280×720 unless stated. **Witnessed
means I performed the interaction and observed the result**, not that I read a screenshot or a note.

| Check | Witnessed |
|---|---|
| Coaching is per-option | **Yes.** Selecting *Protect focus time* changed the observation to *"This option assumes interruptions are the main cause of delay. No supporting evidence is attached"* and the action to *Challenge the explanation*. Selecting *Two developers* gave *Explore hiring delays*. Different observation, different action, different type label. |
| Assumption → invalidation | **Yes, and stronger than documented.** Applying *12 weeks* changed the card to *"Assumption changed · result outdated"* and **removed the 64% / 44% comparison entirely.** The stale number is *withdrawn*, not badged. |
| Explicit recalculation | **Yes.** *Recalculate the example* restored the comparison at **46% vs 44%** (from 64%). |
| Refusal to invent | **Yes.** After recalculation: *"The example recalculation updates the target probability only. An updated outcome range is not supplied."* |
| Coaching completion | **Yes.** The prompt became *"Olumi · followed through — Hiring assumption made explicit. The contribution remains with this option"* and offered *Explore another question* rather than repeating. |
| Variation does not inherit | **Yes.** The added possibility showed *"Commitments and effects still to examine"* — no percentage, no cost, no discussion — while retaining lineage: *"A new possibility from Two developers."* Its coaching adapted to its stage: *"This proposal has not been analysed."* |
| Variation is a different mechanism | **Yes.** *"A different route to capacity"* proposed automation, not a different headcount — a different causal mechanism, which is what the adversarial review itself demands. It also disclosed *"the amount of time saved is unverified"* **before** adding. |
| Honest states | **Yes, six.** Before-value unavailable · unit unavailable · no comparison baseline · not analysed · outdated result · **no useful coaching now**. |
| Private contribution | **Partially.** The control exists — *"Keep private until I reveal it"*, checked by default, with *"Private and shared states are simulated locally in this prototype."* **I did not complete save-and-reveal**; the pane was hidden and paint-dependent actions could not complete. |
| Narrow layout | **Yes.** Single column at 375px, no horizontal overflow, header count updated correctly to *7 possibilities*. Noted only; mobile is not a near-term target. |
| Dark | **Not tested.** Local documents render with light defaults in this pane; colour-scheme emulation does not apply. |

---

## 3. Material findings

### A · No representation-selection mechanism exists — OBSERVED DEFECT (in the prototype, as a specification)

**Evidence.** The renderer branches on the six example identities:
`o.id==='hire'` (6 occurrences), `'shared'` (4), `'pilot'` (2), `'partner'` (2), `'focus'` (2),
`'scope'` (1). The data array carries `type` — *"A quantified intervention"*, *"A change in how we work"* —
but it is a **display string**, not a discriminator; `kind` is **provenance** (`'brief' | 'human'`), not
representation.

⚠ **I reached this through two false steps and record them so the finding can be trusted.** A first sweep
used an over-specific pattern and returned a false zero. A second returned `shape:` / `form:` hits that
were **substring artefacts of `transform:` in CSS**, which made me briefly withdraw a correct claim. Only
the third attempt, with a contrast control on `o.` field access (25 hits), settled it.

**User consequence.** A seventh option gets no representation. The prototype is a demonstration of six
possibilities, not a family with a rule — and the design notes say so honestly.

**Remedy.** Select on the **shape of the intervention set** (a single value change, a set of staged
values, a schedule, a withdrawal), with an **authored override**. I recommend the override deliberately:
asking a team *"what kind of move is this?"* is itself a thinking act, not configuration. **It cannot come
from the contract** — see §4.

**And cap the family.** Six cards currently carry six idioms — one per card. Without a ceiling and a
"why not an existing one?" test, this becomes a different visual language per scenario, which the
adversarial review's own principle forbids.

### B · Coaching selection is arbitrary, in the prototype and in production — OBSERVED

**Evidence.** The v2 design notes state it plainly: *"The prototype does not compute which action has the
highest value of information."* Independently, on the production side: CEE emits `coaching.bias_signals[]`
generated by the drafting model, which chooses which two or three to emit. **There is no ranking rule at
either end.**

**User consequence.** "One contextual next move" implies *the* move. Neither system can support that
claim today. A team could reasonably infer the system has judged this the most important thing to examine.

**Remedy.** Either (a) state the weaker true claim — *a* relevant next move — or (b) build a selection
rule and expose it under *"Why this suggestion?"*, which v2 already provides as an affordance. **The
affordance exists and is currently answering a question the system cannot fully answer.**

### C · It is not a graph — REASONED RISK, and the largest one

**Evidence.** The v2 view is a card grid: no edges, no factor nodes, no routing space, no zoom. The
inspector occupies roughly 40% of the width. Both `START-HERE.md` and the v2 notes disclose this.

**User consequence.** Every density, legibility and context judgement in this package — including the type
scale — is made on a layout the product does not have. The real canvas has curved edges, factor nodes
below the options, and edge labels competing for the same space.

**Remedy.** Re-test with six options, their factors, real edges and the baseline present, at production
zoom. **Until then, do not settle the type scale**; it is the decision most likely to be wrong for the
wrong reason.

⭐ **And one finding from the production derivation that changes what the graph can honestly show:**
PLoT deletes every option node **and every edge incident to it** before inference. **Edges drawn from an
option carry zero analytical weight.** A design that draws them as though they participate in the
computation is making a claim the engine does not support.

### D · The `4 → 6` display is correct in v2 and must not be "improved" later — REASONED RISK

**Evidence (derived, five repos + five live captures, contrast controls fired).** All 55 live interventions
carry exactly five keys, with `unit`, `raw_value`, `display_value` and `value_type` at **zero**. Of 34
factor nodes, 3 carry a unit; the intersection of *factors with a unit* and *factors any option moves* is
**empty**. Across ten payloads the only units seen are `'scale'` (a placeholder the UI already suppresses)
and `'£'`. **Zero count units.**

**Remedy.** None needed in v2 — its *before-value unavailable* and *unit unavailable* states are exactly
right. **The risk is downstream**: an implementer seeing the hero card may restore the assumption. Pin the
degraded states as the default and the real-unit display as the exception.

### E · `intervention_details.display_value` is wrong on the deployed product — OBSERVED DEFECT (product, not design)

**Evidence.** Across 70 entries in five live captures, the display string is **identical for a given factor
across every option**. Of the 45 with a parseable number, **45 of 45 equal the factor's observed value** and
**19 contradict the option's own normalised value**. One option with normalised value `1` displays
**"Low (0)"**.

**User consequence.** **This is precisely the field a before/after design would render.** CEE's own source
documents the defect and carries a fix, so either the deployed build predates it or another rung supplies
the borrowed string. **Not verified which** — I did not query the deployment for its SHA.

**Remedy.** Determine which, and fix, before any design consumes the field.

### F · A contract-versus-wire divergence that would mislead an implementer — OBSERVED

The shared contract declares bias signals `.strict()` with a four-value type enum. The live wire carries a
`target` field on **12 of 12** signals (three naming an option), types outside the enum, and eight action
types where four are legal — **8 of 32 live coaching items carry a value the contract rejects.**

Separately, a UI comment asserts in prose that *"real signals carry only type and detail and never a
target."* **Refuted: all twelve carry one.** The code beside that comment handles targets correctly; only
the doctrine sentence is wrong. **A designer reading it would conclude an option-grounded coaching card is
impossible. It is not** — the contract's target enum already includes `option`, and the UI adapter already
carries it through.

---

## 4. Retain, remove, change

**Retain — these are the package's real contributions.**

- **The honest-state family.** Six states, each preventing a specific wrong conclusion. This is the best
  thing in either version and it should survive any visual revision.
- **Withdrawing a stale number rather than badging it.** Stronger than the design notes claim.
- **Refusing to invent an outcome range** when only a probability was supplied.
- **Coaching completion.** A followed-through prompt does not recur and offers a different question.
- **Variation semantics** — no inherited numbers, lineage retained, unverified assumptions disclosed
  before adding, and a *different mechanism* rather than a different parameter.
- **The empty-coaching state.** "No useful coaching now" is a legitimate state and the easiest thing to
  lose in implementation.
- **The co-authored provenance state** — *"An origin suggestion · edited by you"*. Neither the adversarial
  review nor my own design proposed this; it is a genuine third case between AI-generated and
  human-authored, and it matters for the "humans remain the authors" principle.

**Change.**

- **The illustrative provenance register → the ratified module.** Production has a three-way glyph system
  behind a **total function** over the provenance kinds, with an explicit rule that a glyph is never
  chosen at a call site. Reuse it rather than a parallel vocabulary.
- **"One contextual next move" → "a relevant next move"**, until a selection rule exists.
- **The type scale** should be confirmed against the ratified canvas tokens rather than proposed
  independently. v2 is now 12px-dominant, which is already inside the ratified range — this is a reuse,
  not an amendment.

**Remove.** Nothing. I found no component in v2 that fails the "helps someone understand, compare,
contribute or act, or prevents a consequential misunderstanding" test.

**Leave unresolved, deliberately.**

- Whether any of this improves thinking. **Untested hypothesis**, and the package is right to say so.
- The connected-graph layout.
- Whether the option family needs a shape for archetypes the contract cannot represent (§5).

---

## 5. Design-system implications

**Reuse, already ratified:** the option entity pair (`#AAA7E4` border on `#DDDCF5` fill, canvas only) ·
the three provenance glyphs behind their total function · Lucide at 14px for a canvas node badge with
mandatory tooltips · the canvas type tokens · the two-persistent-affordance budget.

**Conflicts requiring a semantic decision — and three were ruled today, outside this review.**
Border *style* is contested between confidence levels and controllability; that conflict was live in the
code, not merely in documentation. Status glyphs must stay neutral rather than semantic, for a measured
contrast reason recorded in the design system. Those rulings are landing separately; **this review does not
re-open them, and v2 does not depend on them.**

**Genuinely new patterns this component requires:**

| Pattern | State |
|---|---|
| **Edit versus challenge** | No design-system coverage. **The central mechanism of the whole proposal.** |
| Private versus revealed contribution | No coverage. Substantial source exists in the product's collaboration modules **with tests** — but a prior audit measured collaboration as unreachable behind absent flags. **Source presence is not reachability; check before designing around it.** |
| Stale-after-edit on the canvas | No coverage, and product freshness has previously misreported in both directions. |
| An empty slot that reads as an invitation | No coverage. |
| Attribution of a named position on a node | No coverage; avatars are specified for the conversation panel, not for canvas nodes. |

**Do not silently approve** the illustrative palette, the proposed spacing, or any new colour ruling from
this package. The design notes are explicit that they are proposals, and that is correct.

---

## 6. A staged route, with dependencies and proof gaps

**Stage 0 — free, and owed regardless.** Label the comparative figure so it names its comparator and
target. Reuse the ratified provenance glyphs. Confirm the type scale against the tokens. **No new
capability, no persistence, no design-system amendment.**

**Stage 1 — the single dependency that unlocks five components.** A human contribution must be **saveable
and survive reload**. Conditions, costs, reversibility, review points and named positions all rest on this
one piece of plumbing, and none of them work without it however good the card looks. **Proof gap:**
whether the existing collaboration modules are ordinarily reachable — **not verified.**

**Stage 2 — wiring that already has a producer.** Option-targeted coaching is **mostly wiring**: the
contract's target enum includes `option`, `priority_rank` is required, the action enum already carries
`run_pre_mortem`, `run_devils_advocacy`, `run_outside_view` and `compare_options`, and live signals already
name options. **What is missing is only the selection rule.**

**Stage 3 — genuinely new.** The representation family and its selector. The outcome-range display, whose
quantity **neither this package nor I have defined** — and which must not be assumed to be the schema's
`strength_std` or `exists_probability`, since those describe model assumptions rather than an outcome
distribution.

**Constraints that bound the vision permanently — these are not "not yet".** An option **cannot express
time**; there is no field for when, anywhere. An option's **identity is its intervention vector**, so two
options differing entirely in narrative but coinciding numerically are deduplicated as the same option.
An option **cannot add or remove nodes or edges**. Nominal categorical levers are refused downstream by
design. **A design that offers a timing option or a composition option is offering something the engine
will discard.** Those either change at the contract, or the vision should say plainly that they belong to
a different node type.

---

## 7. Limitations of this review

- **Witnessed:** the interactions in §2, in one browser at 1280×720 and 375×812.
- **Not witnessed:** private-contribution save-and-reveal (the pane was hidden and paint-dependent actions
  could not complete); dark rendering (local documents render light in this pane); keyboard traversal
  beyond the controls I activated; v1 was **not** driven — I compared it by source and notes only.
- **Not verified:** current deployment SHA; open-PR state; any two-person journey; whether the
  collaboration modules are reachable by an ordinary user.
- **Derived rather than witnessed:** all production-contract findings come from source at named commits
  plus five live draft-graph captures. **No analysis run was captured**, so post-analysis behaviour rests
  on producer bytes, not a wire witness.
- **This review establishes readability and functioning interactions. It establishes nothing about
  improved thinking.** That remains a hypothesis, and the package is right to hold it as one.

---

# ADDENDUM — 8 Sep 2026. Two of this review's own recommendations are corrected here.

Append-only. The sections above are left exactly as filed; this addendum says which of their claims no
longer stand and why. **Recommendations 1, 2 and 7 are superseded by what follows.**

## 8 · Recommendations 1 and 2 are WITHDRAWN — the selection rule cannot be specified, because there is nothing to select on

**What they said.** R1 *"Specify the representation-selection rule"* and R2 *"Specify the coaching-selection
rule"*, with the proposed mechanism being *selection on the shape of the intervention set, with an authored
override*.

**Why that is wrong.** The archetype derivation this review rests on establishes that an option at the
engine is three fields — `id`, `label`, `interventions: Dict[str, float]` — and that **no option type
discriminator exists anywhere** (swept across three codebases; contrast controls fired at `is_baseline` 610
and `interventions` 4,323). The only two axes are `is_baseline` (a boolean) and `status` (a *readiness*
axis, not a kind axis). **"The shape of the intervention set" therefore has almost no shape**: a flat
factor→number map with no ordering, no conditions and no time. It cannot distinguish a hire from a pilot
from a schedule, because at the engine those are the same object.

**What replaces them.** **One consistent option card, plus one special case.** The card shows the label
(where all the human meaning already lives, and it is free), which factors the option moves and to what
levels, its result if one exists, its provenance, and the honest states when those are absent. The single
special case is `is_baseline` — real data, a genuine discriminator, present in every model.

The variety the v2 prototype achieves should come from **what the team writes**, not from a template the
system picks. A pilot should read as a pilot because someone wrote *"try two weeks with one team, then
review"* — not because the system detected pilot-ness. That is the more honest design, because the system
genuinely does not know what kind of move this is, and a chosen template is a claim it cannot support.

**v2's six cards remain valuable — as stress cases, not as a rendering taxonomy.** They establish what
teams need to *express*. The conclusion to draw is that the authored text must carry that expressiveness,
not that the renderer needs six branches.

### 8.1 · Assessment of the revised proposal (C, 8 Sep)

The revision concedes the defect honestly and contributes one correct generalisation, which is adopted
above: *the same quantity pattern could represent staffing, prices, capacity or time — we would not build a
template per subject.* Three problems remain.

**(a) Three of its four triggers are not unproven; they are unfeedable.** Unproven means untested.
Unfeedable means the input does not exist, and the two call for different responses — test, or drop.

| Trigger | State at the contract |
|---|---|
| Before/after quantity with matching units | **Measured absent.** All 55 live interventions carry `unit`, `raw_value`, `display_value`, `value_type` at zero. Of 34 factor nodes, 3 carry a unit — and the intersection of *factors with a unit* and *factors any option moves* is **empty**. Zero count units. (§3 finding D.) |
| Explicit stages and conditions | **No field exists.** Flat map: no order, no conditions, no time. |
| Comparable modelled outcomes | **Real.** Analysis results exist. The one genuinely data-driven trigger. |
| Qualitative / incomplete | The card itself, not a representation choice. |

Applied to today's data the proposal yields **one card plus a comparison view** — i.e. §8's recommendation,
described as a larger system than it is.

**(b) Its step 1 renames the problem rather than removing it.** *"Identifies the intended change,
commitments, assumptions and possible consequences"* is classification without the word. The system still
has to be right about something it cannot check.

**(c) "Relevance determines prominence" introduces a second unproven judgement to arbitrate the first** —
two places to be wrong, neither checkable by the team. The cost specific to Olumi is that it makes the card
**non-deterministic**: a node that changes shape as the model's relevance opinion shifts destroys the
spatial memory a team builds over a *shared living model*, which is the premise the product rests on.

## 9 · Recommendation 7 is DOWNGRADED — finding E names a field that exists in two disjoint forms

**What it said.** R7 *"Fix `intervention_details.display_value` before any design consumes it"*, on finding
E's evidence: across 70 entries in five live captures, 45/45 parseable numbers equalled the factor's
observed value and 19 contradicted the option's own normalised value.

**What was measured on 8 Sep.**

1. **The deploy-lag hypothesis is REFUTED.** Finding E offered two explanations and verified neither.
   Deployed CEE staging is `dcff3c5` (`/healthz`, v1.12.0) and `repos/.../compare/dcff3c5...staging`
   returns **`status=identical`, `ahead_by=0`**. The deployed build does not predate anything.

2. **There are TWO `intervention_details`, with disjoint required fields.** This estate's signature defect
   — one name, two questions.

   | Carrier | Declared at | Required fields |
   |---|---|---|
   | **A · post-analysis** (`analysis_ready.options[]`) | `src/schemas/analysis-ready.ts:123` | `display_value`, `normalised_value` (+ `raw_value?`, `unit?`) |
   | **B · draft rung** (`option.data`) | `src/cee/transforms/schema-v2.ts:67` | `raw_value`, `source`, `reasoning` — **no display string at all** |

   There is also a **third** site for the same string: the rich union form inside `interventions` itself
   (`analysis-ready.ts:100-108`, `{value, source?, display_value?}`). **Finding E names none of the three.**

3. **The defect does not reproduce in either Carrier-A population reachable today.** CEE's own live capture
   `c2-context-response-20260907T203538Z.json` shows `normalised 1 → "Very high (1)"` and
   `normalised 0 → "Low (0)"` — correct. All five UI starter graphs: **53/53 parseable display strings
   agree with their normalised value, 0 contradictions**, and **16 of 20 factor/file pairs vary across
   options** as they should (control: 5 files, 19 options, 53 strings — all non-zero).

**Status. Finding E is NOT refuted — and it is NOT actionable as written.** Its corpus was *five live
draft-graph captures*, and `display_value` does not exist on the draft carrier at all, so the finding
either measured Carrier A inside those responses or the third site. I no longer hold those captures, so I
cannot say which, and **an absence claim about the other populations is not a refutation of a finding whose
own population I did not re-reach.**

**Revised R7: re-derive finding E with its carrier named, before anyone fixes anything.** As written it
would send an implementer to a field that is correct in the only places they can see, and the two candidate
fixes are in different services. The corpus must state which of the three sites it measured.

**Unchanged and still owed regardless:** no design should consume any of the three until this is settled —
which is finding D's conclusion arrived at from the other direction.

### Instrument notes (this addendum's own failures, both caught by controls)

- A `grep --include=*.ts` was **globbed by zsh** and returned no matches; the contrast control read 0 and
  exposed it. Quoting fixed it.
- The first starter sweep found **zero option nodes** — the walker guessed the shape; options live at
  `analysis_ready.options`, not on graph nodes. Caught because the *control* (hit count) read zero, not
  because the result looked wrong. A zero with no control is not a measurement.
