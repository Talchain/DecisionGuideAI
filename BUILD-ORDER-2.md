# Canvas GRAPH — ranked build order, **replacement #2**

**Derivation only. No product code changed. Nothing executed.**

- **Tree:** fresh blobless clone of `Talchain/DecisionGuideAI` `staging` at `/private/tmp/dgai-triage2-a7f3`
- **Head, read not constructed:** `4b9a8fb548d3526706e1268753e9188202ea99c9`, 2026-09-18 16:38:23 +0100,
  *"Carry the analysis to the recipient of a shared link (#1680)"*
- **Instrument: reading code, and `git merge-tree`. That is all.** No install, no vitest, no playwright,
  no `tsc`, no eslint, no browser, no product API call. Nothing below is a test result, a runtime
  observation, or a claim about the deployed flag posture. Specs are read as **evidence of intended
  behaviour**, never executed.
- **Supersedes `BUILD-ORDER.md`** (branch `canvas/build-order-triage`, derived at `eb7211d7`).
- **Scope:** node cards, edges, canvas inspector. The Model tab is out of scope and nothing here touches it.

---

## ⚠⚠ READ FIRST — THE TREE BARELY MOVED. THE QUEUE MOVED ENORMOUSLY.

**Exactly ONE commit merged since the previous triage** (`eb7211d7..4b9a8fb5` = 1 commit, #1680).
So every *byte-level* verdict in `BUILD-ORDER.md` is still true of the tree — and **almost all of them
are now the wrong answer**, because twelve PRs opened in the same window and six of them close items
that triage ranked as open.

**A naive check of `staging` reports TEN items open that are already built.** That is the single
most expensive mistake available here, and it is the reason this file exists.

| Previous rank | Item | State now | Verdict |
|---|---|---|---|
| **A1** | Edge panel paints an uncertainty nobody stated (`σ = 0.15`) | **BUILT — PR #1700** | ⛔ do not dispatch |
| **A2** | `weight ?? 0.5` lights a band pill with `aria-pressed="true"` | **BUILT — PR #1700** | ⛔ do not dispatch |
| **A3** | Two strength vocabularies disagreeing on one number | **BUILT — PR #1699** | ⛔ do not dispatch |
| **B2** | Thinking prompts below the touch floor | **BUILT — PR #1698** | ⛔ do not dispatch; **the ruling it waited on is moot** |
| **B6** | Edge stroke merges the two weakest bands | **BUILT — PR #1699** | ⛔ do not dispatch |
| **C1** | `value ± std` and the band-span disclosure | **BUILT — PR #1700** | ⛔ do not dispatch |
| — | Rank badge carries a word | still queued **#1688** | ⛔ do not dispatch |
| — | Influence caption reads as a ranking | still queued **#1689** | ⛔ do not dispatch |
| — | Absences are not one thing | still queued **#1690** | ⛔ do not dispatch |
| — | Unassessed edge drawn as established | still queued **#1695** | ⛔ do not dispatch |
| — | Provenance: two facts, two marks | still queued **#1683** | ⛔ do not dispatch |
| — | Prior range's false save promise | **NEW, built — #1691** | ⛔ do not dispatch |

PR head SHAs read from the API at derivation time, never constructed:
`#1683 7dce79f3f8b63dda717aee9b22f0b69169da5b31` · `#1688 4f466ed591a05e035dacbbb36df9d7aa2e5a5b30` ·
`#1689 2a433f99fb0fcad8acfa0e56543b4e330db65775` · `#1690 877663b5541614dde4631b53124c3c3709530802` ·
`#1691 a49856bf6919d060b73d4fd176cd435ef4c2cba6` · `#1692 7885598089a3ac5404393735b91e3fbb5e74aaa5` ·
`#1693 dc19c9165c749d18a7e0092a0a772d138d72e879` · `#1695 6e4ce7d790fe98547c405bc1b09133ca5182d5c1` ·
`#1696 d009079b9907319150d5ffe7159cbbcb5d5429f5` · `#1697 99cd2add1ecfafeac1211394f22d022d677df72b` ·
`#1698 45d7f198595041ae62b10ad608855b9a6597b32b` · `#1699 373e6e039b145a0179c9c66eb35a3a5883cad598` ·
`#1700 9a370ea830f5b80ec98ecfdf14b39647a81270e0` · `#1701 f069c927a4d19d71a846cbd02614a47e088e36b6`

---

## ⛔⛔ THE HIGHEST-VALUE FINDING: THIS LANE'S OWN PRs CONFLICT WITH EACH OTHER IN FOUR PLACES

**Measured, not inferred** — `git merge-tree --write-tree` on the fetched PR heads above:

| Pair | File | Nature |
|---|---|---|
| **#1699 × #1700** | `src/canvas/domain/vocabulary.ts` | ⛔⛔ **Both add a canonical band table to the same file, under different names** — `CANVAS_STRENGTH_BANDS` vs `STRENGTH_BAND_LADDER`. |
| **#1695 × #1699** | `src/canvas/utils/graphDisplayCalculations.ts` | Both rewrite the stroke-band object — #1695 on the dash channel, #1699 adding a fourth rung. |
| **#1688 × #1690** | `src/canvas/nodes/BaseNode.tsx` | Adjacent edits to the corner-stack / badge region. |
| **#1688 × #1699** | `src/canvas/components/__tests__/CanvasLegendPopover.spec.tsx` | Both rewrite the legend spec. |

**The first one is not a merge chore — it is the very defect #1699 exists to remove, re-created one
merge later.** Two canonical tables in one file is exactly *"the same connection called two different
strengths"* at the source level. #1699 anticipated this and shipped a runtime guard
(`src/canvas/__tests__/oneStrengthVocabulary.spec.ts`) that REDs if a second `{ label, min, … }`
array appears in that module — so **"resolve by keeping both" fails loudly instead of merging
quietly.** #1700's own body already concedes the sequencing (*"SEQUENCED BEHIND #1699. Do not merge
this first."*). Good discipline on both sides; it still needs a human to do it in order.

### The merge order that resolves each conflict exactly once

```
1. Conflict-free, any order:   #1701, #1683, #1689, #1691, #1696, #1697, #1698
2. Then, each rebased on the previous:   #1690 → #1688 → #1695 → #1699 → #1700
```

Verified conflict-free against each other in the same sweep: `1690×1699`, `1688×1696`, `1690×1696`,
`1686×1700`, `1691×1692`, `1689×1693`, `1628×1689`, and `1497×{1688,1690,1696,1697}`.
**#1497 is another lane's** (`model-credibility/factor-label-needs-name`) and collides with nothing
here — note the overlap, do not claim the work.

---

## NOT DISPATCHABLE — BLOCKED ON A PRODUCER OR A RULING (built, must **not** merge yet)

These are the ones where dispatching a seat is worse than useless, because the code exists and the
thing standing in its way is not code.

| PR | What it unlocks | What blocks it |
|---|---|---|
| **#1692** (draft) | A team states **in its own hand** how strongly one thing drives another. *Edge strength IS the causal claim* — the most valuable unlock on the graph by the founder's own filter. | CEE refuses the write unless `CEE_V5_GRAPH_CAS_RPC = enforce`. The **code default is `shadow`** ⇒ `reader_only_refusal`. The code default is **not** the deployed posture (trap 18). Unmeasured here — this lane is barred from driving anything. |
| **#1693** (draft) | A factor card shows how firm its number is. | Likely **DARK on today's data**: `observed_state.std` appears **0 times** across 20 observed-state-bearing nodes in all five starter drafts (author's structural sweep; contrast `edges[].strength.std` = 163 in the same sweep). Correct and inert is chronic failure #1. |
| **#1696** | A node can say it was **kept in the model and left out of the calculation** — a fact only the producer holds. | Reads `analysis_participation`, declared by **CEE PR #1581**. If that has not deployed, this ships dark. Not measurable from this repo. |

---

## STILL DISPATCHABLE — ranked by the founder's filter

> *Does the product currently state something FALSE? Then: does this help a team see what they do not know?*

### 1 · An outcome card cannot say how many options act on it — **S, no dependency, dispatch now**

**CONFIRMED OPEN.** Target sweep `rg -a -i 'options act|optionsTargeting|inboundOptions|acting on this|optionsActing'`
over `src/canvas/nodes/` → **0**. **Contrast control, same sweep:** `useNodeConnections|inboundConnections`
→ **21 hits**, so the probe sees. `OutcomeNode.tsx` already computes `inboundConnections`; today it drives
only a post-analysis *"Depends on:"* list, unfiltered by node kind and absent pre-analysis.
**No open PR touches `OutcomeNode.tsx`** (checked against all 28 open PRs' file lists).

*Why it ranks first:* **"Three of your options move this"** is the one honest, useful, derivable-today
sentence an outcome card can say, it needs no producer change, and it is precisely *seeing what you do
not know* — a team that discovers only one option touches its main outcome has learned something.

### 2 · A decision card states its option count only when zoomed out — **S, no dependency**

**CONFIRMED OPEN, and traced to the render.** `DecisionNode.tsx:846-851` sends `optionCount` to
`lodMetric` and nowhere else on the card face. `BaseNode.tsx:429` — `if (!bodyReduced) return null` —
so that line renders **only** when the body is reduced. `bodyReduced = lodBodyHidden || (lensDetailActive
&& isLensDimmed)` (`:336`). At the zoom people actually work at, the count is not on the card.
⚠ **#1690 does NOT close this** — re-verified at its diff: its only `DecisionNode` change is
`noOptionsLine: 'No options linked yet'` → `STRUCTURAL_UNSET.noOptions`, a same-value reference swap.

*Why:* on the anchor card of every model, how many alternatives are in play is hidden.

### 3 · Claims are shortened in JavaScript and recover only on hover — **M**

**CONFIRMED OPEN, unchanged.** `OptionNode.tsx:303` and `:754` shorten via
`compactFactorLabel(…, NODE_ROW_LABEL_MAX_CHARS)`; recovery is `fullLabel` on **hover** and
`BaseNode.tsx:1638` `title={label}`. The file's own comment at `OptionNode.tsx:183` states the hazard:
the elided words are *"present NOWHERE in the DOM"*. **No open PR closes it** — #1697 touches
`OptionNode.tsx` for not-analysed copy, not for label recovery.

*Why:* the elided part is the **subject of the causal claim**, and a touch user cannot hover to get it
back. You cannot argue with a claim you cannot read.
⚠ Do not widen the e2e clipping guard to cover JS shortening before deciding the recovery surface —
`e2e/visual/nodeTextClipping.visual.spec.ts:28-32` is *right* that rendering and content are different
questions, and the founder's measured clips sit inside its declared blind spot.
⚠ Overlaps another lane: **#1497** flags a factor whose name is a sentence. Different remedy, same
symptom. Coordinate; do not duplicate.

### 4 · ⭐ NEW — three more authority keys are unenforced, and #1691 proved one of them was lying — **M, PLAUSIBLE**

`CANONICAL_EDIT_AUTHORITY` is a **presentation** authority answering *"may this control LOOK LIKE a
shared-model edit?"* — its own header says so, and says an unconsumed key is **UNENFORCED POLICY, not
dead policy**. #1691 took exactly one such key (`priorRangeJudgement`, 0 consumers) and found the panel
beside it telling users the range *"saves to the shared model"* when no graph write exists.

**Measured here, same method:** consumers outside `mutationAuthority.ts` and its specs —
`priorRangeJudgement` **0** (being fixed by #1691) · `canvasEdgeStrength` **0** ·
`canvasFactorConfirmation` **0** · `inspectorSemanticControls` **0**.
**Contrast control, same sweep:** `canvasNodeAddWithServerHash` **3**, `modelFactorValue` **1** — non-zero,
so the probe discriminates.

**PLAUSIBLE, not confirmed.** I have shown the policy is unenforced for three more keys; I have **not**
traced each to a control on screen and read its copy. That tracing is the work. Two of the three
concern **edge strength and factor confirmation** — the two gestures by which a team authors its own
reasoning rather than accepting the model's — so if the copy lies there, it lies in the worst place.
⚠ Sequence **after** #1692's ruling: that PR changes what is true about `edge_strength_edit`.

### 5 · No card says *why* it is thin — **M, sequence behind the queue**

**PARTIALLY CLOSED BY THE QUEUE, and that is the point.** Staging target sweep
(`nothing recorded|no values set|little recorded|model holds` over `src/canvas/nodes/`) now hits
`DecisionNode.tsx` and `GoalNode.tsx`; contrast `METRIC_UNSET|STRUCTURAL_UNSET` → **11 files**.
#1690 makes the absence *specific*, #1697 separates *"not analysed"* from *"analysed and absent"*,
#1696 adds *"kept in the model, left out of the calculation"*.
**What remains is the other half: what to add NEXT.** Build it on that merged vocabulary, not beside it.

### 6 · Nothing arbitrates which surfaces may cover the board at once — **L, needs a precedence ruling**

**CONFIRMED OPEN.** Target `overlayArbitr|surfaceArbitr|exclusiveSurface|activeOverlayStore` over
`src/canvas` → **0 files**. **Contrast:** `zIndex|z-[` → **149 files**, each choosing its own layer.
Real absence with no owner. No open PR touches it. Cross-cutting; do not start without the ruling.

### 7 · The contrast guard exempts on `aria-hidden`, not on text-recoverability — **guard-side**

**CONFIRMED OPEN.** `nodeSystem.semanticColourOnText.spec.ts:318` and `:377`. **No user-visible
consequence** — it goes here rather than higher for exactly that reason. Credit where due: `:325-331`
already asserts the exemption count is non-zero, which is the right shape; only the predicate is wrong.

### 8 · Stale docblock in `directionStroke.ts` — **doc-only, zero user harm**

`src/canvas/edges/directionStroke.ts:11` and `:78` still read *"the +/− glyph is the second cue; these
hues are the primary"*, while the product's conclusion is the opposite and the glyph carries direction.
Trap 14 — a false label teaches the next session the wrong thing. **Five minutes, no product change.**

### ⛔ WITHDRAW · *"At rest the board is quiet"*

`edgeLabelVisibility.ts:35` returns `true` for `isTopStrengthEdge`; `:54` `PERSISTENT_LABEL_LIMIT = 3`.
The code carries a **measured counter-rationale** (`:58-70`): a tried `LEADER_PENALTY` cut worst-case
displacement 252→144 but took label-on-label overlaps 2→3. **This item would REMOVE information from
the board**, which cuts against the product's purpose. It is a design disagreement, not a defect.
Withdrawn rather than deferred, so nobody re-proposes it.

---

## FOUNDER / CORE QUESTIONS — one line each, answerable yes/no

1. **Is `CEE_V5_GRAPH_CAS_RPC` set to `enforce` on deployed CEE staging?**
   *No ⇒ #1692 must not merge and the edge-strength pills stay honestly disabled. Yes ⇒ merge it; it is
   the biggest single unlock on the graph.* (Core can answer from the Render dashboard.)
2. **Has CEE #1581 (`analysis_participation` on NodeV3) deployed to staging?**
   *No ⇒ #1696 ships dark — hold it rather than merge it.*
3. **Is node-level `observed_state.std` near zero across Core's factor corpus?**
   *Yes ⇒ hold #1693; it is correct and inert, which is chronic failure #1.*
4. **#1699 and #1700 both add a canonical strength-band table to `vocabulary.ts`. Confirm #1699 merges
   first and #1700 rebases onto its table — rather than the two being reconciled by keeping both?**
   *This is the one decision that cannot be delegated to a rebase.*
5. ~~*Are the four thinking prompts fiddly to hit?*~~ **MOOT — do not ask it.** The previous triage held
   B2 for this ruling because the obvious fix (raising the row gap) makes every factor card taller.
   **#1698 did not do that**: it floors the *box* via `CANVAS_MIN_TARGET_BOX_STYLE` and leaves
   `gap-0.5` alone, so no card changes height. The question the hold existed for no longer arises.

---

## Scope and instrument notes — what this run could NOT see

- **Reading code and `git merge-tree` were the only instruments.** No execution of any kind. Every
  verdict is a bytes reading of one tree at one SHA plus the fetched PR heads listed above.
- **Flag posture was NOT derived.** An item marked open is open *in the source*; whether the deployed
  flags mount it is a separate question this run did not ask and must not be read as having answered.
- **Queued-PR verdicts rest on the PR head at read time**, not on a merge. If a PR is force-pushed or
  closed, re-derive before trusting any row above. The conflict table in particular is a property of
  those exact fourteen SHAs.
- **Item 4 is PLAUSIBLE, not CONFIRMED**, and is labelled so inline. Items 1, 2, 3, 6, 7 are CONFIRMED:
  producer traced to rendered output, or a real absence with a firing contrast control.
- ⚠ **One instrument failure, caught and disclosed.** My first probe for the stale direction docblock ran
  `sed` against `src/canvas/domain/directionStroke.ts` and found nothing — I could have recorded *"the
  file is gone, the item is closed"*. **The file is at `src/canvas/edges/directionStroke.ts`**; the
  previous triage cited it without a directory and I guessed the wrong one. Caught only by re-running as
  `git ls-files | rg -a -i 'directionStroke'` with a contrast control (`edgePresentation|cvdContrast` →
  4 files, so the probe could see). **Trap 20: an absence claim must name the artefact searched, and a
  guessed path is not the artefact.** Every absence claim above therefore carries its contrast control
  inline.
- **`BUILD-ORDER.md` on `canvas/build-order-triage` is now superseded by this file.** Its byte-level
  readings remain accurate; its *verdicts* are stale in ten places. Archive it rather than reconcile it.
