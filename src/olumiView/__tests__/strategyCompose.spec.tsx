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
import { StrategyChips } from '../strategy/StrategyChips'
import { useReveal } from '../reveal'
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
  resetWrites(); resetDrafts(); resetDifferences(); resetDoubts(); useReveal.setState({ selected: null, evidence: null, card: null, chip: null }); setPagePerson(real.you_id)
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
// DL ruling 9 Nov: the view form opens on one box; its card, stance and source are behind "Add figures to your view" (or writing).
const openForm = async () => fireEvent.click(await screen.findByTestId('team-view-more'))

describe('one view form: a view speaks to a card with a stance and a source, in one post (real View, core vocabulary)', () => {
  it('A: strategy card cross_team_adoption opens Priya view 12 in the mounted Team dock', async () => {
    render(<><StrategyChips card={CARD} /><TeamTab /></>)
    expect(screen.getByTestId('strategy-chips-cross_team_adoption').querySelector('[data-strategy-chip-text]')!.textContent).toBe('Priya and Tom differ')
    fireEvent.click(screen.getByTestId('strategy-chips-cross_team_adoption').querySelector('button')!)
    const person = await screen.findByTestId('reveal-dock-view-12')
    expect(person.querySelector('[data-testid="reveal-dock-words"]')!.textContent).toBe('Adoption stalled until someone owned the change. It took two quarters.')
    expect(screen.getByTestId('strategy-pill-12-cross_team_adoption').textContent).toBe('Observed, two rollouts')
    fireEvent.click(screen.getByTestId('reveal-dock-close'))
    await screen.findByTestId('team-view-give')
    expect(screen.getAllByText('Add my view', { selector: 'button' })).toHaveLength(1)
  })
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
    render(<TeamTab />); await openForm()
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
    render(<TeamTab />); await openForm()
    const stance = await screen.findByTestId('team-view-stance') as HTMLSelectElement
    expect([...stance.options].map((o) => [o.value, o.textContent])).toEqual([['', ''], ...VOCAB.stances.map((s) => [s.id, s.text])])
    cleanup()
    vocab = { ...VOCAB, stances: [] }
    // Re-pinned (D3, 10 Nov): this real View carries no `view_figure_cards`, so no figure box; with no stances either there is nothing behind
    // "Add figures to your view", and the form opens by writing. Was: the button opened it, offered for every card with an edit.
    render(<TeamTab />); fireEvent.change(await screen.findByTestId('team-view-text'), { target: { value: 'x' } })
    await screen.findByTestId('team-view-give')
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByTestId('team-view-stance')).toBeNull()
  })
  it('C: Team view 12 draws its item words and sources; debate views 19 and 20 draw core marks, reading and next question', async () => {
    let c = render(<TeamTab />).container
    const item = (id: string) => c.querySelector(`[data-testid="team-view-items-12"] [data-item-about="${id}"]`)
    expect.soft(item('speed_to_value')?.querySelector('[data-item-words]')?.textContent).toBe('Pilots showed value within a month.')
    expect.soft(item('implementation_effort')?.querySelector('[data-item-words]')?.textContent).toBe('Integration took a quarter each time.')
    expect.soft(item('cross_team_adoption')?.querySelector('[data-item-pill]')?.textContent).toBe('Observed, two rollouts')
    expect.soft(item('cross_team_adoption')?.querySelector('[data-item-pill]')?.getAttribute('title')).toBe('two rollouts')
    cleanup()
    const own: View = { ...real, strategy: { ...real.strategy!, views: real.strategy!.views.filter((l) => l.view === 12).map((l) => ({ ...l, mine: true })) },
      collab: { ...real.collab, shared: [], mine: [{ ...real.collab.shared[0]!, shared: false, can_share: false }] } }
    useViewStore.setState({ view: own })
    c = render(<TeamTab />).container
    expect.soft(c.querySelector('[data-testid="team-mine-12"] [data-item-about="speed_to_value"] [data-item-words]')?.textContent).toBe('Pilots showed value within a month.')
    expect.soft(c.querySelector('[data-testid="team-mine-12"] [data-item-about="speed_to_value"] [data-item-pill]')?.textContent).toBe('Observed, two rollouts')
    cleanup()
    // Core 2019e9c5 also puts the items directly on the shared contribution.
    const { strategy: _strategy, ...plain } = real
    useViewStore.setState({ view: { ...plain, collab: { ...real.collab, shared: [{ ...real.collab.shared[0]!,
      items: real.strategy!.views.filter((l) => l.view === 12).map((l) => ({ about: l.about.id, text: l.text, stance: l.stance, source: l.source, pill: l.pill })) }] } } })
    c = render(<TeamTab />).container
    expect.soft(item('speed_to_value')?.querySelector('[data-item-words]')?.textContent).toBe('Pilots showed value within a month.')
    expect.soft(item('cross_team_adoption')?.querySelector('[data-item-pill]')?.getAttribute('title')).toBe('two rollouts')
    cleanup()
    // Exact projection excerpt from consulting-stance.view3.json, core f3aedd9a; no dock or canvas-chip dependency.
    const debate: View = { ...plain, id: 's_a88ba245176e', collab: { ...real.collab,
      shared: [{"id": 19, "by": "Priya", "by_id": "12", "text": "The enterprise buyers I have spoken to take most of a year to sign anything, even a small paid diagnostic. Procurement is the bottleneck, not the price.", "skip": false, "figures": [], "effects": []}, {"id": 20, "by": "Tom", "by_id": "14", "text": "Two of our pilot customers have asked for a short paid diagnostic. A small fixed-price piece of work can go on a manager's card, so I think one would sign within a quarter.", "skip": false, "figures": [], "effects": []}],
      marks: [{"card": "diagnostic_time_to_contract", "kind": "disagreement", "views": [19, 20], "evidence": [], "text": "Priya and Tom differ", "reading": {"text": "Both figures may hold, under different conditions. In this model which option is most likely to achieve 'Generate revenue as quickly as possible' differs between them, so it is worth finding out which conditions apply.", "note": "Olumi's reading, unconfirmed. Priya and Tom can say whether it fits."}, "options": [{"option": "add_consulting", "text": "about 13% → about 13% with Priya's range, about 13% with Tom's range"}, {"option": "paid_enterprise_diagnostic", "text": "about 49% → under 1% with Priya's range, about 68% with Tom's range"}, {"option": "focus_product_sales", "text": "about 12% → about 12% with Priya's range, about 12% with Tom's range"}], "title": "Priya and Tom differ\nPriya · Time to first signed contract for the paid diagnostic: 6 to 12 months · Moves the chances only\nTom · Time to first signed contract for the paid diagnostic: 1 to 3 months · Changes which option is most likely", "label": "Priya and Tom differ · Priya · Time to first signed contract for the paid diagnostic: 6 to 12 months · Moves the chances only · Tom · Time to first signed contract for the paid diagnostic: 1 to 3 months · Changes which option is most likely",
        "question": null /* the excerpt predates each chip's question (core v1.30); a core before it says none */}],
      next: {"text": "What would tell you whether 'Time to first signed contract for the paid diagnostic' is nearer Priya's figure or Tom's? Which option is most likely to achieve 'Generate revenue as quickly as possible' in this model turns on it.", "about": ["diagnostic_time_to_contract"]},
    } }
    useViewStore.setState({ sid: debate.id, view: debate })
    c = render(<TeamTab />).container
    expect.soft(c.querySelector('[data-testid="team-revealed-19"]')?.textContent).toContain("The enterprise buyers I have spoken to take most of a year to sign anything, even a small paid diagnostic. Procurement is the bottleneck, not the price.")
    expect.soft(c.querySelector('[data-testid="team-revealed-20"]')?.textContent).toContain("Two of our pilot customers have asked for a short paid diagnostic. A small fixed-price piece of work can go on a manager's card, so I think one would sign within a quarter.")
    const mark = c.querySelector('[data-testid="team-mark-diagnostic_time_to_contract-disagreement"]')
    expect.soft(mark?.getAttribute('data-mark-views')).toBe('19,20')
    expect.soft(mark?.querySelector('p')?.textContent).toBe('Priya and Tom differ')
    const reading = c.querySelector('[data-testid="team-reading-diagnostic_time_to_contract-disagreement"]')
    expect.soft(reading?.querySelector('p:first-child')?.textContent).toBe("Both figures may hold, under different conditions. In this model which option is most likely to achieve 'Generate revenue as quickly as possible' differs between them, so it is worth finding out which conditions apply.")
    expect.soft(reading?.querySelector('p:last-child')?.textContent).toBe("Olumi's reading, unconfirmed. Priya and Tom can say whether it fits.")
    expect.soft(mark?.querySelector('[data-mark-option="paid_enterprise_diagnostic"]')?.textContent).toBe("about 49% → under 1% with Priya's range, about 68% with Tom's range")
    expect.soft(c.querySelector('[data-testid="team-views-next"]')?.textContent).toBe(debate.collab.next!.text)
    cleanup()
    useViewStore.setState({ view: { ...debate, gated: true } })
    c = render(<TeamTab />).container
    expect(c.querySelector('[data-testid="team-mark-diagnostic_time_to_contract-disagreement"], [data-testid="team-views-next"]')).toBeNull()
  })
  it('a reveal mark in the Team panel names the figure it is about, by its card\'s heading (DL round 5: "Only Sam raised it" was an orphan)', () => {
    const tm04: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/debate/tm04-cara.view3.json'), 'utf8'))
    // Core's own marks and model (tm04, core-produced) on the spec's base View, as the debate row above builds its excerpt.
    const { strategy: _s, ...plain } = real
    const view: View = { ...plain, id: 's_a88ba245176e', model: tm04.model, collab: { ...real.collab, shared: tm04.collab.shared, marks: tm04.collab.marks } }
    useViewStore.setState({ sid: view.id, view })
    const c = render(<TeamTab />).container
    const m = tm04.collab.marks!.find((x) => x.kind === 'unique')!, card = tm04.model!.cards.find((x) => x.id === m.card)!
    const mark = c.querySelector(`[data-testid="team-mark-${m.card}-unique"]`)!
    expect(mark.querySelector(`[data-testid="team-mark-heading-${m.card}"]`)?.textContent).toBe(card.heading)
    expect(mark.textContent).toContain(m.text)
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
    render(<TeamTab />); await openForm()
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
    render(<TeamTab />); await openForm()
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
    // DL ruling 9 Nov: cleared, it opens on its one box again; its card field comes back empty behind "Add figures to your view".
    expect(screen.queryByTestId('team-view-about')).toBeNull()
    fireEvent.click(screen.getByTestId('team-view-more'))
    expect((screen.getByTestId('team-view-about') as HTMLSelectElement).value).toBe('')
  })

  it('a plain view posts no items or stance unless chosen; its source is offered after choosing a card', async () => {
    render(<TeamTab />); await openForm()
    await screen.findByTestId('team-view-about')
    expect((screen.getByTestId('team-view-stance') as HTMLSelectElement).value).toBe('')
    expect(screen.queryByTestId('team-view-source')).toBeNull()
    type('team-view-text', 'Wait a quarter.')
    fireEvent.click(screen.getByTestId('team-view-give'))
    await waitFor(() => expect(posts).toHaveLength(1))
    const { op, ...sent } = posts[0]!.body
    expect([sent, typeof op]).toEqual([{ text: 'Wait a quarter.' }, 'string'])
  })

  it('no stance is chosen for the person: a view on a card shows no stance until they pick one, and is not sent until they do', async () => {
    render(<TeamTab />); await openForm()
    fireEvent.change(await screen.findByTestId('team-view-about'), { target: { value: CARD } })
    expect((screen.getByTestId('team-view-stance') as HTMLSelectElement).value).toBe('')
    type('team-view-text', 'Teams adopt once an owner is named.')
    expect(screen.getByTestId('team-view-give')).toBeDisabled()
    fireEvent.click(screen.getByTestId('team-view-give'))
    await new Promise((r) => setTimeout(r, 20))
    expect(posts).toEqual([])
    type('team-view-stance', 'unsure')
    expect(screen.getByTestId('team-view-give')).not.toBeDisabled()
    fireEvent.click(screen.getByTestId('team-view-give'))
    await waitFor(() => expect(posts.length).toBeGreaterThan(0))
    expect((posts[0]!.body['items'] as { stance: string }[]).map((i) => i.stance)).toEqual(['unsure'])
  })

  it('a lost answer: the same request is sent again with the SAME op, never a second view under a new one', async () => {
    let n = 0
    answer = () => { n++; if (n === 1) throw new TypeError('network'); return json({ contribution: 99 }, 201) }
    render(<TeamTab />); await openForm()
    fireEvent.change(await screen.findByTestId('team-view-about'), { target: { value: CARD } })
    type('team-view-text', 'Teams adopt once an owner is named.')
    type('team-view-stance', 'know')
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
    render(<TeamTab />); await openForm()
    fireEvent.change(await screen.findByTestId('team-view-about'), { target: { value: CARD } })
    type('team-view-text', 'x')
    type('team-view-stance', 'know')
    fireEvent.click(screen.getByTestId('team-view-give'))
    expect(await screen.findByTestId('team-views-error')).toHaveTextContent('stance must be one of: know, suspect, unsure, would_try, others_may_miss')
  })
})
