**Olumi– Cognitive Enhancement Engine (CEE) \- Specification v0.4** 

*Status: Implementation-ready baseline for Phase 1*

---

## **0\. Document intent & status**

This document is the **single source of truth** for the Cognitive Enhancement Engine (CEE) behaviour and contracts.

It is written for:

* **Windsurf / PLoT Engine team** – to confirm type and behaviour alignment.

* **Assistants / CEE implementation team** – to implement /assist/v1/... and the validation/telemetry envelope.

* **Windsurf / Scenario Sandbox UI team** – to integrate CEE capabilities into the Sandbox UI.

This v0.4 spec:

* Incorporates all agreed improvements and engine feedback.

* Defines **CEE Contracts v1.0** – stable, additive-only for the v1.x line.

* Is **implementation-ready**: anything unclear here should be treated as a defect, not an invitation to improvise.

If a workstream sees a **critical, high-risk misalignment** with their area, they should raise it; otherwise this document is considered frozen for Phase 1\.

---

## **1\. Overview & goals**

### **1.1 What CEE is**

Olumi’s **Scenario Sandbox** helps teams build causal models of decisions and explore them with the **PloT engine**.

CEE is the **“embedded decision scientist” layer** that sits on top of the engine and:

* Drafts causal models from natural-language descriptions.

* Explains probabilistic results in plain English.

* Highlights gaps, biases, and weak evidence.

* Suggests options and “what to test next”.

* Eventually synthesises multiple team perspectives.

CEE uses **third-party LLMs** and internal logic, but **all graphs and inference remain under the PLoT engine’s authority**.

### **1.2 PoC, MVP, v1.0 – product staging**

We separate:

* **What CEE can do** (backend capabilities, APIs, SDK, demo harness).

* **What the Scenario Sandbox UI actually exposes at each stage**.

**PoC (Scenario Sandbox PoC):**

* UI integrates **Draft My Model** only:

  * Describe decision → Draft graph → Accept/tweak → Run.

* CEE may implement more capabilities, but they are:

  * Available via the internal demo harness and SDK.

  * **Not** part of the main PoC UI.

**MVP:**

* UI adds **Plain-English Explainer** into the Results view.

**v1.0+:**

* UI progressively integrates:

  * Evidence Helper → Evidence/Documents views.

  * Bias & Gap Checker → Insights.

  * Option Generator → Insights / Scenario templates.

  * Sensitivity Coach → Results / Insights.

  * Team Perspectives → dedicated team view or Insights.

---

## **2\. Roles & boundaries**

### **2.1 PLoT engine (Windsurf)**

The engine is the **source of truth** for:

* **GraphV1** – the canonical graph structure.

* **report.v1** – the canonical inference results structure.

* Graph **limits** and **health**:

  * Dynamic node/edge limits from /v1/limits.

  * Graph validation via /v1/validate.

  * Deterministic behaviour via seed and response\_hash.

  * Degraded-mode signalling via headers (e.g. X-Olumi-Degraded).

CEE **must not fork these types or rules**. It must **import** or code-generate them from the engine SSOT.

### **2.2 CEE (this workstream)**

CEE:

* Owns **all /assist/v1/... contracts** and the **TypeScript SDK**.

* Orchestrates LLMs, pattern libraries and validation to provide:

  * Draft My Model, Explainer, Evidence Helper, Bias Checker, Options, Sensitivity Coach, Team Perspectives.

* Must **never bypass engine validation** for any graph that will be run.

* Must **respect engine limits** and deterministic semantics.

All CEE success responses **must pass through** the CEE validation pipeline (Section 5).

### **2.3 Scenario Sandbox UI (Windsurf)**

UI:

* Owns the **user experience**:

  * Framing decisions.

  * Canvas interaction.

  * Running scenarios and reading results.

* Integrates CEE selectively, according to product staging, via the CEE SDK.

For PoC, UI depends only on:

* /assist/v1/draft-graph.

Other CEE features remain backend-only until explicitly green-lit.

---

## **3\. CEE capabilities & staging**

### **3.1 Capability set (CEE v01)**

CEE v01 defines seven capabilities:

1. **Draft My Model** – draft causal graph from natural language.

2. **Plain-English Explainer** – explain engine results.

3. **Evidence Helper** – map evidence to graph, highlight gaps.

4. **Bias & Gap Checker** – detect likely biases and missing elements.

5. **Option Generator** – suggest strategic options and associated graph changes.

6. **Sensitivity Coach** – suggest what to test next.

7. **Team Perspective Synthesis (Phase 1\)** – basic overlap/diff of multiple team graphs.

**Coherence monitoring** is cross-cutting:

* Engine limits and validation.

* CEE validation pipeline.

* UI health indicators.

### **3.2 Archetypes (PoC focus)**

For the PoC:

* CEE will go **deep on one archetype**:

  * pricing\_decision – B2B SaaS price change (e.g. £49 → £79).

* Other decisions use a **generic fallback** (generic).

Archetypes live in CEE as **pattern libraries**:

* Required nodes and edges.

* Typical confounders, mediators, and temporal sequences.

* Common pitfalls and missing elements.

This framework must be designed so **additional archetypes** can be added later without breaking contracts.

---

## **4\. API contracts –** 

## **/assist/v1/...**

### **4.1 Shared concepts**

#### **4.1.1 Headers**

**Request headers:**

* X-CEE-API-Version: v1 (required)

* X-CEE-Client-Version: \<sdk-version\> (optional; for diagnostics, e.g. cee-sdk-ts/1.0.3)

**Response headers:**

* X-CEE-API-Version: v1

* X-CEE-Feature-Version: \<feature-version\> (e.g. draft-model-1.2.0)

* X-CEE-Request-ID: \<uuid\> (unique per call; used in telemetry and support)

#### **4.1.2 Core types**

**GraphV1**

* Imported **directly** from the engine SSOT (OpenAPI / types).

* CEE:

  * MUST NOT add required fields.

  * MAY use optional metadata fields that the engine can ignore safely.

**InferenceResultsV1**

* CEE’s InferenceResultsV1 is a **thin alias** over engine report.v1.

At time of writing, the working shape is:

// NOTE: authoritative source is the engine contracts.  
// CEE must import/derive this type directly rather than re-declaring by hand.

interface InferenceResultsV1 {  
  summary: {  
    // keyed by outcome/target node id  
    \[target\_node\_id: string\]: {  
      p10: number  
      p50: number  
      p90: number  
      // engine may add extra statistics; treated as opaque  
    }  
  }  
  explain: {  
    top\_drivers: Array\<{  
      id: string        // node id  
      impact: number    // contribution metric (direction \+ magnitude)  
      // additional fields may exist; treated as opaque by CEE  
    }\>  
  }  
  seed: string           // exposed to CEE as string  
  response\_hash: string  
  model\_card: Record\<string, unknown\> // engine metadata; CEE treats as opaque  
}

If the engine evolves report.v1, **CEE must regenerate types** from the engine SSOT, not hand-edit this shape.

**Seed semantics**

* At the **CEE contract** level, seed is always a **string**.

* Internally, CEE maps this deterministically to the engine’s seed type (likely integer).

* Callers must treat seed as an **opaque token**, not a numeric value to manipulate.

**Reproducibility**

* For a given GraphV1 and seed, the engine’s response\_hash is **stable** under the same engine version and configuration.

* response\_hash may change when:

  * The engine is upgraded.

  * Defaults or numerical settings change.

  * There is a defect (rare; then it becomes a signal).

CEE uses response\_hash to detect reproducibility issues (see failure modes).

#### **4.1.3 Trace, validation, quality, errors**

interface CEETraceMeta {  
  request\_id: string  
  feature:  
    | 'draft\_model'  
    | 'explainer'  
    | 'evidence\_helper'  
    | 'bias\_checker'  
    | 'options'  
    | 'sensitivity\_coach'  
    | 'team\_perspectives'  
  primary\_model: string       // e.g. 'claude-3.5-sonnet'  
  reviewer\_model?: string     // optional  
  primary\_latency\_ms: number  
  review\_latency\_ms?: number  
  validation\_pass: boolean  
  quality\_score?: number  
  retry\_count: number  
  engine\_degraded?: boolean   // from engine headers  
}  
interface CEEValidationIssue {  
  severity: 'info' | 'warning' | 'error'  
  code: string           // e.g. 'LIMIT\_EXCEEDED', 'MISSING\_OUTCOME'  
  message: string        // user-facing; MUST NOT be logged verbatim  
  field?: string  
  meta?: Record\<string, number | string | boolean\> // structured only  
}  
interface CEEQualityMeta {  
  overall: number   // 1–10

  // Optional finer-grained scores (may be added later)  
  causal\_structure?: number  
  evidence\_strength?: number  
  probabilistic\_coherence?: number  
  completeness?: number

  warnings?: string\[\]  // user-facing only; not logged verbatim  
}

Quality score guidance:

* **9–10** – Excellent (production-ready).

* **7–8** – Good (usable; minor issues).

* **5–6** – Fair (usable with caution; review recommended).

* **3–4** – Poor (likely needs manual correction).

* **1–2** – Bad (probably unusable).

type CEEErrorCode \=  
  | 'CEE\_TIMEOUT'  
  | 'CEE\_RATE\_LIMIT'  
  | 'CEE\_GRAPH\_INVALID'  
  | 'CEE\_SERVICE\_UNAVAILABLE'  
  | 'CEE\_VALIDATION\_FAILED'  
  | 'CEE\_INTERNAL\_ERROR'  
  | 'CEE\_ENGINE\_DEGRADED'  
  | 'CEE\_REPRO\_MISMATCH'  
interface CEEErrorResponseV1 {  
  error: {  
    code: CEEErrorCode  
    message: string                 // short, user-safe explanation  
    details?: Record\<string, any\>   // structured only, no free text  
    retryable: boolean  
  }  
  trace: CEETraceMeta  
}  
---

### **4.2 Draft My Model –** 

### **/assist/v1/draft-graph**

**Purpose:** Primary PoC feature – turn a natural-language decision description into an engine-ready GraphV1.

#### **4.2.1 Request**

type DecisionTypeV1 \= 'pricing\_decision' | 'generic'

interface DraftGraphRequestV1 {  
  description: string                    // natural language decision description  
  decision\_type?: DecisionTypeV1         // hint; CEE will still detect archetype  
  context?: {  
    goals?: string\[\]                     // free text; NOT logged  
    constraints?: string\[\]  
    time\_horizon\_months?: number  
  }  
  seed?: string                          // optional; CEE treats as opaque string  
  evidence?: EvidenceItemRequestV1\[\]     // optional  
}

#### **4.2.2 Response**

interface GraphSummaryV1 {  
  node\_count: number  
  edge\_count: number  
  limit\_nodes: number  
  limit\_edges: number  
  truncated: boolean   // true if CEE truncated to respect limits  
}

interface DraftGraphResponseV1 {  
  graph: GraphV1  
  summary: GraphSummaryV1  
  validation\_issues: CEEValidationIssue\[\]  
  quality: CEEQualityMeta  
  archetype: {  
    decision\_type: DecisionTypeV1  
    match: 'exact' | 'fuzzy' | 'generic'  
    confidence: number                 // 0.0–1.0  
  }  
  trace: CEETraceMeta  
}

**Response limits**

* Graph must respect /v1/limits (dynamic).

* For PoC we assume limits of **≤50 nodes** and **≤200 edges**, but these must be read from /v1/limits and treated as dynamic.

* CEE may:

  * Deterministically truncate and set summary.truncated \= true, or

  * Return a CEE\_GRAPH\_INVALID error when above limits.

#### **4.2.3 Streaming (non-blocking extension)**

**Decision:** For PoC, **non-streaming POST is sufficient**. Streaming is **optional** and may be added post-PoC as v1.1.

If/when streaming is enabled, CEE will support SSE on:

* GET /assist/v1/draft-graph/stream?...

With event payload:

interface DraftGraphStreamEvent {  
  type: 'progress' | 'complete' | 'error'  
  data: {  
    message?: string                    // progress or status message  
    graph?: GraphV1                     // present when type \= 'complete'  
    summary?: GraphSummaryV1            // when type \= 'complete'  
    validation\_issues?: CEEValidationIssue\[\]  
    quality?: CEEQualityMeta  
    error?: CEEErrorResponseV1          // when type \= 'error'  
  }  
}

UI may ignore streaming initially; contracts are defined here to avoid later breaking changes.

---

### **4.3 Plain-English Explainer –** 

### **/assist/v1/explain-inference**

**Purpose:** Explain engine results in clear English.

#### **4.3.1 Request**

type ExplainerAudienceV1 \= 'product\_team' | 'exec' | 'technical'

interface ExplainInferenceRequestV1 {  
  graph: GraphV1  
  results: InferenceResultsV1  
  audience?: ExplainerAudienceV1  
  seed?: string  
}

#### **4.3.2 Response**

interface ExplainInferenceResponseV1 {  
  summary: string             // ≲100 words; plain language  
  key\_points: string\[\]        // bullet points  
  uncertainties: string\[\]     // where the model is least certain  
  next\_questions?: string\[\]   // prompts for further exploration  
  quality: CEEQualityMeta  
  trace: CEETraceMeta  
}

* All narrative must be **grounded in InferenceResultsV1** (no invented stats).

* Explanations should be **teaching-oriented** (“what this means”, “why this matters”).

---

### **4.4 Evidence Helper –** 

### **/assist/v1/suggest-evidence**

**Purpose:** Help users understand where their model is supported by evidence and where it is assumption-heavy.

#### **4.4.1 Request**

type EvidenceSourceTypeV1 \=  
  | 'internal\_data'  
  | 'customer\_research'  
  | 'market\_research'  
  | 'peer\_reviewed'  
  | 'case\_study'  
  | 'blog\_post'  
  | 'expert\_interview'  
  | 'assumption'

interface EvidenceItemRequestV1 {  
  id: string                         // caller's ID  
  source\_type: EvidenceSourceTypeV1  
  title: string                      // short label; NOT logged  
  content?: string                   // full text for analysis; NEVER logged  
}

interface SuggestEvidenceRequestV1 {  
  graph: GraphV1  
  evidence: EvidenceItemRequestV1\[\]  
}

#### **4.4.2 Response**

interface EvidenceItemResponseV1 {  
  id: string  
  source\_type: EvidenceSourceTypeV1  
  title: string  
  strength: 'none' | 'weak' | 'medium' | 'strong'  
}

interface EvidenceCoverageV1 {  
  node\_id: string  
  edge\_id?: string  
  evidence\_ids?: string\[\]           // IDs from evidence\_items  
  strength: 'none' | 'weak' | 'medium' | 'strong'  
}

interface EvidenceSuggestionV1 {  
  target: {  
    node\_id?: string  
    edge\_id?: string  
  }  
  suggestion: string                // user-facing; NOT logged verbatim  
}

interface SuggestEvidenceResponseV1 {  
  evidence\_items: EvidenceItemResponseV1\[\]  
  coverage: EvidenceCoverageV1\[\]  
  suggestions: EvidenceSuggestionV1\[\]  
  quality: CEEQualityMeta  
  trace: CEETraceMeta  
}

**Response limits (per call):**

* evidence\_items: ≤ 50

* coverage: ≤ 200 items

* suggestions: ≤ 20

---

### **4.5 Bias & Gap Checker –** 

### **/assist/v1/check-bias**

**Purpose:** Provide structured findings about bias and structural gaps.

#### **4.5.1 Request**

interface CheckBiasRequestV1 {  
  graph: GraphV1  
  evidence?: EvidenceItemResponseV1\[\]  
}

#### **4.5.2 Response**

interface BiasFindingV1 {  
  code: string                        // e.g. 'ANCHORING', 'BASE\_RATE\_NEGLECT'  
  severity: 'low' | 'medium' | 'high'  
  message: string                     // user-facing; NOT logged verbatim  
  recommended\_action?: string         // user-facing; NOT logged verbatim  
  targets?: {  
    node\_ids?: string\[\]  
    edge\_ids?: string\[\]  
  }  
}

interface CheckBiasResponseV1 {  
  findings: BiasFindingV1\[\]           // ≤ 10  
  quality: CEEQualityMeta  
  trace: CEETraceMeta  
}  
---

### **4.6 Option Generator –** 

### **/assist/v1/suggest-options**

**Purpose:** Suggest realistic, risk-profiled strategic options and the graph changes they entail.

#### **4.6.1 Request**

interface SuggestOptionsRequestV1 {  
  graph: GraphV1  
  decision\_type?: DecisionTypeV1  
}

#### **4.6.2 Patch type**

Applied **in SDK/UI**, not in the engine:

type NodeUpdate \= {  
  id: string  
} & Partial\<Omit\<GraphV1\['nodes'\]\[number\], 'id'\>\>

type EdgeUpdate \= {  
  id: string  
} & Partial\<Omit\<GraphV1\['edges'\]\[number\], 'id'\>\>

interface GraphPatchV1 {  
  add\_nodes?: GraphV1\['nodes'\]  
  add\_edges?: GraphV1\['edges'\]  
  remove\_node\_ids?: string\[\]  
  remove\_edge\_ids?: string\[\]  
  modify\_nodes?: NodeUpdate\[\]  
  modify\_edges?: EdgeUpdate\[\]  
}

SDK should expose a helper:

function applyGraphPatch(base: GraphV1, patch: GraphPatchV1): GraphV1

#### **4.6.3 Response**

type RiskProfileV1 \= 'conservative' | 'balanced' | 'aggressive'

interface OptionPatchV1 {  
  id: string  
  label: string                      // short label; NOT logged verbatim  
  description: string                // user-facing; NOT logged verbatim  
  risk\_profile: RiskProfileV1  
  tradeoffs?: string\[\]               // user-facing; NOT logged verbatim  
  patch: GraphPatchV1  
  evidence\_prompts?: string\[\]        // "what to check before choosing this"  
}

interface SuggestOptionsResponseV1 {  
  options: OptionPatchV1\[\]           // ≤ 6  
  quality: CEEQualityMeta  
  trace: CEETraceMeta  
}  
---

### **4.7 Sensitivity Coach –** 

### **/assist/v1/sensitivity-coach**

**Purpose:** Suggest which uncertainties to explore next.

#### **4.7.1 Request**

interface SensitivityCoachRequestV1 {  
  graph: GraphV1  
  results: InferenceResultsV1  
}

#### **4.7.2 Response**

interface SensitivitySuggestionV1 {  
  id: string  
  message: string                  // user-facing; NOT logged verbatim  
  target\_node\_ids?: string\[\]  
  target\_edge\_ids?: string\[\]  
  suggested\_experiment?: string    // simple test idea  
}

interface SensitivityCoachResponseV1 {  
  suggestions: SensitivitySuggestionV1\[\]   // ≤ 10  
  quality: CEEQualityMeta  
  trace: CEETraceMeta  
}  
---

### **4.8 Team Perspectives –** 

### **/assist/v1/team-perspectives**

**Purpose (Phase 1):** Simple overlap/diff stats for multiple team member graphs.

#### **4.8.1 Request**

interface TeamPerspectiveInputV1 {  
  user\_id: string          // MUST be pseudonymous, e.g. 'user\_123'; NEVER email/name  
  graph: GraphV1  
}

interface TeamPerspectiveRequestV1 {  
  perspectives: TeamPerspectiveInputV1\[\]   // ≤ 10 team members  
}

#### **4.8.2 Response (Phase 1\)**

interface TeamNodeAgreementV1 {  
  node\_id: string  
  present\_in: string\[\]       // user\_ids where node exists  
}

interface TeamEdgeAgreementV1 {  
  edge\_id: string  
  present\_in: string\[\]  
}

interface TeamPerspectivesResponseV1 {  
  stats: {  
    num\_perspectives: number  
    shared\_nodes: number      // nodes present in all graphs  
    shared\_edges: number  
    unique\_nodes: number      // nodes present in only one graph  
    unique\_edges: number  
  }  
  nodes: TeamNodeAgreementV1\[\]   // ≤ 200  
  edges: TeamEdgeAgreementV1\[\]   // ≤ 400  
  quality: CEEQualityMeta  
  trace: CEETraceMeta  
}

This is deliberately simple; more sophisticated synthesis can be added later without breaking this contract.

---

## **5\. Validation pipeline**

**Core rule:** It must be **impossible in code** to return a CEE success response that has not passed through this pipeline. Tests must assert this invariance.

### **5.1 Steps**

1. **Schema validation (hard fail)**

   * All requests and responses must conform to the JSON Schemas generated from this spec.

   * Fail → CEEErrorResponseV1 with CEE\_VALIDATION\_FAILED.

2. **Engine graph validity (hard fail for engine-bound graphs)**

   * For any graph intended to be run by the engine:

     * CEE **must** call /v1/validate; mirroring rules is a fallback only.

   * Fail → CEE\_GRAPH\_INVALID with structured details (no free text).

3. **Limits enforcement (hard/truncate)**

   * CEE must call /v1/limits and treat it as dynamic and authoritative.

   * For graphs CEE generates:

     * If result \> limits:

       * Either deterministically truncate and set summary.truncated \= true, or

       * Fail with CEE\_GRAPH\_INVALID and a clear message.

   * Engine will also enforce limits; CEE must not rely solely on engine enforcement.

4. **Causal sanity (soft warnings)**

   * Obvious impossible directions (e.g. revenue → price, outcome → decision).

   * Missing outcomes, orphan nodes (no parents or children), simple loops.

   * Issues recorded as CEEValidationIssue with severity warning.

5. **Probabilistic sanity (soft warnings)**

   * Probability masses not summing where they should, values outside \[0,1\], contradictory “most likely” labels.

   * Recorded as warnings, not blockers.

6. **Evidence & quality scoring (soft)**

   * Compute metrics such as evidence coverage, assumption ratio, structural completeness.

   * Populate CEEQualityMeta and internal metrics (but do not block responses unless extreme).

---

## **6\. Telemetry, privacy & rate limiting**

### **6.1 Telemetry & privacy**

**Forbidden in logs/analytics:**

* Any user-provided free text:

  * Decision descriptions, goals, constraints.

  * Node labels, edge labels, evidence content, document titles.

  * User IDs mapped to real identities.

* Any model-generated free text that might echo user content:

  * Explainer summaries, key points, suggestions, options, bias messages, etc.

**Allowed:**

* Event names and timestamps.

* Anonymous IDs: session IDs, trace.request\_id, pseudonymous user\_id.

* Numeric counts and limits: node/edge counts, number of suggestions etc.

* Enums and codes: node types, edge types, EvidenceSourceTypeV1, CEEErrorCode, archetype codes.

* Latency and compute metrics.

* Numeric quality scores, booleans (e.g. truncated, engine\_degraded).

**Review-required (gating):**

* Any new telemetry field **must** be explicitly approved by:

  * Technical lead (data safety).

  * Product owner (privacy compliance).

* PRs with telemetry changes may not be merged without approval comments.

* Default: **when in doubt, do not log it**.

CEEErrorResponseV1.error.details:

* Must contain **only structured, non-textual data** (IDs, codes, counts, booleans), never raw or generated text.

### **6.2 Rate limiting**

CEE must enforce per-feature rate limits (tunable, but the defaults below are recommended):

* **Draft My Model:**

  * Max 5 calls per 60 seconds per session/user.

* **Other /assist/v1/... endpoints:**

  * Max 10 calls per 60 seconds per session/user.

On exceed:

* Return CEEErrorResponseV1 with:

  * error.code \= 'CEE\_RATE\_LIMIT'

  * error.retryable \= true

  * details \= { retry\_after\_seconds: number }

* Add HTTP header Retry-After: \<seconds\>.

UI behaviour is defined in the failure modes matrix (Section 11).

---

## **7\. Graph limits & truncation**

* Limits (limit\_nodes, limit\_edges) come from **engine /v1/limits** and must be treated as dynamic.

* CEE must:

  * Fetch and cache limits, refreshing periodically or when receiving clear “limits changed” signals.

  * Respect limits when generating graphs; never intentionally exceed them.

When a generated graph exceeds limits:

* Preferred: deterministically truncate and set summary.truncated \= true, plus validation\_issues entry.

* Alternative: fail with CEE\_GRAPH\_INVALID if truncation would severely damage semantics.

Engine will independently enforce the same limits; CEE is expected to avoid “round-tripping” invalid graphs.

---

## **8\. Patches vs full graphs**

* Engine will **only** accept full GraphV1 graphs; it has **no patch API** in v1.

* CEE GraphPatchV1 is strictly an internal/SDK/UI concept.

* The TypeScript SDK is responsible for:

  * Providing applyGraphPatch(base, patch) helpers.

  * Ensuring the patched graph still respects /v1/limits before sending to engine or CEE.

Patch application must:

* Never silently drop nodes/edges beyond deterministic truncation rules.

* Treat **node type changes** (e.g. Decision → Outcome) as high-friction events (more a UX/CEE concern than an engine rule, but important).

---

## **9\. Quality gates**

### **9.1 Draft My Model – PoC gate**

Before Draft My Model is turned on in the PoC UI:

* **Structural validity:**

  * 100% of outputs for PoC test set:

    * Pass engine validation, or

    * Are rejected with CEE\_GRAPH\_INVALID, or

    * Are truncated with summary.truncated \= true.

* **Limits:**

  * All graphs respect /v1/limits.

* **Pricing archetype quality:**

  * On a curated test set of pricing decisions, domain reviewers agree that the graphs are:

    * Directionally correct.

    * Missing at most minor refinements.

* **Latency:**

  * End-to-end latency for Draft My Model (CEE call only) is within UX targets (to be set; e.g. p95 ≤ 8s).

* **Reproducibility:**

  * Same description \+ seed (and no engine/LLM upgrade) → same graph.

### **9.2 Explainer – MVP gate**

Before integration into the UI:

* Readability and accuracy reviewed on a curated set.

* No invented metrics; all numbers traceable to InferenceResultsV1.

* Deterministic under same inputs \+ seed.

* Graceful behaviour under partial/odd inputs (clear errors; no nonsense).

### **9.3 Other features – v1.0 gate**

Before UI integration of Evidence Helper, Bias Checker, Options, Coach, Team Perspectives:

* Contracts stable (v1.x).

* Latency/cost acceptable.

* Internal quality metrics show low nonsense rates.

* Telemetry/tracing good enough to debug issues without payload logging.

---

## **10\. Phasing & Phase 1 Definition of Done**

### **10.1 Phase 1 – Foundation (CEE Contracts v1.0)**

**Goal:** Stable contracts, validation, SDK and fixtures.

**Definition of Done (DoD):**

* **Contracts & schemas**

  * □ All /assist/v1/... endpoints defined in this spec.

  * □ JSON Schemas generated for all requests/responses.

  * □ GraphV1 and InferenceResultsV1 imported from engine SSOT.

* **TypeScript SDK**

  * □ Types generated from schemas/OpenAPI.

  * □ Typed client methods for all endpoints.

  * □ applyGraphPatch implemented and tested.

* **Validation pipeline**

  * □ Central validation pipeline implemented as per Section 5\.

  * □ Unit tests assert no success responses bypass the pipeline.

* **Telemetry & rate limiting**

  * □ Telemetry events defined and implemented according to Section 6\.

  * □ Rate limiting enforced with CEE\_RATE\_LIMIT and Retry-After.

* **Fixtures & demo harness**

  * □ At least three fixtures per endpoint (happy path, common error, edge case).

  * □ Internal demo harness (simple UI or scripts) to exercise all endpoints.

* **Cross-workstream alignment**

  * □ PLoT engine team sign-off: no critical misalignment.

  * □ UI team sign-off: DraftGraphResponseV1 shape and failure behaviours workable.

  * □ Product sign-off: Phase 1 scope and DoD accepted.

### **10.2 Phase 2 – Core PoC features**

* Implement Draft My Model (pricing archetype \+ generic fallback).

* Implement Explainer and Evidence Helper to v0 quality behind flags.

* Integrate Draft My Model into the PoC UI.

### **10.3 Phase 3 – Progressive enhancement**

* Improve quality based on telemetry and manual review.

* Implement Bias Checker, Options, Sensitivity Coach, Team Perspectives behind APIs and SDK.

### **10.4 Phase 4 – MVP/v1.0 integration**

* MVP: integrate Explainer into UI.

* v1.0+: progressively surface other capabilities where they clearly improve decisions.

---

## **11\. Failure modes & degraded behaviour (PoC)**

This table defines **expected behaviour** for key failure/degraded scenarios in the PoC (mostly centred on Draft My Model).

| Failure type | What’s happening | What the user sees (UI) | What they can do | Notes / codes |
| ----- | ----- | ----- | ----- | ----- |
| **CEE timeout** | /assist/v1/draft-graph exceeds internal timeout (e.g. 10s) | Toast/banner: “Drafting is taking too long. Please try again.” Draft is not applied. | Try again later; continue manual graph editing. | CEE returns CEE\_TIMEOUT, retryable \= true. UI logs trace.request\_id. |
| **CEE rate limit** | User exceeds per-session Draft limits (e.g. \>5 calls in 60s) | Toast: “You’re drafting too quickly. Please wait XX seconds and try again.” | Wait for countdown; continue manual work. | CEE\_RATE\_LIMIT, retry\_after\_seconds in details \+ Retry-After header. |
| **CEE validation failure (schema)** | Request/response fails schema validation (bug or misuse) | Generic error toast: “Something went wrong drafting your model. Please try again or edit manually.” | Try again once; if it persists, proceed manually and/or contact support. | CEE\_VALIDATION\_FAILED. CEE should log structured details (no payload). |
| **Engine validation failure** | Engine /v1/validate rejects the graph (structural issue) | Error toast: “Drafted model isn’t valid yet. Some connections need adjusting.” Optionally show issues in issues panel. | Edit graph manually then retry Draft or Run. | CEE\_GRAPH\_INVALID. UI can show validation hints from CEEValidationIssue. |
| **Graph over limits** | Draft exceeds /v1/limits (e.g. \>50 nodes) | Warning near Draft result: “This draft was truncated to keep it manageable.” | Accept/trust truncated graph, or edit/reduce complexity manually. | CEE truncates deterministically, sets summary.truncated \= true, adds warning issue. |
| **Engine degraded mode** | Engine responds with X-Olumi-Degraded header | Banner: “System is in a limited mode. Results may be less reliable than usual.” Runs still allowed. | Continue with caution; consider exporting model and revisiting later. | CEE sets trace.engine\_degraded \= true. Error code stays success; no hard block. |
| **Engine unavailable / 5xx** | Engine health check or call fails (e.g. network, outage) | Banner: “We can’t run models right now. Please try again shortly.” Drafting may still work (CEE can generate structure without running engine). | Continue structural editing; retry later; save decision for later. | CEE returns CEE\_SERVICE\_UNAVAILABLE or CEE\_TIMEOUT, retryable \= true. |
| **Reproducibility mismatch** | Same graph \+ seed \+ configuration yields different response\_hash | Non-blocking banner in Results: “This run differs from previous ones, possibly due to a system update.” | Proceed; optionally export both runs and/or contact support. | CEE may set CEE\_REPRO\_MISMATCH in warnings or error.code if treated as soft error. Include engine version from model\_card. |
| **Document upload / evidence error** | Evidence analysis fails (e.g. file corrupt, extraction error) | Toast: “We couldn’t analyse that document. Please check the file and try again.” Evidence features degrade gracefully. | Re-upload, or continue without evidence assistance. | Evidence endpoints return CEE\_INTERNAL\_ERROR or CEE\_SERVICE\_UNAVAILABLE (depending on cause). Core Draft & Run unaffected. |
| **Internal CEE error** | Unexpected exception in CEE pipeline | Generic toast: “Something went wrong on our side. Please try again.” | Retry once; if repeated, proceed manually and/or contact support. | CEE\_INTERNAL\_ERROR, retryable \= false. CEE must log structured diagnostics without payload. |

In all cases:

* **Core loop (edit graph → run engine)** must remain available wherever feasible.

* CEE failures must **never silently corrupt graphs**; they either fail clearly, or degrade gracefully while preserving user-authored content.

---

## **12\. Responsibilities per workstream**

**PloT Engine (Windsurf)**

* Maintain canonical GraphV1 and report.v1 contracts, /v1/limits, /v1/validate, health and degraded headers.

* Ensure deterministic behaviour as defined (seed, response\_hash).

* Inform CEE when contracts or limits change so CEE can regenerate types.

**Assistants / CEE**

* Implement /assist/v1/... exactly as per this spec, importing engine types.

* Implement validation pipeline, telemetry, rate limiting and error mapping.

* Deliver a high-quality Draft My Model for pricing decisions as the first PoC-visible capability.

* Maintain a demo harness to exercise all CEE features safely.

**Scenario Sandbox UI (Windsurf)**

* Integrate /assist/v1/draft-graph via the CEE SDK.

* Implement UI behaviours for Draft acceptance, truncation indicators, validation issues and failure modes.

* Add Explainer and later features as and when product prioritises them, using the same contracts.

---

