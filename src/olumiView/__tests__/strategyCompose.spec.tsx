/**
 * Strategy lane, slice 1, folded into the Team tab's one view form (N2, UI 7 Nov): a view can speak to one card, with a stance and a source,
 * and the one post is core's `POST …/views` with text, figures and items together (olumi-core wip/strategy-n2c 5bfc55d7:
 * src/server/app.ts:348-350, src/app/service.ts:474-488) and an op id (API v1.24, API.md:1044-1050). Bound by identity to the real fixture
 * (card ids, the version number, a View after its reveal) and to core's vocabulary words (GET …/strategy/vocabulary, mocked in core's shape).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { setPagePerson, setTeamFetch } from '../../olumiCore/team/api'
import { resetDrafts } from '../../olumiCore/team/drafts'
import { resetWrites } from '../../olumiCore/team/writes'
import { TeamTab } from '../../olumiCore/team/TeamTab'
import { resetDifferences, useDifferences } from '../../olumiCore/team/differences'
import { resetDoubts } from '../../olumiCore/team/ViewDoubts'

const real: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/strategy', 'growth-reveal.view3.json'), 'utf8'))
const FORM = { about: 'On', stance: 'You', text: 'What you hold about it, in your words', source: 'Source, if you have one', source_example: 'Source, if you have one (two rollouts, a report…)', send: 'Add my view', private: 'Private until the team’s views are revealed.' }
const VOCAB = { kinds: [{ id: 'claim', text: 'Claim' }], form: FORM, stances: [{ id: 'know', text: 'What I know', word: 'Observed' }, { id: 'suspect', text: 'What I suspect', word: 'Expects' }, { id: 'unsure', text: 'Unsure', word: 'Unsure' }, { id: 'would_try', text: 'What I would try', word: 'Would try' }, { id: 'others_may_miss', text: 'What others may miss', word: 'Others may miss' }], limits: { text: 400, source: 200, concerns: 8, items: 8 } }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const CARD = 'cross_team_adoption'

let posts: { url: string; body: Record<string, unknown>; as: string | null }[]
let vocab: unknown, answer: () => Response | Promise<Response>
beforeEach(() => {
  posts = []; vocab = VOCAB; answer = () => json({ contribution: 99 }, 201)
  resetWrites(); resetDrafts(); resetDifferences(); resetDoubts(); setPagePerson(real.you_id)
  setTeamFetch(vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    if (u.endsWith('/strategy/vocabulary')) return json(vocab)
    if (u === '/api/me') return json({ me: { id: real.you_id, name: real.you } })
    if (u.endsWith('/doubts')) return json({ doubt: 100 }, 201)
    if (u.endsWith('/views') && init?.method === 'POST') { posts.push({ url: u, body: JSON.parse(String(init.body)), as: new Headers(init.headers).get('x-olumi-as') }); return answer() }
    if (u.includes('/view?')) return json(real)
    return json({ error: `unexpected ${u}` }, 404)
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: real.id, view: real, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: real.you_id, name: real.you }, status: 'ready' })
})
afterEach(() => { cleanup(); setTeamFetch(null); setPagePerson(null); useMe.setState({ me: null, status: 'none' }) })

const type = (id: string, value: string) => fireEvent.change(screen.getByTestId(id), { target: { value } })

describe('one view form: a view speaks to a card with a stance and a source, in one post (real View, core vocabulary)', () => {
  it('B: fresh scenario s_98e93f5d2389 fetches vocabulary and saves its first item on cross_team_adoption', async () => {
    const { strategy: _strategy, ...withoutStrategy } = real
    const fresh: View = { ...withoutStrategy, collab: { ...real.collab, shared: [], mine: [] } }
    useViewStore.setState({ view: fresh })
    const reads: string[] = []
    setTeamFetch((async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url)
      if (init?.method === 'POST' && u.endsWith('/doubts')) return json({ doubt: 100 }, 201)
      if (init?.method === 'POST') {
        posts.push({ url: u, body: JSON.parse(String(init.body)), as: new Headers(init.headers).get('x-olumi-as') })
        return json({ contribution: 99 }, 201)
      }
      reads.push(u)
      if (u === `/api/scenarios/${real.id}/strategy/vocabulary`) return json(VOCAB)
      if (u === '/api/me') return json({ me: { id: real.you_id, name: real.you } })
      return json(fresh)
    }) as typeof fetch)
    render(<TeamTab />)
    const about = await screen.findByTestId('team-view-about')
    expect(reads.filter((u) => u === `/api/scenarios/${real.id}/strategy/vocabulary`)).toEqual(['/api/scenarios/s_98e93f5d2389/strategy/vocabulary'])
    expect(about.querySelector('option[value="cross_team_adoption"]')!.textContent).toBe('Cross-team adoption')
    type('team-view-about', 'cross_team_adoption')
    type('team-view-stance', 'suspect')
    type('team-view-source', 'two pilots')
    type('team-view-text', 'Teams adopt once an owner is named.')
    fireEvent.click(screen.getByTestId('team-view-give'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ url: '/api/scenarios/s_98e93f5d2389/views', as: real.you_id,
      body: { text: 'Teams adopt once an owner is named.', items: [{ about: 'cross_team_adoption', stance: 'suspect', source: 'two pilots', text: 'Teams adopt once an owner is named.' }], op: expect.any(String) } })
  })
  it('draws core\'s stance words verbatim when the read carries stances, and nothing when it carries none', async () => {
    render(<TeamTab />)
    const stance = await screen.findByTestId('team-view-stance') as HTMLSelectElement
    expect([...stance.options].map((o) => [o.value, o.textContent])).toEqual([['', ''], ...VOCAB.stances.map((s) => [s.id, s.text])])
    cleanup()
    vocab = { ...VOCAB, stances: [] }
    render(<TeamTab />)
    await screen.findByTestId('team-view-give')
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByTestId('team-view-stance')).toBeNull()
  })
  it('D: one stance selector sends suspect for both item cross_team_adoption and saved view 99', async () => {
    const differences = { ...JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/debate/differences.core.json'), 'utf8')), scenario: real.id, differences: [], stances: VOCAB.stances }
    setTeamFetch((async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url)
      if (init?.method === 'POST') {
        posts.push({ url: u, body: JSON.parse(String(init.body)), as: new Headers(init.headers).get('x-olumi-as') })
        return json(u.endsWith('/doubts') ? { doubt: 100 } : { contribution: 99 }, 201)
      }
      if (u === '/api/me') return json({ me: { id: real.you_id, name: real.you } })
      return json(u.endsWith('/differences') ? differences : u.endsWith('/strategy/vocabulary') ? VOCAB : real)
    }) as typeof fetch)
    render(<TeamTab />)
    await screen.findByTestId('team-view-about')
    type('team-view-about', 'cross_team_adoption')
    await waitFor(() => expect(useDifferences.getState().data?.scenario).toBe('s_98e93f5d2389'))
    expect(screen.getAllByTestId('team-view-stance')).toHaveLength(1)
    const stance = screen.getByTestId('team-view-stance') as HTMLSelectElement
    expect([...stance.options].filter((o) => o.value !== '').map((o) => o.textContent)).toEqual(VOCAB.stances.map((s) => s.text))
    type('team-view-stance', 'suspect')
    type('team-view-text', 'Teams adopt once an owner is named.')
    fireEvent.click(screen.getByTestId('team-view-give'))
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(posts.map(({ body: { op: _op, ...body }, ...p }) => ({ ...p, body }))).toEqual([
      { url: '/api/scenarios/s_98e93f5d2389/views', as: '1', body: { text: 'Teams adopt once an owner is named.', items: [{ about: 'cross_team_adoption', stance: 'suspect', text: 'Teams adopt once an owner is named.', source: null }] } },
      { url: '/api/scenarios/s_98e93f5d2389/views/99/doubts', as: '1', body: { links: [], missing: null, stance: 'suspect' } },
    ])
  })
  it('catch: the Team tab as mounted, after a reveal: one form, core\'s words; a view on a card posts ONCE with its text, version, items and an op', async () => {
    render(<TeamTab />)
    const about = await screen.findByTestId('team-view-about') as HTMLSelectElement
    // One form: the strategy compose form is gone, and the one view form holds its fields.
    expect(screen.queryByTestId('strategy-compose')).toBeNull()
    expect(screen.getAllByTestId('team-view-give')).toHaveLength(1)
    expect(screen.getByTestId('team-views').querySelectorAll('textarea')).toHaveLength(1)
    expect(about.closest('[data-testid="team-views"]')).not.toBeNull()
    expect(about.querySelector(`option[value="${CARD}"]`)!.textContent).toBe(real.model!.cards.find((c) => c.id === CARD)!.heading)
    expect(screen.getByTestId('team-view-strategy')).toHaveTextContent(FORM.about)
    fireEvent.change(about, { target: { value: CARD } })
    const stance = screen.getByTestId('team-view-stance') as HTMLSelectElement
    expect([...stance.options].filter((o) => o.value !== '').map((o) => o.textContent)).toEqual(VOCAB.stances.map((s) => s.text))
    expect(screen.getByTestId('team-view-strategy')).toHaveTextContent(FORM.stance)
    expect(screen.getByTestId('team-view-source')).toHaveAttribute('placeholder', FORM.source_example)
    fireEvent.change(stance, { target: { value: 'suspect' } })
    type('team-view-text', 'Teams adopt once an owner is named.')
    type('team-view-source', 'two pilots')
    fireEvent.click(screen.getByTestId('team-view-give'))
    await waitFor(() => expect(posts).toHaveLength(1))
    await new Promise((r) => setTimeout(r, 20))
    expect(posts).toHaveLength(1)
    expect(posts[0]!.url).toBe(`/api/scenarios/${real.id}/views`)
    const { op, ...sent } = posts[0]!.body
    expect(sent).toEqual({ text: 'Teams adopt once an owner is named.', items: [{ about: CARD, stance: 'suspect', text: 'Teams adopt once an owner is named.', source: 'two pilots' }] })
    expect(typeof op).toBe('string')
    expect(posts[0]!.as).toBe(real.you_id)
    // The form stays after the reveal (a new view opens the next round), cleared for the next one.
    await waitFor(() => expect((screen.getByTestId('team-view-text') as HTMLTextAreaElement).value).toBe(''))
    expect((screen.getByTestId('team-view-about') as HTMLSelectElement).value).toBe('')
  })

  it('a plain view posts no items or stance unless chosen; its source is offered after choosing a card', async () => {
    render(<TeamTab />)
    await screen.findByTestId('team-view-about')
    expect((screen.getByTestId('team-view-stance') as HTMLSelectElement).value).toBe('')
    expect(screen.queryByTestId('team-view-source')).toBeNull()
    type('team-view-text', 'Wait a quarter.')
    fireEvent.click(screen.getByTestId('team-view-give'))
    await waitFor(() => expect(posts).toHaveLength(1))
    const { op, ...sent } = posts[0]!.body
    expect([sent, typeof op]).toEqual([{ text: 'Wait a quarter.' }, 'string'])
  })

  it('a lost answer: the same request is sent again with the SAME op, never a second view under a new one', async () => {
    let n = 0
    answer = () => { n++; if (n === 1) throw new TypeError('network'); return json({ contribution: 99 }, 201) }
    render(<TeamTab />)
    fireEvent.change(await screen.findByTestId('team-view-about'), { target: { value: CARD } })
    type('team-view-text', 'Teams adopt once an owner is named.')
    fireEvent.click(screen.getByTestId('team-view-give'))
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(posts[1]!.body).toEqual(posts[0]!.body)
    expect(typeof posts[0]!.body['op']).toBe('string')
  })

  it('negative: a core without the strategy lane, or a vocabulary without the form\'s words, draws none of the fields; the view form is as it was', async () => {
    for (const v of [{ error: 'not found' }, Object.fromEntries(Object.entries(VOCAB).filter(([k]) => k !== 'form'))]) {
      vocab = v
      render(<TeamTab />)
      await screen.findByTestId('team-view-text')
      await new Promise((r) => setTimeout(r, 20))
      expect(screen.queryByTestId('team-view-strategy')).toBeNull()
      expect(screen.getAllByTestId('team-view-give')).toHaveLength(1)
      cleanup()
    }
  })

  it('core\'s own refusal words when core refuses the item', async () => {
    answer = () => json({ error: 'stance must be one of: know, suspect, unsure, would_try, others_may_miss' }, 400)
    render(<TeamTab />)
    fireEvent.change(await screen.findByTestId('team-view-about'), { target: { value: CARD } })
    type('team-view-text', 'x')
    fireEvent.click(screen.getByTestId('team-view-give'))
    expect(await screen.findByTestId('team-views-error')).toHaveTextContent('stance must be one of: know, suspect, unsure, would_try, others_may_miss')
  })
})
