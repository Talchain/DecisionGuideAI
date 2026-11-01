/** SPIKE: the shim's saved-graph read through DGAI's own canonical-view parser and run gate. Skipped without a capture. */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { parseCanonicalAnalysisView } from '../../canvas/runView/canonicalAnalysisView'
import { runViewOf } from '../../canvas/runView/runView'
import { viewOnlyRunChancesOf } from '../../components/results/analysisNew/ViewOnlyRunChances'

const FILE = process.env.SPIKE_GRAPH_FILE ?? '/private/tmp/spike-core-data/graph-read.json'
describe.skipIf(!existsSync(FILE))('olumi-core shim -> canonical_analysis_view', () => {
  it('parses, binds to its Run and says the chances', () => {
    const raw = JSON.parse(readFileSync(FILE, 'utf8'))
    const view = parseCanonicalAnalysisView(raw.canonical_analysis_view)
    expect(view).not.toBeNull()
    expect(runViewOf(null, view).boundToCurrentCanonical()).toBe(true)
    const chances = viewOnlyRunChancesOf(null, view, true)
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(chances, null, 1))
    expect(chances).not.toBeNull()
  })
})
