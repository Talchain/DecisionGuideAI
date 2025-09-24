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
