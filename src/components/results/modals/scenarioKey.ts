/**
 * Scenario keying for the modal stores (Define success + Record the decision).
 *
 * Both stores persist per scenario in sessionStorage (same scope as the
 * unpersisted scenario identity — see strengthenStore's persistence note).
 * `currentScenarioId` can be null before the first scenario exists, so a
 * stable fallback key keeps pre-scenario captures from colliding with real
 * scenario ids (which are generated ids, never this literal).
 */
export const UNSCOPED_SCENARIO_KEY = '__unscoped__'

export function resolveScenarioKey(scenarioId: string | null | undefined): string {
  return scenarioId != null && scenarioId !== '' ? scenarioId : UNSCOPED_SCENARIO_KEY
}
