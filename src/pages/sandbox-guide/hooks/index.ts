/**
 * Hooks - Barrel Export
 *
 * Centralizes exports for all custom hooks.
 * Enables cleaner imports: `import { useGuideStore, useKeyboardShortcuts } from '../hooks'`
 */

export { useGuideStore } from './useGuideStore'
export type { GuideState } from './useGuideStore'

export { useKeyboardShortcuts, KEYBOARD_SHORTCUTS } from './useKeyboardShortcuts'

export { useJourneyDetection } from './useJourneyDetection'
