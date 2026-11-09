/**
 * Paul's acceptance step 6 (DL 9 Nov): selecting a link's chip opens the Team tab with that link already picked in "Where you stand on a
 * link". On core's own View and differences for the capacity case (fixtures/disagree, olumi-core wip/disagree-actionable): the morale link
 * is folded onto 'Add one specialist' and carries core's chip "Bea doubts this link"; the form offers that link and one other.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { setTeamFetch } from '../../olumiCore/team/api'
import { resetDifferences, useDifferences, type Differences } from '../../olumiCore/team/differences'
import { LinkStance } from '../../olumiCore/team/LinkStance'
import { resetWrites } from '../../olumiCore/team/writes'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { LinkMarkCardChip, type LinkMark } from '../LinkMarkChip'
import { openLinkStance, useLinkPick } from '../../olumiCore/team/linkPick'

const DIR = path.resolve('src/olumiView/fixtures/disagree')
const read = <T,>(n: string): T => JSON.parse(readFileSync(path.join(DIR, n), 'utf8'))
const view = read<View>('x2-stances.view3.json'), diff = read<Differences>('x2-revealed.differences.core.json')
const SID = view.id
const mark = view.collab.link_marks![0] as LinkMark
const select = () => screen.getByTestId('team-link-stance-link') as HTMLSelectElement
const form = () => render(<LinkStance sid={SID} view={view} onWrote={async () => true} />)

function setup(at: number | null = null) {
  setTeamFetch((async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch)
  useDifferences.setState({ sid: SID, key: 'k', read: 'k', data: diff, error: null })
  useViewStore.setState({ view, at })
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
}
afterEach(() => {
  cleanup(); setTeamFetch(null); resetDifferences(); resetWrites()
  useViewStore.setState(useViewStore.getInitialState(), true); useLinkPick.setState({ want: null })
})

describe("a link's chip opens Team with its link picked", () => {
  it('LP1 the fixture is the case: the chip is on the morale link, and the form offers it and another link', () => {
    expect(mark.link).toEqual({ record: 'morale_link', part: null })
    expect(mark.line).toBe(false)
    expect(view.model!.holdable!.map((h) => h.link.record)).toEqual(['total_def', 'morale_link'])
  })

  it('LP2 the chip is a button named in core\'s words; selecting it fronts Team and picks the morale link, not the other one', () => {
    setup()
    render(<LinkMarkCardChip mark={mark} />)
    form()
    expect(select().value).toBe('')
    const chip = screen.getByRole('button', { name: mark.label })
    expect(chip.textContent).toContain(mark.text)
    act(() => { fireEvent.click(chip) })
    expect(useUIStore.getState().activeOutputTab).toBe('team')
    expect(select().value).toBe('morale_link|')
    expect(select().value).not.toBe('total_def|existing_capacity')
    expect(useLinkPick.getState().want).toBeNull()
  })

  it('LP3 a chip selected before the form is drawn (the tab opens on that click) is picked once the form draws', () => {
    setup()
    act(() => { openLinkStance(mark.link) })
    form()
    expect(select().value).toBe('morale_link|')
  })

  it('LP4 a link the form does not offer is never picked, and the pick waits', () => {
    setup()
    form()
    act(() => { openLinkStance({ record: 'not_a_link', part: null }) })
    expect(select().value).toBe('')
    expect(useLinkPick.getState().want).toBe('not_a_link|')
  })

  it('LP5 on an earlier version nothing opens and nothing is picked', () => {
    setup(1)
    act(() => { openLinkStance(mark.link) })
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
    expect(useLinkPick.getState().want).toBeNull()
  })
})
