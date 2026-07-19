/**
 * Phase 3: UI Preferences Persistence
 * Saves and restores panel visibility states to/from localStorage
 * for a consistent experience across browser sessions
 */

const STORAGE_KEYS = {
  SHOW_RESULTS_PANEL: 'ui.showResultsPanel',
  SHOW_INSPECTOR_PANEL: 'ui.showInspectorPanel',
  SHOW_TEMPLATES_PANEL: 'ui.showTemplatesPanel',
  SHOW_DRAFT_CHAT: 'ui.showDraftChat',
  SHOW_ISSUES_PANEL: 'ui.showIssuesPanel',
  SHOW_PROVENANCE_HUB: 'ui.showProvenanceHub',
  SHOW_DOCUMENTS_DRAWER: 'ui.showDocumentsDrawer',
  SHOW_COMPARE_PANEL: 'ui.showComparePanel',
} as const

interface UIPreferences {
  showResultsPanel?: boolean
  showInspectorPanel?: boolean
  showTemplatesPanel?: boolean
  showDraftChat?: boolean
  showIssuesPanel?: boolean
  showProvenanceHub?: boolean
  showDocumentsDrawer?: boolean
  showComparePanel?: boolean
}

/**
 * Load all UI preferences from localStorage
 * Returns partial object with only the preferences that were stored
 */
export function loadUIPreferences(): UIPreferences {
  if (typeof localStorage === 'undefined') return {}

  const prefs: UIPreferences = {}

  const loadBoolean = (key: string, defaultValue?: boolean): boolean | undefined => {
    const value = localStorage.getItem(key)
    if (value === null) {
      return defaultValue
    }
    return value === 'true'
  }

  prefs.showResultsPanel = loadBoolean(STORAGE_KEYS.SHOW_RESULTS_PANEL)
  prefs.showInspectorPanel = loadBoolean(STORAGE_KEYS.SHOW_INSPECTOR_PANEL)
  prefs.showTemplatesPanel = loadBoolean(STORAGE_KEYS.SHOW_TEMPLATES_PANEL)
  // Default Olumi AI (Draft Chat) to open on first load until user toggles it off
  prefs.showDraftChat = loadBoolean(STORAGE_KEYS.SHOW_DRAFT_CHAT, true)
  prefs.showIssuesPanel = loadBoolean(STORAGE_KEYS.SHOW_ISSUES_PANEL)
  // showProvenanceHub is DELIBERATELY NOT REHYDRATED. The Provenance Hub's
  // opener was removed by the repo owner in c80f0fe8 (29 Mar 2026) and PR #372
  // recorded the panel as RETIRED, but this line was still restoring it: a
  // returning user whose browser carried `ui.showProvenanceHub=true` from a
  // pre-c80f0fe8 build got the panel back, and it can never have content
  // (`addCitation` has zero callers in all of history, so `citations` is always
  // [] and the panel renders "0 citations" by construction).
  //
  // Reading is what was broken, so only reading is stopped: the key stays in
  // STORAGE_KEYS so clearUIPreferences() still clears the stale value, and
  // setShowProvenanceHub's write is left alone — a write nothing reads is inert.
  // Omitting the key entirely (rather than assigning false) matters: this object
  // is SPREAD over the store defaults, so an explicit `undefined` would override
  // the `showProvenanceHub: false` default with undefined.
  // Pinned by src/canvas/store/__tests__/uiPreferences.provenanceHub.spec.ts.
  prefs.showDocumentsDrawer = loadBoolean(STORAGE_KEYS.SHOW_DOCUMENTS_DRAWER)
  prefs.showComparePanel = loadBoolean(STORAGE_KEYS.SHOW_COMPARE_PANEL)

  return prefs
}

/**
 * Save individual UI preference to localStorage
 */
export function saveUIPreference(key: keyof UIPreferences, value: boolean): void {
  if (typeof localStorage === 'undefined') return

  const storageKey = {
    showResultsPanel: STORAGE_KEYS.SHOW_RESULTS_PANEL,
    showInspectorPanel: STORAGE_KEYS.SHOW_INSPECTOR_PANEL,
    showTemplatesPanel: STORAGE_KEYS.SHOW_TEMPLATES_PANEL,
    showDraftChat: STORAGE_KEYS.SHOW_DRAFT_CHAT,
    showIssuesPanel: STORAGE_KEYS.SHOW_ISSUES_PANEL,
    showProvenanceHub: STORAGE_KEYS.SHOW_PROVENANCE_HUB,
    showDocumentsDrawer: STORAGE_KEYS.SHOW_DOCUMENTS_DRAWER,
    showComparePanel: STORAGE_KEYS.SHOW_COMPARE_PANEL,
  }[key]

  localStorage.setItem(storageKey, String(value))
}

/**
 * Clear all UI preferences from localStorage
 */
export function clearUIPreferences(): void {
  if (typeof localStorage === 'undefined') return

  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })
}

// Export for testing
export const __test__ = {
  STORAGE_KEYS,
}
