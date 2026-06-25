# UI-SEM — Semantic Transform Inventory

The UI must not transform meaning (flip signs, default missing values, clamp ranges).
Every place it unavoidably does is tagged with a `UI-SEM-NNN` comment and listed here.
The rule and rationale live in [`../CLAUDE.md`](../CLAUDE.md); this is the full register.

When you add a transform, tag it with the next free ID and add a row. "Remove when PLoT
provides…" rows are debt — the value is fabricated in the UI and should move upstream.

| ID | Location | Description | Status |
|----|----------|-------------|--------|
| UI-SEM-001 | `src/adapters/plot/v2/adapter.ts:549` | Canvas weight+direction → signed mean (wire format) | Keep — format conversion (legitimate) |
| UI-SEM-002 | `src/adapters/plot/v2/adapter.ts:306` | Observed state default injection (std/baseline fallback) | Keep — adapter concern (legitimate) |
| UI-SEM-003 | `src/adapters/plot/v2/adapter.ts:308` | STD floor enforcement (prevents zero-variance crash) | Keep — adapter concern (legitimate) |
| UI-SEM-004 | `src/canvas/adapters/islRequestAdapter.ts:646` | Risk→goal sign heuristic (last-resort fallback) | Keep — adapter concern (legitimate) |
| UI-SEM-005 | `src/components/results/useResultsSectionData.ts:1034` | Robustness level derivation from stability thresholds (0.8/0.5/0.3) | Remove when PLoT provides level |
| UI-SEM-006 | `src/components/results/buildResultsVM.ts:78` | DecisionState thresholds (GAP 0.10, ROBUST 0.80, SENSITIVE 0.55) | Keep — VM-layer display (legitimate) |
| UI-SEM-007 | `src/components/results/buildResultsVM.ts:41` | Stability fabrication from categorical robustness level | Remove when PLoT guarantees numeric stability |
| UI-SEM-008 | `src/lib/format.ts:61` | Probability cap at 99% | Keep — display formatting (legitimate) |
| UI-SEM-009 | `src/canvas/components/DecisionSummary.tsx:239` | p15/p85 confidence band fabrication (interpolated from p10/p50/p90) | Remove — request from PLoT or delete |
| UI-SEM-010 | `src/types/constraints.ts:38` | Constraint confidence colour thresholds (HIGH≥0.70, LOW≥0.40) | Keep — display formatting (legitimate) |
| UI-SEM-011 | `src/canvas/hooks/useGraphReadiness.ts:323` | Default belief injection (0.8) for CEE coaching | Keep — pre-analysis default (low risk) |
| UI-SEM-012 | `src/components/results/useResultsSectionData.ts:1913` | Edge severity from switch_probability (>0.7 critical, >0.5 error) | Remove when PLoT provides severity |
| UI-SEM-013 | `src/components/results/useResultsSectionData.ts:1630` | Fragile edge filter threshold (0.15) | Remove when PLoT provides visibility gate |
| UI-SEM-014 | `src/components/results/DriversSection.tsx:259` | VOI evidence threshold (>0.05 shows hint) | Remove when PLoT provides visibility gate |
| UI-SEM-015 | `src/components/results/useResultsSectionData.ts:578` | Confidence tier score-based fallback (>=70 strong, >=40 fair) | Remove when PLoT provides tier thresholds |
| UI-SEM-016 | `src/adapters/plot/enrichment.ts:279` | Robustness label from numeric score (>=0.7 robust, >=0.4 moderate) | Remove when PLoT provides label |
| UI-SEM-017 | `src/adapters/plot/httpV1Adapter.ts:87` | Confidence level from numeric score (>=0.7 high, >=0.4 medium) | Remove when PLoT provides categorical level |
| UI-SEM-018 | `src/canvas/components/UnifiedStatusBadge.tsx:49` | Confidence score fabrication (high=0.8, medium=0.5, low=0.3) + status thresholds | Remove when PLoT provides numeric confidence |
| UI-SEM-019 | `src/components/results/useResultsSectionData.ts:537` | Readiness/confidence taxonomy mapping (varied PLoT labels → strong/fair/needs_work) | Remove when PLoT provides canonical tier enum |
| UI-SEM-020 | `src/canvas/hooks/useStagePill.ts` | Stage derivation from canvas state (no graph=frame, graph=ideate, complete=evaluate) | Remove when orchestrator provides envelope.stage_indicator |
| UI-SEM-021 | `src/components/results/HeroSection.tsx:258` | Suppress coaching copy containing "robust"/"ready to proceed" when robustness level is low/very_low | Remove when PLoT/CEE provides robustness-conditioned coaching copy |
| UI-SEM-022 | `src/canvas/components/DraftChat.tsx:505` | Direction inference from signed weight when CEE omits effect_direction | Keep — defensive fallback (remove when CEE guarantees direction) |
| UI-SEM-023 | `src/canvas/components/DraftChat.tsx:519` | Weight magnitude clamped to [0, 2] range | Keep — prevents out-of-range values |
| UI-SEM-024 | `src/canvas/components/DraftChat.tsx:543` | Belief confidence clamped to [0, 1] | Keep — normalisation |
| UI-SEM-025 | `src/canvas/components/DraftChat.tsx:553` | belief_exists clamped to [0, 1] | Keep — normalisation |
| UI-SEM-026 | `src/adapters/cee/client.ts:255` | CEE edge weight clamped to [0, 1] | Keep — normalisation (CIL 0.2) |
| UI-SEM-027 | `src/adapters/cee/client.ts:261` | CEE edge belief clamped to [0, 1] | Keep — normalisation (CIL 0.2) |
| UI-SEM-028 | `src/adapters/cee/client.ts:307` | CEE belief_exists clamped to [0, 1] | Keep — normalisation (CIL 0.2) |
| UI-SEM-029 | `src/canvas/ui/inspector-v2/panels/EdgePanel.tsx:121` | Edge weight/direction display defaults (0.5 / 'positive') | Keep — display-only fallback |
| UI-SEM-030 | `src/canvas/hooks/useGraphReadiness.ts:382` | Edge defaults for CEE coaching (weight 0.5, belief 0.8, direction 'positive') | Keep — pre-analysis defaults (same class as UI-SEM-011) |
| UI-SEM-031 | `src/adapters/plot/v2/adapter.ts:597` | Default exists_probability (0.8) for std computation | Keep — adapter concern (same class as UI-SEM-002) |
| UI-SEM-032 | `src/canvas/adapters/islRequestAdapter.ts:169` | Default exists_probability (0.8) for std computation — mirrors UI-SEM-031 | Keep — adapter concern |
| UI-SEM-033 | `src/canvas/components/ModelTabBody.tsx:683` | Edge display defaults (weight 0.5, direction 'positive', belief 0.7) | Keep — display-only fallback |
| UI-SEM-034 | `src/adapters/plot/v1/mapper.ts:207` | V1 adapter belief clamped to [0, 1] | Keep — normalisation |
| UI-SEM-035 | `src/canvas/conversation/useConversation.ts:1086` | Weight clamp to [-1,+1] for CEE signed mean | Keep — format conversion |
| UI-SEM-036 | `src/canvas/adapters/ceeSynthesisAdapter.ts:75` | Robustness label-to-score default 0.5 for CEE synthesis | Keep — contextual, not inference |
| UI-SEM-037 | `src/canvas/adapters/islRobustnessAdapter.ts:171` | Default current_value/flip_threshold/sensitivity = 0.5 | Keep — display-only fallback |
| UI-SEM-038 | `src/canvas/utils/applyDraftResult.ts:74` | Duplicate of UI-SEM-023/024/025 on alternate ingestion path | Keep — normalisation |
| UI-SEM-039 | `src/components/results/useResultsSectionData.ts:538` | Driver semantic label thresholds (0.50 strong, 0.20 moderate) | Remove when PLoT provides semantic labels per driver |
| UI-SEM-040 | `src/components/results/useResultsSectionData.ts:1601` | Dominance detection heuristic (>0.5 influence AND ratio >2:1) | Remove when PLoT provides dominant_factor in all responses |
| UI-SEM-041 | `src/components/results/HeroSection.tsx:175` | Stability UI label thresholds (0.85/0.70/0.55) | Remove when PLoT provides stability labels directly |
| UI-SEM-042 | `src/components/results/HeroSection.tsx:243` | Fragility ratio threshold (>0.7) for trust reason | Remove when PLoT provides trust reason directly |
| UI-SEM-043 | `src/components/results/HeroSection.tsx:250` | Evidence quality threshold (<0.5) for trust reason | Remove when PLoT provides trust reason directly |
| UI-SEM-044 | `src/components/results/HeroSection.tsx:259` | Border colour classification from stability (0.7/0.4) | Remove when PLoT guarantees robustnessLevel |
| UI-SEM-045 | `src/components/results/DriversSection.tsx:175` | Rank flip warning gate (>0.3) | Remove when PLoT provides visibility gate |
| UI-SEM-046 | `src/components/results/DriversSection.tsx:212` | Elasticity display scaling (x10, floor 1) | Remove when PLoT provides shift percentage |
| UI-SEM-047 | `src/components/results/DriversSection.tsx:356` | Confidence clamped to [0, 1] | Keep — normalisation |
| UI-SEM-049 | `src/canvas/components/ModelTabBody.tsx` | VOI fallback: value_of_information * 100 as pp when evpi_percentage_points absent | Remove when PLoT guarantees evpi_percentage_points |
| UI-SEM-050 | `src/components/results/useResultsSectionData.ts` | Leading-option downside flag — true when leading option's `outcome.p10 < 0`, drives one qualifying sentence on the leader card (display-only, never affects ranking or forwarded values) | Keep — display formatting (legitimate) |
