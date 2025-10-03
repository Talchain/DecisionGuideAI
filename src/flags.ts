// src/flags.ts
// Small, client-side feature flags; all default to OFF.

export function isSseEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_SSE
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.sseStreaming')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Results Summary v2 (OFF by default)
export function isSummaryV2Enabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_SUMMARY_V2
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.summaryV2')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Guided Mode v1 (OFF by default)
export function isGuidedV1Enabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_GUIDED_V1
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.guidedV1')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Comments (OFF by default)
export function isCommentsEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_COMMENTS
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.comments')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Snapshots (OFF by default)
export function isSnapshotsEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_SNAPSHOTS
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.snapshots')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Compare (OFF by default)
export function isCompareEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_COMPARE
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.compare')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Scorecard (OFF by default)
export function isScorecardEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_SCORECARD
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.scorecard')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Diagnostics (OFF by default)
export function isDiagnosticsEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_DIAGNOSTICS
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.diagnostics')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Scenarios v2 polish (OFF by default)
export function isScenariosV2Enabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_SCENARIOS_V2
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.scenariosV2')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// A11y polish (OFF by default)
export function isA11yPolishEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_A11Y_POLISH
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.a11yPolish')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Performance probes (OFF by default)
export function isPerfProbesEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_PERF_PROBES
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.perfProbes')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}
 

// Simplify View for canvas/list edges (OFF by default)
export function isCanvasSimplifyEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_CANVAS_SIMPLIFY
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.canvasSimplify')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Read-only List View that mirrors nodes/edges (OFF by default)
export function isListViewEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_LIST_VIEW
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.listView')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Engine Mode adapter (fixtures vs live) (OFF by default)
export function isEngineModeEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_ENGINE_MODE
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.engineMode')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Mobile guardrails (≤480px list-first, caps) (OFF by default)
export function isMobileGuardrailsEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_MOBILE_GUARDRAILS
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.mobileGuardrails')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Config Drawer feature (OFF by default)
export function isConfigDrawerEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_CONFIG_DRAWER
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.configDrawer')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// E2E test-mode (OFF by default). Build-time only: relies exclusively on import.meta.env.
export function isE2EEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_E2E
    if (env === '1' || env === 1 || env === true) return true
  } catch {}
  try {
    // Window opt-in (Playwright can set this via addInitScript if needed)
    const w = (globalThis as any)
    const winFlag = w?.__E2E
    if (winFlag === '1' || winFlag === 1 || winFlag === true) return true
  } catch {}
  try {
    // URL query opt-in (?e2e=1)
    const href = (globalThis as any)?.location?.href
    if (typeof href === 'string' && href.includes('e2e=1')) return true
  } catch {}
  return false
}

// Real Report source (OFF by default)
export function isRealReportEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_USE_REAL_REPORT
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.realReport')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Confidence chips (OFF by default)
export function isConfidenceChipsEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_CONFIDENCE_CHIPS
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.confidenceChips')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Telemetry seam (OFF by default)
export function isTelemetryEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_TELEMETRY
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.telemetry')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Auto-reconnect is purely a local toggle via localStorage
export function isSseAutoEnabled(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.sseAuto')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Ghost panel feature (OFF by default)
export function isGhostEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_GHOST_PANEL
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.ghostPanel')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Jobs progress panel feature (OFF by default)
export function isJobsProgressEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_JOBS_PROGRESS
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.jobsProgress')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Error Banners (OFF by default)
export function isErrorBannersEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_ERROR_BANNERS
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.errorBanners')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Run Report drawer feature (OFF by default)
export function isRunReportEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_RUN_REPORT
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.runReport')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Terminal "what happened?" hints (OFF by default)
export function isHintsEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_HINTS
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.hints')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Scenario params (seed/budget/model) UI (OFF by default)
export function isParamsEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_PARAMS
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.params')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Local run history drawer (OFF by default)
export function isHistoryEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_HISTORY
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.history')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Export transcript buttons (OFF by default)
export function isExportEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_EXPORT
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.export')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Replay run feature (OFF by default)
export function isReplayEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_REPLAY
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.replay')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}


// History re-run button (OFF by default)
export function isHistoryRerunEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_HISTORY_RERUN
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.historyRerun')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Markdown live preview (OFF by default)
export function isMarkdownPreviewEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_MD_PREVIEW
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.mdPreview')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Keyboard shortcuts (OFF by default)
export function isShortcutsEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_SHORTCUTS
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.shortcuts')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Copy Code buttons for Markdown preview (OFF by default)
export function isCopyCodeEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_COPY_CODE
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.copyCode')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Canvas feature (OFF by default)
export function isCanvasEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_CANVAS
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.canvas')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Canvas-first default split view (OFF by default)
export function isCanvasDefaultEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_CANVAS_DEFAULT
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.canvasDefault')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// TLdraw adapter (OFF by default)
export function isTldrawEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_TLDRAW
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.tldraw')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Scenarios (templates) feature (OFF by default)
export function isScenariosEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_SCENARIOS
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.scenarios')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Scenario import preview (OFF by default)
export function isScenarioImportPreviewEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_SCENARIO_IMPORT_PREVIEW
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.scenarioImportPreview')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Sandbox Decision CTA (OFF by default)
export function isSandboxDecisionCtaEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_SANDBOX_DECISION_CTA
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.sandboxDecisionCta')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Sandbox Mapping (OFF by default)
export function isSandboxMappingEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_SANDBOX_MAPPING
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.sandboxMapping')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Sandbox Projections (OFF by default)
export function isSandboxProjectionsEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_SANDBOX_PROJECTIONS
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.sandboxProjections')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Sandbox Realtime (OFF by default)
export function isSandboxRealtimeEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_SANDBOX_REALTIME
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.sandboxRealtime')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Sandbox Strategy Bridge (OFF by default)
export function isSandboxStrategyBridgeEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_SANDBOX_STRATEGY_BRIDGE
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.sandboxStrategyBridge')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Sandbox Triggers Basic (OFF by default)
export function isSandboxTriggersBasicEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_SANDBOX_TRIGGERS_BASIC
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.sandboxTriggersBasic')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Sandbox Voting (OFF by default)
export function isSandboxVotingEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_SANDBOX_VOTING
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.sandboxVoting')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// Whiteboard (OFF by default)
export function isWhiteboardEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_WHITEBOARD
    if (env === '1' || env === 1 || env === true) return true
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.whiteboard')
      if (raw && raw !== '0' && raw !== 'false') return true
    }
  } catch (_e) {}
  return false
}

// PoC-aware flags system - defaults to ON when VITE_POC_ONLY=1
const env = (import.meta as any)?.env
const isPoc = env?.VITE_POC_ONLY === '1'

// Helper: returns true if explicitly enabled OR (PoC mode AND not explicitly disabled)
const on = (v?: string) => v === '1' || (isPoc && v !== '0')

// PoC-aware flags - default to ON in PoC mode
export const pocFlags = {
  sse: on(env?.VITE_FEATURE_SSE),
  scenarioSandbox: on(env?.VITE_FEATURE_SCENARIO_SANDBOX),
  decisionCta: on(env?.VITE_FEATURE_SANDBOX_DECISION_CTA),
  mapping: on(env?.VITE_FEATURE_SANDBOX_MAPPING),
  projections: on(env?.VITE_FEATURE_SANDBOX_PROJECTIONS),
  realtime: on(env?.VITE_FEATURE_SANDBOX_REALTIME),
  strategyBridge: on(env?.VITE_FEATURE_SANDBOX_STRATEGY_BRIDGE),
  triggersBasic: on(env?.VITE_FEATURE_SANDBOX_TRIGGERS_BASIC),
  voting: on(env?.VITE_FEATURE_SANDBOX_VOTING),
  whiteboard: on(env?.VITE_FEATURE_WHITEBOARD),
}

// Debug helper: dump all flags for inspection
export function dumpFlags() {
  const isPoc = env?.VITE_POC_ONLY === '1'
  const on = (v?: string) => v === '1' || (isPoc && v !== '0')
  return {
    raw: { ...env },
    resolved: {
      isPoc,
      sse: on(env?.VITE_FEATURE_SSE),
      sandbox: on(env?.VITE_FEATURE_SCENARIO_SANDBOX),
      mapping: on(env?.VITE_FEATURE_SANDBOX_MAPPING),
      projections: on(env?.VITE_FEATURE_SANDBOX_PROJECTIONS),
      realtime: on(env?.VITE_FEATURE_SANDBOX_REALTIME),
      strategyBridge: on(env?.VITE_FEATURE_SANDBOX_STRATEGY_BRIDGE),
      triggers: on(env?.VITE_FEATURE_SANDBOX_TRIGGERS_BASIC),
      voting: on(env?.VITE_FEATURE_SANDBOX_VOTING),
      whiteboard: on(env?.VITE_FEATURE_WHITEBOARD),
    }
  }
}
