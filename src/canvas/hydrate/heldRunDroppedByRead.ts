/**
 * ⛔ R3 5904756210 (oob S2 on `5f8ee46d`, intermittent — it PASSED on `6dcb3b10`): the boot read said the held Run
 * is not current (`complete_stale`, no result), yet the same browser showed Run 1 under "Cannot confirm". The drop in
 * `serverGraphHydration` clears only a Run ALREADY held; the autosave restore runs in `ReactFlowGraph`'s init effect,
 * and nothing pins it before the read (see `applyScenarioAnalysisRead.ts` "AN UNPINNED ASSUMPTION"). When the read
 * lands first, the drop has nothing to clear and the restore then puts Run 1 back.
 *
 * So the read's answer is RECORDED per scenario for this page load, and the autosave restore consults it: whichever
 * order the two run in, a Run the read says is not current never comes back. A read that vouches clears the record.
 */
let notCurrentForScenarioId: string | null = null

export function recordReadSaysHeldRunNotCurrent(scenarioId: string, notCurrent: boolean): void {
  if (notCurrent) notCurrentForScenarioId = scenarioId
  else if (notCurrentForScenarioId === scenarioId) notCurrentForScenarioId = null
}

export function readSaysHeldRunNotCurrent(scenarioId: string | null | undefined): boolean {
  return scenarioId != null && notCurrentForScenarioId === scenarioId
}

/** Tests only. */
export function __resetHeldRunDroppedByReadForTests(): void {
  notCurrentForScenarioId = null
}
