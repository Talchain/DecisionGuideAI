# Which disabled authorities already have a carrier?

**A derivation. No product code changed.**

Derived 18 Sep 2026 against `DecisionGuideAI` staging
`5824c05b4762d258b340464650daf70e8fa77c23`, `olumi-assistants-service` (CEE) staging
`dda8f7fc16c1d7e2aaf99100362e9ba637ef8e91`, and the vendored contract
`@talchain/schemas@0.55.0` (`vendor/talchain-schemas-0.55.0.tgz`, the pin in
`package.json:116`).

Every file:line below was read at one of those three tips. Where a sentence already in
the tree disagrees with what I measured, I say so and give the measurement — I have not
edited any of them.

---

## 0. Verdict table

| # | Capability | Verdict | Carrier |
|---|---|---|---|
| 1 | `priorRangeJudgement` | **CARRIER EXISTS — fact-class** | `prior_range_edit` → CEE `fact_and_commit` |
| 2 | `modelFactorConfirmation` | **NO CARRIER** | — |
| 3 | `postRunFactorValue` | **CARRIER EXISTS — graph-class** | `factor_value_edit` → CEE `mutating` |
| 4 | `postRunFactorConfirmation` | **NO CARRIER** | — |
| 5 | `postRunAutoFix` | **NO CARRIER for the act as defined** | per-fix-type carriers exist for 4 of 6 |
| 6 | `preAnalysisFactorValue` | **CARRIER EXISTS — graph-class** | `factor_value_edit` → CEE `mutating` |
| 7 | `preAnalysisFactorConfirmation` | **NO CARRIER** | — |
| 8 | `preAnalysisEdgeStrength` | **CARRIER EXISTS — graph-class** | `edge_strength_edit` → CEE `mutating` |
| 9 | `preAnalysisV3FactorConfirmation` | **NO CARRIER** | — |
| 10 | `analysisAssumedEdgeStrength` | **CARRIER EXISTS — graph-class** | `edge_strength_edit` → CEE `mutating` |
| 11 | `canvasEdgeStrength` | **CARRIER EXISTS for the operation**; key names a surface with no control | `edge_strength_edit` |
| 12 | `canvasFactorConfirmation` | **NO CARRIER** | — |
| 13 | `goalSuccessTarget` | **CARRIER EXISTS — action-class**; key names local-only controls | `add_constraint` via `dispatchAction` |
| 14 | `canvasSemanticMutations` | **MIXED** — 12-member bundle, members differ | see §7 |
| 15 | `inspectorSemanticControls` | **MIXED / UNENFORCED** — zero code consumers | see §8 |

**Six of fifteen have a durable server-authoritative carrier and are disabled only
because no control on that surface reaches it.** Five have genuinely nothing to send the
edit to. Two are correctly-scoped keys sitting beside a carrier that serves a different
surface. Two are bundles that need splitting before the question can be answered at all.

---

## 1. What counts as a carrier

The decisive test is not "does the graph shape admit this value?" It is **"if the user
does this, does the edit survive CEE reloading its own persisted graph?"** Analysis is
UI → CEE → PLoT → ISL with CEE reloading `scenarios.graph`, so an edit that does not
reach that column is invisible to the next run, to collaborators, and to the same user on
another device.

Three carrier classes qualify. One tempting thing does not.

**GRAPH-CLASS** — a `SystemEventKind` whose CEE handling is `'mutating'`: it runs a real
mutation, writes `scenarios.graph`, and commits an `edit_graph` fact
(`cee/src/orchestrator-v5/system-events/dispatch.ts:310`). This is what `server_graph`
requires.

**FACT-CLASS** — CEE handling `'fact_and_commit'`: a typed handler fact on the turn row,
which the prior-facts loader reads from all prior turns, so it is downstream-visible
(`dispatch.ts:299-309`). Durable and server-authoritative, but **no graph write**. This is
what the `'server_fact'` member of `MutationAuthority` names — and **no key in
`CANONICAL_EDIT_AUTHORITY` currently uses it.**

**ACTION-CLASS** — `dispatchAction({ action_type })` into CEE's validated proposal/commit
path, e.g. `add_constraint`. Receipt-bearing; this is how `modelGoalMinimumTarget` earns
`server_graph` (`useModelEditAuthority.ts:447-471`).

**NOT A CARRIER — a local store write.** `useCanvasStore` + `saveAutosave` writes
`localStorage['olumi-canvas-autosave']` and nothing else. The Supabase half is shut at a
single choke point:

```
src/lib/clientGraphWritePolicy.ts:55
    export function clientCanWriteReadableGraph(): boolean { return false }
```

The client holds raw React Flow bytes, `scenarios.graph` is CEE's GraphV3 contract, and
there is no projector between them; writing the former returned HTTP 500
`scenario_read_failed` on every analyse turn (the 2026-08-13 P0, documented in that
file's header). `useScenario.ts:239` and `scenarioService.ts:216` both gate on it.

So a local write survives a reload **in that one browser** and reaches neither analysis
nor anybody else. `useConversation.ts:3362-3366` states this in the tree already: *"The
Supabase half is shut: `clientCanWriteReadableGraph()` is a hard `false`."*

### CEE's handling map, read in full

`dispatch.ts:312-407`. This is the authority on whether a kind has a writer.

| SystemEventKind | Handling | Graph write? |
|---|---|---|
| `factor_value_edit` | `mutating` | yes |
| `edge_strength_edit` | `mutating` | yes |
| `structural_delete` | `mutating` | yes |
| `structural_add` | `mutating` | yes |
| `structural_add_edge` | `mutating` | yes |
| `structural_rename` | `mutating` | yes |
| `option_intervention_edit` | `mutating` | yes |
| `prior_range_edit` | `fact_and_commit` | no — typed fact |
| `edge_adjudication` | `fact_and_commit` | no — typed fact |
| `feedback` | `fact_and_commit` | no — typed fact |
| `finding_dissent` | `fact_and_commit` | no — typed fact |
| `patch_accepted` / `patch_dismissed` / `direct_graph_edit` / `chip_click` | `ack_and_commit` | **no — turn row only, payload discarded** |
| `undo` / `redo` / `selection_change` | `client_only` | no |

`ack_and_commit` is worth naming, because it is the tempting cheap answer and CEE's own
comments record it as the defect twice: an ack writes a turn row and no graph, *"so the
next turn reloads a graph that still holds the deleted option and re-adds it"*
(`dispatch.ts:334-337`).

All five UI-side wire adapters exist and are live: `buildPayload.ts:435` (`factor_value_edit`),
`:446` (`prior_range_edit`), `:461` (`structural_add`), `:466` (`structural_add_edge`),
`:470` (`edge_strength_edit`).

---

## 2. `priorRangeJudgement` — CARRIER EXISTS (fact-class), and the control is now mounted

**Carrier.** `prior_range_edit`, present in `SystemEventKind`
(`schemas/dist/boundary/enums.d.ts:16`), adapted at `buildPayload.ts:910` and emitted at
`useInspectorMutations.ts:512`. CEE handles it `'fact_and_commit'` (`dispatch.ts:329`),
under the note that these kinds *"previously terminated in the browser (no wire shape
existed at all)"*.

**It is no longer fenced.** `factor-external` is in `AUTHORITY_OWNING_PANELS`
(`InspectorRouter.tsx:441`), so the blanket `<fieldset disabled>` no longer reaches it.
The router records the reason at `:409-417`: *"Built, wired, tested — and no user could
operate it, because the blanket wrap below inerted the whole pane."*

**⚠ The frozen contract for this key is stale.** `mutationAuthority.spec.ts:76` gives its
`requiredEvidence` as *"blanket Inspector fieldset disables the control; no pointer or
keyboard affordance executes"*. That is false at this tip. It goes unnoticed because
`requiredEvidence` is never executed — the spec asserts only
`expect(contract.requiredEvidence.length).toBeGreaterThan(0)` (`:205`). It is a
hand-maintained mirror inside the file that freezes the contract.

**⚠ But `server_graph` would be the wrong flip.** `prior_range_edit` writes no graph.
`FactorExternalPanel.tsx:571-575` already says so: *"`setPriorRange` updates the store and
emits `prior_range_edit`, which CEE persists as a typed turn FACT and which writes no
graph."* The honest value is `'server_fact'` — declared in the type union
(`mutationAuthority.ts:46`) and used by nothing.

**Not a contradiction to reconcile (trap 21).** The table answers *"may this control look
like a shared-model edit?"* — and a turn fact is not a shared-model edit, so `'disabled'`
is a defensible answer to *that* question. My question is *"is there a durable
server-authoritative carrier?"* and the answer is yes, of the fact class. Both stand.

---

## 3. The factor-confirmation family — NO CARRIER (four keys, one act)

`modelFactorConfirmation`, `postRunFactorConfirmation`, `preAnalysisFactorConfirmation`,
`preAnalysisV3FactorConfirmation`, `canvasFactorConfirmation`.

All five name one act. `useModelEditAuthority.ts:647-661`:

```ts
const proposeFactorConfirmation = useCallback((): LocalCommitOutcome => {
  ...
  mutations.setObservedSource('user_confirmed')
  return 'committed'
}, [activeNodeId, mutations])
```

A local store write. No `sendSystemEvent`. Three independent legs make this **NO CARRIER**,
and any one of them is sufficient:

1. **No event transports it.** `factor_value_edit` is `.strict()` with fields `kind`,
   `target_id`, `value` (required `z.ZodNumber`), `raw_value?`, `unit?`, `field?`,
   `applied_from?` (`turn-payload.d.ts:2253-2271`). There is **no `intent` and no `source`
   field**, and `.strict()` refuses an extra key. *Contrast control, same sweep:*
   `edge_strength_edit` **does** carry `intent: z.ZodEnum<["set","confirm_current"]>`
   (`turn-payload.d.ts:2030`) — so the probe can see an intent field where one exists.
2. **CEE has no writer that stamps it.** CEE's own measured census, with its own contrast
   controls (`brief_extraction` 25, `user_specified` 10), reports `user_confirmed` **0**
   assignment sites in `src/` (`cee/src/cee/transforms/provenance-display.ts:322`).
   `user_override` reads 6 and `panel_elicited` 1, so the sweep discriminates.
3. **The client cannot write the graph.** §1.

**⚠ CORRECTION TO A PREMISE IN THE TREE — measured, and it matters for the fix.**
`mutationAuthority.ts:107` and `ModelTabV2Panel.tsx:663` both give the reason as
`setObservedSource('user_confirmed')` being *"a LOCAL write that the server's own enum
cannot carry"*. **The enum carries it.** `OBSERVED_STATE_SOURCE_LITERALS` includes
`'user_confirmed'` (`schemas/dist/graph.d.ts:117`), and the contract documents it by the
exact gesture: `user_confirmed — "confirm as is"` (`graph.d.ts:97`). CEE reads and
classifies it throughout — `obligation-provenance.ts:149` maps it to `user_stated`,
`value-source-extraction-type.ts:121` to `explicit`, `not-modelled-manifest.ts:691` sets
it `true`.

The verdict does not change — it is still NO CARRIER — but the *reason* does, and a lane
acting on the written reason would fix the wrong thing. The shape is admitted and CEE
understands it; what is missing is **an event field to request it and a CEE writer to
stamp it**. The precedent for exactly that is one line away: `edge_strength_edit` with
`intent: 'confirm_current'`, which `mutationAuthority.ts:101-120` describes as CEE having
*"permission to stamp exactly two provenance fields"*, guarded by a provenance-only
full-graph diff. That is the smallest honest change, and it is a **CEE + schemas** change,
not a UI one.

Until then `'disabled'` is right for all five, and for a reason worth keeping: stamping
"confirmed by you" on a value that never reaches analysis would be the product asserting
something about the model that the model does not contain.

---

## 4. The factor-value keys — CARRIER EXISTS (graph-class)

`postRunFactorValue`, `preAnalysisFactorValue`.

**Carrier.** `factor_value_edit` → CEE `'mutating'` (`dispatch.ts:316`). Built and merged
in July (#513). Proven in use by three siblings already at `server_graph`:
`modelFactorValue`, `preAnalysisV3FactorValue`, and the Inspector's own
`factor-controllable` panel (`InspectorRouter.tsx:396-403`). Chain:
`useFactorValueCommit` → `proposeFactorValue` → `buildFactorValueEditEvent` →
`sendSystemEvent` → `buildPayload.ts:435` → CEE.

**Why they are disabled is a surface fact, not a carrier fact**, and the tree says so
plainly. `PreAnalysisPanel.tsx:1307-1313`:

> `preAnalysisFactorValue` governs the INLINE editor below (`handleInlineEditValue`),
> which does one local `updateNode` and emits nothing, so that gate is correct and is
> untouched.

Same for post-run at `TriageActionCardsBody.tsx:316-320`: `onSetValue` *"writes through a
path with no working writer"*.

**So: nobody plugged these two editors into the carrier.** Both surfaces have since been
re-pointed to navigate to the Inspector instead, which does reach it — a legitimate fix,
and it leaves the inline editors as the remaining gap. Wiring either to
`proposeFactorValue` is the same move `preAnalysisV3FactorValue` already made.

---

## 5. The edge-strength keys — CARRIER EXISTS (graph-class), and one premise has expired

`preAnalysisEdgeStrength`, `analysisAssumedEdgeStrength`, `canvasEdgeStrength`.

**Carrier.** `edge_strength_edit` → CEE `'mutating'` (`dispatch.ts:332`, *"0.42.0 Train C —
canonical writer"*). The full chain is named in `InspectorRouter.tsx:299-307`:
`buildEdgeStrengthEditEvent` → `sendSystemEvent` → `buildPayload.ts` `adaptEdgeStrengthEdit`
→ CEE's `dispatchEdgeStrengthEdit`. Already `server_graph` for
`modelEdgeStrengthConfirmation`.

**⚠ The reason recorded against `analysisAssumedEdgeStrength` has expired.**
`AnalysisHeroPanel.tsx:605-616` keeps the key disabled because its button pointed at
`openEdgeStrengthEditor`, and *"The Inspector CANNOT SAVE: `InspectorRouter` wraps every
panel in an unconditional `<fieldset disabled>`"*. At this tip the edge branch has **no
blanket fence at all** — `InspectorRouter.tsx:298-315`:

> ⭐⭐ NO BLANKET FENCE HERE ANY MORE, AND THAT IS THE CHANGE. [...] The whole chain behind
> it was already built and connected [...] The only thing missing was a user able to touch
> it.

`mutationAuthority.ts:155-165` records the same expiry against `canvasEdgeStrength` and
strikes it in place rather than deleting it.

**The user-visible consequence, and it is the most valuable thing in this report.**
`assumedStrengthCopy.ts:158-175` justifies shipping `ASSUMED_STRENGTH_ACTION = 'Ask Olumi
to set this strength'` on the grounds that *"There is no user-facing edge editor to route
to; there is no v2 edge surface."* That is false now. The panel calls this *"the product's
MOST PROMINENT intervention — zero clicks, panel top level, carrying the most specific
sentence Olumi produces"*, and it routes through a chat ask while a direct,
receipt-bearing strength control sits in the Inspector.

The copy is not a lie — it promises the ask and delivers the ask. But the user is being
sent the long way round for a reason that stopped holding, and for a reasoning tool the
short way round is the one where the human sets the number themselves.

**`canvasEdgeStrength` is different and should stay named apart (trap 21).** Its
`entrySurfaces` is `['canvas edge label']` and the label still writes nothing. The carrier
exists for the *operation*; this key names a *surface* that has no control on it. Flipping
it would license the label to present itself as a saved edit, which nothing made true.
It also has **zero non-test code consumers** (contrast in the same sweep:
`canvasNodeAddWithServerHash`, 4 files) — unenforced policy, so flipping it would change
no behaviour while asserting something false.

---

## 6. `postRunAutoFix` — NO CARRIER for the act as defined

`OutputsDock.tsx:1793-1823`: `handleAutoFix` → `executeAutoFix(params, nodes, edges)` →
`applyAutoFixChanges({ nodes, edges })`. A bulk local rewrite of arbitrary nodes and
edges. No wire event anywhere on the path.

Six fix types (`autoFix.ts:19-25`):

| Fix type | Carrier for the underlying edit |
|---|---|
| `add_factor`, `add_risk` | `structural_add` — `mutating` |
| `connect_orphan` | `structural_add_edge` — `mutating` |
| `clamp_strength` | `edge_strength_edit` — `mutating` |
| `remove_cycle` | `structural_delete` — `mutating` (composite in practice) |
| `normalize_probabilities` | **none** — rewrites every outgoing edge of a node atomically |

So four of six map cleanly onto carriers that exist. The capability as a whole does not,
for two reasons: `normalize_probabilities` is inherently multi-edge, and **there is no
batch or transaction carrier** — every `mutating` kind is single-element and settles
against its own receipt. An auto-fix that emitted N events would be N independent edits
with N chances to half-land, which is worse than the control staying disabled.

**Verdict: NO CARRIER** for "apply this fix atomically". A per-fix-type split (the move
already made for `add-node` in the context menu) would make four of them buildable.

---

## 7. `canvasSemanticMutations` — MIXED, a 12-member bundle

`LOCAL_SEMANTIC_CONTEXT_MENU_IDS` (`useMenuItems.ts:185-198`) is what this key gates, and
per-id judgement already exists at `menuIdIsAuthorised` (`:218-230`).

| Menu id | Carrier |
|---|---|
| `set-value` | **`factor_value_edit`** — `mutating` |
| `add-connected-factor` / `-outcome` / `-risk` | **`structural_add` + `structural_add_edge`** — both `mutating` |
| `duplicate` | **`structural_add` + `structural_add_edge`** |
| `paste` | **`structural_add` + `structural_add_edge`** |
| `cut` | **`structural_delete`** — `mutating` (delete half) |
| `insert-factor-between` | composite: `structural_add` + 2× `structural_add_edge` + `structural_delete` |
| `reverse-edge` | no single carrier — `edge_strength_edit.direction_intent` is effect sign, not endpoint swap |
| `mark-assumption` | **none** |
| `undo` / `redo` | **none** — CEE `client_only` by design |

**`mark-assumption` measured.** It writes `node.data.flagged_as_assumption`
(`useMenuItems.ts:757-767`). Absence sweep over `schemas@0.55.0` `dist/`:
`flagged_as_assumption` **0**, against contrast controls firing in the same sweep —
`exists_probability` 205, `observed_state` 302, and the bare term `assumption` 139 (all of
which resolve to coaching-side concepts: `challenge_assumption`, `critical_assumptions`,
`assumptions_ledger`, never a per-node boolean). Real absence, not a blind probe.

**⚠ A list in the tree is stale here.** `useMenuItems.ts:348-351` warns that flipping this
key would open *"FIVE CARRIERLESS IDS (paste, undo, redo, cut, duplicate)"*. Two of those
five now have carriers, and **CEE says so by name** — `dispatch.ts:362-366`:

> ⭐⭐ THIS ONE KIND CARRIES FOUR USER-FACING GESTURES [...] draw-a-link, the five "Add
> connected …" affordances, **duplicate, and paste**. The last three are gestures users
> ALREADY perform and already believe work — a duplicated subgraph reaches the server as
> nodes with no connections and returns having quietly lost its causal structure.

CEE built `structural_add_edge`'s writer (#1443, promoted to `mutating` 13 Sep 2026)
*explicitly* to carry duplicate and paste. The UI has not yet emitted for those two
gestures. That is the clearest "built but not plugged in" in this whole sweep — and CEE's
sentence names the harm precisely: a user duplicates a subgraph and silently loses its
causal structure, which on a reasoning tool is the loss of the reasoning.

**Verdict: MIXED.** Do not flip this key. Split it, the way `add-node` was split out to
`canvasNodeAddWithServerHash`, taking `set-value`, the three `add-connected-*`,
`duplicate` and `paste` first — those six have carriers today.

**⚠ One caveat on duplicate/paste, derived and not assumed.** `captureStructuralAddEdge`
stands down with `strength_not_stated` on any edge whose strength nobody set, because
`USER_EDGE_DEFAULTS.weight = 0.3` carries no provenance (`store.ts:1113-1120`,
`mutationAuthority.ts:91-95`). A duplicated edge inherits the original's provenance, so
duplicating a *stated* edge will carry and duplicating an *unstated* one will not. That is
correct behaviour, not a blocker, but it means the gesture is partial by construction and
the user has to be told which half happened.

---

## 8. `inspectorSemanticControls` — MIXED, and unenforced

`entrySurfaces: ['node Inspector', 'edge Inspector', 'technical editors']`,
`requiredEvidence: 'disabled fieldset plus one visible shared-model authority reason'`
(`mutationAuthority.spec.ts:186-187`).

**Zero non-test code consumers** — the only reference outside its own definition is the
spec (contrast: `canvasNodeAddWithServerHash`, 4 files). Per the file's own header this is
*unenforced policy, not dead policy*, and the two need opposite treatment.

Its stated evidence has expired for the same reason as §2 and §5: three node panel types
are exempt (`InspectorRouter.tsx:441`) and the edge branch has no blanket fence. The
controls it names now split three ways — strength and factor value reach carriers, prior
range reaches a fact carrier, and `setDescription`, existence probability and uncertainty
reach nothing and are fenced by their own panels. It cannot be answered as one key.

---

## 9. Cross-cutting: nine files still cite a fence that has moved

`InspectorRouter`'s blanket `<fieldset disabled>` is cited as a load-bearing premise in
**nine non-test source files**, and at this tip it exempts three panel types and does not
wrap the edge branch at all.

Complete manifest, swept `rg -a -i` over `src/` excluding `__tests__/` and `*.spec.*`,
contrast control `AUTHORITY_OWNING_PANELS` firing at 7 hits in the same sweep:

1. `src/index.css:677`, `:726`
2. `src/canvas/ui/inspector-v2/useInspectorMutations.ts:147`
3. `src/canvas/ui/inspector-v2/editors/EdgeAdvancedEditor.tsx:86`
4. `src/canvas/domain/analyticalNodeFields.ts:150`
5. `src/components/results/strengthElicitation/AssumedStrengthCard.tsx:32`
6. `src/components/results/strengthElicitation/assumedStrengthCopy.ts:161`
7. `src/components/results/TriageActionCardsBody.tsx:296`
8. `src/components/results/analysisNew/sections/OptionsComparison.tsx:110`
9. `src/components/results/analysis-hero/AnalysisHeroPanel.tsx:607`

Scope, stated narrowly: this is *nine files whose comments assert the blanket fence*. I
have **not** established that all nine reach a wrong user-visible outcome — I measured one
that does (§5, `assumedStrengthCopy.ts`, which routes the product's most prominent
intervention around a control that now works). The other eight are premises that need
re-deriving before anything is built on them, which is the cheapest thing on this list and
the one most likely to be skipped.

---

## 10. What I deliberately did not do

- **No product code changed.** This was commissioned as a derivation and I have kept it to
  one. Every stale premise above is reported where I found it, not edited.
- **No new spec files** (barred). I ran no focused specs either: this question is answered
  by reading the contract, the dispatch map and the call sites, and a green suite would
  not have discriminated any of it. Nothing below rests on a test run.
- **No flips proposed as safe without a surface check.** A carrier existing is necessary
  and not sufficient — the control still has to be built, fenced and told what to say when
  the carrier stands down.
- **I did not open the Model tab question** (out of scope). `modelFactorConfirmation`
  appears above only because it is the same act as the four canvas/pre-analysis
  confirmation keys and sharing the finding was cheaper than splitting it.
- **Not wire-witnessed.** Every claim here is CODE EXISTS or MOUNTED, derived at three
  pinned tips. I did not drive the deployed product, so no claim here is
  JOURNEY-WITNESSED, and the six "carrier exists" verdicts are claims about the code path,
  not about a capture.
- **`remove_cycle` and `insert-factor-between` I have marked composite rather than
  tracing them to a verdict** — both need a multi-event sequence and I did not derive
  whether the intermediate states are legal. Treat them as UNKNOWN rather than as the
  "carrier exists" I have claimed for the single-element gestures.

---

## 11. If one thing is picked up from this

`set-value`, the three `add-connected-*`, `duplicate` and `paste` have working,
receipt-bearing carriers today, and CEE built the edge writer *naming duplicate and paste
as the gestures it exists to serve*. They are dark behind one bundled key that already has
per-id machinery in place to split them.

The founder's test is whether a change helps a team think. A user who duplicates part of
their model and silently loses its causal structure has been made to think *less* clearly,
by a product that already has everything it needs to do better.
