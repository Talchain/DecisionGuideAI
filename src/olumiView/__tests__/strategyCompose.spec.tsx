/**
 * Strategy lane, slice 1: a person adds a qualitative view on one card from the dock, in their own words, with a stance in core's words and a
 * source. Bound by identity to the real fixture (card ids, the version number) and to core's vocabulary words (served by GET …/strategy/
 * vocabulary; mocked here with core's own shape). The post is exactly core's `POST …/views` body with `items`.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { setPagePerson, setTeamFetch } from '../../olumiCore/team/api'
import { resetWrites } from '../../olumiCore/team/writes'
import { StrategyCompose } from '../strategy/StrategyCompose'

const real: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/strategy', 'growth-reveal.view3.json'), 'utf8'))
const VOCAB = { kinds: [{ id: 'claim', text: 'Claim' }], stances: [{ id: 'know', text: 'What I know', word: 'Observed' }, { id: 'suspect', text: 'What I suspect', word: 'Expects' }, { id: 'unsure', text: 'Unsure', word: 'Unsure' }, { id: 'would_try', text: 'What I would try', word: 'Would try' }, { id: 'others_may_miss', text: 'What others may miss', word: 'Others may miss' }], limits: { text: 400, source: 200, concerns: 8, items: 8 } }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

let posts: { url: string; body: unknown }[]
beforeEach(() => {
  posts = []; resetWrites(); setPagePerson(real.you_id)
  setTeamFetch(vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    if (u.endsWith('/strategy/vocabulary')) return json(VOCAB)
    if (u === '/api/me') return json({ me: { id: real.you_id, name: real.you } })
    if (u.endsWith('/views') && init?.method === 'POST') { posts.push({ url: u, body: JSON.parse(String(init.body)) }); return json({ contribution: 99 }, 201) }
    return json({ error: `unexpected ${u}` }, 404)
  }) as unknown as typeof fetch)
})
afterEach(() => { cleanup(); setTeamFetch(null); setPagePerson(null) })

describe('composing a qualitative view on a card (real View, core vocabulary)', () => {
  it('offers the model’s cards and core’s stance words; posts core’s body for the chosen card with the version shown; tells the panel it wrote', async () => {
    const onWrote = vi.fn()
    render(<StrategyCompose sid={real.id} view={real} onWrote={onWrote} />)
    const stance = await screen.findByTestId('strategy-compose-stance') as HTMLSelectElement
    expect([...stance.options].map((o) => o.textContent)).toEqual(VOCAB.stances.map((s) => s.text))
    const about = screen.getByTestId('strategy-compose-about') as HTMLSelectElement
    expect([...about.options].map((o) => o.value)).toContain('cross_team_adoption')
    expect(about.querySelector('option[value="cross_team_adoption"]')!.textContent).toBe(real.model!.cards.find((c) => c.id === 'cross_team_adoption')!.heading)
    fireEvent.change(about, { target: { value: 'cross_team_adoption' } })
    fireEvent.change(stance, { target: { value: 'suspect' } })
    fireEvent.change(screen.getByTestId('strategy-compose-text'), { target: { value: 'Teams adopt once an owner is named.' } })
    fireEvent.change(screen.getByTestId('strategy-compose-source'), { target: { value: 'two pilots' } })
    fireEvent.click(screen.getByTestId('strategy-compose-send'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.url).toBe(`/api/scenarios/${real.id}/views`)
    expect(posts[0]!.body).toEqual({ text: 'Teams adopt once an owner is named.', version: real.version!.n, items: [{ about: 'cross_team_adoption', stance: 'suspect', text: 'Teams adopt once an owner is named.', source: 'two pilots' }] })
    await waitFor(() => expect(onWrote).toHaveBeenCalled())
  })
  it('sends nothing without words; shows core’s own refusal words when core refuses', async () => {
    render(<StrategyCompose sid={real.id} view={real} onWrote={vi.fn()} />)
    await screen.findByTestId('strategy-compose-stance')
    expect(screen.getByTestId('strategy-compose-send')).toBeDisabled()
    setTeamFetch(vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => (String(url) === '/api/me' ? json({ me: { id: real.you_id } }) : init?.method === 'POST' ? json({ error: 'stance must be one of: know, suspect, unsure, would_try, others_may_miss' }, 400) : json(VOCAB))) as unknown as typeof fetch)
    fireEvent.change(screen.getByTestId('strategy-compose-text'), { target: { value: 'x' } })
    fireEvent.click(screen.getByTestId('strategy-compose-send'))
    expect(await screen.findByRole('alert')).toHaveTextContent('stance must be one of: know, suspect, unsure, would_try, others_may_miss')
  })
})

describe('only where core serves the strategy key (V11 × debate-ui integration, 8 Nov: two 404s on core n2)', () => {
  it('a View without core’s strategy key asks for no vocabulary and draws nothing', async () => {
    const consulting: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-stance.view3.json'), 'utf8'))
    expect((consulting as { strategy?: unknown }).strategy).toBeUndefined()
    const seen: string[] = []
    setTeamFetch(vi.fn(async (url: RequestInfo | URL) => { seen.push(String(url)); return json({ error: 'not found' }, 404) }) as unknown as typeof fetch)
    const { container } = render(<StrategyCompose sid={consulting.id} view={consulting} onWrote={() => undefined} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(seen.filter((u) => u.includes('/strategy/vocabulary'))).toEqual([])
    expect(container).toBeEmptyDOMElement()
  })
})
