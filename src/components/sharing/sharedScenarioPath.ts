/**
 * Where a decision someone SHARED with me opens. One helper, so the viewer
 * route is decided in exactly one place (ACCOUNTS "Invite a colleague").
 */
export function sharedScenarioPath(scenarioId: string): string {
  return `/scenario/${encodeURIComponent(scenarioId)}`
}
