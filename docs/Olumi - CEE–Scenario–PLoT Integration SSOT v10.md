

---

## **CEE–Scenario–PLoT Integration SSOT v1.0 — 2025-11-19 (Europe/London)**

### **0\. Scope**

This document defines **how CEE v1 integrates with**:

* The **PLoT engine** (plot-lite-service), and

* The **Scenario UI / Sandbox** (DecisionGuideAI).

All three work streams (CEE, PLoT, UI) have agreed the decisions below (D1–D7). This is the canonical reference for implementation.

---

### **1\. Roles and responsibilities**

* **CEE v1 (olumi-assistants-service)**

  * Provides /assist/v1/\* capabilities and a **TypeScript SDK**.

  * Enforces invariants: **metadata-only**, **deterministic**, **centrally validated**, **v1 contracts frozen (additive only)**.

  * Exposes helpers such as:

    * createCEEClient

    * buildCeeDecisionReviewPayload

    * Error helpers: buildCeeErrorViewModel, getCeeErrorMetadata, isRetryableCEEError

    * Engine helpers: buildCeeEngineStatus, applyGraphPatch

    * Portfolio helpers and a lean Evidence Helper v1.

* **PLoT engine (plot-lite-service)**

  * Sole caller of CEE for scenario reviews.

  * Owns the **“CEE orchestrator” step** and the **persisted ceeReview/ceeTrace** fields.

  * Exposes CEE-derived data to the UI via its existing scenario/run API.

* **Scenario UI / Sandbox (DecisionGuideAI)**

  * **Never calls CEE directly.**

  * Reads **ceeReview \+ ceeTrace from PLoT** and renders a Decision Review panel.

  * Treats CEE as an **overlay** on top of engine results, not a gatekeeper.

---

### **2\. Execution model**

#### **2.1 Run pipeline (agreed)**

Current PLoT flow (simplified):

inputs (graph \+ params)  
→ PLoT inference  
→ report.v1 (graph \+ results \+ explainability)  
→ response to Scenario UI

With CEE v1:

inputs → PLoT inference → report.v1  
→ **CEE orchestrator (optional)**  
→ add ceeReview \+ ceeTrace  
→ response to Scenario UI

* The CEE orchestrator runs **after the engine has constructed the graph and results**, at a dedicated “review” step.

* If CEE is **degraded/unavailable/disabled**, the orchestrator simply **skips CEE**; PLoT still returns a normal engine result.

#### **2.2 When CEE runs (v1 scope)**

For **v1**, CEE runs **only** for:

* **Saved/named scenarios**, and

* **Explicit “review runs”**,

not for every transient / scratch run. This keeps latency and cost controlled.

---

### **3\. Contracts**

#### **3.1 CEE ↔ PLoT contract**

**Integration surface**

* **Single integration surface**: **CEE TypeScript SDK only** (no raw HTTP/OpenAPI).

* PLoT adds a thin internal module, e.g. ceeOrchestrator.ts, which:

  * Imports the CEE SDK.

  * Shapes engine artefacts into CEE requests.

  * Returns a **full CeeDecisionReviewPayload** and a small ceeTrace.

**Expected PLoT usage (happy path)**

Inside the CEE orchestrator:

1. Construct an SDK client:

const client \= createCEEClient({  
  apiKey: process.env.CEE\_API\_KEY\!,  
  baseUrl: process.env.CEE\_BASE\_URL,  
  timeout: /\* sensible default, e.g. 60\_000 \*/,  
});

2. Call one or more CEE endpoints using engine artefacts (exact subset is up to PLoT, but typically draft-graph, options, evidence-helper, bias-check, team-perspectives).

3. Build the review payload:

const ceeReview \= buildCeeDecisionReviewPayload({  
  draft,  
  options,  
  evidence,  
  bias,  
  team,  
});

4. Capture trace/engine status:

const engineStatus \= buildCeeEngineStatus(ceeReview.trace);  
const ceeTrace \= {  
  requestId: ceeReview.trace.request\_id,  
  degraded: engineStatus.degraded,  
  timestamp: new Date().toISOString(),  
};

5. Return to the main pipeline:

return { ceeReview, ceeTrace };

**Error behaviour**

* On any error from CEE:

const vm \= buildCeeErrorViewModel(error);

* PLoT:

  * Marks CEE as **failed** for that run (e.g. ceeReview \= null, ceeError \= vm).

  * Still returns a normal engine response to the UI.

  * Logs: ceeTraceId (if available), retryable, and a coarse error code.

**Persistence (v1)**

Per relevant run (saved/named or review run), PLoT persists:

* ceeReview: **full CeeDecisionReviewPayload or a lightly trimmed version** (to be tuned during implementation, but must preserve story/health/journey/uiFlags/trace).

* ceeTrace: e.g.

{  
  requestId: string;  
  degraded: boolean;  
  timestamp: string; // ISO8601  
}

Optional: ceeError (from buildCeeErrorViewModel), if CEE failed.

#### **3.2 PLoT ↔ Scenario UI contract**

The UI consumes **only PLoT’s API**, which is extended with CEE fields.

For each relevant scenario run, PLoT exposes something of the form:

interface ScenarioRunResponse {  
  // existing fields  
  id: string;  
  scenarioId: string;  
  report: ReportV1;  
  // ...  
  // new CEE fields  
  ceeReview?: CeeDecisionReviewPayload | null; // omitted or null if CEE skipped/failed  
  ceeTrace?: {  
    requestId: string;  
    degraded: boolean;  
    timestamp: string;  
  } | null;  
  ceeError?: {  
    code?: string;  
    retryable: boolean;  
    traceId?: string;  
    suggestedAction: 'retry' | 'fix\_input' | 'fail';  
  } | null;  
}

**Scenario UI behaviour**

* The UI adds a **“Decision Review” panel** (right-hand area) that reads these fields.

Panel states:

1. **Loading**

   * While the run (and thus ceeReview) is being fetched → skeleton/spinner.

2. **CEE error (no review, but ceeError present)**

   * Show a banner keyed by ceeError.suggestedAction:

     * "retry" → transient problem; show “Try again” messaging.

     * "fix\_input" → highlight that inputs need adjusting.

     * "fail" → neutral “CEE unavailable” copy.

3. **CEE success (ceeReview present)**

    Use:

* ceeReview.story.headline as the title.

* story.key\_drivers, story.next\_actions as main content.

* journey.is\_complete \+ journey.missing\_envelopes for completeness.

* uiFlags to render chips/badges for:

  * has\_team\_disagreement

  * has\_truncation\_somewhere

  * any “high risk” indicator carried by the payload.

No CEE calls from the browser; the UI treats these fields as just part of the normal run response.

#### **3.3 Config and secrets**

* **CEE secrets live only server-side** (CEE \+ PLoT/assistants).

* Scenario UI:

  * Has **no CEE API key** and no awareness of CEE endpoints.

  * Only talks to PLoT (and any UI backend) over existing APIs.

---

### **4\. Error, degraded, and “no CEE” cases**

* If CEE is disabled, rate-limited, or degraded:

  * PLoT: do not block engine runs; simply omit ceeReview and set an appropriate ceeError and/or ceeTrace.degraded \= true.

  * UI: still shows normal engine outputs; Decision Review panel shows a calm, non-alarming banner or neutral “Not available for this run” state.

* CEE remains an **overlay**, not a gatekeeper:

  * Engine correctness and UI core flows **must not depend** on CEE.

---

### **5\. Implementation checklist by work stream**

(High level; you can turn these into concrete tickets/agent prompts.)

#### **5.1 CEE workstream (this repo)**

* Ensure CeeDecisionReviewPayload is:

  * Clearly documented as the **external review contract** in Docs/CEE-v1.md.

  * Stable for v1 (additive changes only).

* Optional: add a helper buildCompactDecisionReview(ceeReview) that:

  * Trims any fields we know we will never need in PLoT/UI.

  * Stays metadata-only and deterministic.

* Add a short section in Docs/CEE-v1.md and/or CEE-maintainers-guide.md linking to this **Integration SSOT**.

#### **5.2 PLoT engine workstream**

* Implement ceeOrchestrator module:

  * Uses the CEE TS SDK.

  * Follows the pipeline and error behaviour in §3.1 and §4.

* Extend the run data model with ceeReview, ceeTrace, ceeError as in §3.2.

* Add logging/metrics:

  * ceeTrace.requestId, ceeTrace.degraded.

  * Simple counters: “CEE called / skipped / failed / degraded”.

* Add tests for:

  * Happy-path CEE review attachment.

  * CEE error cases not breaking engine responses.

  * “No CEE” cases (disabled) behaving identically to today.

#### **5.3 Scenario UI workstream**

* Extend the run/Scenario client types to include ceeReview, ceeTrace, ceeError.

* Implement the **Decision Review panel**:

  * Loading, error, and success states as per §3.2.

  * Use only PLoT data; no CEE calls.

* Add basic tests:

  * Panel renders correctly for review present / absent / errored.

  * Chips/badges respond to uiFlags and journey fields.

---

This SSOT is now the reference for CEE ↔ PLoT ↔ Scenario UI integration.

If any work stream needs to diverge, the change should be made **here first** (bumping the version), then implemented in code.

