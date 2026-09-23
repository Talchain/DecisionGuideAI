# Olumi Canvas — Final Design and Overnight Implementation Spec

**Status:** Experience Design lock · 22 September 2026  
**Scope:** Factor nodes, Option nodes, connectors and existing inspector/AI routing.  
**Goal:** High information density with low cognitive effort. The graph should answer, at a glance: **what is this, what matters, and why should I look here?**

## 1. Build principle

This is a **tidy-up of the current Canvas**, not a rebuild.

- Preserve the existing graph, focus/neighbourhood behaviour, floating panels and inspectors.
- Reuse existing analysis/coaching data and routes.
- Do not create new scientific scores, thresholds, confidence bands or behavioural detectors in the UI.
- Normal view is compact and useful. Detailed adds information, **not a bigger card**.
- Zoom controls visual density. Standard/Expert must not hide ordinary edit/coaching functionality.

---

## 2. Locked node anatomy

### Shared

- Node-type shape sits **large and centred above the node**, at the connection point.
- Shape carries node type; do not spend body space repeating type iconography.
- Target width: **Factor ~216px; Option ~232px**. Use judgement where content requires a small adjustment.
- Title: 13–14px.
- Primary value: **same visual scale as body/title**, not oversized.
- `Not set` / missing value is small and quiet, not the dominant content.
- Bottom rail is one consistent location for icons/actions.
- Persistent status/data icons render **only when informative**.
- Edit actions may appear on hover/focus in the same rail.
- Coaching is one consistent icon; hover explains the question, click opens AI with the element already in context.

### Attention cue — add

Add one quiet **Worth reviewing** marker, visually separate from the bottom icon rail.

It means: **Olumi has a grounded reason this element deserves attention.**

It may aggregate existing upstream reasons such as:

- top/key driver or high sensitivity;
- targeted high-value evidence gap;
- consequential/fragile relationship;
- high-severity targeted assumption;
- grounded behavioural finding mapped to the element;
- consequential Olumi-generated assumption **when combined with one of the reasons above**.

Rules:

- **AI-generated alone is not an attention trigger.** A fresh model may contain many AI-generated values.
- Do not duplicate an already-obvious explicit state such as `Not set` or `Analysis out of date`.
- Hover: list the specific reason(s), e.g. `Top driver · High-value evidence gap`.
- Click: select/focus the element and open the existing inspector. Do not create a new panel.
- UI may aggregate/rout existing signals; it must not invent a new importance score.

---

## 3. Factor node

### Normal — fresh analysis

Order:

1. **Title** — e.g. `Trial conversion`
2. **Value + human unit** — e.g. `8% · trials convert`
3. **Tiny relative driver visual**, when valid analysis exists
4. **One primary mini-visual**, when valid
5. Bottom icon rail

### Tiny driver visual — restore

Bring back influence/sensitivity visually, but **not** as `73% influence` or another absolute-looking percentage.

Display:

- `Driver #1 of 5`
- a tiny relative bar/mark, using the existing normalised display value
- tooltip: `Relative model sensitivity in this analysis, not an absolute causal percentage.`

Data:

- Reuse existing authoritative factor-sensitivity/importance pipeline (`elasticity` / `sensitivity_score` / `importance_score`, existing rank/display normalisation).
- Existing relative display normalisation is acceptable for presentation; raw values remain the underlying analysis truth.
- Hide when analysis is absent or stale.

### Primary mini-visual precedence

Show **at most one**:

1. **Turning point / flip threshold**, if a real flip threshold exists.
   - show current value and flip value on a small track;
   - click opens the existing analysis/impact detail.
2. **Explicit range**, if a genuine producer/user range exists.
   - do not imply a distribution or confidence interval unless supplied.
3. Nothing.

Do not fabricate a fallback chart.

### Factor icons

Render only when applicable:

- **Evidence/research** — factor is a targeted evidence gap; prioritise existing VOI ordering, do not invent a new UI threshold.
- **Behavioural awareness** — only a grounded `bias_finding` maps to this factor/element.
- **Provenance/source** — at rest only when it is an informative exception to the graph-wide default; always available in Detailed/inspector.
- **Coaching** — consistent action.

Behavioural copy must be reflective, e.g. `Worth checking: anchoring`, never `You are anchored` / `You have anchoring bias`.

### Detailed

Same width. Add existing information such as:

- source/provenance;
- evidence status;
- key relationship(s);
- analysis explanation.

Never expose raw internal scales such as `0.4 model scale` by default.

---

## 4. Option node

### Normal

Always lead with **what this option changes**.

- Show concrete intervention deltas.
- Use a compact two-column delta treatment.
- If there are many targets, show the most useful subset plus a clear `+N more` route rather than making the card tall.
- **Standard view must indicate that real editable targets can be changed.** Do not leave the route Expert-only when the deltas are already visible.

### Consequence visual

Only show analysis outcomes that actually exist.

- 2 outcomes available → up to two compact rows/bars.
- 1 outcome → one row only.
- no quantified outcomes → omit the visual entirely.
- stale → hide previous analysis-derived outcome visuals and show the explicit stale state.

Do not create a generic permanent “trade-off chart”.

### Option icons

Same grammar as Factors:

- evidence/research only when targeted;
- behavioural only when grounded and mapped;
- provenance as an informative exception / in Detailed;
- coaching consistent;
- edit affordance/route available in normal Standard view when a real mutation carrier exists.

---

## 5. Connectors — preserve and clarify existing visual intelligence

Do **not** redesign connector semantics from scratch.

### Existing channels to preserve

| Channel | Meaning |
|---|---|
| **Line width, pre-analysis** | Relationship weight magnitude |
| **Line width, post-analysis** | Relative consequential importance from the existing edge-importance calculation |
| **Colour + sign** | Positive / negative direction |
| **Solid / dashed / dotted** | Relationship existence certainty, using existing thresholds |
| **Selection / dimming** | Existing path/neighbourhood focus behaviour |

### Critical correction

**Do not use dotted/dashed lines for evidence gaps.** Line style already has a semantic job.

Evidence, fragility and disagreement use discreet exception markers/icons instead.

### Exception markers

At readable zoom, allow up to two if genuinely needed:

- evidence/research gap;
- consequential/fragile edge;
- contested relationship **only when attributable unresolved disagreement exists**.

In dense graphs, collapse to the most consequential exception cue(s); do not decorate every edge.

Click routes to the existing Edge Inspector and relevant section.

### Gated

- **Contested** is design-ready but must not ship as factual state until a canonical carrier supports attributable disagreement.
- Do not equate disagreement with low confidence or weak evidence.
- Do not revive the current uncertainty band unless the producer data is shown to differentiate relationships meaningfully; current/default values have previously made this misleading.

### Legend

Legend wording must reflect phase:

- pre-analysis: thicker = stronger modelled relationship;
- post-analysis: thicker = greater relative consequential importance.

Never label a post-analysis thick line simply `stronger relationship` if that is not what it encodes.

---

## 6. Provenance, attention and coaching are different

Do not collapse these concepts.

- **Provenance:** where did this come from?
- **Attention:** why should I look here now?
- **Coaching:** what reasoning move could help next?

Fresh AI-generated models should communicate globally that they are a **starting model**. Do not repeat the same AI icon across every node if it conveys no new information.

Show provenance exceptions instead, e.g. user-set, brief-derived, evidence-backed, or a particularly consequential unvalidated assumption.

---

## 7. Behavioural science

Use it. Do not diagnose.

Canvas behavioural icon appears only when current grounded output maps a finding to the element, for example a valid `bias_findings[].affected_elements` result.

Current grounded patterns may include anchoring, narrow framing, missing baseline/status-quo risk, sunk cost, planning fallacy and other evidence-backed findings.

Rules:

- structural or semantic evidence must already exist upstream;
- never add a UI-only behavioural inference;
- tooltip says `Worth checking: …`;
- click engages AI with the finding, evidence and element context;
- if grounding is absent, no icon.

---

## 8. State truth — non-negotiable

Preserve the existing truth contract:

- proposed ≠ applied;
- `Not applied yet` remains explicit;
- `Saving…` remains explicit during receipt wait;
- do not claim user provenance before applied receipt;
- stale analysis is shown as stale, never as absent;
- stale analysis hides/de-emphasises analysis-derived driver, tipping-point, fragility and forecast cues;
- failures do not silently retry writes or imply success.

---

## 9. Existing inspector integration — tidy only

**No inspector rebuild tonight.**

Reuse existing inspector components and sections.

Routing:

- node click → existing node inspector;
- driver / turning-point mini visual → existing analysis/impact section;
- evidence icon → existing evidence/research section;
- provenance icon → source/provenance section;
- edge exception icon → relevant Edge Inspector section;
- coaching icon → AI, with node/edge already attached;
- behavioural icon → AI discussion with grounded finding attached.

If cheap, reorder existing sections so the clicked section is brought into view/highlighted. Do not create a parallel panel system.

---

## 10. Zoom and disclosure

- **Zoomed out / line rung:** preserve graph structure, type shapes and only the most important state/attention signal where legible.
- **Readable Normal:** compact card, useful model signal, selective icons and core action routes.
- **Detailed:** same card width, more evidence/provenance/relationship detail.
- Selecting/focusing may use the existing focus plan to bring the element to a readable zoom.

Important: `viewMode` must not make core ordinary functionality disappear. Expert is for advanced detail, not the only route to editing an option whose target changes are already shown in Standard.

---

# 11. Fastest safe implementation order

## P0 — visual tidy-up and truth-safe signals

1. **Node layout**
   - larger top connection shape;
   - tighten Factor/Option widths and spacing;
   - normal-size values;
   - small `Not set` state;
   - consistent bottom icon rail.

2. **Selective icons**
   - remove repeated `AI estimate` text;
   - suppress repeated/default provenance marks;
   - evidence/behaviour icons only when data says they apply;
   - coaching icon consistent.

3. **Attention cue**
   - pure view-layer aggregation of existing signals only;
   - tooltip + select/open existing inspector.

4. **Factor driver visual**
   - reuse existing sensitivity rank/normalised display data;
   - label relative, never `% influence`.

5. **Factor turning point/range**
   - real flip threshold first;
   - real range second;
   - otherwise nothing.

6. **Connector correction**
   - preserve current line channels;
   - never use dash for evidence;
   - add/selectively retain exception icons;
   - correct legend wording.

7. **Option compact consequence treatment**
   - only supported outcome rows;
   - clean partial/no-data states.

## P1 — low-risk routing/polish

8. Route each icon/mini-visual to the relevant existing inspector section or AI context.
9. Expose the existing option-target editing route in Standard/readable view where a durable carrier exists.
10. Ensure stale/pending/refusal states render truthfully across Canvas and Model panel.

## Hold / do not build tonight

- new inspector architecture;
- new floating/focus-panel work;
- new behavioural detector;
- new attention score;
- new confidence/uncertainty maths;
- new contested-state backend;
- raw model-scale labels;
- permanent generic trade-off charts;
- a redesign of existing selection/path/neighbourhood behaviour;
- large-scale Standard/Expert architecture rewrite beyond exposing core routes.

---

# 12. Acceptance witnesses

### Factor

- Fresh priority factor shows: compact value, relative driver indicator, valid turning point, attention cue, only applicable icons.
- Ordinary factor does **not** receive the same attention/evidence/behaviour icons by default.
- Range-only factor shows range but no invented tipping point.
- No-analysis factor shows no analysis-derived visual.
- `Not set` is compact and clearly editable.
- Stale factor hides current-looking driver/tipping-point signals.

### Behavioural

- Grounded finding mapped to element → reflective icon and correct explanation.
- No grounding → no behavioural icon.
- No copy diagnoses the user/team.

### Option

- Concrete changes remain immediately visible.
- One outcome → one outcome row; two → two; none → none.
- Standard readable view exposes route to edit real intervention targets.

### Connectors

- Width, colour/sign and dash retain their documented distinct meanings.
- Evidence icon does not alter dash pattern.
- Dense board remains readable with only exceptional relationships marked.
- Contested cue cannot appear without attributable disagreement state.

### Interaction/state

- Attention marker explains *why* the element is worth review.
- Data icon → existing inspector/section.
- Coaching/behaviour → AI with correct element context.
- `Saving…`, `Not applied yet` and stale states remain truthful.

---

## Design reference

Use `olumi-canvas-final-design-v2.html` as the visual reference. Earlier Experience Labs remain historical exploration, not implementation authority.
