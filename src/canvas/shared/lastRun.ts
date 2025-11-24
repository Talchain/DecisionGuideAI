import type { StoredRun } from '../store/runHistory'

interface SelectScenarioLastRunOptions {
  runs: StoredRun[]
  scenarioLastResultHash: string | null
  currentResultsHash: string | null
}

/**
 * Select the best "last run" candidate for the current scenario.
 *
 * Preference order:
 * 1. Run whose hash matches scenarioLastResultHash
 * 2. Run whose hash matches currentResultsHash
 * 3. The first run in the list (latest, assuming loadRuns() ordering)
 * 4. null when no runs exist
 */
export function selectScenarioLastRun(options: SelectScenarioLastRunOptions): StoredRun | null {
  const { runs, scenarioLastResultHash, currentResultsHash } = options

  if (!runs.length) {
    return null
  }

  if (scenarioLastResultHash) {
    const match = runs.find(run => run.hash === scenarioLastResultHash)
    if (match) return match
  }

  if (currentResultsHash) {
    const match = runs.find(run => run.hash === currentResultsHash)
    if (match) return match
  }

  // Fallback: assume runs are sorted latest-first by loadRuns
  return runs[0] ?? null
}
