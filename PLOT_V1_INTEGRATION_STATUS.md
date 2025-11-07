# PLoT v1 UI⇄API Shape Separation - Implementation Status

**Branch:** `feat/plot-v1-shape-separation`
**Date:** 28 Oct 2025
**Status:** Foundation Complete, Integration In Progress

## ✅ Completed (Foundational Layer)

### 1. Type System - Strict Shape Separation
**File:** [`src/types/plot.ts`](src/types/plot.ts)

- ✅ `UiGraph` type (React Flow format: `source/target/id/data`)
- ✅ `ApiGraph` type (PLoT v1 format: `from/to/label/weight`)
- ✅ `RunRequest`, `RunResponse` types
- ✅ Full TypeScript strict mode compliance

### 2. Clean Mapper API
**File:** [`src/adapters/plot/v1/mapper.ts`](src/adapters/plot/v1/mapper.ts)

- ✅ `toApiGraph(UiGraph): ApiGraph` - converts UI → API shape
- ✅ `isApiGraph(any): boolean` - type guard for templates
- ✅ Weight normalization (75 → 0.75, -25 → -0.25)
- ✅ Confidence fallback (always non-negative)
- ✅ Never leaks `source/target/id/data.confidence`
- ✅ Legacy functions preserved for backward compatibility

**Test Coverage:** 25/25 tests passing ✅
**File:** [`src/adapters/plot/v1/__tests__/mapper.spec.ts`](src/adapters/plot/v1/__tests__/mapper.spec.ts)

- ✅ Node mapping (label priority: `node.label` → `node.data.label`)
- ✅ Edge shape correctness (strips UI fields)
- ✅ Positive weight normalization (1, 0.6, 75 → 0.75, 100 → 1)
- ✅ Negative weight preservation (-0.4, -25 → -0.25, -100 → -1)
- ✅ Confidence fallback (0.6, 60 → 0.6, prefers weight)
- ✅ Complex graphs with no field leakage

### 3. Report Normalizer
**File:** [`src/adapters/plot/v1/reportNormalizer.ts`](src/adapters/plot/v1/reportNormalizer.ts)

- ✅ `toUiReport(RunResponse): NormalizedReport`
- ✅ Current format: `results.{conservative,most_likely,optimistic}`
- ✅ Legacy format: `result.summary.{conservative,likely,optimistic}`
- ✅ Determinism: `meta.seed` + `model_card.response_hash`
- ✅ Drivers with polarity/strength classification

**Test Coverage:** 17/17 tests passing ✅
**File:** [`src/adapters/plot/v1/__tests__/reportNormalizer.spec.ts`](src/adapters/plot/v1/__tests__/reportNormalizer.spec.ts)

- ✅ Both envelope formats
- ✅ Seed extraction (meta.seed → model_card.seed)
- ✅ Hash extraction (model_card.response_hash → response_hash)
- ✅ Driver classification (polarity: up/down/neutral, strength: high/medium/low)
- ✅ Missing data handling

### 4. Probe Configuration
**File:** [`src/adapters/plot/v1/probe.ts`](src/adapters/plot/v1/probe.ts)

- ✅ Uses `HEAD /v1/run` (lines 169-189)
- ✅ 405 Method Not Allowed = route exists ✅
- ✅ 5-minute cache with sessionStorage
- ✅ Already correct per requirements

### 5. Previous Polish Improvements (Sprint 2)
**Files:** Various

- ✅ Driver `kind` field preservation ([`httpV1Adapter.ts:76`](src/adapters/plot/httpV1Adapter.ts#L76))
- ✅ Adapter mode observability ([`store.ts:854-864`](src/canvas/store.ts#L854-L864))
- ✅ Global toast queue ([`TemplatesPanel.tsx:26`](src/canvas/panels/TemplatesPanel.tsx#L26))
- ✅ `getAllBlueprints()` fallback ([`TemplatesPanel.tsx:40-86`](src/canvas/panels/TemplatesPanel.tsx#L40-L86))
- ✅ "Refresh from API" CTA ([`TemplatesPanel.tsx:92-98`](src/canvas/panels/TemplatesPanel.tsx#L92-L98))

**Test Status:** All existing tests passing ✅

---

## 🚧 In Progress (Integration Layer)

### 6. httpV1Adapter Integration
**File:** [`src/adapters/plot/httpV1Adapter.ts`](src/adapters/plot/httpV1Adapter.ts)

**Required Changes:**

1. **Import new modules:**
   ```typescript
   import { toApiGraph, isApiGraph } from './v1/mapper'
   import { toUiReport } from './v1/reportNormalizer'
   import type { ApiGraph } from '../types/plot'
   ```

2. **Update `run()` method (lines 153-186):**
   ```typescript
   async run(input: RunRequest): Promise<ReportV1> {
     const graph = input.graph || await loadTemplateGraph(input.template_id)

     // Check if already API shape (from templates)
     const apiGraph: ApiGraph = isApiGraph(graph)
       ? graph
       : toApiGraph(graph as UiGraph)

     const requestBody = {
       graph: apiGraph,
       seed: input.seed,
       // Optional knobs (if provided):
       k_samples: input.k_samples,
       treatment_node: input.treatment_node,
       outcome_node: input.outcome_node,
       baseline_value: input.baseline_value,
       // DO NOT include: meta.template_id
     }

     const response = await v1http.runSync(requestBody)
     const normalized = toUiReport(response.result)

     // Map to ReportV1 format expected by UI
     return {
       schema: 'report.v1',
       meta: {
         seed: normalized.seed || 1337,
         response_id: normalized.hash || `http-v1-${Date.now()}`,
         elapsed_ms: response.execution_ms,
       },
       model_card: {
         response_hash: normalized.hash || '',
         response_hash_algo: 'sha256',
         normalized: true,
       },
       results: {
         conservative: normalized.conservative,
         likely: normalized.mostLikely,
         optimistic: normalized.optimistic,
         units: 'units',
       },
       confidence: { level: 'medium', why: '' },
       drivers: normalized.drivers,
     }
   }
   ```

3. **Remove deprecated:**
   - `mapGraphToV1Request()` (use `toApiGraph` instead)
   - `mapV1ResultToReport()` (use `toUiReport` instead)
   - Legacy validation calls

**Status:** Not yet implemented (high risk, needs careful testing)

---

## 📋 Remaining Tasks (PR-A)

### 7. Contract Tests Update
**File:** [`src/adapters/plot/__tests__/httpV1Adapter.contract.test.ts`](src/adapters/plot/__tests__/httpV1Adapter.contract.test.ts)

**Required:**
- ✅ Verify POST /v1/run receives ONLY `{nodes:[{id,label?}], edges:[{from,to,label?,weight?}]}`
- ✅ Assert NO `source/target/id/data.confidence` in request
- ✅ Test error mappings: 400 BAD_INPUT, 413 LIMIT_EXCEEDED, 429 RATE_LIMITED, 5xx
- ✅ Verify deterministic `response_hash` echoed to UI

**Status:** Not yet implemented

### 8. E2E Tests
**File:** `e2e/canvas-templates-run.spec.ts` (new)

**Required:**
- ✅ Mock `GET /v1/templates/{id}/graph` (API shape)
- ✅ Insert template → Run → Results panel
- ✅ Assert Seed • Hash visible
- ✅ Assert probe failure shows fallback banner

**Status:** Not yet implemented

### 9. Results Panel - Seed • Hash Display
**Files:** [`src/canvas/panels/ResultsPanel.tsx`](src/canvas/panels/ResultsPanel.tsx)

**Required:**
- ✅ Show "Seed: 42 • Hash: abc123" (KPI footer or collapsed section)
- ✅ Copy-to-clipboard on click (with toast)
- ✅ Unit test in `ResultsPanel.spec.tsx`

**Status:** Not yet implemented

---

## 📋 Remaining Tasks (PR-B)

### 10. Documentation
**File:** `docs/UI_Handoff_PLoT_v1.md` (new)

**Required:**
- Live endpoints list
- API vs UI shape tables
- Weight semantics (negative = inhibitory)
- Determinism explanation
- curl examples

**Status:** Not yet implemented

### 11. Guard Test
**File:** `src/adapters/plot/v1/__tests__/mapper.guard.spec.ts` (new)

**Required:**
- One focused test: `toApiGraph` never outputs `source/target/id/data.confidence`
- Assert: `75 → 0.75`, `-25 → -0.25`, `confidence=60 → weight=0.6`

**Status:** Not yet implemented

---

## ⚠️ Risk Assessment

### HIGH RISK (Breaking Changes)
- **httpV1Adapter integration**: Touches critical run path
- **Error handling**: Need to ensure all error codes map correctly
- **Template insertion**: Must preserve API shape pass-through

### MEDIUM RISK (Regression Potential)
- **Weight normalization**: Edge cases with 0, 1, 100, -100
- **Confidence fallback**: Must remain non-negative
- **Determinism**: Seed/hash must always be captured

### LOW RISK (Additive)
- **New tests**: Pure additions, no changes to existing code
- **Documentation**: Informational only
- **Results panel**: Visual enhancement

---

## 🎯 Acceptance Criteria (PR-A)

- [ ] Adapter uses `HEAD /v1/run` (405 unlock) ✅ Already done
- [ ] POST /v1/run receives only API shape (verified by MSW)
- [ ] UI graph never leaks `source/target/id/data.confidence` past `toApiGraph`
- [ ] Negative weights preserved; confidence fallback non-negative
- [ ] Results normalized; Seed • Hash shown
- [ ] Unit + contract + E2E tests green; TS strict, no errors
- [ ] No regressions in existing template flow

---

## 🎯 Acceptance Criteria (PR-B)

- [ ] `docs/UI_Handoff_PLoT_v1.md` complete
- [ ] Guard test in place
- [ ] Results panel determinism UX confirmed by unit test

---

## 📊 Test Summary

| Module | Tests | Status |
|--------|-------|--------|
| `mapper.spec.ts` | 25 | ✅ Pass |
| `reportNormalizer.spec.ts` | 17 | ✅ Pass |
| `mapper.test.ts` (legacy) | 19 | ✅ Pass |
| **Total** | **61** | **✅ Pass** |

---

## 🚀 Next Steps

### Immediate (Critical Path)
1. **Complete httpV1Adapter integration** (careful, test each change)
2. **Update contract tests** (verify API shape)
3. **Add E2E test** (template flow)

### Follow-up (Polish)
4. **Add Seed • Hash display** (Results panel)
5. **Create documentation** (PR-B)
6. **Add guard test** (PR-B)

### Before Merge
7. **Full regression testing** (all flows)
8. **Manual QA** (insert template → run → results)
9. **Screenshot/GIF** (for PR)

---

## 📝 Notes

- **Legacy functions preserved**: `graphToV1Request`, `computeClientHash`, `validateGraphLimits` marked `@deprecated` but functional
- **Backward compatibility**: All existing tests pass
- **Type safety**: Strict TypeScript, no `any` escapes in new code
- **Probe already correct**: Using `HEAD /v1/run` with 405 detection
- **Weight semantics**: Negative values supported (inhibitory edges)

---

## 🤝 Handoff Guidance

If continuing this work:

1. **Start with httpV1Adapter**: Most critical, highest risk
2. **Test incrementally**: Run contract tests after each change
3. **Preserve determinism**: Always capture seed + hash
4. **Watch for edge cases**: Weight normalization (0, 1, 100, -100)
5. **Verify templates**: API-shape pass-through must work
6. **Manual testing**: Insert template → run → check console for API request shape

**Key Files to Modify:**
- `src/adapters/plot/httpV1Adapter.ts` (run method)
- `src/adapters/plot/__tests__/httpV1Adapter.contract.test.ts` (assertions)
- `src/canvas/panels/ResultsPanel.tsx` (Seed • Hash UI)
- `e2e/canvas-templates-run.spec.ts` (new file)

**Do NOT modify:**
- `src/adapters/plot/v1/probe.ts` (already correct)
- `src/adapters/plot/v1/mapper.ts` (complete with tests)
- `src/adapters/plot/v1/reportNormalizer.ts` (complete with tests)
