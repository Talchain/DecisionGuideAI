# Feature Flag Classification Report

**Date:** 2026-04-12
**Branch:** staging (commit 9966740e)
**Author:** Claude Code (Phase C5 investigation)

---

## Summary

| Category | Count | Est. dead code (lines) |
|---|---|---|
| permanent-on | 6 | ~74 |
| dead | 19 | ~133 |
| active-rollout | 47 (incl. 21 sandbox-only) | — |
| debug-only | 4 | — |
| **Total (standard flags)** | **76** | **~207** |

Non-standard VITE_* env vars: 18 (see Section 3)

### Methodology: dead-code line estimates

- **permanent-on flags:** 7 lines per flag definition (config object + makeFlag + export) + ~8 lines per consumer site (import line share, flag call, conditional branch, dead else-path). Counted by inspecting each consumer's conditional gating pattern.
- **dead flags:** 7 lines per flag definition only (no consumers exist). Where the flag also appears in `pocFlags` or `dumpFlags`, an additional ~2 lines counted.
- Estimates are conservative; actual savings may be higher when entire components or branches are behind a single flag.

---

## Section 1: Standard flags (src/flags.ts)

### 1A. permanent-on — Inline the true path, delete the flag check and false path

These flags default to `true` in code AND are set to `true` (or unset, falling through to default) in all environments. No `.env` file or Netlify config sets them to `false`. The false path is dead code.

| # | Flag name | Env var | Default | Netlify | Consumers | What it gates | Retirement readiness | Est. lines | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `isInputsOutputsEnabled` | `VITE_FEATURE_INPUTS_OUTPUTS` | `true` | not set | 1 (ReactFlowGraph.tsx) | Documents drawer auto-show on canvas | safe-now | ~15 | Default true, never set false. Single consumer with simple conditional. |
| 2 | `isCommandPaletteEnabled` | `VITE_FEATURE_COMMAND_PALETTE` | `true` | not set | 1 (ReactFlowGraph.tsx) | Cmd+K command palette rendering | safe-now | ~15 | Default true, never set false. Guards single JSX conditional. |
| 3 | `isDegradedBannerEnabled` | `VITE_FEATURE_DEGRADED_BANNER` | `true` | not set | 1 (ReactFlowGraph.tsx) | DegradedBanner component rendering | safe-now | ~15 | Default true, never set false. Guards single JSX element. |
| 4 | `isContextMenuEnabled` | `VITE_FEATURE_CONTEXT_MENU` | `true` | not set | 0 | Right-click context menu (code exists but flag is never checked) | safe-now | ~7 | Default true, 0 consumers. Context menu always renders — flag definition is vestigial. |
| 5 | `isDecisionReviewEnabled` | `VITE_FEATURE_DECISION_REVIEW` | `true` | `true` | 0 | CEE decision review panel | safe-now | ~7 | Default true + Netlify true, but 0 consumers. Decision review code exists unconditionally. Flag definition only. |
| 6 | `isDiagnosticsEnabled` | `VITE_FEATURE_DIAGNOSTICS` | `true` | not set | 1 (StreamFlagsProvider → SandboxStreamPanel) | Diagnostics display in sandbox stream panel | needs-check | ~15 | Default true, but consumed in sandbox panel where it controls conditional rendering. Verify sandbox panel behaviour before removal. |

**Subtotal: ~74 lines**

### 1B. dead — Delete the flag definition (and any remaining gated code)

These flags are defined in `flags.ts` but have zero production consumers (the flag function is never called outside of flags.ts, test helpers, or test files).

| # | Flag name | Env var | Default | Netlify | What it gates | Retirement readiness | Est. lines | Evidence |
|---|---|---|---|---|---|---|---|---|
| 7 | `isScenariosV2Enabled` | `VITE_FEATURE_SCENARIOS_V2` | `false` | not set | Scenarios v2 (never built) | safe-now | ~7 | 0 consumers. No gated code exists. |
| 8 | `isA11yPolishEnabled` | `VITE_FEATURE_A11Y_POLISH` | `false` | not set | A11y polish pass (never built) | safe-now | ~7 | 0 consumers. No gated code exists. |
| 9 | `isSseAutoEnabled` | (localStorage only) | `false` | n/a | SSE auto-reconnect (never wired) | safe-now | ~7 | 0 consumers. localStorage-only flag, never read. |
| 10 | `isOptimiseBetaEnabled` | `VITE_FEATURE_OPTIMISE_BETA` | `false` | not set | Optimise beta feature (never built) | safe-now | ~7 | 0 consumers. No gated code exists. |
| 11 | `isV3SystemEventsEnabled` | `VITE_ENABLE_V3_SYSTEM_EVENTS` | `false` | `true` | CEE v3 system event wire format | needs-check | ~7 | 0 consumers of the flag function. Netlify sets true but no code reads it. Check if the v3 format is now unconditional or if this flag was meant to gate something not yet wired. |
| 12 | `isModelCardLiteEnabled` | `VITE_FEATURE_MODEL_CARD_LITE` | `false` | `true` | Model Card Lite component | needs-check | ~7 | 0 consumers of the flag. Component `ModelCardLite.tsx` exists but is not gated by this flag — it's rendered unconditionally. Netlify sets true. Flag definition is dead. |
| 13 | `isCausalClaimsEnabled` | `VITE_FEATURE_CAUSAL_CLAIMS` | `false` | `true` | Causal claims in edge inspector | needs-check | ~7 | 0 consumers of the flag. Adapter `causalClaimsAdapter.ts` exists but is not gated. Netlify sets true. Flag definition is dead. |
| 14 | `isNodeIntelligenceEnabled` | `VITE_FEATURE_NODE_INTELLIGENCE` | `false` | `true` | Node intelligence section in inspector | needs-check | ~7 | 0 consumers. Netlify sets true. Feature may exist ungated or may not be built yet. |
| 15 | `isSandboxDecisionCtaEnabled` | `VITE_FEATURE_SANDBOX_DECISION_CTA` | `false` | not set | Sandbox decision CTA button | safe-now | ~7 | 0 consumers. Also in pocFlags (via `pocFlags.decisionCta`). pocFlags consumer: 0 outside flags.ts. |
| 16 | `isSandboxMappingEnabled` | `VITE_FEATURE_SANDBOX_MAPPING` | `false` | not set | Sandbox mapping feature | safe-now | ~7 | 0 consumers. Also in pocFlags. |
| 17 | `isSandboxProjectionsEnabled` | `VITE_FEATURE_SANDBOX_PROJECTIONS` | `false` | not set | Sandbox projections feature | safe-now | ~7 | 0 consumers. Also in pocFlags. |
| 18 | `isSandboxRealtimeEnabled` | `VITE_FEATURE_SANDBOX_REALTIME` | `false` | not set | Sandbox realtime feature | safe-now | ~7 | 0 consumers. Also in pocFlags. |
| 19 | `isSandboxStrategyBridgeEnabled` | `VITE_FEATURE_SANDBOX_STRATEGY_BRIDGE` | `false` | not set | Sandbox strategy bridge | safe-now | ~7 | 0 consumers. Also in pocFlags. |
| 20 | `isSandboxTriggersBasicEnabled` | `VITE_FEATURE_SANDBOX_TRIGGERS_BASIC` | `false` | not set | Sandbox triggers | safe-now | ~7 | 0 consumers. Also in pocFlags. |
| 21 | `isSandboxVotingEnabled` | `VITE_FEATURE_SANDBOX_VOTING` | `false` | not set | Sandbox voting feature | safe-now | ~7 | 0 consumers. Also in pocFlags. |
| 22 | `isWhiteboardEnabled` | `VITE_FEATURE_WHITEBOARD` | `false` | not set | Whiteboard feature | safe-now | ~7 | 0 consumers. Also in pocFlags. |
| 23 | `isCanvasDefaultEnabled` | `VITE_FEATURE_CANVAS_DEFAULT` | `false` | not set | Canvas as default view | needs-check | ~7 | 1 consumer: SandboxStreamPanel line 137 (dynamic access). Canvas is now the main app — verify this sandbox-only flag is truly obsolete. |
| 24 | `isScenarioImportPreviewEnabled` | `VITE_FEATURE_SCENARIO_IMPORT_PREVIEW` | `false` | not set | Scenario import preview | needs-check | ~7 | 1 consumer: SandboxStreamPanel line 455 (dynamic access). Sandbox-only. |
| 25 | `isConfidenceChipsEnabled` | `VITE_FEATURE_CONFIDENCE_CHIPS` | `false` | not set | Confidence chips UI in sandbox | safe-now | ~7 | 1 consumer: SandboxStreamPanel (flag read, controls chip rendering). Default false, not set in any env. Feature off everywhere. |

**Note on sandbox-only flags (items 23-25):** These are consumed only in `SandboxStreamPanel.tsx`. If the sandbox panel is slated for removal, these flags go with it. Classified as dead from the main canvas app perspective.

**Subtotal: ~133 lines**

### 1C. active-rollout — Keep (currently used to control a toggleable feature)

| # | Flag name | Env var | Default | Netlify | Consumers | What it gates |
|---|---|---|---|---|---|---|
| 26 | `isSseEnabled` | `VITE_FEATURE_SSE` | `false` | `1` | 2 | SSE streaming in SandboxStreamPanel + AppPoC. Also in pocFlags. |
| 27 | `isSnapshotsEnabled` | `VITE_FEATURE_SNAPSHOTS` | `false` | not set | 1 (StreamFlagsProvider → SandboxStreamPanel) | Snapshot panel in sandbox stream |
| 28 | `isCompareEnabled` | `VITE_FEATURE_COMPARE` | `false` | not set | 1 (StreamFlagsProvider → SandboxStreamPanel) | Compare feature in sandbox stream |
| 29 | `isSnapshotsV2Enabled` | `VITE_FEATURE_SNAPSHOTS_V2` | `false` | not set | 3 (SnapshotPanel, snapshots.ts, VisualDiff) | V2 snapshot format/UI in canvas |
| 30 | `isSchemaV2Enabled` | `VITE_FEATURE_SCHEMA_V2` | `false` | `1` | 1 (useCEEDraft.ts) | CEE schema v2 (observed_state, effect_direction) |
| 31 | `isPlotEnrichmentEnabled` | `VITE_USE_PLOT_ENRICHMENT` | `false` | `1` | 3 (httpV1Adapter, enrichment, useISLValidation) | PLoT enrichment routing consolidation |
| 32 | `isOrchestratorV2Enabled` | `VITE_ENABLE_ORCHESTRATOR_V2` | `false` | `true` | 5 (useConversation, useGraphEditEvents, useSessionResumeEvent, useAnalysisCompleteEvent, CanvasToolbar) | Orchestrator v2 conversation path |
| 33 | `isLegacyDirectRunEnabled` | `VITE_ENABLE_LEGACY_DIRECT_RUN` | `true` | `false` | 1 (CanvasToolbar) | Direct PLoT /v1/run alongside orchestrator. Netlify=false means orchestrator-only on staging. |
| 34 | `isOrchestratorStreamingEnabled` | `VITE_FEATURE_ORCHESTRATOR_STREAMING` | `false` | `1` | 1 (useConversation) | SSE streaming for orchestrator turns |
| 35 | `isCompareTabEnabled` | `VITE_FEATURE_COMPARE_TAB` | `false` | `1` | 2 (OutputsDock, store.ts) | Compare tab in OutputsDock |
| 36 | `isJourneyTabEnabled` | `VITE_FEATURE_JOURNEY_TAB` | `false` | not set | 2 (OutputsDock, useGraphEditEvents) | Decision Journey tab in OutputsDock |
| 37 | `isThreadPersistEnabled` | `VITE_FEATURE_THREAD_PERSIST` | `false` | not set | 3 (useConversation, useThreadPersistence, threadService) | Thread persistence to Supabase |
| 38 | `isThreadHydrateEnabled` | `VITE_FEATURE_THREAD_HYDRATE` | `false` | not set | 1 (useConversation) | Thread hydration on scenario resume |
| 39 | `isBilPreviewEnabled` | `VITE_FEATURE_BIL` | `false` | `true` | 1 (ChatComposer) | BIL local preview in chat composer |
| 40 | `isPreAnalysisEnrichedEnabled` | `VITE_FEATURE_PRE_ANALYSIS_ENRICHED` | `false` | `true` | 2 (ModelSnapshot, InlineBlocks) | Pre-analysis enrichment (receipt, evidence gaps) |
| 41 | `isGraphBadgesEnabled` | `VITE_FEATURE_GRAPH_BADGES` | `false` | `true` | 1 (FactorNode) | Evidence gap badges on factor nodes |
| 42 | `isCrossHighlightEnabled` | `VITE_FEATURE_CROSS_HIGHLIGHT` | `false` | `true` | 3 (HighlightContext, WorthInvestigating, ReactFlowGraph) | Cross-surface hover highlighting |
| 43 | `isGraphLensEnabled` | `VITE_FEATURE_GRAPH_LENS` | `false` | `1` | 7 (BaseNode, useMenuItems, LensInfoPanel, useCanvasKeyboardShortcuts, StyledEdge, LeftSidebar, OptionCards) | Post-analysis canvas filtering modes |
| 44 | `isOrchestratorRenderingV2Enabled` | `VITE_FEATURE_ORCHESTRATOR_RENDERING_V2` | `false` | not set (but `ORCHESTRATOR_RENDERING_V2=1` on Netlify without VITE_ prefix) | 3 (SuggestedChips, MessageBubble, InlineBlocks) | SafeRichText, commentary collapse, tone styling |
| 45 | `isDeterministicCeeEnabled` | `VITE_FEATURE_DETERMINISTIC_CEE` | `false` | `1` | 2 (MessageBubble, InlineBlocks) | Deterministic CEE typed blocks + insights |
| 46 | `isGhostEnabled` | `VITE_FEATURE_GHOST_PANEL` | `false` | not set | 1 (GhostPanel) | Ghost/draft panel in PLoT Lite route |
| 47 | `isOnboardingTourEnabled` | `VITE_FEATURE_ONBOARDING` | `false` | not set | 2 (CoachMarks, EmptyState) | Onboarding coach marks overlay |
| 48 | `isCanvasEnabled` | `VITE_FEATURE_CANVAS` | `false` | not set | 2 (SandboxStreamPanel, CanvasDrawer) | Canvas drawer in sandbox panel |
| 49 | `isTldrawEnabled` | `VITE_FEATURE_TLDRAW` | `false` | not set | 1 (CanvasDrawer) | TLDraw integration in canvas drawer |
| 50 | `isScenariosEnabled` | `VITE_FEATURE_SCENARIOS` | `false` | not set | 1 (SandboxStreamPanel) | Scenario management in sandbox |
| 51 | `isE2EEnabled` | `VITE_E2E` | `false` | not set | 7 (App, HealthIndicator, SandboxStreamPanel, AuthGuard, AuthContext, featureFlags, supabase) | E2E testing mode |
| 52a | `isHintsEnabled` | `VITE_FEATURE_HINTS` | `false` | not set | 1 (SandboxStreamPanel) | Hints display in sandbox stream |
| 52b | `isParamsEnabled` | `VITE_FEATURE_PARAMS` | `false` | not set | 1 (SandboxStreamPanel) | Parameters panel in sandbox stream |
| 52c | `isHistoryEnabled` | `VITE_FEATURE_HISTORY` | `false` | not set | 1 (SandboxStreamPanel) | History panel in sandbox stream |
| 52d | `isExportEnabled` | `VITE_FEATURE_EXPORT` | `false` | not set | 1 (SandboxStreamPanel) | Export feature in sandbox stream |
| 52e | `isReplayEnabled` | `VITE_FEATURE_REPLAY` | `false` | not set | 1 (SandboxStreamPanel) | Replay feature in sandbox stream |
| 52f | `isHistoryRerunEnabled` | `VITE_FEATURE_HISTORY_RERUN` | `false` | not set | 1 (RunHistoryDrawer) | History rerun in sandbox |
| 52g | `isMarkdownPreviewEnabled` | `VITE_FEATURE_MD_PREVIEW` | `false` | not set | 1 (SandboxStreamPanel) | Markdown preview in sandbox stream |
| 52h | `isShortcutsEnabled` | `VITE_FEATURE_SHORTCUTS` | `false` | not set | 1 (SandboxStreamPanel) | Keyboard shortcuts in sandbox stream |
| 52i | `isCopyCodeEnabled` | `VITE_FEATURE_COPY_CODE` | `false` | not set | 1 (SandboxStreamPanel) | Copy code button in sandbox stream |
| 52j | `isRunReportEnabled` | `VITE_FEATURE_RUN_REPORT` | `false` | not set | 2 (SandboxStreamPanel, RunReportDrawer) | Run report drawer in sandbox |

### 1D. debug-only — Keep, tag as dev

| # | Flag name | Env var | Default | Netlify | Consumers | What it gates |
|---|---|---|---|---|---|---|
| 53 | `isDebugEnabled` | `VITE_FEATURE_DEBUG` | `false` | not set | 3 (featureFlags.ts, debug.ts, debugLog.ts) | Debug logging and debug panels |
| 54 | `isPerfProbesEnabled` | `VITE_FEATURE_PERF_PROBES` | `false` | not set | 1 (StreamFlagsProvider → SandboxStreamPanel) | Performance probe display in sandbox |
| 55 | `isTelemetryEnabled` | `VITE_FEATURE_TELEMETRY` | `false` | not set | 2 (telemetry.ts, guidanceEvents.ts) | PostHog telemetry event firing |
| 56 | `isRealReportEnabled` | `VITE_FEATURE_REAL_REPORT` | `false` | not set | 1 (runReport.ts) | Real vs. mock report data in run reports |

### 1E. Notes on specific flags

**`isOrchestratorRenderingV2Enabled` (item 44 in active-rollout):** Netlify sets `ORCHESTRATOR_RENDERING_V2=1` but this is missing the `VITE_` prefix, so Vite won't expose it to the browser. The flag resolves to `false` (its default) on staging. This may be intentionally off or may be a Netlify config typo. See Batch 3 in Section 4.

**`VITE_FEATURE_SCENARIO_SANDBOX` (pocFlags only):** No standard `isXxxEnabled` export exists. Only consumed in AppPoC.tsx via direct `feature()` helper and in pocFlags. Counted in Section 2 (pocFlags) only.

### Sandbox-panel-only flags (consumed only in SandboxStreamPanel or StreamFlagsProvider)

These flags are technically active but serve only the `/sandbox` route. If the sandbox panel is deprecated, all of these become dead:

| # | Flag name | Consumers outside sandbox |
|---|---|---|
| 58 | `isSummaryV2Enabled` | 0 |
| 59 | `isGuidedV1Enabled` | 0 |
| 60 | `isCommentsEnabled` | 0 |
| 61 | `isScorecardEnabled` | 0 |
| 62 | `isCanvasSimplifyEnabled` | 0 |
| 63 | `isListViewEnabled` | 0 |
| 64 | `isEngineModeEnabled` | 0 |
| 65 | `isMobileGuardrailsEnabled` | 0 |
| 66 | `isErrorBannersEnabled` | 0 |
| 67 | `isConfigDrawerEnabled` | 0 (SandboxStreamPanel only) |
| 68 | `isJobsProgressEnabled` | 1 (JobsProgressPanel + SandboxStreamPanel) |
| 69 | `isHintsEnabled` | 0 (SandboxStreamPanel only) |
| 70 | `isParamsEnabled` | 0 (SandboxStreamPanel only) |
| 71 | `isHistoryEnabled` | 0 (SandboxStreamPanel only) |
| 72 | `isExportEnabled` | 0 (SandboxStreamPanel only) |
| 73 | `isReplayEnabled` | 0 (SandboxStreamPanel only) |
| 74 | `isHistoryRerunEnabled` | 0 (RunHistoryDrawer, loaded by SandboxStreamPanel) |
| 75 | `isMarkdownPreviewEnabled` | 0 (SandboxStreamPanel only) |
| 76 | `isShortcutsEnabled` | 0 (SandboxStreamPanel only) |
| 77 | `isCopyCodeEnabled` | 0 (SandboxStreamPanel only) |
| 78 | `isRunReportEnabled` | 0 (SandboxStreamPanel + RunReportDrawer, loaded by SandboxStreamPanel) |

These are classified as active-rollout above (they gate real UI in the sandbox route), but flagged here as a cluster of 21 flags that could be retired together if the sandbox panel is removed.

---

## Section 2: pocFlags object (src/flags.ts:563-576)

The `pocFlags` object is a parallel flag system that defaults all flags to ON when `VITE_POC_ONLY=1`. Each pocFlag maps to a standard flag env var. They are counted once above with their standard flag entry.

| pocFlag key | Maps to env var | Standard flag exists? | Production consumers (of pocFlag) |
|---|---|---|---|
| `pocFlags.sse` | `VITE_FEATURE_SSE` | Yes (`isSseEnabled`) | 1 (useDraftModel.ts) |
| `pocFlags.orchestratorStreaming` | `VITE_FEATURE_ORCHESTRATOR_STREAMING` | Yes (`isOrchestratorStreamingEnabled`) | 0 |
| `pocFlags.scenarioSandbox` | `VITE_FEATURE_SCENARIO_SANDBOX` | No standard export | 1 (AppPoC.tsx — via `feature()` helper) |
| `pocFlags.decisionCta` | `VITE_FEATURE_SANDBOX_DECISION_CTA` | Yes (dead) | 0 |
| `pocFlags.mapping` | `VITE_FEATURE_SANDBOX_MAPPING` | Yes (dead) | 0 |
| `pocFlags.projections` | `VITE_FEATURE_SANDBOX_PROJECTIONS` | Yes (dead) | 0 |
| `pocFlags.realtime` | `VITE_FEATURE_SANDBOX_REALTIME` | Yes (dead) | 0 |
| `pocFlags.strategyBridge` | `VITE_FEATURE_SANDBOX_STRATEGY_BRIDGE` | Yes (dead) | 0 |
| `pocFlags.triggersBasic` | `VITE_FEATURE_SANDBOX_TRIGGERS_BASIC` | Yes (dead) | 0 |
| `pocFlags.voting` | `VITE_FEATURE_SANDBOX_VOTING` | Yes (dead) | 0 |
| `pocFlags.whiteboard` | `VITE_FEATURE_WHITEBOARD` | Yes (dead) | 0 |
| `pocFlags.contextBar` | `VITE_FEATURE_CONTEXT_BAR` | No standard export | 0 (ReactFlowGraph reads env directly) |

When the 8 dead sandbox flags (items 15-22) are removed from flags.ts, the corresponding pocFlags entries and the `dumpFlags()` entries should also be cleaned up. Estimated additional lines: ~20.

---

## Section 3: Non-standard VITE_* env vars (consumed directly via import.meta.env)

### 3A. Product feature flags (retireable)

| # | Env var | Defined in | Consumers | What it gates | Classification | Retirement readiness | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | `VITE_SHOW_VERDICT_CARD` | .env.local, Netlify | 2 (OutputsDock:128, config.ts:48) | Verdict card features in OutputsDock | active-rollout | — | Set `true` in Netlify + .env.local. Gates conditional rendering in OutputsDock. config.ts defines it but nobody reads `config.verdictCard`. |
| 2 | `VITE_COPILOT_ENABLED` | .env.local, .env.dev, Netlify | 2 (App.tsx:160, DiagnosticBanner.tsx) | Copilot assistant route in main app | active-rollout | — | Set `true` everywhere. Gates copilot sandbox page rendering. |
| 3 | `VITE_FEATURE_CONTEXT_BAR` | flags.ts (pocFlags) | 1 (ReactFlowGraph.tsx:140) | New canvas layout (context bar position) | permanent-on | safe-now | Code checks `!== '0'`, so default (undefined) = ON. Only way to disable is explicit `=0`. Never set to `0` in any env. ~10 lines (conditional + old layout path). |
| 4 | `VITE_FEATURE_SCENARIO_SANDBOX` | flags.ts (pocFlags), Netlify | 1 (AppPoC.tsx:53) | Scenario sandbox in PoC app | active-rollout | — | Set `1` in Netlify. Only consumed in PoC. |
| 5 | `VITE_SHOW_PARETO_PANEL` | Netlify only | 0 | Pareto panel (component exists but not gated) | dead | safe-now | Set `true` in Netlify but 0 code consumers. Env var can be removed from Netlify. |
| 6 | `VITE_SHOW_RECOMMENDATION_CARD` | .env.local, Netlify | 0 | Recommendation card (component exists but not gated) | dead | safe-now | Set `true` in Netlify + .env.local but 0 code consumers. Env var can be removed. |
| 7 | `VITE_SHOW_SEQUENTIAL_VIEW` | .env.local, Netlify | 0 | Sequential view (component exists but not gated) | dead | safe-now | Set `true` in Netlify + .env.local but 0 code consumers. Env var can be removed. |
| 8 | `VITE_DISABLE_OPENAI` | Netlify only | 0 | OpenAI disable switch | dead | safe-now | Set `0` in Netlify but 0 code consumers. Env var can be removed. |
| 9 | `VITE_FORCE_ENGINE` | Netlify only | 0 | Force engine mode | dead | safe-now | Set `1` in Netlify but 0 code consumers. Env var can be removed. |
| 10 | `ORCHESTRATOR_RENDERING_V2` | Netlify only (no VITE_ prefix) | 0 | N/A — not exposed to browser by Vite | dead | safe-now | Missing `VITE_` prefix. Server-side only env var with no server-side consumer (this is a static SPA). Remove from Netlify or rename to `VITE_FEATURE_ORCHESTRATOR_RENDERING_V2`. |

### 3B. Infrastructure / config wiring (NOT retireable as feature flags)

These are service configuration, not feature toggles. They should remain as-is.

| # | Env var | Purpose | Consumers |
|---|---|---|---|
| 11 | `VITE_POC_ONLY` | PoC mode detection | 4+ (flags.ts, poc.ts, pocFlags.ts, supabase.ts, Build.ts, SafeMode.tsx) |
| 12 | `VITE_PLC_LAB` | PLC lab mode indicator | 2 (BuildBadge, PlotShowcase) |
| 13 | `VITE_FEATURE_PLOT_USES_PLC_CANVAS` | PLC canvas routing override | 3 (resolvePlcOverride, BuildBadge, PlotShowcase) |
| 14 | `VITE_DEBUG_BUNDLE_V2` | Debug bundle v2 format | 1 (exportBundle.ts) |
| 15 | `VITE_ENABLE_WEB_VITALS` | Web Vitals monitoring | 1 (monitoring.ts) |
| 16 | `VITE_ENABLE_PLOT_HEALTH` | PLoT health check in PoC SafeMode | 1 (SafeMode.tsx) |
| 17 | `VITE_SHOW_DEBUG` | Debug tray visibility | 1 (DebugTray.tsx) |
| 18 | `VITE_ENABLE_SSE` | SSE streaming (Netlify) | 0 direct (alias for VITE_FEATURE_SSE in Netlify config) |

---

## Section 4: Retirement priority

### Batch 1 — safe-now, immediate cleanup (~207 lines flags.ts + Netlify vars)

**Dead flags with 0 consumers (remove definition from flags.ts + pocFlags + dumpFlags):**
- `isScenariosV2Enabled`, `isA11yPolishEnabled`, `isSseAutoEnabled`, `isOptimiseBetaEnabled`
- `isSandboxDecisionCtaEnabled`, `isSandboxMappingEnabled`, `isSandboxProjectionsEnabled`, `isSandboxRealtimeEnabled`, `isSandboxStrategyBridgeEnabled`, `isSandboxTriggersBasicEnabled`, `isSandboxVotingEnabled`, `isWhiteboardEnabled`
- `isConfidenceChipsEnabled`

**Permanent-on flags (inline true path, delete flag + false branch):**
- `isInputsOutputsEnabled`, `isCommandPaletteEnabled`, `isDegradedBannerEnabled`
- `isContextMenuEnabled` (0 consumers — definition only)
- `isDecisionReviewEnabled` (0 consumers — definition only)
- `VITE_FEATURE_CONTEXT_BAR` (non-standard, always ON)

**Dead Netlify-only env vars (remove from Netlify config):**
- `VITE_SHOW_PARETO_PANEL`, `VITE_SHOW_RECOMMENDATION_CARD`, `VITE_SHOW_SEQUENTIAL_VIEW`
- `VITE_DISABLE_OPENAI`, `VITE_FORCE_ENGINE`
- `ORCHESTRATOR_RENDERING_V2` (missing VITE_ prefix — dead)
- `VITE_ENABLE_SSE` (duplicate of `VITE_FEATURE_SSE`)

### Batch 2 — needs-check (~30 lines)

Require manual verification before removal:
- `isDiagnosticsEnabled` — default true, 1 sandbox consumer. Verify sandbox still needs toggle.
- `isV3SystemEventsEnabled` — Netlify=true but 0 consumers. Verify if v3 format is now unconditional.
- `isModelCardLiteEnabled` — Netlify=true but 0 consumers. Verify component is unconditionally rendered.
- `isCausalClaimsEnabled` — Netlify=true but 0 consumers. Verify adapter is unconditionally used.
- `isNodeIntelligenceEnabled` — Netlify=true but 0 consumers. Verify feature status.
- `isCanvasDefaultEnabled` — 1 sandbox consumer. Verify if canvas-as-default is now permanent.
- `isScenarioImportPreviewEnabled` — 1 sandbox consumer. Verify sandbox feature status.

### Batch 3 — Netlify config typo

- `ORCHESTRATOR_RENDERING_V2=1` should likely be `VITE_FEATURE_ORCHESTRATOR_RENDERING_V2=1` if the intent is to enable `isOrchestratorRenderingV2Enabled` in the browser. Currently this flag resolves to `false` (its default) on staging.

---

## Appendix: flag definition locations

All standard flags: `src/flags.ts:30-386` (FLAGS_CONFIG) + `src/flags.ts:393-469` (makeFlag calls) + `src/flags.ts:473-548` (exports)

pocFlags: `src/flags.ts:556-576`

dumpFlags: `src/flags.ts:579-597`

Flag factory: `src/lib/flagFactory.ts`

Infrastructure flags: `src/lib/featureFlags.ts` (not in scope for retirement)
