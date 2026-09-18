# Can a user adjust factor values before and after a run?

**A derivation. No product code changed — and the reason no code changed is the finding.**

Commissioned to unlock `preAnalysisFactorValue` and `postRunFactorValue`
(`src/canvas/mutations/mutationAuthority.ts:121,124`), both `'disabled'`, both reported by
the sibling derivation (`canvas/which-authorities-have-carriers`, `AUTHORITY-CARRIERS.md`)
as **CARRIER EXISTS — graph-class**.

The carrier finding is correct and I did not need to re-derive it. **Neither key should be
flipped**, for reasons the carrier question cannot see, because they are facts about the
*surfaces* rather than about the *carrier*.

Derived 18 Sep 2026 against `DecisionGuideAI` staging
`5824c05b4762d258b340464650daf70e8fa77c23`. Every file:line below was read at that tip.

---

## 0. Verdict

| Key | Carrier | Control on a live surface? | Surface | Verdict |
|---|---|---|---|---|
| `preAnalysisFactorValue` | yes (`factor_value_edit`) | control renders, **writes local-only** | **Analysis tab**, flag-OFF arm | **DO NOT FLIP** |
| `postRunFactorValue` | yes (`factor_value_edit`) | **no — callback withheld at the only live mount** | **Analysis tab** | **DO NOT FLIP** |

**And the thing worth leading with: the capability the direction asks for is already
shipped on both IN-SCOPE surfaces.** A user can adjust factor values today, and the edit
reaches CEE, in the **Inspector** and on the **Reasoning tab**. See §4.

---

## 1. Both keys gate ANALYSIS-TAB surfaces — the decisive scope fact

`OutputsDock.tsx` renders one tab branch per surface. Derived by indentation, because a
JSX conditional this long is easy to mis-attribute by eye:

```
3137  (indent 12)   {effectiveActiveTab === 'results' && (
3468  (indent 24)       <PreAnalysisPanelV3 …
3481  (indent 22)       <PreAnalysisPanel …          ← preAnalysisFactorValue
3768  (indent 18)       <ResultsBody …               ← postRunFactorValue
3852  (indent 12)   )}
3853  (indent 12)   {effectiveActiveTab === 'analysisNew' && (
```

Both target surfaces are nested strictly inside the `'results'` branch, which closes at
3852. The tab-id → label map settles what `'results'` is
(`canvas/components/workspaceShell/shellContract.ts`):

| id | label |
|---|---|
| `results` | **Analysis** (`:369`) |
| `analysisNew` | **Reasoning** (`:415`) |
| `diagnostics` | **Model** (`:461`) |

So `preAnalysisFactorValue` and `postRunFactorValue` both govern controls on the
**Analysis tab**. Paul's standing scope ruling is *Reasoning and Model only — ignore the
Analysis tab completely*. **Either key flipped would be work on a surface the programme
has ruled out of scope**, and neither would move the in-scope journey.

This is sufficient on its own. Each key also has a second, independent disqualification.

---

## 2. `postRunFactorValue` — there is no control behind it

The key gates one thing, at `TriageActionCardsBody.tsx:1156`:

```ts
POST_RUN_VALUE_EDIT_CONNECTED ? onSetValue : undefined
```

`onSetValue` arrives from `ResultsBody`'s `onSetFactorValue` prop
(`ResultsBody.tsx:91`, forwarded at `:176` → `:516`). **The only live mount of
`ResultsBody` never passes it.** `OutputsDock.tsx:3768` supplies 26 props (`:3769-3805`) and neither
mutation callback is among them, under a comment that says so deliberately (`:3764-3767`):

> B3 authority gate: post-run cards previously wrote only React-Flow state and then
> offered Rerun. Withholding both mutation callbacks removes those controls; the canonical
> factor transaction remains available in Model.

**Contrast-controlled sweep, same run, scope `src/canvas/components/OutputsDock.tsx`:**

| prop | hits |
|---|---|
| `onSetFactorValue=` | **0** ← target |
| `onConfirmFactor=` | **0** ← its withheld sibling |
| `onFocusNode=` | 2 ← contrast, fires |
| `onApplyThreshold=` | 1 ← contrast, fires |

Target zero beside two non-zero contrasts in the same sweep: a real absence, not a blind
probe. **So `POST_RUN_VALUE_EDIT_CONNECTED` is a gate on an expression that is `undefined`
either way. Flipping the key would change no behaviour whatsoever** while asserting that a
post-run surface offers a saved shared-model edit. That is precisely the "flipping a key
for show" the brief barred.

The act that *used* to live here has already been re-pointed, to Model tab v2
(`TriageActionCardsBody.tsx:334-345`, `setActiveOutputTab('diagnostics')`) — a working
destination, and also out of scope.

The second `onSetValue` consumer, `WorthInvestigating.tsx:132`, is **unmounted**: sweeping
`src/` for a render site of `WorthInvestigating` outside its own file returns only
comments and an unrelated `buildWorthInvestigatingIdSet` helper. No JSX call site exists.

---

## 3. `preAnalysisFactorValue` — the control is real, the handler is local-only, the panel is the flag-OFF arm

Unlike its post-run sibling, **this control genuinely exists**. `PreAnalysisPanel.tsx:1439`
attaches an inline `ScientificEditor` via `editorConfig`, gated on
`PRE_ANALYSIS_FACTOR_VALUE_CONNECTED` (`:670`), rendered at `:830` / `:864`.

**But its `onSave` reaches nothing durable.** `handleInlineEditValue`
(`PreAnalysisPanel.tsx:1246-1259`) is one local `updateNode` with
`source: 'user_override'` and **no `sendSystemEvent`**. So flipping the key alone produces
exactly the outcome the brief named as the one thing that must not happen: a control that
looks editable whose edit never reaches the model. The panel's own comment says so
(`:1307-1313`) and is accurate at this tip.

**And the panel is not the surface staging mounts.** It is the ELSE arm of
`isPreAnalysisV3Enabled()` (`OutputsDock.tsx:3461`), and `netlify.toml:209` bakes:

```
VITE_FEATURE_PRE_ANALYSIS_V3 = "1"
```

so a fresh staging user renders `PreAnalysisPanelV3`, never this panel. Stated narrowly
(the flag is a localStorage-overridable default, not a lock — `flags.ts:262-265`): this
surface is **reachable but not default**, so wiring it would be a real change that no fresh
user would see. Trap 3b.

**Wiring it is buildable** — `proposeFactorValue` is the template, and the V3 sibling shows
the correct gate shape, `V3_FACTOR_VALUE_CONNECTED && sendSystemEvent != null`
(`CalibrateDrillIn.tsx:247`), so a missing conversation context cannot present a local-only
write as a saved one. I did not build it: an out-of-scope tab and a non-default arm are two
reasons not to, and neither is mine to overrule.

---

## 4. What a user CAN already do — both in-scope surfaces, measured

**Inspector.** `factor-controllable` is in `AUTHORITY_OWNING_PANELS`
(`InspectorRouter.tsx:441`), so the blanket `<fieldset disabled>` no longer reaches it.
`FactorControllablePanel.tsx` commits through `buildFactorValueEditEvent` (`:287`) →
`sendSystemEvent` (`:360`) → CEE `factor_value_edit`, handled `'mutating'`. It fences only
its carrier-less writers, by name (`:478` description, `:929` advanced editor), and the
panel gets its own honest notice rather than the blanket one
(`InspectorRouter.tsx:519-521`).

Witnessed, not asserted — `FactorControllablePanel.valueEditEmitsTurn.spec.tsx`, **5/5
passed** at this tip, collected non-zero:

- emits a `factor_value_edit` system event on commit
- is ID-addressed — `target_id` is the node id, never the label
- carries the scale contract (`raw_value` = typed magnitude, `value` = model scale)
- NEGATIVE CONTROL: committing the same value emits nothing
- one turn per committed edit, not one per keystroke

**Reasoning tab.** `AnalysisNewTabBody` renders `ModelStrip` (`:74`) and
`DriverInfluenceChart` (`:67`), both committing via `useFactorValueCommit` →
`proposeFactorValue` → the same carrier, governed by `modelFactorValue: 'server_graph'`.

**Rung, stated honestly: TESTED + MOUNTED, 18 Sep 2026. Not wire-witnessed and not
journey-witnessed** — I did not drive the deployed product, so none of this is a claim
about a capture.

---

## 5. What I deliberately did not do

- **No key flipped.** Both would have been cosmetic or false; see §1–§3.
- **No new spec files** (barred). I ran four existing specs, all green, all collected
  non-zero (19 + 13 tests). I repaired none, because I broke none.
- **No product code changed**, so nothing here needs a mutation kit — there is no fix whose
  bite could be proved.
- **I did not re-derive the carrier question.** The sibling's §4 is correct and I checked
  the two claims I leaned on (`factor_value_edit` reached from `proposeFactorValue`; the
  V3 sibling genuinely emitting) rather than inheriting them.
- **I did not wire the legacy pre-analysis inline editor**, though it is buildable (§3).
  If the scope ruling changes, that is the shape of the change and `CalibrateDrillIn.tsx`
  is the template.
- **I did not open the Model tab question** — out of scope by the brief.

---

## 6. If one thing is taken from this

**The direction was "make the inspector editable so users can adjust the numbers", and the
Inspector is already editable for factor values — end to end, ID-addressed, with a negative
control pinning it.** The two keys commissioned here do not stand between a user and that
capability; they name controls on a tab the programme has ruled out of scope, one of which
has no control behind it at all.

The remaining honest gap on these two surfaces is the legacy pre-analysis inline editor
(§3) — and it is worth building only if the Analysis tab comes back into scope.
