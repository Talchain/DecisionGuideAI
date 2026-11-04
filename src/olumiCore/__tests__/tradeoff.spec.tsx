/**
 * Core L3 trade-offs on DGAI: options × aims, each cell the option card's own row for that aim (API.md L3), one dot per person under how
 * much the aim matters to them, private until revealed together, dissent in core's words; no score, total, rank or winner. The View is
 * core's golden with a two-person weights block written in by hand, in the View's own shape (core wip/v3.1-l3-on-cand schema).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../../olumiView/client'
import { optionCards } from '../../olumiView/layout'
import { setTeamFetch } from '../team/api'
import { resetWrites } from '../team/writes'
import { TradeoffPanel } from '../team/TradeoffPanel'

const SID = 's_0123456789ab'
const base = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'european.view.json'), 'utf8')) as View
const aims = base.model!.cards.filter((c) => c.family === 'goal' || c.family === 'limit')
const aim = aims[0]!
const two = (weights?: View['weights']): View => ({ ...base, id: SID, you: 'Ada', you_id: 'p_1', members: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Bea' }], ...(weights ? { weights } : {}) })

let posts: Array<{ path: string; body: unknown }> = []
beforeEach(() => {
  posts = []
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'POST') posts.push({ path: String(u), body: JSON.parse(String(init!.body ?? '{}')) })
    if (String(u) === '/api/me') return new Response(JSON.stringify({ me: { id: 'p_1', name: 'Ada' } }), { status: 200 })
    return new Response(JSON.stringify({ weight: 1, revealed: [1, 2] }), { status: 201 })
  }) as unknown as typeof fetch)
})
afterEach(() => { cleanup(); setTeamFetch(null); resetWrites() })

describe('the trade-off grid', () => {
  it('alone: not drawn (weights are revealed only once a second person has joined)', () => {
    expect(render(<TradeoffPanel sid={SID} view={{ ...two(), members: [{ id: 'p_1', name: 'Ada' }] }} onWrote={async () => true} />).container.firstChild).toBeNull()
  })

  it('options × aims, each cell the option card\'s own row for that aim, its hover the row\'s; no score, total, rank or winner', () => {
    render(<TradeoffPanel sid={SID} view={two()} onWrote={async () => true} />)
    const grid = screen.getByTestId('team-tradeoff-grid')
    const options = optionCards(base.model!)
    expect([...grid.querySelectorAll('thead th')].slice(1, 1 + options.length).map((t) => t.textContent)).toEqual(options.map((o) => o.heading))
    for (const o of options) {
      const r = o.rows.find((x) => x.aim_id === aim.id)!
      const cell = grid.querySelector(`tr[data-aim="${aim.id}"] td[data-option="${o.id}"]`)!
      expect(cell.getAttribute('title'), o.id).toBe(r.title)
      const words = r.kind === 'chance' ? `${r.approx}${r.value}` : r.kind === 'limit' ? r.value : (r.text ?? r.title)
      expect(cell.textContent, o.id).toContain(words)
    }
    expect(grid.textContent).not.toMatch(/\b(score|total|rank|winner|best)\b/i)
  })

  it('one dot per person under how much the aim matters to them; a private one is dashed and says so; the dissent is core\'s sentence', () => {
    const weights: View['weights'] = {
      aims: [{ aim_id: aim.id, aim: aim.heading, dissent: 'Ada: matters more; Bea: matters less', dots: [
        { by: 'Ada', by_id: 'p_1', weight: 'more', text: 'matters more', mine: true, revealed: true },
        { by: 'Bea', by_id: 'p_2', weight: 'less', text: 'matters less', mine: false, revealed: true },
      ] }],
      skipped: [], can_reveal: false, waiting: null,
    }
    render(<TradeoffPanel sid={SID} view={two(weights)} onWrote={async () => true} />)
    const row = screen.getByTestId('team-tradeoff-grid').querySelector(`tr[data-aim="${aim.id}"]`)!
    expect(row.querySelector('[data-weight-of="more"] [data-by="p_1"]')?.getAttribute('title')).toBe('You: matters more')
    expect(row.querySelector('[data-weight-of="less"] [data-by="p_2"]')?.getAttribute('title')).toBe('Bea: matters less')
    expect(screen.getByTestId('team-tradeoff-grid').querySelector(`[data-dissent="${aim.id}"]`)?.textContent).toContain('Ada: matters more; Bea: matters less')
    cleanup()
    const mine: View['weights'] = { aims: [{ aim_id: aim.id, aim: aim.heading, dissent: null, dots: [{ by: 'Ada', by_id: 'p_1', weight: 'same', text: 'matters the same', mine: true, revealed: false }] }], skipped: [], can_reveal: false, waiting: 'waiting for Bea' }
    render(<TradeoffPanel sid={SID} view={two(mine)} onWrote={async () => true} />)
    expect(screen.getByTestId('team-tradeoff-grid').querySelector('[data-by="p_1"]')?.getAttribute('title')).toBe('You: matters the same, private until revealed')
    expect(screen.getByTestId('team-weights-waiting').textContent).toBe('waiting for Bea')
    expect((screen.getByTestId(`team-weight-${aim.id}`) as HTMLSelectElement).value).toBe('same')
    expect(screen.queryByTestId('team-weights-reveal')).toBeNull()
  })

  it('saves only the aims weighed, skips, and reveals exactly when core says it can', async () => {
    let wrote = 0
    const { rerender } = render(<TradeoffPanel sid={SID} view={two()} onWrote={async () => { wrote += 1; return true }} />)
    fireEvent.change(screen.getByTestId(`team-weight-${aim.id}`), { target: { value: 'more' } })
    fireEvent.click(screen.getByTestId('team-weights-save'))
    await waitFor(() => expect(wrote).toBe(1))
    expect(posts.at(-1)).toEqual({ path: `/api/scenarios/${SID}/weights`, body: { weights: { [aim.id]: 'more' } } })
    fireEvent.click(screen.getByTestId('team-weights-skip'))
    await waitFor(() => expect(wrote).toBe(2))
    expect(posts.at(-1)).toEqual({ path: `/api/scenarios/${SID}/weights`, body: { skip: true } })
    rerender(<TradeoffPanel sid={SID} view={two({ aims: [], skipped: [], can_reveal: true, waiting: null })} onWrote={async () => { wrote += 1; return true }} />)
    fireEvent.click(screen.getByTestId('team-weights-reveal'))
    await waitFor(() => expect(wrote).toBe(3))
    expect(posts.at(-1)!.path).toBe(`/api/scenarios/${SID}/weights/reveal`)
  })
})
