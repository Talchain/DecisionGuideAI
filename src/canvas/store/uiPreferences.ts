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

  const loadBoolean = (key: string): boolean | undefined => {
    const value = localStorage.getItem(key)
    return value !== null ? value === 'true' : undefined
  }

  prefs.showResultsPanel = loadBoolean(STORAGE_KEYS.SHOW_RESULTS_PANEL)
  prefs.showInspectorPanel = loadBoolean(STORAGE_KEYS.SHOW_INSPECTOR_PANEL)
  prefs.showTemplatesPanel = loadBoolean(STORAGE_KEYS.SHOW_TEMPLATES_PANEL)
  prefs.showDraftChat = loadBoolean(STORAGE_KEYS.SHOW_DRAFT_CHAT)
  prefs.showIssuesPanel = loadBoolean(STORAGE_KEYS.SHOW_ISSUES_PANEL)
  prefs.showProvenanceHub = loadBoolean(STORAGE_KEYS.SHOW_PROVENANCE_HUB)
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
