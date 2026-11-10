/**
 * G4: the person's own figure, changed on its card through core's edit route as typed (API v1.9 `typed`). Offered exactly where core
 * offers it (`figure.edit`), labelled with core's prompt; core's refusal (the card's `figure.edit.ask`) shown on the card; nothing parsed
 * here. Core's golden (wip/v3.1-one 8d25761).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { ViewChances } from '../ViewChances'
import { setTeamFetch } from '../../olumiCore/team/api'
import { resetWrites } from '../../olumiCore/team/writes'
import { useMe } from '../../olumiCore/me'

const SID = 's_0123456789ab'
// Pins the R5 european model's cards (the R17 vendor replaced the golden): kept as fixtures/real/european-22cards.view3.json.
const view: View = { ...JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'european-22cards.view3.json'), 'utf8')), id: SID }
const card = view.model!.cards.find((c) => c.figure?.edit)!
const plain = view.model!.cards.find((c) => c.figure !== null && c.figure.edit === null)

let calls: Array<{ method: string; path: string; body: unknown }> = []
let answer: { status: number; body: unknown } = { status: 201, body: { version: 2, n: 2, receipt: 'r' } }
beforeEach(() => {
  calls = []
  answer = { status: 201, body: { version: 2, n: 2, receipt: 'r' } }
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ method, path: String(u), body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (method === 'GET' && String(u) === '/api/me') return new Response(JSON.stringify({ me: { id: view.you_id, name: view.you } }), { status: 200 })
    if (method === 'GET') return new Response(JSON.stringify(view), { status: 200 })
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view, status: 'ready', error: null, stale: false })
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
})
afterEach(() => { cleanup(); setTeamFetch(null); resetWrites(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }); useMe.setState({ me: null, status: 'none' }) })

const posts = () => calls.filter((c) => c.method === 'POST')

describe('lane C: a card reads heading and figure first', () => {
  // R25 (Paul's 6 Nov test: "I can't find manual editing"): the figure's ✎ is its at-rest cue. DL ruling 9 Nov (the face never changes height
  // on hover, focus or opening): its words are its label and hover, never a line that appears.
  it('core\'s detail is the heading\'s hover, never a line; the figure\'s ✎ shows at rest, its words its label and hover, the same opened', () => {
    const detailed = view.model!.cards.find((c) => c.detail !== '')!
    for (const selected of [false, true]) {
      const c = render(<ViewCard card={card} selected={selected} />).container
      expect(c.querySelector(`[data-testid="view-figure-glyph-${card.id}"]`)?.className ?? '').not.toContain('opacity-0')
      const pen = c.querySelector(`[data-testid="view-figure-edit-${card.id}"]`)!
      expect([pen.getAttribute('aria-label'), pen.getAttribute('title')]).toEqual(['Change figure', card.figure!.edit!.ask])
      expect(c.querySelector(`[data-testid="view-figure-words-${card.id}"]`), `selected ${selected}: no words line`).toBeNull()
      c.remove()
    }
    // Core's detail is hover text, never a line (DL 4 Nov: it repeated the heading, said the kind word and spelled provenance out).
    const drawn = render(<ViewCard card={detailed} />).container
    expect(drawn.querySelector(`[data-view="${detailed.id}.detail"]`)).toBeNull()
    expect(drawn.querySelector(`[data-view="${detailed.id}.heading"]`)?.getAttribute('title')).toBe(detailed.detail)
  })
})

describe('a card says its heading once, with no kind word and no provenance spelled out (Paul: no static repeating text)', () => {
  it('every quantity card of core\'s european golden: the heading once in the visible text, never " · quantity" or "Theirs:"; the words whole on hover', () => {
    const quantities = view.model!.cards.filter((c) => c.family === 'quantity' && c.detail !== '')
    expect(quantities.length).toBeGreaterThan(3)
    for (const c of quantities) {
      const el = render(<ViewCard card={c} />).container
      const text = el.textContent ?? ''
      expect(text.split(c.heading).length - 1, c.id).toBe(1)
      expect(text, c.id).not.toContain(' · quantity')
      expect(text, c.id).not.toContain('Theirs:')
      expect(el.querySelector(`[data-view="${c.id}.heading"]`)?.getAttribute('title'), c.id).toBe(c.detail)
      cleanup()
    }
  })
})

// Plan v3 finish line (full text on selection or keyboard focus, not hover only; DL/PL 7 Nov) supersedes DL 4 Nov's one cut line: a premise
// shows only with its card open, beside it, so a premise several options share is never repeated across cards at rest.
describe('a premise is whole, its glyph first, core\'s title kept', () => {
  it('every premise row of european\'s option cards: whole (no ellipsis), glyph and text drawn, core\'s title on hover', () => {
    const options = view.model!.cards.filter((c) => c.family === 'option' && c.premises.length > 0)
    expect(options.length).toBeGreaterThan(0)
    for (const c of options) {
      const el = render(<ViewCard card={c} />).container
      c.premises.forEach((p, j) => {
        const row = el.querySelector<HTMLElement>(`[data-premise-row="${c.id}.${j}"]`)!
        expect(row.className, `${c.id}.${j}`).not.toMatch(/truncate|line-clamp/)
        expect(row.getAttribute('title')).toBe(p.title)
        expect(row.querySelector(`[data-view="${c.id}.premises.${j}.glyph"]`)?.textContent).toBe(p.glyph)
        expect(row.querySelector(`[data-view="${c.id}.premises.${j}.text"]`)?.textContent).toBe(p.text)
      })
      cleanup()
    }
  })
})

describe('an Olumi estimate reads as Olumi\'s at a glance (core L1/L2)', () => {
  it('a figure card core marks ◆: the figure in Olumi\'s colour with core\'s mark on hover, its ✎ always shown with "Give yours" as its label, never a words line (no static repeating text; DL 9 Nov); a person\'s figure is neither', async () => {
    const { QUIET } = await import('../FigureEdit')
    const est = view.model!.cards.find((c) => c.family === 'quantity' && c.olumi?.glyph === '◆' && c.figure?.edit)!
    const theirs = view.model!.cards.find((c) => c.family === 'quantity' && c.olumi === null && c.figure?.edit)!
    const a = render(<ViewCard card={est} />).container
    const fig = a.querySelector<HTMLElement>(`[data-view="${est.id}.figure.text"]`)!
    expect(fig.textContent).toBe(est.figure!.text)
    expect(fig.getAttribute('data-olumi')).toBe('true')
    expect(fig.className).toContain('text-info')
    expect(fig.getAttribute('title')).toBe(`${est.figure!.title} · ${est.olumi!.title}`)
    const give = a.querySelector(`[data-testid="view-figure-edit-${est.id}"]`)!
    expect(give.getAttribute('aria-label')).toBe('Give yours')
    expect(give.className).not.toContain(QUIET)
    const glyph = a.querySelector(`[data-testid="view-figure-glyph-${est.id}"]`)!
    expect(glyph.textContent).toBe('✎')
    expect(glyph.className).not.toContain('opacity-0')
    expect(a.querySelector(`[data-testid="view-figure-words-${est.id}"]`)).toBeNull()
    a.remove()
    const sel = render(<ViewCard card={est} selected />).container
    expect(sel.querySelector(`[data-testid="view-figure-edit-${est.id}"]`)?.getAttribute('aria-label')).toBe('Give yours')
    expect(sel.querySelector(`[data-testid="view-figure-words-${est.id}"]`)).toBeNull()
    sel.remove()
    const b = render(<ViewCard card={theirs} />).container
    expect(b.querySelector(`[data-view="${theirs.id}.figure.text"]`)?.hasAttribute('data-olumi')).toBe(false)
    expect(b.querySelector(`[data-testid="view-figure-edit-${theirs.id}"]`)?.getAttribute('aria-label')).toBe('Change figure')
    expect(b.querySelector(`[data-testid="view-figure-glyph-${theirs.id}"]`)?.textContent).toBe('✎')
  })
})

describe('a figure the person may set', () => {
  it('is offered exactly where core offers it, labelled with core\'s prompt', () => {
    render(<ViewCard card={card} />)
    fireEvent.click(screen.getByTestId(`view-figure-edit-${card.id}`))
    expect(screen.getByLabelText(card.figure!.edit!.prompt)).toBeInTheDocument()
    cleanup()
    if (plain) { render(<ViewCard card={plain} />); expect(screen.queryByTestId(`view-figure-edit-${plain.id}`)).toBeNull() }
  })

  it('is not offered while core holds no version to edit (a proposal waits), nor on a View for someone else', () => {
    useViewStore.setState({ view: { ...view, model: { ...view.model!, edit_base: null } } })
    const { rerender } = render(<ViewCard card={card} />)
    expect(screen.queryByTestId(`view-figure-edit-${card.id}`)).toBeNull()
    useViewStore.setState({ view })
    useMe.setState({ me: { id: 'p_someone_else', name: 'X' }, status: 'ready' })
    rerender(<ViewCard card={card} />)
    expect(screen.queryByTestId(`view-figure-edit-${card.id}`)).toBeNull()
  })

  it('goes to core\'s edit route exactly as typed, against the version shown, with its op; then the View is read again', async () => {
    render(<ViewCard card={card} />)
    fireEvent.click(screen.getByTestId(`view-figure-edit-${card.id}`))
    fireEvent.change(screen.getByTestId(`view-figure-typed-${card.id}`), { target: { value: ' 150 to 400 ' } })
    fireEvent.click(screen.getByTestId(`view-figure-set-${card.id}`))
    await waitFor(() => expect(calls.some((c) => c.method === 'GET' && c.path === `/api/scenarios/${SID}/view?schema=3`)).toBe(true))
    expect(posts()).toEqual([{ method: 'POST', path: `/api/scenarios/${SID}/edit`,
      body: { base: view.model!.edit_base, quantity: card.id, typed: ' 150 to 400 ', op: expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/) } }])
    await waitFor(() => expect(screen.queryByTestId(`view-figure-form-${card.id}`)).toBeNull())
  })

  it('saved, but the View could not be read after it: the card says so and keeps the editor, never the old figure as current (review 00004 ledger)', async () => {
    setTeamFetch((async (u: unknown, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push({ method, path: String(u), body: undefined })
      if (method === 'GET' && String(u) === '/api/me') return new Response(JSON.stringify({ me: { id: view.you_id, name: view.you } }), { status: 200 })
      if (method === 'GET') return new Response('{', { status: 200 })
      return new Response(JSON.stringify({ version: 2, n: 2, receipt: 'r' }), { status: 201 })
    }) as unknown as typeof fetch)
    render(<ViewCard card={card} />)
    fireEvent.click(screen.getByTestId(`view-figure-edit-${card.id}`))
    fireEvent.change(screen.getByTestId(`view-figure-typed-${card.id}`), { target: { value: '150' } })
    fireEvent.click(screen.getByTestId(`view-figure-set-${card.id}`))
    await waitFor(() => expect(screen.getByTestId(`view-figure-error-${card.id}`)).toHaveTextContent('Saved, but Olumi could not show it just now. Reload the page to see it.'))
    expect(screen.getByTestId(`view-figure-form-${card.id}`)).toBeInTheDocument()
  })

  it('a figure core cannot read: core\'s own ask, on the card; nothing is read again', async () => {
    answer = { status: 400, body: { error: card.figure!.edit!.ask } }
    render(<ViewCard card={card} />)
    fireEvent.click(screen.getByTestId(`view-figure-edit-${card.id}`))
    fireEvent.change(screen.getByTestId(`view-figure-typed-${card.id}`), { target: { value: 'lots' } })
    fireEvent.click(screen.getByTestId(`view-figure-set-${card.id}`))
    await waitFor(() => expect(screen.getByTestId(`view-figure-error-${card.id}`)).toHaveTextContent(card.figure!.edit!.ask))
    expect(calls.some((c) => c.method === 'GET' && c.path.includes('/view'))).toBe(false)
  })
})

describe('worth checking first: the line\'s figure given with its ✎, as core\'s page draws it (olumi.view/3 science[].figure, core L7)', () => {
  const line = view.model!.run!.science[0]!, fig = line.figure!
  it('a figure core gives: core\'s words, then the ✎ named for the figure, then the card\'s own edit, by the figure\'s id', async () => {
    const c = render(<ViewChances model={view.model!} />).container
    const give = c.querySelector<HTMLElement>(`[data-testid="worth-give-${fig.id}"]`)!
    expect(give.textContent).toBe(`${fig.give!.text} ✎.`)
    const btn = screen.getByTestId(`worth-edit-${fig.id}`)
    expect(btn.getAttribute('aria-label')).toBe(`Change ${fig.label}`)
    expect(btn.getAttribute('title')).toBe(fig.give!.edit.ask)
    fireEvent.click(btn)
    expect(screen.getByLabelText(fig.give!.edit.prompt)).toBeInTheDocument()
    fireEvent.change(screen.getByTestId(`worth-typed-${fig.id}`), { target: { value: '150' } })
    fireEvent.click(screen.getByTestId(`worth-set-${fig.id}`))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]).toEqual({ method: 'POST', path: `/api/scenarios/${SID}/edit`,
      body: { base: view.model!.edit_base, quantity: fig.id, typed: '150', op: expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/) } })
  })
  it('whose mark after the line when core gives one, with its hover; none when core gives none', () => {
    const mark = { glyph: '◐', title: 'A person\'s figure, Olumi\'s range' }
    const marked = { ...view.model!, run: { ...view.model!.run!, science: [{ ...line, figure: { ...fig, mark } }] } }
    const m = render(<ViewChances model={marked} />).container.querySelector('[data-view="run.science.0.figure.mark.glyph"]')!
    expect(m.textContent).toBe('◐')
    expect(m.getAttribute('title')).toBe(mark.title)
    cleanup()
    expect(render(<ViewChances model={view.model!} />).container.querySelector('[data-view="run.science.0.figure.mark.glyph"]')).toBeNull()
  })
  it('must not change: core gives no ✎ (give null): no words and no ✎, the line verbatim', () => {
    const none = { ...view.model!, run: { ...view.model!.run!, science: [{ ...line, figure: { ...fig, give: null } }] } }
    const c = render(<ViewChances model={none} />).container
    expect(c.querySelector(`[data-testid="worth-give-${fig.id}"]`)).toBeNull()
    expect(c.querySelector('[data-view="run.science.0.line"]')?.textContent).toBe(line.line)
    expect(c.querySelector('[data-view-fact]')?.textContent).toBe(`${line.olumi ? `${line.olumi.glyph} ` : ''}${line.line}`)
  })
})

describe('the most likely line that rests on Olumi\'s estimate: its ✎ is that figure\'s own edit (core\'s most_likely.estimate, L7)', () => {
  it('european names Olumi\'s estimate by its card\'s id: the ✎ after the line, named for that card, edits that figure', async () => {
    const ml = view.model!.run!.most_likely!, est = view.model!.cards.find((c) => c.id === ml.estimate)!
    expect(est.figure?.edit).toBeTruthy()
    const c = render(<ViewChances model={view.model!} />).container
    expect(c.querySelector('[data-view="run.most_likely.text"]')?.textContent).toBe(ml.text)
    const btn = screen.getByTestId(`likely-edit-${est.id}`)
    expect(btn.getAttribute('aria-label')).toBe(`Give your figure for ${est.heading}`)
    expect(btn.textContent).toBe('✎')
    fireEvent.click(btn)
    fireEvent.change(screen.getByTestId(`likely-typed-${est.id}`), { target: { value: '40' } })
    fireEvent.click(screen.getByTestId(`likely-set-${est.id}`))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect((posts()[0]!.body as { quantity: string }).quantity).toBe(est.id)
  })
  it('must not change: no estimate, or an estimate no card offers an edit for (bakery\'s), draws the line alone', () => {
    const ml = view.model!.run!.most_likely!
    const none = { ...view.model!, run: { ...view.model!.run!, most_likely: { ...ml, estimate: null } } }
    expect(render(<ViewChances model={none} />).container.querySelector('[data-testid^="likely-"]')).toBeNull()
    cleanup()
    const hidden = { ...view.model!, run: { ...view.model!.run!, most_likely: { ...ml, estimate: 'not_a_card' } } }
    const c = render(<ViewChances model={hidden} />).container
    expect(c.querySelector('[data-testid^="likely-"]')).toBeNull()
    expect(c.querySelector('[data-view="run.most_likely.text"]')?.textContent).toBe(ml.text)
  })
})

// Pre-screen row 7 (DL 10 Nov): an open editor whose model moved on offers one press onto the latest version, keeping the typing.
describe('row 7: the model changed while the editor was open', () => {
  const moved = (): View => ({ ...view, model: { ...view.model!, edit_base: (view.model!.edit_base ?? 0) + 1 } })
  it('says so and offers "Use the latest version"; pressed, Set goes against the latest base with the same typing', async () => {
    render(<ViewCard card={card} />)
    fireEvent.click(screen.getByTestId(`view-figure-edit-${card.id}`))
    fireEvent.change(screen.getByTestId(`view-figure-typed-${card.id}`), { target: { value: '150' } })
    expect(screen.queryByTestId(`view-figure-rebase-${card.id}`)).toBeNull() // contrast: nothing moved, no offer
    act(() => { useViewStore.setState({ view: moved() }) })
    fireEvent.click(screen.getByTestId(`view-figure-rebase-${card.id}`))
    expect(screen.queryByTestId(`view-figure-rebase-${card.id}`)).toBeNull()
    expect((screen.getByTestId(`view-figure-typed-${card.id}`) as HTMLInputElement).value).toBe('150')
    fireEvent.click(screen.getByTestId(`view-figure-set-${card.id}`))
    await waitFor(() => expect(posts().length).toBe(1))
    expect((posts()[0]!.body as { base: number; typed: string })).toMatchObject({ base: moved().model!.edit_base, typed: '150' })
  })
  it('must not change (PL 7 Nov): without the press the edit stays on the base it opened on', async () => {
    render(<ViewCard card={card} />)
    fireEvent.click(screen.getByTestId(`view-figure-edit-${card.id}`))
    fireEvent.change(screen.getByTestId(`view-figure-typed-${card.id}`), { target: { value: '150' } })
    act(() => { useViewStore.setState({ view: moved() }) })
    fireEvent.click(screen.getByTestId(`view-figure-set-${card.id}`))
    await waitFor(() => expect(posts().length).toBe(1))
    expect((posts()[0]!.body as { base: number })).toMatchObject({ base: view.model!.edit_base })
  })
})
