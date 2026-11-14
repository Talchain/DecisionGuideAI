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
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { revealOf, useReveal } from '../reveal'
import { landingChipOf, resetRevealLanding, useRevealLanding } from '../revealLanding'
import { composerStepsAside, forgetLanded, registerRevealReturnCamera, returnFromLanded } from '../revealReturn'
import { openView } from '../RevealMarks'
import { ViewLensBar } from '../ViewLensBar'

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
afterEach(() => { cleanup(); closed(); resetRevealLanding(); forgetLanded(); useViewStore.setState(useViewStore.getInitialState(), true); useUIStore.setState({ activeOutputTab: 'olumi' } as never) })

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

describe('a landed panel hands the dock back (V11 lane 10 Nov: journey 6.3 and the Reveal audit could reach neither Team nor the tabs)', () => {
  it('RL9 catch: closing the landed panel fronts the tab it landed over (Olumi), not Team', () => {
    act(() => { land(view) })
    expect(useUIStore.getState().activeOutputTab).toBe('team')
    const chip = useReveal.getState().chip
    act(() => { useReveal.getState().select(null); expect(returnFromLanded(chip)).toBe(true) })
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
  })
  it('RL10 a panel opened from a chip returns to the originating tab and camera', () => {
    useViewStore.setState({ view, sid: view.id, at: null })
    const c = landingChipOf(revealOf(view))!
    const restore = vi.fn(), unregister = registerRevealReturnCamera(() => restore)
    act(() => { openView(c.views[0]!, c.card, c.key) })
    act(() => { useReveal.getState().select(null); expect(returnFromLanded(c.key)).toBe(true) })
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
    expect(restore).toHaveBeenCalledOnce()
    unregister()
  })
  it('RL11 catch: pressing Team on the canvas while the landed panel is open shows Team itself: the panel steps aside', () => {
    act(() => { land(view) })
    expect(useReveal.getState().selected).not.toBeNull()
    render(<ViewLensBar nav />)
    act(() => { fireEvent.click(screen.getByTestId('lens-bar-team')) })
    expect([useReveal.getState().selected, useReveal.getState().evidence]).toEqual([null, null])
    expect(useUIStore.getState().activeOutputTab).toBe('team')
    // Where the landed panel would have returned is forgotten: a later close of another panel does not jump tabs.
    expect(returnFromLanded(landingChipOf(revealOf(view))!.key)).toBe(false)
  })
})

describe('P1c: the composer steps aside for the reveal panel (the approved Reveal comp; Codex grade 10 Nov)', () => {
  it('RL12 catch: on the core lane with a reveal panel open in Team, no composer; the panel\'s question and actions are the foot', () => {
    expect(composerStepsAside(true, true, 'team')).toBe(true)
  })
  it('RL13 must not change: with the panel closed, on another tab, or on the legacy lane, the composer stays', () => {
    expect([composerStepsAside(true, false, 'team'), composerStepsAside(true, true, 'olumi'), composerStepsAside(false, true, 'team')]).toEqual([false, false, false])
  })
})


it('a page reload does not land the same revealed views again for this person', () => {
  act(() => { land(view) })
  expect(useReveal.getState().selected).not.toBeNull()
  cleanup(); closed(); forgetLanded(); resetRevealLanding(false)
  useUIStore.setState({ activeOutputTab: 'olumi' })
  act(() => { render(<Host />) })
  expect(useReveal.getState().selected).toBeNull()
  expect(useUIStore.getState().activeOutputTab).toBe('olumi')
})
