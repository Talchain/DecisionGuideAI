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
  it('capacity → the card’s own Run licence is CEE’s permitted_with_caveat', () => {
    const view = viewOf('capacity')
    expect(chatCardRunViewOf(cardFor(view), view).leaderLicence()).toBe('permitted_with_caveat')
  })
  it('hiring → the card’s own Run licence is CEE’s withheld', () => {
    const view = viewOf('hiring')
    expect(chatCardRunViewOf(cardFor(view), view).leaderLicence()).toBe('withheld')
  })
  it('IDENTITY: an older card (another Run id, same graph hash) or no view gets no CEE licence (null), never another Run’s', () => {
    const view = viewOf('capacity')
    expect(chatCardRunViewOf(cardFor(view, 'an-older-run'), view).leaderLicence()).toBeNull()
    expect(chatCardRunViewOf(cardFor(view), null).leaderLicence()).toBeNull()
  })
})

describe('PL @01:26: only a POSITIVE CEE permission names a leader; unknown stays unknown', () => {
  it('permitted and permitted_with_caveat license; withheld and an unknown value do not; no view → null (caller fallback)', async () => {
    const { ceeLicencePermitsLeader } = await import('../runView')
    expect(ceeLicencePermitsLeader('permitted')).toBe(true)
    expect(ceeLicencePermitsLeader('permitted_with_caveat')).toBe(true)
    expect(ceeLicencePermitsLeader('withheld')).toBe(false)
    expect(ceeLicencePermitsLeader('some_future_value')).toBe(false)
    expect(ceeLicencePermitsLeader(null)).toBeNull()
  })
})
