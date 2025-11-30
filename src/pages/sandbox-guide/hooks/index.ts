/**
 * Hooks - Barrel Export
 *
 * Centralizes exports for all custom hooks.
 * Enables cleaner imports: `import { useCopilotStore, useKeyboardShortcuts } from '../hooks'`
 */

export { useCopilotStore } from './useCopilotStore'
export type { CopilotState } from './useCopilotStore'

export { useKeyboardShortcuts, KEYBOARD_SHORTCUTS } from './useKeyboardShortcuts'

export { useJourneyDetection } from './useJourneyDetection'
