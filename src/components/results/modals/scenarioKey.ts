/**
 * Scenario keying for the modal stores (Define success + Record the decision).
 *
 * ⚠ THE TWO STORES NO LONGER SHARE A BACKING STORE, AND THIS HELPER MAKES NO
 * CLAIM ABOUT EITHER. Superseded text: ~~Both stores persist per scenario in
 * sessionStorage (same scope as the unpersisted scenario identity — see
 * strengthenStore's persistence note).~~ `successMeasureStore` is still
 * sessionStorage; `decisionRecordStore` moved to localStorage on 7 Sep 2026,
 * because a record whose purpose is to be read back on a LATER visit cannot
 * live in a store the tab empties. Each store's own header states its lifetime;
 * this file supplies only the KEY, and a sentence here describing both would be
 * a hand-maintained mirror of two files it does not own (CLAUDE.md trap 12).
 * `currentScenarioId` can be null before the first scenario exists, so a
 * stable fallback key keeps pre-scenario captures from colliding with real
 * scenario ids (which are generated ids, never this literal).
 */
export const UNSCOPED_SCENARIO_KEY = '__unscoped__'

export function resolveScenarioKey(scenarioId: string | null | undefined): string {
  return scenarioId != null && scenarioId !== '' ? scenarioId : UNSCOPED_SCENARIO_KEY
}
