// Lightweight board metadata registry used by sandbox and tests
// This avoids DOM access and SSR brittleness.

const DRAFT = new Map<string, boolean>()

export function isBoardDraft(decisionId: string): boolean {
  return DRAFT.get(decisionId) === true
}

// Test helper / local UI wire-up
export function __setDraft(decisionId: string, value: boolean) {
  DRAFT.set(decisionId, value)
}

// Test-only: clear all draft flags between tests
export function __clearDraftsForTest() {
  DRAFT.clear()
}
