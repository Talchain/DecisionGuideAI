/**
 * Debug Panel V2 Components
 *
 * 4-tab debug panel for staging/development environments.
 * - Summary: At-a-glance health check
 * - Data Flow: Service chain tracing
 * - Pipeline: CEE internal processing stages
 * - Captured: Recorded payloads
 *
 * Public API: Only DebugPanelV2 is exported for external consumption.
 * Internal modules (tabs, components, hooks, utils) should be imported
 * directly by their relative paths within the debug directory.
 */

export { DebugPanelV2 } from './DebugPanelV2'
export type { DebugPanelV2Props } from './DebugPanelV2'
