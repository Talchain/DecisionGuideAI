# V5 Alpha Hardening (UI) — Evidence Pack

Branch: `claude/v5-alpha-hardening-ui`
Off: `staging` at `f7907f896e3f4d7947aeaa585c1f3bb3b54d59a0`
Previous branch (left clean): `ui/analysis-tab-visual-system` at `361538a13e8a41744a1821aa533f42959aafde31`

## Phase 0 — Baseline

### Branch / commit provenance

- Branch created from `staging` (HEAD `f7907f89`) with `git checkout -b claude/v5-alpha-hardening-ui staging`.
- Top staging commit: `f7907f89 fix(v5): wire analysis_ready through applyV5State to store` (2026-04-23). This commit already added the lenient normaliser, option_id→id mapping, inline-path ownership gate, and malformed-payload clearing. **This hardening branch builds on top of that wiring** — it adds logging, stale-turn safety, chip readiness gating, null-probability guards, and the BoundaryError contract.

### Baseline test state

| Suite | Files | Tests | Pass | Fail | Skipped | Notes |
|---|---|---|---|---|---|---|
| `src/v5` | 14 | 195 | 195 | 0 | 0 | Clean |
| `src/canvas/conversation` | 90 | 1365 | 1275 | 68 | 22 | **Pre-existing broad regression** — all failures share the `mockCallTurn.mock.calls[0]` undefined pattern, rooted in shared mock harness wiring, not production code. Documented as baseline; this branch must not exceed 68 failures |

Specific files with failures (conversation suite baseline):
- `useConversation.hook.spec.ts` (15 failed / 64 tests)
- `conversation-flow.spec.ts` (12/12)
- `streamingLifecycle.spec.ts` (7/10)
- `analysisInputsReconciliation.spec.ts` (5/5)
- `envelopeAnalysisWiring.spec.ts` (6/9)
- `handleEnvelopeArbitration.spec.ts` (4/4)
- `aiPanelTranche1.spec.tsx` (2/9)
- `useConversation.systemEvents.spec.ts` (6/11)
- `analysisInputsWiring.spec.ts` (7/7)
- `generateDispatch.spec.ts` (4/5)

### Fixture inventory

**Existing V5-relevant fixtures:**
- `src/__contracts__/analysis-ready.fixture.json` — canonical contract fixture (status `ready`, two ready options, one with baseline)
- `src/canvas/conversation/__tests__/fixtures/cee-orchestrator-response.json` — pre-analysis_ready conversational V5 response (2026-03-07 bundle, `stage_indicator.stage === 'ideate'`, no top-level `analysis_ready`)
- `src/canvas/conversation/__tests__/fixtures/orchestrator-rendering-v2.json` — V4 envelope for render parity
- `src/v5/__tests__/applyV5State.test.ts` — inline `{ goal_node_id, options, status }` payloads across 25 cases

**Captured-response provenance for each new fixture:**

| Fixture (new) | Source / shape class |
|---|---|
| `src/fixtures/v5/analysis_ready_ready.json` | Derived from the canonical contract fixture at `src/__contracts__/analysis-ready.fixture.json`, wrapped as a full `OlumiResponse` (stage_indicator `analyse`, single analysis_result block, top-level `analysis_ready`) |
| `src/fixtures/v5/analysis_ready_not_ready.json` | Adapted from the canonical fixture — one option flipped to `needs_encoding`, top-level `status: 'needs_user_input'`; mirrors the CEE pre-ready state documented in `src/adapters/cee/types.ts:307-318` |
| `src/fixtures/v5/analysis_ready_missing.json` | Based on `cee-orchestrator-response.json` shape with `stage_indicator.stage` flipped to `'analyse'` and an `analysis_result` block added. `analysis_ready` field absent (key not present) |
| `src/fixtures/v5/run_success_full_probs.json` | Minimal OlumiResponse with an `analysis_result` block; probability fields populated to `0.74` / `0.26` matching ReportV1 shape |
| `src/fixtures/v5/run_success_null_probs.json` | Same shell as full_probs, `win_probability: null` across all options. **Models the recent production failure** (analysis_result block present, per-option probs null) |
| `src/fixtures/v5/run_boundary_error.json` | OlumiResponse with `blocks[].type === 'error'` boundary — derived from shape at `src/v5/__tests__/TypedErrorRenderer.test.tsx` |
| `src/fixtures/v5/conversational_chips_only.json` | Extracted from `cee-orchestrator-response.json`, chips-only, no `analysis_ready` key, `stage_indicator: 'ideate'` |
| `src/fixtures/v5/analysis_complete_null_probs_stale_ready.json` | **Reproduction of the recent failing trace**: analysis_result block present + per-option probabilities null + `ceeAnalysisReady` still set to prior turn's `ready` state. Regression guard for the concrete bug |

Note: no live staging bundle access was available during this branch; fixtures are synthesised from the canonical contract fixture, the checked-in conversational bundle, and the shape union documented in `src/adapters/cee/types.ts`. This is called out explicitly in the integrated evidence pack coordination note (Phase 4 §10).

### DS v5 token confirmation

- DS doc: `docs/Design/Olumi_Design_System_v5.md` is the current spec
- `src/styles/brand.css`: `--info: #52A3C8` (line 73), `--primary: #52A3C8` (line 130). Brief's legacy `#63ADCF` / `#3A8FB5` confirmed absent from source tree
- Tokens in scope: `bg-panel`, `bg-panel-hover`, `border-panel-border`, `text-text-body`, `text-danger`, `--info`, `--success`, `--warning`, `--danger` + `-light` variants
- Chip base class set in `SuggestedChips.tsx:118-129` already compliant with DS v5 §21.4 (cap 2, bg-panel, border-panel-border)

### ceeAnalysisReady status mapping (contract the UI must honour)

| Wire `status` | Per-option statuses present | UI behaviour |
|---|---|---|
| `'ready'` | all options `'ready'` | Executable `run_analysis` chip allowed; pre-analysis panel shows "ready" affordance |
| `'needs_user_input'` | any option `'needs_user_mapping'` / `'needs_user_input'` / `'needs_encoding'` | Hide executable `run_analysis` chip; conversational chips still render |
| `'needs_encoding'` | n/a | Hide executable `run_analysis` chip |
| `'needs_user_mapping'` | n/a | Hide executable `run_analysis` chip |
| `'unknown'` or absent on **analyse-shaped** turn | n/a | Clear `ceeAnalysisReady` slice; hide executable `run_analysis` chip |
| absent on **conversational** turn (no `analysis_result` block, stage `ideate`/`frame`) | n/a | Preserve existing `ceeAnalysisReady` value |

(Populated at Phase 1; referenced by Phase 2.2 and Phase 2.3 regression tests.)

---

## Phase 1 — Diagnostic logging (pending)
## Phase 2 — Fixes (pending)
## Phase 3 — DS verification (pending)
## Phase 4 — Tests + fixtures (pending)

---

## Open discoveries / follow-ups

(Populated as phases complete.)
