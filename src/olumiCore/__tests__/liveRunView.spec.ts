/**
 * The Analysis tab reads the canonical Run view the page last ADOPTED. A read adopts it; a core turn did not, so beside a change
 * held for the person's answer the tab went on showing the saved model's chances as current (until a reload), and after "Not now"
 * went on showing the not-current line. On the olumi-core lane the turn carries the view for the model it shows and the applier
 * adopts it: the tab agrees with the canvas at once.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {}, getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../lib/posthog', () => ({ trackEvent: () => undefined }))

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyCoreTurnState } from '../../v5/applyCoreTurn'
import { parseCoreTurn } from '../../v5/coreTurnContract'
import { useCanonicalAnalysisViewStore } from '../../canvas/stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../canvas/runView/canonicalAnalysisView'
import { analysisViewOf } from '../../../scripts/olumi-core/lib/model.mjs'
import { turnBodyForTest } from './withdrawnDraft.helpers'

const here = path.dirname(fileURLToPath(import.meta.url))
const view = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'view-approved-with-change.json'), 'utf8'))
const SCENARIO = '00000000-0000-4000-8000-437f3c107bdd'
const turnWith = (canonical: unknown) => {
  const body = turnBodyForTest({}) as { model: Record<string, unknown> }
  return parseCoreTurn({ ...body, model: { ...body.model, canonical_analysis_view: canonical } })!
}
const apply = (canonical: unknown, scenario: string | null = SCENARIO) => applyCoreTurnState(turnWith(canonical), { nodes: [] }, { turnScenarioId: scenario })

beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '1'); useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null }) })
afterEach(() => { vi.unstubAllEnvs() })

describe('a core turn carries the Run view and the page adopts it', () => {
  it('a change held beside the saved model: the model on screen is the saved one, so the page holds its view as current', () => {
    const r = apply(analysisViewOf(view))
    expect(r.applied).toContain('canonical_analysis_view:adopted')
    const held = useCanonicalAnalysisViewStore.getState()
    expect(held.scenarioId).toBe(SCENARIO)
    expect(held.view?.staleness.stale).toBe(false)
  })
  it('then the change is set aside: the view is current again', () => {
    apply(analysisViewOf(view))
    apply(analysisViewOf({ ...view, pending: null }))
    expect(useCanonicalAnalysisViewStore.getState().view?.staleness.stale).toBe(false)
  })
  it('a null view (a first draft with no Run) clears what the page held', () => {
    apply(analysisViewOf({ ...view, pending: null }))
    apply(null)
    expect(useCanonicalAnalysisViewStore.getState().view).toBeNull()
    expect(parseCanonicalAnalysisView(null)).toBeNull()
  })
  it('a turn with no view in it leaves the page\'s view alone, and with no scenario to name nothing is adopted', () => {
    apply(analysisViewOf(view))
    applyCoreTurnState(parseCoreTurn(turnBodyForTest({}))!, { nodes: [] }, { turnScenarioId: SCENARIO })
    expect(useCanonicalAnalysisViewStore.getState().view?.staleness.stale).toBe(false)
    useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
    apply(analysisViewOf(view), null)
    expect(useCanonicalAnalysisViewStore.getState().view).toBeNull()
  })
  it('off the olumi-core lane nothing is adopted (CEE\'s own turns carry no such view)', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    apply(analysisViewOf(view))
    expect(useCanonicalAnalysisViewStore.getState().view).toBeNull()
  })
})
