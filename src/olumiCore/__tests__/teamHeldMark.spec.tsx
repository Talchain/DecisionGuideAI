import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { TeamHeldMark } from '../team/TeamHeldMark'
import { useTeamStore } from '../team/store'
import { scenario } from './teamFixtures'

afterEach(() => { cleanup(); useTeamStore.setState({ uuid: null, sid: null, scenario: null, status: 'none', error: null }) })
const put = (s: ReturnType<typeof scenario> | null) => act(() => { useTeamStore.setState({ scenario: s, status: s ? 'ready' : 'none' }) })

describe('the question card\'s "views held" mark', () => {
  it('says "1 of 3 views held" with a lock and a visible 1/3, from members, waiting and reveal (never views.length)', () => {
    put(scenario({ members: [{ id: '1', name: 'Ada' }, { id: '5', name: 'Bea' }, { id: '6', name: 'Cy' }], waiting: ['Bea', 'Cy'], views: [] }))
    render(<TeamHeldMark />)
    const mark = screen.getByTestId('views-held-mark')
    expect(mark.getAttribute('aria-label')).toBe('1 of 3 views held')
    expect(mark.getAttribute('data-card-mark')).toBe('views-held')
    expect(screen.getByTestId('views-held-mark-caption').textContent).toBe('1/3')
  })
  it('is absent when nobody has given a view, once the round is revealed, and with no scenario', () => {
    render(<TeamHeldMark />)
    expect(screen.queryByTestId('views-held-mark')).toBeNull()
    put(scenario({ waiting: ['Ada', 'Bea'] }))
    expect(screen.queryByTestId('views-held-mark')).toBeNull()
    put(scenario({ waiting: ['Ada', 'Bea'], reveal: { state: 'revealed', at: 'x' } }))
    expect(screen.queryByTestId('views-held-mark')).toBeNull()
  })
  it('follows a read: another person\'s view makes the count 2 of 2', () => {
    put(scenario({ waiting: ['Bea'] }))
    render(<TeamHeldMark />)
    expect(screen.getByTestId('views-held-mark').getAttribute('aria-label')).toBe('1 of 2 views held')
    put(scenario({ waiting: [] , reveal: { state: 'ready', at: null } }))
    expect(screen.getByTestId('views-held-mark').getAttribute('aria-label')).toBe('2 of 2 views held')
  })
})
