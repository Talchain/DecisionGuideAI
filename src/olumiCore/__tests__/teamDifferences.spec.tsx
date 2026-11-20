/**
 * Where your explanations differ (core `GET …/differences`, olumi-core wip/debate 38cb4377), drawn since 18 Nov as the Team flow's chart
 * cards (`Differences`; the unmounted DifferencesPanel was deleted with its what-if preview and per-aim link grouping): core's read verbatim,
 * each holder's chance on that holder's bar by id, and posts a step as core's route takes it. A core without the route (404), or a gated
 * viewer, draws nothing. Fixture: core's own output for the capacity case (debate.test.ts row 3), Paul and Sam on `per_specialist`.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../../olumiView/client'
import { tipOf } from '../../olumiView/__tests__/tipHelpers'
import { setPagePerson, setTeamFetch } from '../team/api'
import { resetWrites } from '../team/writes'
import { differencesShape, resetDifferences } from '../team/differences'
import { draftOf, resetDrafts } from '../team/drafts'
import { Differences, WhereWeDiffer } from '../../olumiView/v12/views/WhereWeDiffer'

const core = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/debate/differences.core.json'), 'utf8'))
const fx: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5', 'effects.view3.json'), 'utf8'))
const view = (over: Partial<View> = {}): View => ({ ...fx, gated: false, you_id: '1', ...over } as View)
type Sent = { method: string; url: string; body: unknown }
function serve(answer: (s: Sent) => { status: number; body: unknown }): Sent[] {
  const sent: Sent[] = []
  setTeamFetch((async (url: string, init?: RequestInit) => {
    const s = { method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : undefined }
    sent.push(s)
    const a = answer(s)
    return new Response(JSON.stringify(a.body), { status: a.status, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch)
  return sent
}
afterEach(() => { cleanup(); setTeamFetch(null); setPagePerson(null); resetWrites(); resetDifferences(); resetDrafts() })

describe('where your explanations differ', () => {
  const at = 'differ-row-per_specialist-capacity_goal'
  it('draws core\'s words and each holder\'s chance on that holder\'s bar, by id', async () => {
    serve(() => ({ status: 200, body: core }))
    render(<Differences sid="s_x" view={view()} onWrote={async () => true} />)
    const card = await screen.findByTestId(at)
    const d = core.differences[0]
    expect(screen.getByTestId(`${at}-status`).textContent).toBe(d.status_text)
    const row = card.querySelector('[data-difference-option="add_one"]')!
    expect(row.querySelector('[data-difference-chance="1"]')!.textContent).toContain('about 7%')
    expect(row.querySelector('[data-difference-chance="2"]')!.textContent).toContain('about 94%')
    expect(row.querySelector('[data-difference-model]')!.textContent).toContain(d.options.find((o: { option: string }) => o.option === 'add_one').model)
    expect([...card.querySelectorAll('[data-settle]')].map((e) => [e.getAttribute('data-settle'), e.textContent])).toEqual(d.settle.map((s: { kind: string; text: string }) => [s.kind, s.text]))
    expect([...card.querySelectorAll('[data-step]')].map((e) => e.textContent)).toEqual(d.steps.map((s: { text: string }) => s.text))
    // Never a side named right, never a recommendation (core's words, drawn as given).
    expect(card.textContent).not.toMatch(/\b(best|recommend|winner|should)\b/i)
  })

  it('a step posts core\'s body to core\'s route; the step\'s "Commit to an action" opens the commitment draft for the viewer', async () => {
    const fresh = { ...core, differences: [{ ...core.differences[0], steps: [] }] }
    const sent = serve((s) => (s.method === 'POST' ? { status: 201, body: { step: 42 } } : { status: 200, body: fresh }))
    render(<WhereWeDiffer sid="s_x" view={view()} onWrote={async () => true} />)
    fireEvent.click(await screen.findByTestId(`${at}-research`))
    await waitFor(() => expect(sent.filter((s) => s.method === 'POST')).toHaveLength(1))
    expect(sent.find((s) => s.method === 'POST')).toMatchObject({ url: '/api/scenarios/s_x/differences/per_specialist/steps', body: { step: 'research' } })
    expect(draftOf('s_x:commitment')).toBeUndefined()
    fireEvent.click(screen.getByTestId('differ-commit'))
    expect(draftOf<{ open: boolean; owner: string }>('s_x:commitment')).toMatchObject({ open: true, owner: '1' })
  })

  it('a chance a holder\'s version withholds is drawn as core says it, with its reason on hover, never another holder\'s number', async () => {
    const reason = "With the model's figures, the outcome under 'Keep current staffing' can't be told apart from the target of 'At least 100 a week'."
    const d0 = core.differences[0]
    const held = { ...d0, status: 'withheld', options: d0.options.map((o: { option: string; chances: { holder_id: string }[] }) => (o.option !== 'hold' ? o
      : { ...o, chances: o.chances.map((c) => (c.holder_id === '1' ? { holder_id: '1', chance: null, text: "can't be told apart from the target", withheld: { value: "can't be told apart from the target", reason } } : c)) })) }
    serve(() => ({ status: 200, body: { ...core, differences: [held] } }))
    render(<Differences sid="s_x" view={view()} onWrote={async () => true} />)
    const card = await screen.findByTestId(at)
    const cell = card.querySelector('[data-difference-option="hold"] [data-difference-chance="1"]')!
    expect(cell.textContent).toContain("can't be told apart from the target")
    expect([await tipOf(cell as HTMLElement), cell.querySelector('svg')]).toEqual([reason, null])
    expect(card.querySelector('[data-difference-option="hold"] [data-difference-chance="2"]')!.textContent).toContain('0%')
  })

  it('draws nothing on a core without the route, or for a gated viewer', async () => {
    const sent = serve(() => ({ status: 404, body: { error: 'not found' } }))
    const { container } = render(<Differences sid="s_x" view={view()} onWrote={async () => true} />)
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(container.querySelector('[data-testid^="differ-row-"]')).toBeNull()
    cleanup(); resetDifferences()
    const asked = serve(() => ({ status: 200, body: { ...core, gated: true, differences: [] } }))
    const again = render(<Differences sid="s_x" view={view({ gated: true })} onWrote={async () => true} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(again.container.innerHTML).toBe('')
    expect(asked).toHaveLength(0)
  })

  it('reads core\'s stance words as given; a read without them is kept, and a malformed list is dropped while the read is kept', () => {
    const words = [{ id: 'know', text: 'I know this from experience' }, { id: 'suspect', text: 'I suspect this' }]
    expect(differencesShape({ ...core, stances: words })!.stances).toEqual(words)
    const bare = { ...core }; delete (bare as { stances?: unknown }).stances
    const kept = differencesShape(bare)!
    expect(kept.differences).toEqual(core.differences)
    expect('stances' in kept).toBe(false)
    for (const bad of [[{ id: 1, text: 'x' }], 'know', [null]]) {
      const r = differencesShape({ ...core, stances: bad })!
      expect(r.differences).toEqual(core.differences)
      expect(r.stances).toBeUndefined()
    }
  })
})
