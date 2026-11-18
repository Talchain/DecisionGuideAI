/**
 * What a reveal panel hands back when it closes, and the composer rule beside it. BY DESIGN (18 Nov, Codex 008): the automatic landing (P1, 10 Nov)
 * is gone, so its rows (which card lands, once per reveal, reload memory) went with it; the panel opens only on a press (see revealNoTakeover.spec.tsx).
 * Bound on core's split-shape strategy Reveal (fixtures/j1, candidate 261df1d4).
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
import { composerStepsAside, forgetLanded, registerRevealReturnCamera, returnFromLanded } from '../revealReturn'
import { openView } from '../RevealMarks'
import { ViewLensBar } from '../ViewLensBar'

const view = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/j1', 'strategy-reveal-split.core-261df1d4.view3.json'), 'utf8')) as View
const chipOf = () => { const c = [...revealOf(view)!.cardChips.values()].flat().find((x) => x.kind !== 'evidence' && x.views.length > 0)!; return c }
// BY DESIGN (18 Nov): nothing lands by itself. The rows below open the panel by the press that opens it (openView), as a chip does.
const land = (v: View) => {
  useViewStore.setState({ view: v, sid: v.id, at: null })
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
  const c = chipOf()
  act(() => { openView(c.views[0]!, c.card, c.key) })
}
const closed = () => useReveal.setState({ selected: null, evidence: null, card: null, chip: null })
afterEach(() => { cleanup(); closed(); forgetLanded(); useViewStore.setState(useViewStore.getInitialState(), true); useUIStore.setState({ activeOutputTab: 'olumi' } as never) })

describe('a landed panel hands the dock back (V11 lane 10 Nov: journey 6.3 and the Reveal audit could reach neither Team nor the tabs)', () => {
  it('RL9 catch: closing the landed panel fronts the tab it landed over (Olumi), not Team', () => {
    land(view)
    expect(useUIStore.getState().activeOutputTab).toBe('team')
    const chip = useReveal.getState().chip
    act(() => { useReveal.getState().select(null); expect(returnFromLanded(chip)).toBe(true) })
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
  })
  it('RL10 a panel opened from a chip returns to the originating tab and camera', () => {
    useViewStore.setState({ view, sid: view.id, at: null })
    const c = chipOf()
    const restore = vi.fn(), unregister = registerRevealReturnCamera(() => restore)
    act(() => { openView(c.views[0]!, c.card, c.key) })
    act(() => { useReveal.getState().select(null); expect(returnFromLanded(c.key)).toBe(true) })
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
    expect(restore).toHaveBeenCalledOnce()
    unregister()
  })
  it('RL11 catch: pressing Team on the canvas while the landed panel is open shows Team itself: the panel steps aside', () => {
    land(view)
    expect(useReveal.getState().selected).not.toBeNull()
    render(<ViewLensBar nav />)
    act(() => { fireEvent.click(screen.getByTestId('lens-bar-team')) })
    expect([useReveal.getState().selected, useReveal.getState().evidence]).toEqual([null, null])
    expect(useUIStore.getState().activeOutputTab).toBe('team')
    // Where the landed panel would have returned is forgotten: a later close of another panel does not jump tabs.
    expect(returnFromLanded(chipOf().key)).toBe(false)
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

