

---

# **Olumi Scenario Sandbox – PoC Specification v4.2** 

## **1\. Purpose & Context**

This document reframes the **Scenario Sandbox PoC** around a focused, testable core loop, while:

* **Preserving existing foundations** that Windsurf has already built (three-panel shell, diagnostics, limits, health, tests).

* **Aligning with PRD v18** and the **CEE Section 4.3 specification** (all six CEE features), without forcing them all into the PoC UI.

* Providing a **clear PoC→MVP→v1.0 ladder** with explicit scope, success criteria, telemetry, and launch blockers.

Think of this as:

* **PoC Spec** (this document) – what UI we ship now to test the hypothesis.

* **CEE Spec v18 \+ Implementation Guide** – the full capability envelope CEE is building into.

---

## **2\. Product Mission & PoC Hypothesis**

### **Mission**

Help product teams turn messy debates into clear, causal decision models that **quantify trade-offs they couldn’t see before**, in a way that feels scientific but still usable.

### **PoC Hypothesis**

*“A product team can describe a complex decision in natural language, accept a drafted causal model, tweak it, run it, and understand the key drivers well enough to say:*  
 *‘I saw something here I wouldn’t have seen on my own.’”*

If that’s not true, everything else (full CEE surface, rich templates, Team Perspectives, etc.) is premature.

---

## **3\. Current Foundations (Windsurf Assets to Preserve)**

We explicitly **build on**, not discard, Windsurf’s work to date:

* **Three-panel shell & docks**

  * Inputs (left), Canvas (centre), Outputs (right), with a stable bottom toolbar.

  * Dock state persisted; layout already wired to `--dock-left-offset` / `--dock-right-offset`.

* **Diagnostics & degraded mode**

  * Diagnostics overlay \+ Outputs → Diagnostics tab.

  * Degraded banner & correlation IDs wired to engine headers.

* **Limits & graph health**

  * Central `useEngineLimits` hook calling `/v1/limits`.

  * Graph health slice and **HealthStatusBar** gating Run on blockers.

  * Limits spec already updated to **50 nodes / 200 edges**, with progressive warnings and sweet-spot hints in PRD v18.

* **Results & compare foundations**

  * Results store with `seed`, `response_hash`, drivers, and run metadata.

  * Basic Compare view & diff tables already in place (even if UX will be simplified initially).

* **Onboarding & keyboard legend**

  * First-run overlay and keyboard shortcuts (Shift+/) already wired and accessible.

* **Tests & SLOs**

  * A decent Vitest \+ Playwright baseline.

  * Performance envelopes taken from PRD v18 (reference p95 ≤600 ms, Context Bar \<200 ms, streaming fixture at 2.5 s).

**Non-negotiable:** PoC must **not regress** any of these (see §9.2 Anti-regression).

---

## **4\. Core PoC Loop (Single Source of Truth)**

This is the **canonical end-to-end journey** the PoC must support:

1. **Open** – The user opens Scenario Sandbox (single-user canvas view).

2. **Frame decision** – In the left panel they give:

   * Decision title / question

   * Primary success criterion

   * Timeline/deadline

3. **Describe** – They use chat to describe the decision in natural language.

4. **Draft** – Olumi (CEE) builds a candidate graph (8–20 nodes) and shows a diff preview.

5. **Accept** – The user accepts the draft **as a baseline** (or discards).

6. **Tweak** – They tweak the graph inline (adjust nodes/edges, beliefs).

7. **Run** – They click Run; graph health and limits gate invalid models.

8. **Results** – Results panel shows quantiles and top drivers (plus optional explainer).

9. **“I saw something new”** – They can name at least one non-obvious insight (e.g. a driver or trade-off).

Everything else is in service of making this loop **fast, clear, and trustworthy**.

---

## **5\. Scope Ladder: PoC vs MVP vs v1.0**

### **5.1 Feature Classification Table**

High-level classification (UI side):

| Feature / Area | PoC (now) | MVP (next) | v1.0 (later) | Notes |
| ----- | ----- | ----- | ----- | ----- |
| Three-panel shell & responsive | ✓ | refine | refine | Foundation, already present. |
| Chat (bottom-docked) | ✓ | refine | refine | Primary—but not mandatory—entry. |
| Draft My Model (CEE) | ✓ | ✓ | ✓ | **Only CEE feature fully integrated in PoC.** |
| Canvas inline editing | ✓ | refine | refine | Nodes/edges, labels, beliefs. |
| Run & basic Results (quantiles \+ drivers \+ trust footer) | ✓ | refine | refine | Explainer optional in PoC, required by MVP. |
| Context Bar & health badge | ✓ | refine | refine | Shows node/edge counts, health and limits. |
| Limits tab (usage bars, sweet-spot) | ✓ | refine | refine | Thin but real usage. |
| Diagnostics tab & degraded banner | ✓ (minimal) | refined | refined | Keep behaviour, polish later. |
| Evidence upload (thin slice) | optional | ✓ | ✓ | Capability exists; UI minimal at PoC. |
| Simple Compare (A/B only, if trivial) | optional | ✓ | ✓ v1.1 | Only if truly low effort; see §7.10. |
| Templates library | ✗ | maybe | ✓ | MVP only if PoC users struggle with blank canvas. |
| Advanced Compare v1.1 | ✗ | ✗ | ✓ | Ranked diffs, promote snapshot, etc. |
| CEE Plain-English Explainer | enhancement (non-blocking) | **✓ must-have** | ✓ | See §7.6.2. |
| CEE Bias & Gap Checker | ✗ | ✗ | ✓ | UI deferred to v1.0, backend can ship earlier. |
| CEE Evidence Helper (full UI) | ✗ | ✗ | ✓ | Thin backend slice exists earlier. |
| CEE Option Generator | ✗ | ✗ | ✓ | v1.0+; potentially alternative to templates. |
| CEE Coach for Sensitivity | ✗ | ✗ | ✓ | v1.0+. |
| CEE Team Perspective Synthesis | ✗ | ✗ | ✓ (Phase 1\) | Later; multi-user in Phase 2\. |

---

## **6\. CEE Integration vs CEE Spec v18**

### **6.1 The Misalignment**

CEE Section 4.3 currently describes a **PoC** in which *all* of the following are live in the UI: Draft My Model, Bias & Gap Checker, Evidence Helper, Option Generator, Plain-English Explainer, Coach, and Team Perspective Synthesis.

Our UI PoC plan would overload first-time users and delay learning. We instead:

* Treat **CEE v18 “PoC scope” as the backend envelope**, not the initial UI surface.

* Expose only **Draft My Model** in the PoC UI.

* Add Explainer in MVP, and the remaining CEE features in v1.0.

### **6.2 Staging Contract (Option A)**

**CEE builds ahead; UI integrates progressively.**

**PoC (Weeks 1–6, UI release):**

* **CEE side**

  * Builds **all six features** per CEE spec (Draft, Bias & Gap, Evidence Helper, Option Generator, Explainer, Coach, plus Team Perspectives Phase 1\) with stable endpoints and SDK.

* **UI side**

  * Integrates **only `Draft My Model`** into chat and canvas.

  * Uses core CEE operational contracts (50/200, deterministic truncation, 2.5 s fixture, progressive warnings) but does **not** expose other CEE panels/cards yet.

**MVP (Weeks 7–10):**

* UI adds **Plain-English Explainer** to the Results panel (see §7.6.2).

* Other CEE features remain backend-only, exercised via internal tools / SDK.

**v1.0 (Weeks 11+):**

* UI progressively integrates:

  * Bias & Gap Checker into Insights.

  * Evidence Helper into Documents / Inspector.

  * Option Generator into Insights or Templates.

  * Coach for Sensitivity into Results below needle-movers.

  * Team Perspective Synthesis into Insights (Phase 1 “stakeholder slots”).

### **6.3 Responsibilities**

* **CEE Workstream**

  * Builds all routes to spec.

  * Provides TypeScript SDK, mocks, and docs for all 6 features.

  * Accepts that **UI only uses 1 feature in PoC, 2 in MVP**, and the rest post-PoC.

* **UI Workstream (Windsurf)**

  * Commits to **Draft My Model integration in PoC** as the only CEE surface.

  * Tests non-integrated CEE features via SDK / Postman, not via production UI.

* **Product (Paul)**

  * Enforces staged rollout; no last-minute “just wire up Bias too”.

  * Uses CEE’s full feature set for **internal demos and investor pitches**, even if the production UI only surfaces a subset.

---

## **7\. Detailed PoC UI Scope**

### **7.1 Shell & Layout**

* Three-panel shell retained and refined:

  * **Left**: Decision framing \+ (minimal) structure \+ Limits tab.

  * **Centre**: Canvas \+ Context Bar.

  * **Right**: Outputs (Results / Diagnostics; Compare tab optional for PoC).

* Responsive behaviour:

  * ≥1440 px: classic three-panel rails.

  * 1024–1439 px: collapsible rails.

  * 768–1023 px: slide-in rails.

  * \<768 px: single-pane \+ simple view switcher for Inputs / Canvas / Outputs.

### **7.2 Left Panel – Progressive Structure**

**Always visible fields (PoC):**

* Decision title / question

* Primary success criterion

* Timeline / decision horizon

**“Add more structure”**

* Expands to reveal additional sections **on demand**, not all at once.

* Keeps alignment with PRD v18’s 9-section model without forcing them up front.

### **7.3 Chat – Primary but Not Mandatory**

#### **7.3.1 Chat-first flow (preferred)**

1. User lands with chat collapsed but clearly visible at the bottom.

2. Prompt: *“Describe your decision to get a first draft ✨”*.

3. User types description; sends to **Draft My Model**.

4. Receives draft; accepts or declines, then tweaks on canvas.

#### **7.3.2 Manual-first flow (fully supported)**

1. User ignores chat and starts drawing manually (Add node, Add edge, etc.).

2. After a few nodes, chat unobtrusively offers:  
    *“Want me to extend this model for you? ✨”*

3. User can:

   * Accept (triggers Draft My Model using current graph as context), or

   * Dismiss and carry on manually (no repeated nagging).

**Principles:**

* Chat is **never a gate**: manual creation must work from second zero.

* Chat hints are **single, polite offers**, not constant banners.

* Telemetry distinguishes chat-first vs manual-first paths (see §8).

### **7.4 Draft My Model (CEE Integration)**

* Endpoint: `/assist/draft-graph` (or equivalent) per CEE spec.

* Behaviour:

  * Accepts NL description (50–500 words), optional attached evidence.

  * Optionally considers existing partial graph (for the manual-first flow).

  * Generates a graph **≤50 nodes / ≤200 edges**.

  * Applies deterministic truncation if over limit and returns the truncation metadata.

* UX:

  * **Diff preview**:

    * “Olumi will add 8 nodes and 14 edges.”

    * Highlight new nodes and edges.

  * **Actions**:

    * Apply (atomic patch),

    * Discard,

    * Inspect node/edge details.

  * Uses ✨ \+ mint-500 accents for intelligence cues, per design guidelines and CEE spec.

  * If slow, show **2.5 s fixture** (“Olumi is thinking…”) and then stream results.

### **7.5 Canvas & Editing**

* Inline editing for:

  * Node labels and types.

  * Belief values on edges (with validation).

* Keyboard:

  * Enter to save edits.

  * Esc to cancel.

  * Delete / Backspace to delete selected nodes/edges.

* Run gating:

  * Graph health \+ limits must allow Run; otherwise the Context Bar and Issues panel explain why.

### **7.6 Run & Results**

#### **7.6.1 Minimum Results (PoC launch)**

* Run button (primary CTA at bottom toolbar).

* On success, Results tab shows:

  * Outcome range (e.g. p10 / p50 / p90).

  * Top 3–5 drivers (edges/nodes) with clear labels.

  * A **trust footer**:

    * Seed

    * Response hash

    * Engine label (PLoT env)

    * Optional correlation ID

* to reflect determinism and reproducibility in line with PRD v18.

#### **7.6.2 Plain-English Explainer (PoC enhancement, MVP must-have)**

If capacity allows, PoC includes a simple explainer; otherwise **MVP makes it mandatory**.

* Position: top of Results panel.

* Length: **≤100 words**.

* Content:

  * Summarises p50 outcome.

  * Names the top 1–2 drivers and what they mean (“Price → Demand (-0.4) indicates moderate price sensitivity”).

  * Touches on uncertainty at a high level.

  * References reproducibility (e.g. “Reproducible via seed XYZ”).

* Constraints:

  * Derived only from available engine outputs; no speculative logic.

  * Graceful fallback if data incomplete (“We don’t have enough information to explain this run yet”).

### **7.7 Context Bar, Health & Limits**

* Fixed Context Bar above the canvas, showing:

  * Live node and edge counts.

  * **Sweet-spot guidance**: “Most effective: \~12–25 nodes / 25–50 edges.”

  * Health indicator: OK / Warnings / Blocked.

  * Simple copy for each zone:

    * Green: “Comfortable size; easy to reason about.”

    * Yellow: “Getting complex; consider grouping.”

    * Red: “At or over limits; simplify to run.”

* Limits tab in the left panel reuses `useEngineLimits` to show:

  * Current counts vs max (e.g. 34/50 nodes, 80/200 edges).

  * Progressive warnings at 30/40/50 node thresholds.

  * Source and freshness of limits (live vs fallback).

### **7.8 Diagnostics & Degraded Mode**

**PoC minimum:**

* Outputs → Diagnostics tab:

  * Shows resumes / trims.

  * Shows correlation ID.

* Degraded banner:

  * Appears when headers indicate degraded or fallback; simple message (“We’ve temporarily simplified some calculations; results may be less precise.”).

* Resume toast:

  * Debounced; appears once per run if resumes \>0.

### **7.9 Evidence (Thin Slice in PoC, Richer Later)**

* PoC:

  * Left panel “Evidence” area:

    * Upload file(s) or paste text.

    * Show a simple list of uploaded sources with remove buttons.

  * No complex provenance UI; no automatic belief updates.

* CEE Evidence Helper is built and tested **backend-only** in PoC. It becomes:

  * MVP+: optional internal tool for you and CEE to test the contract.

  * v1.0: integrated into Insights and Inspector with provenance chips and tooltips.

### **7.10 Compare – Decision Framework**

Compare for PoC is **explicitly optional** and subject to this decision tree:

**Include in PoC only if ALL true:**

* Duplicate scenario support already exists.

* Results panel can show two scenarios **side by side** without new layout.

* Top 3–5 edge diffs can be computed from existing store state.

* Implementation and tests are realistically **≤2 days of work**.

If **any** of the above is false, Compare is deferred to MVP or v1.0.

---

## **8\. Success Criteria & Telemetry**

### **8.1 PoC Success Criteria**

Target with 15–20 evaluators (friendly product teams):

**Primary:**

* ≥80% users complete the full **describe → draft → tweak → run** workflow without facilitator help.

* ≥70% say *“I saw something I wouldn’t have thought of without this”*.

* Average engaged session time **≥8 minutes**.

**Secondary:**

* Time from **first describe → draft preview**: \<30 seconds for p95.

* Time from **Run → results**: \<5 seconds for p95.

* No serious trust objections like *“This looks like random GPT answers”*.

### **8.2 Required Telemetry (No PII / No Payload Logging)**

We log **only structured events**, never decision text, labels or documents.

**Core loop funnel events:**

* `canvas_opened`

* `chat_focused`

* `cee_draft_requested`

* `cee_draft_received` (with duration)

* `draft_applied` / `draft_declined`

* `first_manual_edit_made`

* `run_clicked`

* `results_displayed` (with duration)

* `session_ended` (with total duration)

**Behaviour signals:**

* `manual_node_created` (with pre/post draft context)

* `chat_collapsed` / `chat_hidden`

* `add_more_structure_clicked`

* `evidence_uploaded` / `evidence_removed`

* `compare_opened` (if enabled)

**Technical health:**

* `cee_draft_timeout` (e.g. \>10s)

* `run_failed` (with error class, not content)

* `degraded_mode_triggered`

* `resume_event` (network issues)

**Privacy constraints:**

* No logging of: decision text, node/edge labels, evidence content.

* Only log: event names, timestamps, durations, anonymous session IDs, counts, boolean flags.

---

## **9\. Launch Criteria, Anti-Regression & Non-Goals**

### **9.1 Launch Blockers (Must-have for PoC)**

PoC **cannot ship** unless:

* Chat → Draft → Accept → Tweak → Run → Results loop is fully functional for a single scenario.

* Health gating prevents obviously broken graphs from running, with clear messaging.

* 50/200 limits are enforced with Context Bar \+ Limits tab surfacing.

* Trust footer shows seed and response hash on every Run.

* Keyboard basics work: Tab, Enter, Esc, Delete/Backspace on main flows.

* The three-panel shell works at least at the **1440 px** breakpoint.

### **9.2 Anti-Regression Commitments**

PoC **must not break**:

* Existing Diagnostics tab behaviour.

* Degraded banner triggers.

* Limits enforcement contract (50/200 caps).

* Health-based Run gating and Issues panel.

* Screen-reader relationships and announcement patterns.

* Keyboard navigation already in place.

* Docks avoiding the bottom toolbar at all breakpoints.

If any of these regress, fixing them becomes a **higher priority** than adding new PoC features.

### **9.3 Enhancements (Nice-to-haves for PoC)**

PoC is stronger with, but does *not* depend on:

* Plain-English Explainer in Results (see §7.6.2).

* Diagnostics tab fully polished.

* Keyboard shortcut legend refinements.

* First-run intro slides.

### **9.4 Explicit Non-Goals for PoC**

PoC will **not** ship with:

* Bias & Gap Checker cards in the UI.

* Evidence Helper suggestions UI.

* Option Generator tiles.

* Coach for Sensitivity.

* Team Perspective Synthesis.

* Templates library UI.

* Multi-scenario compare v1.1 with promote snapshot.

* Decision Brief export.

* Multi-user collaboration or CRDTs.

* Heavy evidence previews and rich provenance UIs.

These are deferred to MVP and v1.0, despite being fully described in PRD v18 and CEE spec.

---

Yes, I think that’s a very good approach **as long as** we treat it as:

* A *summary \+ constraints* section inside the PoC spec, and

* The **Design & UX Brief v03** remains the detailed reference it points to, not something we try to fully duplicate.

That keeps the PoC spec as the single source of truth for *what must be true for the PoC*, while making it impossible for Windsurf to “accidentally” ignore brand and UX principles.

Below is a section you can drop into the PoC spec (you can renumber it to fit your structure).

---

## **10\. UX & Brand Implementation (PoC-specific)**

**Purpose**  
 This section defines the minimum UX and brand requirements that **must** be respected for the Scenario Sandbox PoC UI. It is a summary for the engineering team. Full detail is provided in the companion document **“Olumi Scenario Sandbox – Design & UX Brief – v03”** (“UX Brief”), which remains the primary reference for design tokens, component guidelines, and phased UI work.

The PoC is **single-user** only. Multi-user features (concurrent editing, avatars, conflict resolution) are explicitly **out of scope** and should not drive any UI choices in this phase.

### **10.1 Core UX Principles (PoC constraints)**

The following principles from the UX Brief are mandatory for the PoC:

1. **Spatial model**

   * **Left:** Inputs & decision framing (context, scenarios, limits & health).

   * **Centre:** Graph canvas (work surface).

   * **Right:** Outputs & results (Results, Insights, Compare, Diagnostics).

   * **Bottom:** Global actions & chat.

   * On desktop, the Outputs panel should remain visible by default when space allows.

2. **Progressive disclosure**

   * First view should feel light and approachable.

   * Show only the **minimum framing fields** and essential controls by default.

   * Additional structure (extra fields, advanced options) is revealed via clear, low-friction affordances (e.g. “Add more structure”, drawers, inline expanders), not blocking modals.

   * Avoid more than **2–3 accent colours visible at once** on any given screen.

3. **Determinism & trust**

   * Always surface determinism artefacts provided by the PLoT engine: **seed**, **response\_hash**, and live **limits**. Never fabricate or guess these values.

   * Results views must include a **trust footer** showing reproducibility information (see 7.4).

   * Diagnostics from the Assistants service (degraded state, resumes, trims, correlation IDs) must be exposed clearly but non-intrusively in the Diagnostics tab and banners.

4. **Accessibility & performance**

   * Keyboard-first navigation, clear focus states, and support for `prefers-reduced-motion`.

   * Colour contrast should meet WCAG AA.

   * Interactions should feel snappy (target \<100–200ms perceived latency for UI actions; engine latency is handled via loading states rather than blocking layouts).

### **10.2 Brand System & Visual Language**

The PoC must use the **Olumi design system tokens** defined in the UX Brief, implemented via Tailwind theme extensions and CSS custom properties. No raw hex values should be introduced directly in components.

1. **Colour palette & semantic mapping**

   * **Foundation neutrals (70–80% usage):** `charcoal`, `storm`, `mist` — used for backgrounds, borders, and typography.

   * **Cognitive spectrum (20–30% usage):** `analytical`, `practical`, `creative`, `strategic`, `intuitive` — reserved for meaningfully distinct states and actions, not decoration.

   * Semantic mapping (must be respected):

     * Primary actions (Run, Save): **analytical-600**

     * AI assistance (Draft, suggestions): **practical-600**

     * Warnings, health alerts: **creative-600**

     * Results, outcomes surfaces: **strategic-600**

     * “Aha”/insightful highlights (sparingly): **intuitive-600**

   * Node type colours must follow the canonical mapping (decision, option, outcome, factor, risk, mitigation) defined in the UX Brief; the PoC must not introduce alternative colour coding.

2. **Typography**

   * Typeface: **Inter, system-ui, sans-serif** as the primary sans family.

   * Use the defined type scale for headings, body, and labels (e.g. `heading-lg` for panel titles, `body-md` for main copy, `label-sm` for chips & badges).

   * Avoid ad-hoc font sizes or weights; changes should go via tokens.

3. **Spacing, elevation, and shape**

   * Respect the 8px-based spacing system for layout and component padding/margins.

   * Use the defined elevation tokens (`boxShadow.sm/md/lg/xl`) and border radii; no new arbitrary shadows or radii.

   * Overall look should be clean, calm, and analytical — not playful or noisy.

### **10.3 Key Surfaces (as implemented in the PoC)**

The PoC implementation should map the UX Brief into the following concrete surfaces:

1. **Inputs (left panel)**

   * Always visible on desktop; collapsible at smaller breakpoints.

   * Above-the-fold fields:

     * Decision title / question.

     * Primary goal / success definition.

     * Optional timeline / horizon field.

   * Additional framing structure (e.g. stakeholders, constraints) is hidden behind a single affordance such as **“Add more structure”** and revealed inline when needed (progressive disclosure).

   * The **Limits & health** tab in Inputs must:

     * Show current node/edge usage vs caps (e.g. `34 / 50 nodes`, `152 / 200 edges`) with simple usage bars.

     * Clearly indicate whether the current graph is **Comfortable**, **Getting complex**, or **At limit** based on live limits from `/v1/limits` (see 7.4).

2. **Canvas (centre)**

   * Graph canvas sits between Inputs and Outputs and respects the three-panel docking behaviour already implemented.

   * No floating overlays that obscure the canvas (Results and Diagnostics live in the Outputs dock).

   * Node shapes and colours follow the design system; new node types introduced in the PoC must still use the defined palette and typography hierarchy.

3. **Outputs (right panel)**

   * Tabs: **Results, Insights, Compare, Diagnostics** (even if some tabs are thin placeholders in the PoC).

   * **Results**:

     * Shows the main run summary, top drivers, and key scenario comparison for the active run.

     * Includes the **trust footer** (see 7.4).

   * **Insights**:

     * For the PoC, may host a minimal set of insights (e.g. top drivers or basic narrative explanation) but must not fabricate content beyond what the engine provides as “needle-movers” or insights.

   * **Diagnostics**:

     * Surfaces Assistants diagnostics (degraded mode, resumes, trims, correlation ID) in a structured, readable way, matching the semantics in the UX Brief.

4. **Bottom bar & chat**

   * Bottom toolbar remains **unobscured** at all breakpoints (docks and drawers must respect its vertical space).

   * Chat input (even if minimal in the PoC) sits in the bottom area and uses the brand tokens for AI assistance (practical-600) for its actions and accents.

### **10.4 Determinism, Limits & Trust Surfaces**

1. **Context bar / health**

   * A simple context bar appears above the canvas, combining:

     * Node and edge counts.

     * Live limits zone: e.g. “Ready to run”, “Getting complex”, “At limit – simplify to run”.

   * Health states must be derived from actual `/v1/limits` responses and current graph size, not hard-coded thresholds.

2. **Run button states**

   * Primary Run CTA uses **analytical-600** and is clearly:

     * Enabled when the graph is runnable.

     * Disabled with a short reason when blocked (e.g. “Fix 2 errors before running”).

   * During a run, show a loading state but keep the layout stable; no disabling of the entire UI.

3. **Trust footer in Results**

   * Every Results view must include a trust footer containing, at minimum:

     * `Seed: …`

     * `Response: …` (response\_hash)

     * Engine / backend label (e.g. “Powered by Olumi PLoT engine”).

   * If either seed or hash is missing, the footer should reflect that honestly (e.g. “Seed not provided for this run”), never inventing or masking values.

4. **Diagnostics & degraded mode**

   * When Assistants reports degraded mode or resumes, the Diagnostics tab and (where appropriate) a subtle banner should explain this in plain British English, using **creative-600** sparingly for warnings.

### **10.5 Feature Flags & Documentation Expectations (PoC)**

* Existing feature flags for Inputs/Outputs panels, degraded banner, Diagnostics tab, and sweet-spot guidance should remain in place, with the precedence rules defined in the UX Brief (localStorage → env var → default).

* Any PoC-specific UX behaviour that is behind a flag must:

  * Be documented briefly in `FEATURES_OVERVIEW.md`.

  * Include clear acceptance criteria and at least one unit/DOM test and one Playwright path.

### **10.6 Out-of-Scope UX for the PoC**

To avoid scope creep, Windsurf should treat the following as **explicitly out of scope for this PoC spec** (but allowed as typed stubs if helpful):

* Multi-user features (presence, avatars, locking, merge conflict UI).

* Full mobile-first responsive behaviour (desktop is the priority; tablet/mobile can be “good enough” but not polished).

* Rich onboarding flows beyond a simple first-run overlay and keyboard legend already wired in the codebase.

* Complex chat history management (single-session interaction is sufficient for PoC testing).

---

## **11\. Implementation Phases & Relative Effort**

These are **planning guides, not commitments**, to help reason about sequencing and risk.

### **Phase 1 – Foundation Check** 

* Audit Windsurf’s current implementation against this PoC spec.

* Confirm three-panel shell, diagnostics, limits, health, and keyboard flows are intact.

* Make minimal changes needed for PoC (e.g. Context Bar copy, colour zones).

### **Phase 2 – Core Loop** 

* Chat interface (collapsed/expanded, chat-first vs manual-first hints).

* Draft My Model integration (including diff preview, truncation messaging).

* Canvas editing refinements (inline editing, keyboard behaviour).

* Run & Results with trust footer (and optional explainer).

* Context Bar with sweet-spot and warnings linked to `/v1/limits`.

### **Phase 3 – Support & Polish** 

* Left panel progressive structure \+ Limits tab.

* Diagnostics minimum (tab \+ banner \+ resume toast).

* Error and success toasts.

* Keyboard legend and first-run intro refinements.

### **Phase 4 – Conditional Extras**

* Simple Compare surface (only if trivial per §7.10).

* Tiny templates slice (e.g. 2 starter templates) if testing shows severe “blank canvas” friction.

Total: **\~4–6 weeks of focused work**, building on the current code rather than restarting.

---

## **12\. CEE & UI Workstream Coordination**

This spec resolves the CEE v01 PoC Specification vs Scenario Sandbox PoC apparent misalignment through **\*\*staged progressive integration:\*\*** 

1. **\*\*CEE Workstream (Backend):\*\***   
   \- Builds all 6 features per CEE v01 specification across 4 phases \- Delivers stable TypeScript SDK for all routes   
   \- Can demo full capability to investors

2. **\*\*UI Workstream (Frontend):\*\***   
   \- **\*\*PoC:\*\*** Integrates Draft My Model only   
   \- **\*\*MVP:\*\*** Adds Plain-English Explainer   
   \- **\*\*v1.0:\*\*** Adds remaining 4 features (Evidence Helper, Bias Checker, Options, Coach)  
3.  **\*\*Integration Contract:\*\***   
   Both teams acknowledge:   
   \- CEE capability existing ≠ UI must integrate immediately   
   \- Weekly syncs maintain alignment on integration points   
   \- UI provides feedback on non-integrated features via SDK/testing   
   \- Features are built to support staged rollout, not big-bang release 

---

## **13\. Key Decisions Made**

1. **\***  
2. **CEE Integration Strategy\*\*** \- **\*\*Decision:\*\*** Option A (CEE builds comprehensive capability, UI integrates progressively) \- **\*\*Rationale:\*\*** Validates CEE architecture early while protecting UX simplicity   
3. **\*\*2\. Plain-English Explainer Timing\*\*** \- **\*\*Decision:\*\*** MVP requirement (non-blocking for PoC) \- **\*\*Rationale:\*\*** \- PoC validates "Does Draft My Model work?" \- MVP validates "Do users understand results?" \- Keeps PoC focused on core loop   
4. **\*\*3\. Compare Functionality\*\*** \- **\*\*Decision:\*\*** Conditional PoC enhancement \- **\*\*Criteria:\*\*** Include ONLY if decision framework in §7.10 fully satisfied \- **\*\*Default:\*\*** Defer to MVP if any doubt   
5. **\*\*4\. Launch Blockers\*\*** \- **\*\*Must-have:\*\*** Chat → Draft → Canvas → Run → Results with trust footer \- **\*\*Nice-to-have:\*\*** Explainer, Compare, Templates \- **\*\*Out of scope:\*\*** All other CEE features, advanced diagnostics, exports   
     
     
    Success Threshold   
   This PoC is considered **\*\*validated\*\*** if:   
   \- ≥70% of test users complete core loop   
   \- ≥70% report "saw something I wouldn't have thought of"   
   \- \<5 major UX blockers identified  
    If validated → Proceed to MVP (add Explainer)  
    If mixed results → Iterate core loop before expanding If fails → Reassess hypothesis before further investment

