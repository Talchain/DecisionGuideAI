/**
 * R25 slice 2b, remove a link (core's contract, API.md R25: `POST …/links/remove { base, record, op }`): offered on a selected or focused
 * link only where core names the one record it stands for (`links[].remove`), on an approved board the person owns, on the live version;
 * asked once, posted on the base it was asked on; core's receipt (a direct edit: no "Approved by"); a refusal is core's own words.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Position, ReactFlowProvider } from '@xyflow/react'
import type { View, ViewLink } from '../client'
import { useViewStore } from '../store'
import { ViewLinkEdge } from '../../canvas/edges/ViewLinkEdge'
import { EdgeLabelLayer } from './edgeLabelLayer'
import { focusedLinkOf, useViewFocusLink } from '../canvas'
import { setTeamFetch } from '../../olumiCore/team/api'
import { resetWrites } from '../../olumiCore/team/writes'
import { useMe } from '../../olumiCore/me'
import { useModelNotice } from '../notice'

const SID = 's_0123456789ab'
const approved: View = { ...JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'european-22cards.view3.json'), 'utf8')), id: SID }
const base = approved.model!.edit_base!
const plain = approved.model!.links.findIndex((l) => l.kind !== 'reason')
const removable = { ...approved.model!.links[plain]!, remove: { record: 'evening_mood', part: null } } as ViewLink
// One added part of a sum (core c63693bc): its line names the sum's record and the part; another part of the same sum is another line.
const onePart = { ...approved.model!.links[plain]!, remove: { record: 'total_def', part: 'existing_capacity' } } as ViewLink
const kept = { ...approved.model!.links[plain]!, remove: null } as ViewLink
const Edge = ViewLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element
const draw = (link: ViewLink, selected: boolean) => render(
  <ReactFlowProvider><EdgeLabelLayer><svg>
    <Edge id="a->b:plain" source={link.from} target={link.to} sourceX={0} sourceY={0} targetX={0} targetY={300}
      sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link, i: plain }} selected={selected} />
  </svg></EdgeLabelLayer></ReactFlowProvider>,
).container

let calls: Array<{ method: string; path: string; body: unknown }> = []
let answer: { status: number; body: unknown } = { status: 201, body: { version: 9, n: 4, receipt: 'links-remove:9' } }
beforeEach(() => {
  calls = []; answer = { status: 201, body: { version: 9, n: 4, receipt: 'links-remove:9' } }
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET', p = String(u)
    calls.push({ method, path: p, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (method === 'GET') return new Response(JSON.stringify(approved), { status: 200 })
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view: approved, status: 'ready', error: null, stale: false, at: null })
  useMe.setState({ me: { id: approved.you_id, name: approved.you }, status: 'ready' })
})
afterEach(() => {
  cleanup(); setTeamFetch(null); resetWrites(); useModelNotice.setState({ notice: null }); useViewFocusLink.setState({ id: null })
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }); useMe.setState({ me: null } as never)
})
const posts = () => calls.filter((c) => c.method === 'POST')

describe('remove a link', () => {
  it('catch: a selected link core can take off offers it; asked once, it posts core\'s record on the base it was asked on, and says core\'s version', async () => {
    const c = draw(removable, true)
    fireEvent.click(c.querySelector('[data-testid="view-link-remove-open-evening_mood"]')!)
    act(() => { useViewStore.setState({ view: { ...approved, model: { ...approved.model!, edit_base: base + 5 } } as View }) }) // a newer version lands
    expect(posts()).toHaveLength(0) // asked first, nothing sent
    fireEvent.click(screen.getByTestId('view-link-remove-yes-evening_mood'))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]!.path).toBe(`/api/scenarios/${SID}/links/remove`)
    expect(posts()[0]!.body).toEqual({ base, record: 'evening_mood', part: null, op: expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/) }) // core's object, verbatim
    await waitFor(() => expect(useModelNotice.getState().notice).toMatchObject({ kind: 'saved', n: 4, by: null }))
  })
  it('catch (core c63693bc): a line that is one part of a sum posts that part with its record, verbatim; its control is that line\'s, not the record\'s', async () => {
    const c = draw(onePart, true)
    expect(c.querySelector('[data-testid="view-link-remove-evening_mood"]')).toBeNull()
    fireEvent.click(c.querySelector('[data-testid="view-link-remove-open-total_def.existing_capacity"]')!)
    fireEvent.click(screen.getByTestId('view-link-remove-yes-total_def.existing_capacity'))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]!.body).toEqual({ base, record: 'total_def', part: 'existing_capacity', op: expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/) })
    cleanup()
    // CONTRAST: the same sum's other part is another line, with its own control
    const other = draw({ ...onePart, remove: { record: 'total_def', part: 'added_capacity' } } as ViewLink, true)
    expect(other.querySelector('[data-testid="view-link-remove-total_def.added_capacity"]')).not.toBeNull()
    expect(other.querySelector('[data-testid="view-link-remove-total_def.existing_capacity"]')).toBeNull()
  })
  it('a refusal is core\'s own words (it names what depends on the link), and nothing reads as saved', async () => {
    answer = { status: 409, body: { error: 'Removing this link leaves "total capacity" with nothing that works it out. Give its figure first, or remove it too.' } }
    const c = draw(removable, true)
    fireEvent.click(c.querySelector('[data-testid="view-link-remove-open-evening_mood"]')!)
    fireEvent.click(screen.getByTestId('view-link-remove-yes-evening_mood'))
    await waitFor(() => expect(screen.getByTestId('view-link-remove-error-evening_mood')).toHaveTextContent('Removing this link leaves "total capacity" with nothing that works it out. Give its figure first, or remove it too.'))
    expect(useModelNotice.getState().notice).toBeNull()
  })
  it('catch: focus alone offers it too, and focus on the control keeps the link named', () => {
    useViewFocusLink.setState({ id: 'a->b:plain' })
    const c = draw(removable, false)
    const box = c.querySelector<HTMLElement>('[data-testid="view-link-remove-evening_mood"]')!
    expect(box).not.toBeNull()
    expect(focusedLinkOf(box.querySelector('button'))).toBe('a->b:plain')
  })
  it('must not change: never on a link core does not name a record for, at rest, while a proposal is held, on an earlier version or someone else\'s page', () => {
    const none = (c: HTMLElement) => c.querySelector('[data-testid^="view-link-remove-"]') === null
    expect(none(draw(kept, true))).toBe(true); cleanup()
    expect(none(draw(removable, false))).toBe(true); cleanup()
    for (const set of [
      () => useViewStore.setState({ view: { ...approved, model: { ...approved.model!, edit_base: null } } as View }),
      () => useViewStore.setState({ at: 2 }),
      () => useMe.setState({ me: { id: 'someone-else', name: 'Someone else' }, status: 'ready' } as never),
    ]) {
      set()
      expect(none(draw(removable, true))).toBe(true)
      cleanup()
      useViewStore.setState({ view: approved, at: null }); useMe.setState({ me: { id: approved.you_id, name: approved.you }, status: 'ready' })
    }
    expect(none(draw(removable, true))).toBe(false) // CONTRAST: offered here
  })
})
