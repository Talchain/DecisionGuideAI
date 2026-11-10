/**
 * P1 (DL 10 Nov; the approved V11 Reveal comp): when a reveal is on the board the dock lands on the contested card's panel. Bound on core's
 * own split-shape strategy Reveal (fixtures/j1, candidate 261df1d4): three marks, "Tom, Maya and Priya spoke to it" on Cross-team adoption
 * (3 views), "Tom and Maya observed it" on Time to value (2), and Maya's evidence on Cross-team adoption. The comp lands on Cross-team
 * adoption.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { revealOf, useReveal } from '../reveal'
import { landingChipOf, resetRevealLanding, useRevealLanding } from '../revealLanding'

const view = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/j1', 'strategy-reveal-split.core-261df1d4.view3.json'), 'utf8')) as View
const marks = view.collab.marks!
type CoreMark = (typeof marks)[number]
const withMarks = (ms: CoreMark[]): View => ({ ...view, collab: { ...view.collab, marks: ms } })
const Host = () => { useRevealLanding(); return null }
const land = (v: View, at: number | null = null) => {
  useViewStore.setState({ view: v, sid: v.id, at })
  return render(<Host />)
}
const closed = () => useReveal.setState({ selected: null, evidence: null, card: null, chip: null })
afterEach(() => { cleanup(); closed(); resetRevealLanding(); useViewStore.setState(useViewStore.getInitialState(), true); useUIStore.setState({ activeOutputTab: 'olumi' } as never) })

describe('which card the dock lands on', () => {
  it('RL1 precondition: core\'s marks are as the comp\'s case', () => {
    expect(marks.map((m) => [m.card, m.kind, m.views.length])).toEqual([['cross_team_adoption', 'shared', 3], ['speed_to_value', 'shared', 2], ['cross_team_adoption', 'evidence', 0]])
  })
  it('RL2 catch: with no disagreement chip, the chip gathering the most people: Cross-team adoption, as the comp', () => {
    const c = landingChipOf(revealOf(view))!
    expect([c.card, c.kind, c.views.length]).toEqual(['cross_team_adoption', 'shared', 3])
  })
  it('RL3 catch: core\'s disagreement chip wins over a chip with more people', () => {
    const two = marks[1]!
    const c = landingChipOf(revealOf(withMarks([marks[0]!, { ...two, kind: 'disagreement' }])))!
    expect([c.card, c.kind]).toEqual(['speed_to_value', 'disagreement'])
  })
  it('RL4 must not change: an evidence chip never lands; none at all when only evidence is marked', () => {
    expect(landingChipOf(revealOf(withMarks([marks[2]!])))).toBeNull()
  })
})

describe('the dock lands once, on the latest version, only while nothing is open', () => {
  it('RL5 catch: a reveal on the board opens that card\'s panel in the Team tab', () => {
    act(() => { land(view) })
    const c = landingChipOf(revealOf(view))!
    expect(useReveal.getState().selected).toBe(c.views[0])
    expect([useReveal.getState().card, useReveal.getState().chip]).toEqual([c.card, c.key])
    expect(useUIStore.getState().activeOutputTab).toBe('team')
  })
  it('RL6 closing is final for that reveal: the canvas mounted again (another scenario and back) does not reopen it', () => {
    const r = land(view)
    act(() => { closed() })
    r.unmount()
    act(() => { render(<Host />) })
    expect(useReveal.getState().selected).toBeNull()
  })
  it('RL7 on an earlier version nothing opens; back on the latest, the reveal lands then', () => {
    act(() => { land(view, 1) })
    expect(useReveal.getState().selected).toBeNull()
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
    act(() => { useViewStore.setState({ at: null }) })
    expect(useReveal.getState().selected).toBe(landingChipOf(revealOf(view))!.views[0])
  })
  it('RL8 must not change: something the person already opened stays open', () => {
    // Maya's evidence (id 22, the View's own) is open on the scenario on screen before the reveal is read.
    useViewStore.setState({ view, sid: view.id, at: null })
    useReveal.setState({ selected: null, evidence: 22, card: 'cross_team_adoption', chip: 'cross_team_adoption:evidence' })
    act(() => { render(<Host />) })
    expect([useReveal.getState().selected, useReveal.getState().evidence]).toEqual([null, 22])
  })
})
