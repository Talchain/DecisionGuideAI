/**
 * ⭐ S9/S11 (DL Q3a, 15 Oct): the chat card's leader licence is CEE's `leader_licence` for THAT card's Run, matched by
 * identity (run id AND graph hash, `chatCardRunViewOf`). Two served views (14 Oct staging): capacity
 * 'permitted_with_caveat', hiring 'withheld'.
 */
import { describe, expect, it } from 'vitest'
import { chatCardRunViewOf } from '../runView'
import type { CanonicalAnalysisView } from '../canonicalAnalysisView'
import served from '../../../components/results/__tests__/fixtures/served-leader-licence-20261014.json'

const viewOf = (name: 'capacity' | 'hiring') => served[name].canonical_analysis_view as unknown as CanonicalAnalysisView
const cardFor = (view: CanonicalAnalysisView, runId = view.run!.run_id!, hash = view.run!.graph_hash_at_run!) =>
  ({ enrichment: {}, run_id: runId, computed_against_hash: hash })

describe('chat card: CEE leader_licence for the card’s own Run', () => {
  it('capacity (permitted_with_caveat) → the card may name its leader', () => {
    const view = viewOf('capacity')
    expect(chatCardRunViewOf(cardFor(view), view).leaderLicensed()).toBe(true)
  })
  it('hiring (withheld) → the card names none', () => {
    const view = viewOf('hiring')
    expect(chatCardRunViewOf(cardFor(view), view).leaderLicensed()).toBe(false)
  })
  it('FAIL-CLOSED: an older card (another Run id, same graph hash) or no view licenses nothing', () => {
    const view = viewOf('capacity')
    expect(chatCardRunViewOf(cardFor(view, 'an-older-run'), view).leaderLicensed()).toBe(false)
    expect(chatCardRunViewOf(cardFor(view), null).leaderLicensed()).toBe(false)
  })
})
