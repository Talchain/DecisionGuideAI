/**
 * THE MODEL TAB AS THE PLACE TO CHANGE THE MODEL BY HAND (Paul 7 Nov). Saved writes are HIGH tier: each row pins the exact request core
 * gets (route, body, the base the editor opened on), that the editor closes only once the View read after the save lands, and that a
 * refusal is core's own words with the person's typing kept. The gate is the canvas editors' own (own page, latest version, `edit_base`).
 * Plain | Expert is a content switch, the person's preference kept under the dock's key. Fixture: the R5 european View from the wire
 * (fixtures/real/european-22cards.view3.json, edit_base 1), bound by card id.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { setTeamFetch } from '../../olumiCore/team/api'
import { NOT_CONFIRMED, resetWrites, useWrites } from '../../olumiCore/team/writes'
import { useMe } from '../../olumiCore/me'
import { useModelNotice } from '../notice'
import { ASIDE_WORDS } from '../FigureEdit'
import { ViewModelTab, ViewModelTabBlock } from '../ViewModelTab'
import { FACTORS_ROW, RELATIONSHIPS_ROW, resetModelTab, useModelTab } from '../model/state'
import { MODEL_EDIT_WORDS, modelEditNow } from '../model/editing'
import { forgetThisPerson } from '../../olumiCore/signout'
import { useWhatIf } from '../whatif'
import { linkRowOf } from '../model/targets'
import { useGuidanceStore } from '../../canvas/stores/guidanceStore'
import { useUIStore } from '../../stores/uiStore'

const SID = 's_0123456789ab'
const wire: View = { ...JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'european-22cards.view3.json'), 'utf8')), id: SID }
const figure = wire.model!.cards.find((c) => c.id === 'starting_customers')!
const derived = wire.model!.cards.find((c) => c.figure !== null && c.figure.edit === null)!

let view: View = wire
let calls: Array<{ method: string; path: string; body: unknown }> = []
let answer: { status: number; body: unknown } = { status: 201, body: { version: 2, n: 2, receipt: 'r' } }
/** Holds every POST until released, so a spec can act while core has the write. */
let gate: Promise<void> | null = null
let release: () => void = () => undefined
const hold = () => { gate = new Promise<void>((r) => { release = r }) }
/** Holds each View read begun from now until its own release (a read keeps the gate it began under), so a spec can order two reads. */
let readGate: Promise<void> | null = null
const holdReads = (): (() => void) => { let r: () => void = () => undefined; readGate = new Promise<void>((res) => { r = res }); return () => r() }
/** The next n View reads fail (core 500); the next n POSTs lose their answer (the connection drops after the request left). */
let readFails = 0
let drops = 0
beforeEach(() => {
  view = wire
  gate = null
  readGate = null
  readFails = 0
  drops = 0
  calls = []
  answer = { status: 201, body: { version: 2, n: 2, receipt: 'r' } }
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ method, path: String(u), body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (method === 'GET' && String(u) === '/api/me') return new Response(JSON.stringify({ me: { id: wire.you_id, name: wire.you } }), { status: 200 })
    if (method === 'GET') {
      const held = readGate
      if (held !== null) await held
      if (readFails > 0) { readFails -= 1; return new Response(JSON.stringify({ error: 'down' }), { status: 500 }) }
      return new Response(JSON.stringify(view), { status: 200 })
    }
    if (gate !== null) await gate
    if (drops > 0) { drops -= 1; throw new TypeError('Failed to fetch') }
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view, status: 'ready', error: null, stale: false, at: null })
  useMe.setState({ me: { id: wire.you_id, name: wire.you }, status: 'ready' })
})
afterEach(() => {
  cleanup(); setTeamFetch(null); resetWrites(); useModelNotice.setState({ notice: null })
  try { localStorage.clear() } catch { /* none */ }
  resetModelTab()
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', at: null }); useMe.setState({ me: null, status: 'none' })
})

const posts = () => calls.filter((c) => c.method === 'POST')
const draw = (v: View = view) => {
  const c = render(<ViewModelTab model={v.model!} />).container
  fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
  return c
}

describe('a figure is changed where it stands', () => {
  it('catch: a figure core lets the person set carries ✎ (shown on hover, focus and an open row), and a worked-out figure does not', () => {
    const c = draw()
    expect(c.querySelector(`[data-model-value-edit="${figure.id}"] [data-model-edit-cue]`)).not.toBeNull()
    expect(c.querySelector(`[data-model-row="${derived.id}"] [data-model-edit-cue]`)).toBeNull() // CONTRAST
  })

  it('HIGH: core gets the figure as typed on the base the editor opened on; the editor closes only once the new View lands, and says core\'s version', async () => {
    const c = draw()
    fireEvent.click(c.querySelector(`[data-model-value-edit="${figure.id}"]`)!)
    expect(c.querySelector(`[data-view-edit-prompt="${figure.id}"]`)?.textContent).toBe(figure.figure!.edit!.prompt) // core's words label it
    // A background re-read moves the live base on while the person types: their figure still goes on the version they opened.
    useViewStore.setState({ view: { ...wire, model: { ...wire.model!, edit_base: 7 } } })
    fireEvent.change(c.querySelector(`[data-model-editor-input="${figure.id}"]`)!, { target: { value: '450 to 520' } })
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(c.querySelector(`[data-model-editor="${figure.id}"]`)).toBeNull())
    const sent = posts()
    expect(sent.map((p) => p.path)).toEqual([`/api/scenarios/${SID}/edit`])
    const body = sent[0]!.body as Record<string, unknown>
    expect([body['base'], body['quantity'], body['typed'], typeof body['op']]).toEqual([1, figure.id, '450 to 520', 'string'])
    expect(calls.findIndex((x) => x.method === 'GET' && x.path.includes('/view'))).toBeGreaterThan(calls.indexOf(sent[0]!)) // the View was read after
    expect(c.querySelector(`[data-model-saved="${figure.id}"]`)?.textContent).toBe('Version 2 saved.')
  })

  it('HIGH: a refusal is core\'s own words under the field, the typing kept, nothing said as saved', async () => {
    answer = { status: 400, body: { error: figure.figure!.edit!.ask } }
    const c = draw()
    fireEvent.click(c.querySelector(`[data-model-value-edit="${figure.id}"]`)!)
    fireEvent.change(c.querySelector(`[data-model-editor-input="${figure.id}"]`)!, { target: { value: 'lots' } })
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(c.querySelector(`[data-model-editor-error="${figure.id}"]`)?.textContent).toBe(figure.figure!.edit!.ask))
    expect((c.querySelector(`[data-model-editor-input="${figure.id}"]`) as HTMLInputElement).value).toBe('lots')
    expect(c.querySelector(`[data-model-saved="${figure.id}"]`)).toBeNull()
  })

  it('an aim\'s target opens its own figure\'s editor (the line core draws titled target), and core gets that figure\'s id', async () => {
    const goal = wire.model!.cards.find((k) => k.id === 'reach_customer_target')!
    const target = wire.model!.cards.find((k) => k.id === 'customer_target')!
    const c = draw()
    fireEvent.click(c.querySelector(`[data-model-value-edit="${goal.id}"]`)!)
    expect(c.querySelector(`[data-view-edit-prompt="${target.id}"]`)?.textContent).toBe(target.figure!.edit!.prompt)
    fireEvent.change(c.querySelector(`[data-model-editor-input="${goal.id}"]`)!, { target: { value: '900' } })
    fireEvent.click(c.querySelector(`[data-model-editor-save="${goal.id}"]`)!)
    await waitFor(() => expect(posts().length).toBe(1))
    expect(posts()[0]!.path).toBe(`/api/scenarios/${SID}/edit`)
    const body = posts()[0]!.body as Record<string, unknown>
    expect([body['base'], body['quantity'], body['typed']]).toEqual([1, target.id, '900'])
  })

  it('catch (review a4d73faf): opening another row keeps an open editor and its typing', () => {
    const c = draw()
    fireEvent.click(c.querySelector(`[data-model-value-edit="${figure.id}"]`)!)
    fireEvent.change(c.querySelector(`[data-model-editor-input="${figure.id}"]`)!, { target: { value: '450' } })
    fireEvent.click(c.querySelector(`[data-model-select="${derived.id}"]`)!)
    expect(c.querySelector(`[data-model-detail="${derived.id}"]`)).not.toBeNull()
    expect((c.querySelector(`[data-model-editor-input="${figure.id}"]`) as HTMLInputElement | null)?.value).toBe('450')
  })

  it('catch (review a4d73faf): while core has one save, no other editor opens over it, and the save closes only its own', async () => {
    const other = wire.model!.cards.find((k) => k.id === 'customer_target')!
    hold()
    const c = draw()
    fireEvent.click(c.querySelector(`[data-model-value-edit="${figure.id}"]`)!)
    fireEvent.change(c.querySelector(`[data-model-editor-input="${figure.id}"]`)!, { target: { value: '450' } })
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(c.querySelector(`[data-model-editor-sending="${figure.id}"]`)?.textContent).toBe('Saving…'))
    fireEvent.click(c.querySelector(`[data-model-value-edit="${other.id}"]`)!)
    expect(c.querySelector(`[data-model-editor="${other.id}"]`)).toBeNull() // refused while core has the first
    release()
    await waitFor(() => expect(c.querySelector(`[data-model-editor="${figure.id}"]`)).toBeNull())
    expect(c.querySelector(`[data-model-saved="${figure.id}"]`)?.textContent).toBe('Version 2 saved.')
  })

  it('catch (review a4d73faf): a refusal that lands after its editor left the screen is core\'s words on its row', async () => {
    answer = { status: 400, body: { error: figure.figure!.edit!.ask } }
    hold()
    const c = draw()
    fireEvent.click(c.querySelector(`[data-model-value-edit="${figure.id}"]`)!)
    fireEvent.change(c.querySelector(`[data-model-editor-input="${figure.id}"]`)!, { target: { value: 'lots' } })
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(posts().length).toBe(1))
    fireEvent.click(c.querySelector('[data-model-group-toggle="factors"]')!) // the group closes: the editor leaves the screen
    expect(c.querySelector(`[data-model-editor="${figure.id}"]`)).toBeNull()
    release()
    await waitFor(() => expect(useModelTab.getState().busy).toBeNull())
    fireEvent.click(c.querySelector('[data-model-group-toggle="factors"]')!)
    expect(c.querySelector(`[data-model-failed="${figure.id}"]`)?.textContent).toBe(figure.figure!.edit!.ask)
  })

  it('Cancel hands focus back to the figure that opened the editor', async () => {
    const c = draw()
    fireEvent.click(c.querySelector(`[data-model-value-edit="${figure.id}"]`)!)
    fireEvent.click(c.querySelector(`[data-model-editor-cancel="${figure.id}"]`)!)
    await waitFor(() => expect(document.activeElement).toBe(c.querySelector(`[data-model-value-edit="${figure.id}"]`)))
  })

  it('HIGH: a link\'s strength opens its sizing figure\'s editor (labelled fixture), and core gets that figure\'s id', async () => {
    // ⚠ LABELLED FIXTURE: core sizes a line with `links[].effect.figure` (core view.ts); this golden has none, so one line is given an
    // effect sized by an editable figure card of the same View.
    const k = wire.model!.links.findIndex((l) => l.kind === 'plain')
    const sized = { ...wire, model: { ...wire.model!, links: wire.model!.links.map((l, i) => (i === k ? { ...l, effect: { text: '1.5', title: 'x', figure: figure.id } } : l)) } }
    view = sized
    useViewStore.setState({ view })
    const c = draw(sized)
    const row = linkRowOf(sized.model!, k)
    fireEvent.click(c.querySelector(`[data-model-select="${row}"]`)!)
    fireEvent.click(c.querySelector(`[data-model-detail="${row}"] [data-model-action="strength"]`)!)
    expect(c.querySelector(`[data-view-edit-prompt="${figure.id}"]`)?.textContent).toBe(figure.figure!.edit!.prompt)
    fireEvent.change(c.querySelector(`[data-model-editor-input="${row}"]`)!, { target: { value: '2' } })
    fireEvent.click(c.querySelector(`[data-model-editor-save="${row}"]`)!)
    await waitFor(() => expect(posts().length).toBe(1))
    const body = posts()[0]!.body as Record<string, unknown>
    expect([posts()[0]!.path, body['base'], body['quantity'], body['typed']]).toEqual([`/api/scenarios/${SID}/edit`, 1, figure.id, '2'])
  })
})

describe('a row opens its detail', () => {
  it('the row\'s press opens its detail with what the person can do there; a second press closes it', () => {
    const c = draw()
    fireEvent.click(c.querySelector(`[data-model-select="${figure.id}"]`)!)
    const detail = c.querySelector(`[data-model-detail="${figure.id}"]`)!
    expect([...detail.querySelectorAll('[data-model-action]')].map((a) => a.getAttribute('data-model-action'))).toEqual(['figure', 'rename', 'canvas'])
    expect(c.querySelector(`[data-model-select="${figure.id}"]`)?.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(c.querySelector(`[data-model-select="${figure.id}"]`)!)
    expect(c.querySelector(`[data-model-detail="${figure.id}"]`)).toBeNull()
  })

  it('the name is a keyboard control: Enter opens the row\'s detail, Space closes it', () => {
    const c = draw()
    const name = c.querySelector(`[data-model-select="${figure.id}"]`)!
    expect([name.getAttribute('role'), name.getAttribute('tabindex')]).toEqual(['button', '0'])
    fireEvent.keyDown(name, { key: 'Enter' })
    expect(c.querySelector(`[data-model-detail="${figure.id}"]`)).not.toBeNull()
    fireEvent.keyDown(name, { key: ' ' })
    expect(c.querySelector(`[data-model-detail="${figure.id}"]`)).toBeNull()
  })

  it('HIGH: Rename sends the new name on the base it opened on; the editor closes once the new View lands', async () => {
    const c = draw()
    fireEvent.click(c.querySelector(`[data-model-select="${figure.id}"]`)!)
    fireEvent.click(c.querySelector(`[data-model-detail="${figure.id}"] [data-model-action="rename"]`)!)
    const input = c.querySelector(`[data-model-renamer-input="${figure.id}"]`) as HTMLInputElement
    expect(input.value).toBe(figure.heading)
    fireEvent.change(input, { target: { value: '  Customers today  ' } })
    fireEvent.click(c.querySelector(`[data-model-renamer-save="${figure.id}"]`)!)
    await waitFor(() => expect(c.querySelector(`[data-model-renamer="${figure.id}"]`)).toBeNull())
    expect(posts().map((p) => p.path)).toEqual([`/api/scenarios/${SID}/rename`])
    const body = posts()[0]!.body as Record<string, unknown>
    expect([body['base'], body['record'], body['label']]).toEqual([1, figure.id, 'Customers today'])
  })
})

describe('when the tab may not change the model', () => {
  it('catch: Olumi\'s held change is said once with core\'s heading; no ✎ anywhere; setting it aside discards it and reads the View again', async () => {
    view = { ...wire, proposal: { id: 9, base: 1, heading: 'Olumi proposes 1 change', on: 'on version 1' } as unknown as View['proposal'], model: { ...wire.model!, edit_base: null } }
    useViewStore.setState({ view })
    const c = draw(view)
    const held = c.querySelector('[data-testid="view-model-held"]')!
    expect(held.querySelector('[data-view="proposal.heading"]')?.textContent).toBe('Olumi proposes 1 change')
    expect(c.querySelectorAll('[data-model-edit-cue]').length).toBe(0)
    fireEvent.click(c.querySelector('[data-testid="view-model-held-aside"]')!)
    expect(posts()).toEqual([]) // asked first
    fireEvent.click(c.querySelector('[data-testid="view-model-held-confirm"]')!)
    await waitFor(() => expect(posts().map((p) => p.path)).toEqual(['/api/proposals/9/discard']))
    expect(posts()[0]!.body).toEqual({})
    await waitFor(() => expect(calls.at(-1)?.path).toContain('/view'))
  })

  it('CONTRAST: on another person\'s page, or on an earlier version, nothing offers an edit', () => {
    useMe.setState({ me: { id: 'p_somebody_else', name: 'Bea' }, status: 'ready' })
    const other = draw()
    expect(other.querySelectorAll('[data-model-edit-cue]').length).toBe(0)
    cleanup()
    useMe.setState({ me: { id: wire.you_id, name: wire.you }, status: 'ready' })
    useViewStore.setState({ at: 3 })
    const earlier = draw()
    expect(earlier.querySelectorAll('[data-model-edit-cue]').length).toBe(0)
    cleanup()
    useViewStore.setState({ at: null })
    expect(draw().querySelectorAll('[data-model-edit-cue]').length).toBeGreaterThan(0) // the same page, latest version: offered
  })
})

describe('Plain | Expert', () => {
  it('catch: Plain hides the science core sends; Expert shows it in core\'s words; the choice is the person\'s, kept under the dock\'s key', () => {
    const reading = wire.model!.cards.find((k) => k.id === 'entry_delay')!
    const marked = wire.model!.links.findIndex((l) => l.label !== '')
    const c = draw()
    expect(c.querySelector(`[data-view="${reading.id}.figure.title"]`)).toBeNull()
    // A link's kind or sign stays in Plain: what a person needs to challenge the model is never behind the switch.
    expect(c.querySelector(`[data-view="links.${marked}.label"]`)?.textContent).toBe(wire.model!.links[marked]!.label)
    fireEvent.click(c.querySelector('[data-model-expert-arm="expert"]')!)
    expect(c.querySelector(`[data-view="${reading.id}.figure.title"]`)?.textContent).toBe(reading.figure!.title)
    expect(localStorage.getItem('olumi.expertMode')).toBe('true')
    resetModelTab() // a fresh visit reads the stored choice back
    expect(useModelTab.getState().expert).toBe(true)
  })
})

describe('whose it is, and another scenario', () => {
  it('the detail says whose a card is in core\'s words: a person\'s by their icon, Olumi\'s by core\'s own glyph (core a62f0899 wire)', () => {
    const bakery: View = { ...JSON.parse(readFileSync(path.resolve('src/olumiView/model/fixtures/bakery-author.core-a62f0899.view3.json'), 'utf8')), id: SID }
    view = bakery
    useViewStore.setState({ view })
    useMe.setState({ me: { id: bakery.you_id, name: bakery.you }, status: 'ready' })
    const c = draw(bakery)
    type A = { by: string; text: string; title: string }
    const authorOf = (id: string) => (bakery.model!.cards.find((k) => k.id === id) as unknown as { author: A }).author
    fireEvent.click(c.querySelector('[data-model-select="base_sales"]')!)
    expect(c.querySelector('[data-model-detail="base_sales"] [data-view="base_sales.author.text"]')?.textContent).toBe(authorOf('base_sales').text)
    fireEvent.click(c.querySelector('[data-model-select="sales"]')!)
    const whose = c.querySelector('[data-model-detail="sales"] [data-model-detail-section="whose"]')!
    expect(whose.querySelector('[data-view="sales.author.text"]')?.textContent).toBe(authorOf('sales').text)
    expect(whose.textContent).toContain(bakery.model!.cards.find((k) => k.id === 'sales')!.olumi!.glyph)
  })

  it('catch (review a4d73faf): another scenario opens with nothing open and no receipt', () => {
    const c = draw()
    fireEvent.click(c.querySelector(`[data-model-select="${figure.id}"]`)!)
    useModelTab.getState().say({ row: figure.id, words: 'Version 2 saved.', tone: 'saved' })
    expect(useModelTab.getState().open).toBe(figure.id)
    act(() => { useViewStore.setState({ sid: 's_ffffffffffff' }) })
    expect(useModelTab.getState().open).toBeNull()
    expect(useModelTab.getState().receipt).toBeNull()
    expect(c.querySelector(`[data-model-detail="${figure.id}"]`)).toBeNull()
  })
})

describe('adding and taking away', () => {
  it('N2 blocker 7: empty Factors opens and saves q_first_factor through Add a figure', async () => {
    // Labelled fixture: an approved model with its goal and options, before anyone has added a factor.
    const ids = ['reach_customer_target', 'broader_entry', 'single_country_test', 'no_new_european_entry']
    const empty: View = { ...wire, model: { ...wire.model!, cards: wire.model!.cards.filter((c) => ids.includes(c.id)), links: [] } }
    useViewStore.setState({ view: empty })
    const c = render(<ViewModelTabBlock />).container
    const factors = c.querySelector('[data-model-group-toggle="factors"]')
    expect(factors).not.toBeNull()
    expect(factors?.getAttribute('aria-label')).toBe('Factors, 0 elements')
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    expect(factors?.getAttribute('aria-expanded')).toBe('true')
    const add = c.querySelector('[data-model-group="factors"] [data-model-add-figure="open"]')!
    expect(add.textContent).toBe('Add a figure')
    fireEvent.click(add)
    fireEvent.change(c.querySelector('[data-model-add-figure="name"]')!, { target: { value: 'Sales team' } })
    fireEvent.change(c.querySelector('[data-model-add-figure="typed"]')!, { target: { value: '4 to 6' } })
    fireEvent.change(c.querySelector('[data-model-add-figure="unit"]')!, { target: { value: 'people' } })
    const first = { ...figure, id: 'q_first_factor', heading: 'Sales team', figure: { ...figure.figure!, text: '4–6 people' } }
    answer = { status: 201, body: { version: 2, n: 2, receipt: 'r_first_factor', record: first.id } }
    view = { ...empty, version: { ...wire.version!, id: 2, n: 2 }, model: { ...empty.model!, edit_base: 2, cards: [...empty.model!.cards, first] } }
    fireEvent.click(c.querySelector('[data-model-add-figure="add"]')!)
    await waitFor(() => expect(c.querySelector(`[data-view="${first.id}.heading"]`)?.textContent).toBe('Sales team'))
    expect(posts()).toEqual([
      { method: 'POST', path: `/api/scenarios/${SID}/figures`, body: { base: 1, label: 'Sales team', typed: '4 to 6', unit: 'people', op: expect.any(String) } },
    ])
    expect(c.querySelector(`[data-view="${first.id}.figure.text"]`)?.textContent).toBe('4–6 people')
    expect(c.querySelector('[data-model-group-count="factors"]')?.textContent).toBe('1')
    expect(c.querySelector('[data-model-add-figure="form"]')).toBeNull()
  })

  it('HIGH: Add a figure sends the name, the figure as typed and the unit on the base it opened on; the form closes once the new View lands', async () => {
    answer = { status: 201, body: { version: 2, n: 2, receipt: 'r', record: 'q_new' } }
    const c = draw()
    fireEvent.click(c.querySelector('[data-model-add-figure="open"]')!)
    useViewStore.setState({ view: { ...wire, model: { ...wire.model!, edit_base: 7 } } }) // a background re-read moves the live base on
    fireEvent.change(c.querySelector('[data-model-add-figure="name"]')!, { target: { value: ' Sales team ' } })
    fireEvent.change(c.querySelector('[data-model-add-figure="typed"]')!, { target: { value: '4 to 6' } })
    fireEvent.change(c.querySelector('[data-model-add-figure="unit"]')!, { target: { value: 'people' } })
    fireEvent.click(c.querySelector('[data-model-add-figure="add"]')!)
    await waitFor(() => expect(c.querySelector('[data-model-add-figure="form"]')).toBeNull())
    expect(posts().map((p) => p.path)).toEqual([`/api/scenarios/${SID}/figures`])
    const body = posts()[0]!.body as Record<string, unknown>
    expect([body['base'], body['label'], body['typed'], body['unit']]).toEqual([1, 'Sales team', '4 to 6', 'people'])
  })

  it('HIGH: Remove link asks once, then posts core\'s remove object verbatim on the base it opened on (labelled fixture: this wire View marks no line removable)', async () => {
    // ⚠ LABELLED FIXTURE: core marks a line removable with `links[].remove` (core view.ts removalsOf); none in this golden, so one line is
    // given the shape core serves ({ record, part }, as the R25 part witness recorded it: { record: 'total_def', part: 'existing_capacity' }).
    const k = wire.model!.links.findIndex((l) => l.kind === 'plain')
    const removable = { ...wire, model: { ...wire.model!, links: wire.model!.links.map((l, i) => (i === k ? { ...l, remove: { record: 'rel_x', part: 'part_y' } } : l)) } }
    view = removable
    useViewStore.setState({ view })
    const c = draw(removable)
    const row = linkRowOf(removable.model!, k)
    fireEvent.click(c.querySelector(`[data-model-select="${row}"]`)!)
    fireEvent.click(c.querySelector(`[data-model-remove-link-open="${row}"]`)!)
    expect(posts()).toEqual([]) // asked first
    fireEvent.click(c.querySelector(`[data-model-remove-link-yes="${row}"]`)!)
    await waitFor(() => expect(posts().map((p) => p.path)).toEqual([`/api/scenarios/${SID}/links/remove`]))
    const body = posts()[0]!.body as Record<string, unknown>
    expect([body['base'], body['record'], body['part'], typeof body['op']]).toEqual([1, 'rel_x', 'part_y', 'string'])
    // CONTRAST: the detail of a line core does not mark is open, and offers no removal.
    const other = linkRowOf(removable.model!, wire.model!.links.findIndex((_, i) => i !== k))
    fireEvent.click(c.querySelector(`[data-model-select="${other}"]`)!)
    expect(c.querySelector(`[data-model-detail="${other}"]`)).not.toBeNull()
    expect(c.querySelector(`[data-model-remove-link-open="${other}"]`)).toBeNull()
  })
})

// ── UI audit of e8ebab94 (7 Nov): every write path the tab offers, bound by identity (route, exact body, write key, base at the press) ──
/** Core's own refusals (core a62f0899 src/app/service.ts: /edit at 1647-1648; rename, remove and add `EDIT_WORDS.stale` at 186). */
const CORE = {
  editStale: 'this figure was edited on a different version',
  stale: (verb: 'rename' | 'remove' | 'add') => `this was changed on a different version; reload and ${verb} it again`,
}
const sendingKeys = () => Object.keys(useWrites.getState().sending)
const viewReads = () => calls.filter((x) => x.method === 'GET' && x.path.includes('/view'))
const typeIn = (c: HTMLElement, sel: string, value: string) => fireEvent.change(c.querySelector(sel)!, { target: { value } })
const goal = wire.model!.cards.find((k) => k.id === 'reach_customer_target')!
const target = wire.model!.cards.find((k) => k.id === 'customer_target')!
const limit = wire.model!.cards.find((k) => k.id === 'investment_limit')!
const cap = wire.model!.cards.find((k) => k.id === 'investment_cap')!
const plainLink = wire.model!.links.findIndex((l) => l.kind === 'plain')
/** ⚠ LABELLED FIXTURE (as the rows above): one plain line sized by an editable figure and removable in core's { record, part } shape. */
const withFixture = (): View => {
  view = { ...wire, model: { ...wire.model!, links: wire.model!.links.map((l, i) => (i === plainLink ? { ...l, effect: { text: '1.5', title: 'x', figure: figure.id }, remove: { record: 'rel_x', part: 'part_y' } } : l)) } }
  useViewStore.setState({ view })
  return view
}
/** A background re-read moves the live base on (core approved version 7 meanwhile); the View the next read answers is unchanged. */
const moveBase = () => act(() => { useViewStore.setState({ view: { ...view, model: { ...view.model!, edit_base: 7 } } }) })
/** The View with one figure's words changed, as core answers once a save has landed. */
const withFigure = (v: View, id: string, text: string): View => ({ ...v, model: { ...v.model!, cards: v.model!.cards.map((k) => (k.id === id ? { ...k, figure: { ...k.figure!, text } } : k)) } })
/** A held View as core serves one (core view.ts:133/244/315: while a proposal is pending, edit_base and every figure's edit are null). */
const heldView = (v: View): View => ({ ...v, proposal: { id: 9, base: 1, heading: 'Olumi proposes 1 change', on: 'on version 1' } as unknown as View['proposal'],
  model: { ...v.model!, edit_base: null, cards: v.model!.cards.map((k) => (k.figure === null ? k : { ...k, figure: { ...k.figure, edit: null } })) } })
const openFigure = (c: HTMLElement, id: string, typed: string) => {
  fireEvent.click(c.querySelector(`[data-model-value-edit="${id}"]`)!)
  typeIn(c, `[data-model-editor-input="${id}"]`, typed)
}
const openLink = (c: HTMLElement, row: string) => fireEvent.click(c.querySelector(`[data-model-select="${row}"]`)!)

describe('the write key is the canvas editor\'s, and it is held while core has the write', () => {
  it('HIGH: Change figure holds `<sid>:edit:<quantity>` and nothing else, until the View read after it lands', async () => {
    hold()
    const c = draw()
    openFigure(c, figure.id, '450')
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(posts().length).toBe(1))
    expect(sendingKeys()).toEqual([`${SID}:edit:${figure.id}`])
    expect(useModelTab.getState().busy).toBe(`${SID}:edit:${figure.id}`)
    release()
    await waitFor(() => expect(c.querySelector(`[data-model-editor="${figure.id}"]`)).toBeNull())
    expect([sendingKeys(), useModelTab.getState().busy]).toEqual([[], null])
  })

  it('HIGH: Rename holds `<sid>:rename:<record>`', async () => {
    hold()
    const c = draw()
    fireEvent.click(c.querySelector(`[data-model-select="${figure.id}"]`)!)
    fireEvent.click(c.querySelector(`[data-model-detail="${figure.id}"] [data-model-action="rename"]`)!)
    typeIn(c, `[data-model-renamer-input="${figure.id}"]`, 'Customers today')
    fireEvent.click(c.querySelector(`[data-model-renamer-save="${figure.id}"]`)!)
    await waitFor(() => expect(posts().length).toBe(1))
    expect(sendingKeys()).toEqual([`${SID}:rename:${figure.id}`])
    release()
    await waitFor(() => expect(c.querySelector(`[data-model-renamer="${figure.id}"]`)).toBeNull())
  })

  it('HIGH: Add a figure holds `<sid>:add-figure`', async () => {
    answer = { status: 201, body: { version: 2, n: 2, receipt: 'r', record: 'q_new' } }
    hold()
    const c = draw()
    fireEvent.click(c.querySelector('[data-model-add-figure="open"]')!)
    typeIn(c, '[data-model-add-figure="name"]', 'Sales team')
    typeIn(c, '[data-model-add-figure="typed"]', '4 to 6')
    fireEvent.click(c.querySelector('[data-model-add-figure="add"]')!)
    await waitFor(() => expect(posts().length).toBe(1))
    expect(sendingKeys()).toEqual([`${SID}:add-figure`])
    release()
    await waitFor(() => expect(c.querySelector('[data-model-add-figure="form"]')).toBeNull())
  })

  it('HIGH: Remove link holds `<sid>:remove-link:<record>.<part>` (labelled fixture)', async () => {
    const v = withFixture()
    const row = linkRowOf(v.model!, plainLink)
    hold()
    const c = draw(v)
    openLink(c, row)
    fireEvent.click(c.querySelector(`[data-model-remove-link-open="${row}"]`)!)
    fireEvent.click(c.querySelector(`[data-model-remove-link-yes="${row}"]`)!)
    await waitFor(() => expect(posts().length).toBe(1))
    expect(sendingKeys()).toEqual([`${SID}:remove-link:rel_x.part_y`])
    release()
    await waitFor(() => expect(useModelTab.getState().busy).toBeNull())
  })
})

describe('what an editor opened on is what core gets: the base at the press, exact bodies', () => {
  it('HIGH: Rename sends the base it opened on, as exactly { base, record, label, op }', async () => {
    const c = draw()
    fireEvent.click(c.querySelector(`[data-model-select="${figure.id}"]`)!)
    fireEvent.click(c.querySelector(`[data-model-detail="${figure.id}"] [data-model-action="rename"]`)!)
    moveBase()
    typeIn(c, `[data-model-renamer-input="${figure.id}"]`, '  Customers today  ')
    fireEvent.click(c.querySelector(`[data-model-renamer-save="${figure.id}"]`)!)
    await waitFor(() => expect(posts().length).toBe(1))
    expect(posts()[0]).toEqual({ method: 'POST', path: `/api/scenarios/${SID}/rename`, body: { base: 1, record: figure.id, label: 'Customers today', op: expect.any(String) } })
  })

  it('HIGH: Remove link sends the base its ask opened on, as exactly { base, record, part, op } (labelled fixture)', async () => {
    const v = withFixture()
    const row = linkRowOf(v.model!, plainLink)
    const c = draw(v)
    openLink(c, row)
    fireEvent.click(c.querySelector(`[data-model-remove-link-open="${row}"]`)!)
    moveBase()
    fireEvent.click(c.querySelector(`[data-model-remove-link-yes="${row}"]`)!)
    await waitFor(() => expect(posts().length).toBe(1))
    expect(posts()[0]).toEqual({ method: 'POST', path: `/api/scenarios/${SID}/links/remove`, body: { base: 1, record: 'rel_x', part: 'part_y', op: expect.any(String) } })
  })

  it('HIGH: an aim\'s target and a limit\'s bound send their own figure on the base they opened on, as exactly { base, quantity, typed, op }', async () => {
    const c = draw()
    openFigure(c, goal.id, '900')
    moveBase()
    fireEvent.click(c.querySelector(`[data-model-editor-save="${goal.id}"]`)!)
    await waitFor(() => expect(c.querySelector(`[data-model-editor="${goal.id}"]`)).toBeNull())
    openFigure(c, limit.id, 'at most 450,000')
    moveBase()
    fireEvent.click(c.querySelector(`[data-model-editor-save="${limit.id}"]`)!)
    await waitFor(() => expect(posts().length).toBe(2))
    expect(posts().map((p) => p.body)).toEqual([
      { base: 1, quantity: target.id, typed: '900', op: expect.any(String) },
      { base: 1, quantity: cap.id, typed: 'at most 450,000', op: expect.any(String) },
    ])
  })

  it('HIGH: a link\'s strength sends its sizing figure on the base it opened on, as exactly { base, quantity, typed, op } (labelled fixture)', async () => {
    const v = withFixture()
    const row = linkRowOf(v.model!, plainLink)
    const c = draw(v)
    openLink(c, row)
    fireEvent.click(c.querySelector(`[data-model-detail="${row}"] [data-model-action="strength"]`)!)
    moveBase()
    typeIn(c, `[data-model-editor-input="${row}"]`, '2')
    fireEvent.click(c.querySelector(`[data-model-editor-save="${row}"]`)!)
    await waitFor(() => expect(posts().length).toBe(1))
    expect(posts()[0]).toEqual({ method: 'POST', path: `/api/scenarios/${SID}/edit`, body: { base: 1, quantity: figure.id, typed: '2', op: expect.any(String) } })
  })

  it('catch: the typing and the base stay with the editor when its group closes and opens again', async () => {
    const c = draw()
    openFigure(c, figure.id, '450')
    fireEvent.click(c.querySelector('[data-model-group-toggle="factors"]')!)
    expect(c.querySelector(`[data-model-editor="${figure.id}"]`)).toBeNull()
    moveBase()
    fireEvent.click(c.querySelector('[data-model-group-toggle="factors"]')!)
    expect((c.querySelector(`[data-model-editor-input="${figure.id}"]`) as HTMLInputElement).value).toBe('450')
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(posts().length).toBe(1))
    expect(posts()[0]!.body).toEqual({ base: 1, quantity: figure.id, typed: '450', op: expect.any(String) })
  })
})

describe('core refuses: its own words in the editor that asked, the typing kept', () => {
  it('HIGH: a stale base on a figure: core\'s words, the typing kept, the field focused; nothing read, nothing said as saved', async () => {
    answer = { status: 409, body: { error: CORE.editStale } }
    const c = draw()
    openFigure(c, figure.id, '450')
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(c.querySelector(`[data-model-editor-error="${figure.id}"]`)?.textContent).toBe(CORE.editStale))
    const input = c.querySelector(`[data-model-editor-input="${figure.id}"]`) as HTMLInputElement
    expect(input.value).toBe('450')
    await waitFor(() => expect(document.activeElement).toBe(input))
    expect(c.querySelector(`[data-model-saved="${figure.id}"]`)).toBeNull()
    expect(viewReads()).toEqual([])
  })

  it('HIGH: a target, a bound, a strength and a name each say core\'s refusal under their own field, the typing kept', async () => {
    const v = withFixture()
    const row = linkRowOf(v.model!, plainLink)
    const c = draw(v)
    const refused = async (at: string, sel: string, typed: string, words: string, field = `[data-model-editor-input="${at}"]`) => {
      answer = { status: 409, body: { error: words } }
      fireEvent.click(c.querySelector(sel)!)
      await waitFor(() => expect(c.querySelector(`[data-model-editor-error="${at}"], [data-model-renamer-error="${at}"]`)?.textContent).toBe(words))
      expect((c.querySelector(field) as HTMLInputElement).value).toBe(typed)
      fireEvent.click(c.querySelector(`[data-model-editor="${at}"] [data-model-editor-cancel], [data-model-renamer="${at}"] button[type="button"]`)!)
    }
    openFigure(c, goal.id, '900')
    await refused(goal.id, `[data-model-editor-save="${goal.id}"]`, '900', CORE.editStale)
    openFigure(c, limit.id, '450')
    await refused(limit.id, `[data-model-editor-save="${limit.id}"]`, '450', CORE.editStale)
    openLink(c, row)
    fireEvent.click(c.querySelector(`[data-model-detail="${row}"] [data-model-action="strength"]`)!)
    typeIn(c, `[data-model-editor-input="${row}"]`, '2')
    await refused(row, `[data-model-editor-save="${row}"]`, '2', CORE.editStale)
    fireEvent.click(c.querySelector(`[data-model-select="${figure.id}"]`)!)
    fireEvent.click(c.querySelector(`[data-model-detail="${figure.id}"] [data-model-action="rename"]`)!)
    typeIn(c, `[data-model-renamer-input="${figure.id}"]`, 'Customers today')
    await refused(figure.id, `[data-model-renamer-save="${figure.id}"]`, 'Customers today', CORE.stale('rename'), `[data-model-renamer-input="${figure.id}"]`)
    expect(posts().length).toBe(4)
    expect(viewReads()).toEqual([])
    expect(c.querySelector('[data-model-saved]')).toBeNull()
  })

  it('HIGH: Add a figure and Remove link say core\'s refusal in their own place, the form and the ask kept (labelled fixture)', async () => {
    const v = withFixture()
    const row = linkRowOf(v.model!, plainLink)
    const c = draw(v)
    answer = { status: 409, body: { error: CORE.stale('add') } }
    fireEvent.click(c.querySelector('[data-model-add-figure="open"]')!)
    typeIn(c, '[data-model-add-figure="name"]', 'Sales team')
    typeIn(c, '[data-model-add-figure="typed"]', '4 to 6')
    fireEvent.click(c.querySelector('[data-model-add-figure="add"]')!)
    await waitFor(() => expect(c.querySelector('[data-model-add-figure="error"]')?.textContent).toBe(CORE.stale('add')))
    expect((c.querySelector('[data-model-add-figure="name"]') as HTMLInputElement).value).toBe('Sales team')
    answer = { status: 409, body: { error: CORE.stale('remove') } }
    openLink(c, row)
    fireEvent.click(c.querySelector(`[data-model-remove-link-open="${row}"]`)!)
    fireEvent.click(c.querySelector(`[data-model-remove-link-yes="${row}"]`)!)
    await waitFor(() => expect(c.querySelector(`[data-model-remove-link-error="${row}"]`)?.textContent).toBe(CORE.stale('remove')))
    expect(c.querySelector(`[data-model-remove-link-yes="${row}"]`)).not.toBeNull() // the ask stays, nothing removed
    expect(viewReads()).toEqual([])
  })
})

describe('the offer withdrawn while an editor is open (Olumi\'s change held meanwhile)', () => {
  const block = () => {
    const c = render(<ViewModelTabBlock />).container
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    return c
  }
  it('catch: a figure\'s editor leaves with core\'s offer, keeping the typing; back once core offers again, its base the one it opened on', async () => {
    answer = { status: 409, body: { error: CORE.editStale } }
    const c = block()
    openFigure(c, figure.id, '450')
    act(() => { useViewStore.setState({ view: heldView(wire) }) })
    expect(c.querySelector(`[data-model-editor="${figure.id}"]`)).toBeNull() // core offers no edit while it waits
    expect(c.querySelector('[data-testid="view-model-held"]')).not.toBeNull()
    // Never silently (UI audit of 3f7817bd): the row says why, and that the typing is kept.
    expect(c.querySelector(`[data-model-editor-kept="${figure.id}"] [role="status"]`)?.textContent).toBe(MODEL_EDIT_WORDS.withdrawnHeld)
    act(() => { useViewStore.setState({ view: { ...wire, model: { ...wire.model!, edit_base: 2 } } }) }) // set aside: version 2 offered
    expect((c.querySelector(`[data-model-editor-input="${figure.id}"]`) as HTMLInputElement).value).toBe('450')
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(c.querySelector(`[data-model-editor-error="${figure.id}"]`)?.textContent).toBe(CORE.editStale))
    expect(posts()[0]!.body).toEqual({ base: 1, quantity: figure.id, typed: '450', op: expect.any(String) })
  })

  it('catch: a name\'s editor stays with Save off and says why; the typing kept; nothing is sent', () => {
    const c = block()
    fireEvent.click(c.querySelector(`[data-model-select="${figure.id}"]`)!)
    fireEvent.click(c.querySelector(`[data-model-detail="${figure.id}"] [data-model-action="rename"]`)!)
    typeIn(c, `[data-model-renamer-input="${figure.id}"]`, 'Customers today')
    act(() => { useViewStore.setState({ view: heldView(wire) }) })
    expect(c.querySelector(`[data-model-renamer-withdrawn="${figure.id}"]`)?.textContent).toBe(MODEL_EDIT_WORDS.withdrawnHeld)
    expect((c.querySelector(`[data-model-renamer-save="${figure.id}"]`) as HTMLButtonElement).disabled).toBe(true)
    expect((c.querySelector(`[data-model-renamer-input="${figure.id}"]`) as HTMLInputElement).value).toBe('Customers today')
    fireEvent.submit(c.querySelector(`[data-model-renamer="${figure.id}"]`)!)
    expect(posts()).toEqual([])
    // CONTRAST: offered again, the line goes and Save is on.
    act(() => { useViewStore.setState({ view: wire }) })
    expect(c.querySelector(`[data-model-renamer-withdrawn="${figure.id}"]`)).toBeNull()
    expect((c.querySelector(`[data-model-renamer-save="${figure.id}"]`) as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('an editor closes only once the View read after the save shows it', () => {
  it('HIGH: while the read after a save is on its way, nothing of the stale View is drawn, only "Saving…"; then the new figure, core\'s version, the groups as left', async () => {
    const releaseRead = holdReads()
    view = withFigure(wire, figure.id, '450 to 520')
    const c = render(<ViewModelTabBlock />).container
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    openFigure(c, figure.id, '450 to 520')
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(viewReads().length).toBe(1))
    // The View is stale until this read lands (store.ts modelChanged): none of it is drawn and nothing offers an edit (Codex review-ui 6).
    expect(c.querySelector('[data-testid="view-model-not-current-why"]')?.textContent).toBe(MODEL_EDIT_WORDS.saving)
    expect(c.querySelector(`[data-model-editor="${figure.id}"], [data-view="${figure.id}.figure.text"]`)).toBeNull()
    expect(useModelTab.getState().editing?.typed).toBe('450 to 520') // the draft is kept, not drawn
    releaseRead()
    await waitFor(() => expect(c.querySelector(`[data-view="${figure.id}.figure.text"]`)?.textContent).toBe('450 to 520'))
    expect(c.querySelector(`[data-model-editor="${figure.id}"]`)).toBeNull()
    expect(c.querySelector(`[data-model-saved="${figure.id}"]`)?.textContent).toBe('Version 2 saved.')
    expect(c.querySelector('[data-model-group="factors"]')?.getAttribute('data-open')).toBe('true') // the tab stayed: its groups as left
  })

  it('HIGH: a read a newer one overtook is not a failed one: the editor waits for the newer read, then closes with core\'s version', async () => {
    const releaseOurs = holdReads()
    const c = draw()
    openFigure(c, figure.id, '450')
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(viewReads().length).toBe(1))
    const releaseNewer = holdReads()
    void useViewStore.getState().refresh() // a newer read (the person opened a badge, say) overtakes the save's own
    await waitFor(() => expect(viewReads().length).toBe(2))
    releaseOurs()
    await new Promise((r) => setTimeout(r, 200))
    expect(c.querySelector(`[data-model-editor-error="${figure.id}"]`)).toBeNull() // not "could not show it": the newer read settles it
    expect(c.querySelector(`[data-model-editor-sending="${figure.id}"]`)?.textContent).toBe('Saving…')
    releaseNewer()
    await waitFor(() => expect(c.querySelector(`[data-model-editor="${figure.id}"]`)).toBeNull())
    expect(c.querySelector(`[data-model-saved="${figure.id}"]`)?.textContent).toBe('Version 2 saved.')
  })
})

describe('a lost answer is sent again with the same op, never as a second write', () => {
  it('HIGH: the connection drops once: the same request goes again with the same op, and the save lands once', async () => {
    drops = 1
    const c = draw()
    openFigure(c, figure.id, '450')
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(c.querySelector(`[data-model-editor="${figure.id}"]`)).toBeNull())
    expect(posts().length).toBe(2)
    expect(posts()[1]!.body).toEqual(posts()[0]!.body)
    expect(c.querySelector(`[data-model-saved="${figure.id}"]`)?.textContent).toBe('Version 2 saved.')
  })

  it('HIGH: dropped twice: core\'s answer unconfirmed is said, the typing kept; Save again sends the same op', async () => {
    drops = 2
    const c = draw()
    openFigure(c, figure.id, '450')
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(c.querySelector(`[data-model-editor-error="${figure.id}"]`)?.textContent).toBe(NOT_CONFIRMED))
    expect((c.querySelector(`[data-model-editor-input="${figure.id}"]`) as HTMLInputElement).value).toBe('450')
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(c.querySelector(`[data-model-editor="${figure.id}"]`)).toBeNull())
    expect(posts().length).toBe(3)
    expect(new Set(posts().map((p) => (p.body as { op: string }).op)).size).toBe(1)
  })
})

describe('a save that lands after the page moved to another scenario says nothing there', () => {
  it('HIGH: no notice, no View read, no receipt and no editor closed in the scenario now on screen', async () => {
    hold()
    const c = draw()
    openFigure(c, figure.id, '450')
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(posts().length).toBe(1))
    act(() => { useViewStore.setState({ sid: 's_ffffffffffff' }) })
    // The other scenario's own editor, open on a card of the same id (ids are scenario-local).
    act(() => { useModelTab.getState().edit({ row: figure.id, what: 'figure', quantity: figure.id, sid: 's_ffffffffffff', base: 4, typed: '9' }) })
    release()
    await waitFor(() => expect(sendingKeys()).toEqual([]))
    await new Promise((r) => setTimeout(r, 50))
    expect(useModelNotice.getState().notice).toBeNull()
    expect(viewReads()).toEqual([])
    expect(useModelTab.getState().receipt).toBeNull()
    expect(useModelTab.getState().editing).toEqual({ row: figure.id, what: 'figure', quantity: figure.id, sid: 's_ffffffffffff', base: 4, typed: '9' })
  })

  it('HIGH: a refusal that lands after the move is said nowhere in the new scenario', async () => {
    answer = { status: 409, body: { error: CORE.editStale } }
    hold()
    const c = draw()
    openFigure(c, figure.id, '450')
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(posts().length).toBe(1))
    act(() => { useViewStore.setState({ sid: 's_ffffffffffff' }) })
    release()
    await waitFor(() => expect(sendingKeys()).toEqual([]))
    await new Promise((r) => setTimeout(r, 50))
    // Nowhere: not on a row (the receipt), not under a field, not as an editor left open for it.
    expect(useModelTab.getState().receipt).toBeNull()
    expect(c.querySelector('[data-model-editor-error], [data-model-failed]')).toBeNull()
    expect(useModelTab.getState().editing).toBeNull()
  })
})

describe('Remove link: what it came to, said where the person was', () => {
  it('HIGH: once the View shows the line gone, its detail closes and the Relationships group says core\'s version (labelled fixture)', async () => {
    const v = withFixture()
    const row = linkRowOf(v.model!, plainLink)
    const c = render(<ViewModelTabBlock />).container
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    openLink(c, row)
    fireEvent.click(c.querySelector(`[data-model-remove-link-open="${row}"]`)!)
    view = { ...v, model: { ...v.model!, links: v.model!.links.filter((_, i) => i !== plainLink) } } // core's View after the removal
    fireEvent.click(c.querySelector(`[data-model-remove-link-yes="${row}"]`)!)
    await waitFor(() => expect(c.querySelector(`[data-model-saved="${RELATIONSHIPS_ROW}"]`)?.textContent).toBe('Version 2 saved.'))
    expect(c.querySelector(`[data-model-link="${row}"]`)).toBeNull()
    expect(useModelTab.getState().open).toBeNull()
    expect(c.querySelector('[data-model-group="relationships"]')!.contains(c.querySelector(`[data-model-saved="${RELATIONSHIPS_ROW}"]`))).toBe(true)
  })

  it('catch: a row opened while core had the removal stays open (the removal closes only its own detail)', async () => {
    const v = withFixture()
    const row = linkRowOf(v.model!, plainLink)
    hold()
    const c = draw(v)
    openLink(c, row)
    fireEvent.click(c.querySelector(`[data-model-remove-link-open="${row}"]`)!)
    fireEvent.click(c.querySelector(`[data-model-remove-link-yes="${row}"]`)!)
    await waitFor(() => expect(posts().length).toBe(1))
    fireEvent.click(c.querySelector(`[data-model-select="${derived.id}"]`)!)
    release()
    await waitFor(() => expect(useModelTab.getState().busy).toBeNull())
    expect(useModelTab.getState().open).toBe(derived.id)
  })

  it('catch: a line removed above an open one never moves its detail onto the next line (rows by what they join)', () => {
    const k = wire.model!.links.length - 1
    const c = render(<ViewModelTabBlock />).container
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    const row = linkRowOf(wire.model!, k)
    openLink(c, row)
    // A teammate's version takes the first line away: every later line moves up one place in `links`.
    const fewer = { ...wire, model: { ...wire.model!, links: wire.model!.links.slice(1) } }
    act(() => { useViewStore.setState({ view: fewer }) })
    const open = [...c.querySelectorAll('[data-model-detail]')].map((d) => d.getAttribute('data-model-detail'))
    expect(open).toEqual([linkRowOf(fewer.model!, k - 1)])
    expect(linkRowOf(fewer.model!, k - 1)).toBe(row)
  })
})

describe('the minors of the audit', () => {
  it('catch: while core has one write, Save, Add and Remove each send nothing', async () => {
    const v = withFixture()
    const row = linkRowOf(v.model!, plainLink)
    hold()
    const c = draw(v)
    fireEvent.click(c.querySelector('[data-model-add-figure="open"]')!)
    typeIn(c, '[data-model-add-figure="name"]', 'Sales team')
    typeIn(c, '[data-model-add-figure="typed"]', '4 to 6')
    openLink(c, row)
    fireEvent.click(c.querySelector(`[data-model-remove-link-open="${row}"]`)!)
    openFigure(c, figure.id, '450')
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(posts().length).toBe(1))
    fireEvent.click(c.querySelector('[data-model-add-figure="add"]')!)
    fireEvent.click(c.querySelector(`[data-model-remove-link-yes="${row}"]`)!)
    await new Promise((r) => setTimeout(r, 50))
    expect(posts().map((p) => p.path)).toEqual([`/api/scenarios/${SID}/edit`])
    release()
    await waitFor(() => expect(useModelTab.getState().busy).toBeNull())
  })

  it('catch: in Plain a line\'s strength shows while its row is open, beside its detail\'s Change strength; closed, it does not (labelled fixture)', () => {
    const v = withFixture()
    const row = linkRowOf(v.model!, plainLink)
    const c = draw(v)
    expect(useModelTab.getState().expert).toBe(false)
    expect(c.querySelector(`[data-view="links.${plainLink}.effect.text"]`)).toBeNull()
    openLink(c, row)
    expect(c.querySelector(`[data-model-item="${row}"] [data-view="links.${plainLink}.effect.text"]`)?.textContent).toBe('1.5')
    expect(c.querySelector(`[data-model-detail="${row}"] [data-model-action="strength"]`)).not.toBeNull()
  })

  it('catch: once Olumi\'s change is set aside it no longer reads as waiting, even when the View read after it fails', async () => {
    view = heldView(wire)
    useViewStore.setState({ view })
    readFails = 1
    hold()
    const c = render(<ViewModelTabBlock />).container
    fireEvent.click(c.querySelector('[data-testid="view-model-held-aside"]')!)
    const confirm = c.querySelector('[data-testid="view-model-held-confirm"]') as HTMLButtonElement
    confirm.focus()
    fireEvent.click(confirm)
    // While core has it: the notice's own words, the pressed control inert but never disabled.
    await waitFor(() => expect(c.querySelector('[data-testid="view-model-held-sending"]')?.textContent).toBe(MODEL_EDIT_WORDS.settingAside))
    expect([confirm.disabled, confirm.getAttribute('aria-disabled')]).toEqual([false, 'true'])
    release()
    // The read failed: the tab draws no View (Codex review-ui 6) and says, in the canvas's words, that core set it aside.
    await waitFor(() => expect(c.querySelector('[data-testid="view-model-not-current-unshown"]')?.textContent).toBe(ASIDE_WORDS.notShown))
    const said = c.querySelector('[data-testid="view-model-not-current-unshown"]')!
    expect(said.getAttribute('role')).toBe('alert')
    await waitFor(() => expect(document.activeElement).toBe(said)) // focus that was on the pressed control goes to what it says
    expect(c.textContent).not.toContain(MODEL_EDIT_WORDS.heldLead)
    expect(c.querySelector('[data-testid="view-model-held"]')).toBeNull()
    expect(posts().map((p) => p.path)).toEqual(['/api/proposals/9/discard'])
    // CONTRAST: the next View that lands shows it gone, and the words go with it; nothing is sent again.
    view = wire
    await act(async () => { await useViewStore.getState().refresh() })
    await waitFor(() => expect(c.querySelector('[data-testid="view-model-not-current"]')).toBeNull())
    expect([useModelTab.getState().receipt, c.querySelector('[data-testid="view-model-held"]')]).toEqual([null, null])
    expect(posts().length).toBe(1)
  })

  it('catch: a person who moved on while core had the save keeps their focus where they put it', async () => {
    hold()
    const c = draw()
    openFigure(c, figure.id, '450')
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(posts().length).toBe(1))
    const filter = c.querySelector('[data-testid="view-model-filter"]') as HTMLInputElement
    filter.focus()
    release()
    await waitFor(() => expect(c.querySelector(`[data-model-editor="${figure.id}"]`)).toBeNull())
    await new Promise((r) => setTimeout(r, 20))
    expect(document.activeElement).toBe(filter)
    // CONTRAST: one who stayed gets focus back on the figure they changed.
    openFigure(c, figure.id, '460')
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(document.activeElement).toBe(c.querySelector(`[data-model-value-edit="${figure.id}"]`)))
  })
})

describe('the review of 9e40765e: what a write says when its form has gone, and presses while another write is with core', () => {
  it('HIGH: Add a figure refused after Factors was closed says core\'s words on the Factors group', async () => {
    answer = { status: 409, body: { error: CORE.stale('add') } }
    hold()
    const c = draw()
    fireEvent.click(c.querySelector('[data-model-add-figure="open"]')!)
    typeIn(c, '[data-model-add-figure="name"]', 'Sales team')
    typeIn(c, '[data-model-add-figure="typed"]', '4 to 6')
    fireEvent.click(c.querySelector('[data-model-add-figure="add"]')!)
    await waitFor(() => expect(posts().length).toBe(1))
    fireEvent.click(c.querySelector('[data-model-group-toggle="factors"]')!) // the form leaves the screen with its group
    release()
    await waitFor(() => expect(c.querySelector(`[data-model-failed="${FACTORS_ROW}"]`)?.textContent).toBe(CORE.stale('add')))
    const note = c.querySelector(`[data-model-failed="${FACTORS_ROW}"]`)!
    expect(note.getAttribute('role')).toBe('alert')
    expect(c.querySelector('[data-model-group="factors"]')!.contains(note)).toBe(true) // under its heading, the group still closed
  })

  it('HIGH: Remove link refused after Relationships was closed says core\'s words on the Relationships group (labelled fixture)', async () => {
    const v = withFixture()
    const row = linkRowOf(v.model!, plainLink)
    answer = { status: 409, body: { error: CORE.stale('remove') } }
    hold()
    const c = draw(v)
    openLink(c, row)
    fireEvent.click(c.querySelector(`[data-model-remove-link-open="${row}"]`)!)
    fireEvent.click(c.querySelector(`[data-model-remove-link-yes="${row}"]`)!)
    await waitFor(() => expect(posts().length).toBe(1))
    fireEvent.click(c.querySelector('[data-model-group-toggle="relationships"]')!)
    release()
    await waitFor(() => expect(c.querySelector(`[data-model-failed="${RELATIONSHIPS_ROW}"]`)?.textContent).toBe(CORE.stale('remove')))
  })

  it('catch: while another write is with core, an open editor\'s Set figure and Try, and Add, are inert (aria-disabled, never disabled) and send nothing', async () => {
    answer = { status: 201, body: { version: 2, n: 2, receipt: 'r', record: 'q_new' } }
    hold()
    const c = draw()
    openFigure(c, figure.id, '450')
    fireEvent.click(c.querySelector('[data-model-add-figure="open"]')!)
    typeIn(c, '[data-model-add-figure="name"]', 'Sales team')
    typeIn(c, '[data-model-add-figure="typed"]', '4 to 6')
    fireEvent.click(c.querySelector('[data-model-add-figure="add"]')!)
    await waitFor(() => expect(posts().length).toBe(1))
    const save = c.querySelector(`[data-model-editor-save="${figure.id}"]`) as HTMLButtonElement
    const tryIt = c.querySelector(`[data-model-editor-try="${figure.id}"]`) as HTMLButtonElement
    expect([save.disabled, save.getAttribute('aria-disabled'), tryIt.disabled, tryIt.getAttribute('aria-disabled')]).toEqual([false, 'true', false, 'true'])
    fireEvent.click(save)
    fireEvent.click(tryIt)
    await new Promise((r) => setTimeout(r, 30))
    expect(posts().map((p) => p.path)).toEqual([`/api/scenarios/${SID}/figures`])
    release()
    await waitFor(() => expect(useModelTab.getState().busy).toBeNull())
    expect(save.getAttribute('aria-disabled')).toBeNull() // CONTRAST: once it settles, Save is live again
  })

  it('catch: Try without saving never disables itself while core works out the what-if (house rule: the pressed control stays focusable)', async () => {
    answer = { status: 200, body: { variants: [] } }
    hold()
    const c = draw()
    openFigure(c, figure.id, '450')
    const tryIt = c.querySelector(`[data-model-editor-try="${figure.id}"]`) as HTMLButtonElement
    tryIt.focus()
    fireEvent.click(tryIt)
    await waitFor(() => expect(posts().map((p) => p.path)).toEqual([`/api/scenarios/${SID}/whatif`]))
    expect([tryIt.disabled, tryIt.getAttribute('aria-disabled'), document.activeElement === tryIt]).toEqual([false, 'true', true])
    expect(c.querySelector(`[data-model-editor-trying="${figure.id}"]`)?.textContent).toBe(MODEL_EDIT_WORDS.trying) // words, not a fade
    release()
    await waitFor(() => expect(tryIt.getAttribute('aria-disabled')).toBeNull())
    expect(c.querySelector(`[data-model-editor-trying="${figure.id}"]`)).toBeNull()
  })
})

describe('the UI audit of 3f7817bd', () => {
  const classes = (root: Element) => [root, ...root.querySelectorAll('*')].map((e) => e.getAttribute('class') ?? '')
  /** A dimming class: any opacity below full, on any state (disabled:, read-only:, aria-…), but not the ✎ cue's own show-on-hover (0 / 100). */
  const dims = (root: Element) => classes(root).filter((k) => /(^|\s)([a-z-]+:)*opacity-(?!0(\s|$)|100(\s|$))\d+/.test(k))
  /** Olumi's blue in any form a class paints it: its text, a fill or a border, in any state; `primary` is that blue by token (brand.css). */
  const blue = (root: Element) => [root, ...root.querySelectorAll('*')].filter((e) => /(^|\s)([a-z-]+:)*(text-info|bg-info|bg-primary|border-info|border-primary|text-primary)(\/\d+)?(\s|$)/.test(e.getAttribute('class') ?? ''))

  it('catch: the person\'s own controls are grey; only Olumi\'s hand-offs are blue', () => {
    useGuidanceStore.setState({ _prefillChat: () => undefined })
    try {
      const v = withFixture()
      const row = linkRowOf(v.model!, plainLink)
      const c = draw(v)
      openFigure(c, figure.id, '450') // Set figure, Try without saving, Cancel
      fireEvent.click(c.querySelector('[data-model-add-figure="open"]')!) // Add, Cancel
      fireEvent.click(c.querySelector(`[data-model-select="${derived.id}"]`)!) // Change figure, Rename, Show on canvas; Ask Olumi to change this
      const pressed = (sel: string) => c.querySelector(sel)!
      const own = ['[data-model-editor-save]', '[data-model-editor-try]', '[data-model-editor-cancel]', '[data-model-add-figure="add"]', '[data-model-add-figure="cancel"]',
        '[data-model-expert-arm="plain"]', '[data-model-expert-arm="expert"]', `[data-model-detail="${derived.id}"] [data-model-action="rename"]`, `[data-model-detail="${derived.id}"] [data-model-action="canvas"]`]
      for (const sel of own) expect(blue(pressed(sel)), sel).toEqual([])
      openLink(c, row)
      fireEvent.click(c.querySelector(`[data-model-remove-link-open="${row}"]`)!) // Remove, Keep
      for (const sel of [`[data-model-remove-link-yes="${row}"]`, `[data-model-remove-link-keep="${row}"]`, `[data-model-detail="${row}"] [data-model-action="strength"]`]) expect(blue(pressed(sel)), sel).toEqual([])
      // Blue is Olumi's only: every blue element is an Ask Olumi hand-off, and every hand-off is blue.
      const asks = [...c.querySelectorAll('[data-model-ask]')]
      expect(asks.length).toBeGreaterThan(2)
      expect(blue(c)).toEqual(asks)
      for (const a of asks) expect(a.className).toMatch(/(^|\s)text-info(\s|$)/)
    } finally { useGuidanceStore.setState({ _prefillChat: null }) }
  })

  it('catch: the held notice\'s own controls are grey too (Set it aside, Set aside, Keep it)', () => {
    view = heldView(wire)
    useViewStore.setState({ view })
    const c = draw(view)
    expect(c.querySelector('[data-testid="view-model-held-aside"]')!.className).not.toMatch(/text-info/)
    fireEvent.click(c.querySelector('[data-testid="view-model-held-aside"]')!)
    expect(blue(c.querySelector('[data-testid="view-model-held"]')!)).toEqual([])
  })

  it('catch: nothing dims: a control that cannot act keeps its full weight and a line says why (saving; another change saving; saved, not shown)', async () => {
    answer = { status: 201, body: { version: 2, n: 2, receipt: 'r', record: 'q_new' } }
    hold()
    const c = render(<ViewModelTabBlock />).container
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    openFigure(c, figure.id, '450')
    fireEvent.click(c.querySelector('[data-model-add-figure="open"]')!)
    typeIn(c, '[data-model-add-figure="name"]', 'Sales team')
    typeIn(c, '[data-model-add-figure="typed"]', '4 to 6')
    fireEvent.click(c.querySelector('[data-model-add-figure="add"]')!)
    await waitFor(() => expect(posts().length).toBe(1))
    expect(c.querySelector('[data-model-add-figure="sending"]')?.textContent).toBe(MODEL_EDIT_WORDS.saving)
    expect(c.querySelector(`[data-model-editor-waiting="${figure.id}"]`)?.textContent).toBe(MODEL_EDIT_WORDS.savingOther)
    expect(dims(c)).toEqual([])
    release()
    await waitFor(() => expect(useModelTab.getState().busy).toBeNull())
    expect(c.querySelector(`[data-model-editor-waiting="${figure.id}"]`)).toBeNull() // CONTRAST: settled, the line goes
    readFails = 1
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(c.querySelector('[data-testid="view-model-not-current-unshown"]')?.textContent).toBe(MODEL_EDIT_WORDS.savedNotShown))
    expect(dims(c)).toEqual([])
  })

  it('catch: a what-if that lands after the page moved scenario raises no Results tab there; on the same scenario it does', async () => {
    answer = { status: 200, body: { variants: [] } }
    const was = useUIStore.getState().forceActivateOutputTab
    const raise = vi.fn()
    useUIStore.setState({ forceActivateOutputTab: raise } as never)
    try {
      hold()
      let c = draw()
      openFigure(c, figure.id, '450')
      fireEvent.click(c.querySelector(`[data-model-editor-try="${figure.id}"]`)!)
      await waitFor(() => expect(posts().map((p) => p.path)).toEqual([`/api/scenarios/${SID}/whatif`]))
      act(() => { useViewStore.setState({ sid: 's_ffffffffffff' }) })
      release()
      await new Promise((r) => setTimeout(r, 50))
      expect(raise).not.toHaveBeenCalled()
      cleanup(); resetModelTab(); gate = null
      act(() => { useViewStore.setState({ sid: SID }) })
      c = draw()
      openFigure(c, figure.id, '450')
      fireEvent.click(c.querySelector(`[data-model-editor-try="${figure.id}"]`)!)
      await waitFor(() => expect(raise).toHaveBeenCalledWith('results'))
    } finally { useUIStore.setState({ forceActivateOutputTab: was } as never) }
  })
})

// Rename, Add a figure and Remove link each get the figure editor's three rows (UI audit of 3f7817bd): saved but not shown; a read a newer
// one overtook; the page moved scenario while core had the write.
type Flow = {
  name: string
  answer?: unknown
  start: (c: HTMLElement) => void
  press: string
  error: string
  /** The control that closes once its write is saved, what of it the tab then holds (nothing), and where core's version is then said. */
  control: string
  closed: () => unknown
  unseen: string
  done: (c: HTMLElement) => void
}
const removeRow = () => linkRowOf(view.model!, plainLink)
const FLOWS: Flow[] = [
  {
    name: 'Rename',
    start: (c) => {
      fireEvent.click(c.querySelector(`[data-model-select="${figure.id}"]`)!)
      fireEvent.click(c.querySelector(`[data-model-detail="${figure.id}"] [data-model-action="rename"]`)!)
      typeIn(c, `[data-model-renamer-input="${figure.id}"]`, 'Customers today')
    },
    press: `[data-model-renamer-save="${figure.id}"]`,
    error: `[data-model-renamer-error="${figure.id}"]`,
    control: `[data-model-renamer="${figure.id}"]`,
    closed: () => useModelTab.getState().editing,
    unseen: figure.id,
    done: (c) => {
      expect(c.querySelector(`[data-model-renamer="${figure.id}"]`)).toBeNull()
      expect(c.querySelector(`[data-model-saved="${figure.id}"]`)?.textContent).toBe('Version 2 saved.')
    },
  },
  {
    name: 'Add a figure',
    answer: { version: 2, n: 2, receipt: 'r', record: 'q_new' },
    start: (c) => {
      fireEvent.click(c.querySelector('[data-model-add-figure="open"]')!)
      typeIn(c, '[data-model-add-figure="name"]', 'Sales team')
      typeIn(c, '[data-model-add-figure="typed"]', '4 to 6')
    },
    press: '[data-model-add-figure="add"]',
    error: '[data-model-add-figure="error"]',
    control: '[data-model-add-figure="form"]',
    closed: () => useModelTab.getState().adding,
    unseen: FACTORS_ROW,
    done: (c) => {
      expect(c.querySelector('[data-model-add-figure="form"]')).toBeNull()
      expect(useModelTab.getState().receipt).toEqual({ row: 'q_new', words: 'Version 2 saved.', tone: 'saved' }) // on the new card's row
    },
  },
  {
    name: 'Remove link',
    start: (c) => {
      openLink(c, removeRow())
      fireEvent.click(c.querySelector(`[data-model-remove-link-open="${removeRow()}"]`)!)
    },
    press: '[data-model-remove-link-yes]',
    error: '[data-model-remove-link-error]',
    control: '[data-model-remove-link-yes]',
    closed: () => useModelTab.getState().open, // the link's detail: the link is gone
    unseen: RELATIONSHIPS_ROW,
    done: (c) => {
      expect(useModelTab.getState().open).toBeNull()
      expect(c.querySelector(`[data-model-saved="${RELATIONSHIPS_ROW}"]`)?.textContent).toBe('Version 2 saved.')
    },
  },
]

describe.each(FLOWS)('$name, as the figure editor (UI audit of 3f7817bd)', (f) => {
  const ready = () => {
    if (f.answer !== undefined) answer = { status: 201, body: f.answer }
    withFixture() // the removable line; the other flows do not touch it
    const c = render(<ViewModelTabBlock />).container // the surface the dock mounts: the View's validity gate on
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    f.start(c)
    return c
  }

  it('HIGH: saved but not shown: it closes (nothing of it to send again) and the tab says so; a later View says core\'s version on its row or group', async () => {
    readFails = 1
    const c = ready()
    fireEvent.click(c.querySelector(f.press)!)
    await waitFor(() => expect(c.querySelector('[data-testid="view-model-not-current-unshown"]')?.textContent).toBe(MODEL_EDIT_WORDS.savedNotShown))
    expect(document.activeElement).toBe(c.querySelector('[data-testid="view-model-not-current-unshown"]')) // focus had nowhere else to be
    expect(c.querySelector('[data-view]')).toBeNull() // none of the View it kept
    expect([f.closed(), useModelTab.getState().busy]).toEqual([null, null])
    view = { ...view, model: { ...view.model!, edit_base: 2 } } // core's View once the write is in it (the next base is its version)
    await act(async () => { await useViewStore.getState().refresh() })
    await waitFor(() => expect(c.querySelector(`[data-model-saved="${f.unseen}"]`)?.textContent).toBe('Version 2 saved.'))
    expect([c.querySelector(f.control), c.querySelector('[data-testid="view-model-not-current"]')]).toEqual([null, null])
    expect(posts().length).toBe(1)
  })

  it('HIGH: a read a newer one overtook is not a failed one: it waits for the newer read, then says core\'s version', async () => {
    const releaseOurs = holdReads()
    const c = ready()
    fireEvent.click(c.querySelector(f.press)!)
    await waitFor(() => expect(viewReads().length).toBe(1))
    const releaseNewer = holdReads()
    void useViewStore.getState().refresh()
    await waitFor(() => expect(viewReads().length).toBe(2))
    releaseOurs()
    await new Promise((r) => setTimeout(r, 200))
    expect(c.querySelector(f.error)).toBeNull()
    expect(useModelTab.getState().busy).not.toBeNull() // still with core's read, not settled as failed
    releaseNewer()
    await waitFor(() => expect(useModelTab.getState().busy).toBeNull())
    f.done(c)
  })

  it('HIGH: the page moved scenario while core had it: no notice, no View read, no receipt, nothing said', async () => {
    hold()
    const c = ready()
    fireEvent.click(c.querySelector(f.press)!)
    await waitFor(() => expect(posts().length).toBe(1))
    act(() => { useViewStore.setState({ sid: 's_ffffffffffff' }) })
    release()
    await waitFor(() => expect(sendingKeys()).toEqual([]))
    await new Promise((r) => setTimeout(r, 50))
    expect(useModelNotice.getState().notice).toBeNull()
    expect(viewReads()).toEqual([])
    expect(useModelTab.getState().receipt).toBeNull()
    expect(c.querySelector(`${f.error}, [data-model-failed], [data-model-saved]`)).toBeNull()
  })
})

describe('the review of 2f060f5a: an unseen save keeps its words and settles once a read shows it', () => {
  it('HIGH: a figure saved unseen: the tab says so, and again when the person leaves the Model tab and comes back (the words live with the tab)', async () => {
    readFails = 1
    let c = render(<ViewModelTabBlock />).container
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    openFigure(c, figure.id, '450')
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(c.querySelector('[data-testid="view-model-not-current-unshown"]')?.textContent).toBe(MODEL_EDIT_WORDS.savedNotShown))
    cleanup()
    c = render(<ViewModelTabBlock />).container
    expect(c.querySelector('[data-testid="view-model-not-current-unshown"]')?.textContent).toBe(MODEL_EDIT_WORDS.savedNotShown)
  })

  it('HIGH: saved but not shown while the tab drew nothing: the failed read and the save are said, nothing of the stale View; a later read settles it', async () => {
    readFails = 1
    const c = render(<ViewModelTabBlock />).container
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    openFigure(c, figure.id, '450')
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(c.querySelector('[data-testid="view-model-not-current-unshown"]')?.textContent).toBe(MODEL_EDIT_WORDS.savedNotShown))
    const why = c.querySelector('[data-testid="view-model-not-current-why"]')!
    expect([why.textContent, why.getAttribute('role')]).toEqual(['down', 'alert']) // the failed read, in its own words
    expect(c.querySelector('[data-view], [data-model-editor]')).toBeNull()
    expect(useModelTab.getState().editing).toBeNull() // it was saved: its editor closed, nothing to send again
    expect(useModelTab.getState().busy).toBeNull()
    view = withFigure(wire, figure.id, '450')
    await act(async () => { await useViewStore.getState().refresh() })
    await waitFor(() => expect(c.querySelector(`[data-model-saved="${figure.id}"]`)?.textContent).toBe('Version 2 saved.'))
    expect(c.querySelector(`[data-view="${figure.id}.figure.text"]`)?.textContent).toBe('450')
    expect(c.querySelector(`[data-model-editor="${figure.id}"]`)).toBeNull() // the next View draws no editor for it
    expect(posts().length).toBe(1) // and nothing more is sent
  })

  it('HIGH: Add a figure saved but not shown while the tab drew nothing: said; a later read settles it on Factors as core\'s version', async () => {
    answer = { status: 201, body: { version: 2, n: 2, receipt: 'r', record: 'q_new' } }
    readFails = 1
    const c = render(<ViewModelTabBlock />).container
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    fireEvent.click(c.querySelector('[data-model-add-figure="open"]')!)
    typeIn(c, '[data-model-add-figure="name"]', 'Sales team')
    typeIn(c, '[data-model-add-figure="typed"]', '4 to 6')
    fireEvent.click(c.querySelector('[data-model-add-figure="add"]')!)
    await waitFor(() => expect(c.querySelector('[data-testid="view-model-not-current-unshown"]')?.textContent).toBe(MODEL_EDIT_WORDS.savedNotShown))
    view = { ...wire, model: { ...wire.model!, cards: [...wire.model!.cards, { ...figure, id: 'q_new', heading: 'Sales team' }] } } // core's View with the card
    await act(async () => { await useViewStore.getState().refresh() })
    await waitFor(() => expect(c.querySelector(`[data-model-saved="${FACTORS_ROW}"]`)?.textContent).toBe('Version 2 saved.'))
    expect(c.querySelector('[data-model-add-figure="form"]')).toBeNull()
    expect(c.querySelector('[data-model-row="q_new"]')).not.toBeNull()
  })

  it('catch: a link\'s strength editor whose offer core withdrew leaves a line on the link\'s row, not silence (labelled fixture)', () => {
    const v = withFixture()
    const row = linkRowOf(v.model!, plainLink)
    const c = render(<ViewModelTabBlock />).container
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    openLink(c, row)
    fireEvent.click(c.querySelector(`[data-model-detail="${row}"] [data-model-action="strength"]`)!)
    typeIn(c, `[data-model-editor-input="${row}"]`, '2')
    act(() => { useViewStore.setState({ view: heldView(v) }) })
    expect(c.querySelector(`[data-model-editor="${row}"]`)).toBeNull()
    expect(c.querySelector(`[data-model-item="${row}"] [data-model-editor-kept="${row}"] [role="status"]`)?.textContent).toBe(MODEL_EDIT_WORDS.withdrawnHeld)
    fireEvent.click(c.querySelector(`[data-model-editor-drop="${row}"]`)!)
    expect(useModelTab.getState().editing).toBeNull() // Cancel drops the typing
  })
})

describe('Codex review-ui blockers 3 and 6 (N2)', () => {
  it('HIGH (3): forgetting the person leaves nothing of theirs in the Model tab store: no typing, no unseen write\'s View, no receipt, nothing open', () => {
    const typed = 'my private figure 4,321', named = 'my private card'
    useModelTab.setState({ sid: SID, open: figure.id, busy: `${SID}:edit:${figure.id}`,
      receipt: { row: figure.id, words: MODEL_EDIT_WORDS.savedNotShown, tone: 'failed', unseen: { n: 2, view: wire } },
      editing: { row: figure.id, what: 'figure', quantity: figure.id, sid: SID, base: 1, typed },
      adding: { sid: SID, base: 1, label: named, typed: '7', unit: '' } })
    useWhatIf.setState({ shown: { sid: SID, base: 1, quantity: figure.id, typed, variant: {} as never } }) // tried without saving
    forgetThisPerson()
    const s = useModelTab.getState()
    expect([s.sid, s.open, s.editing, s.adding, s.busy, s.receipt]).toEqual([null, null, null, null, null, null])
    expect(JSON.stringify(s)).not.toMatch(/my private|you_id|european/i)
    expect(useWhatIf.getState().shown).toBeNull()
  })

  it('DL 7 Nov: forgetting the person drops the requests they typed into unconfirmed writes, and their saved notice; a lock stays', () => {
    const typed = JSON.stringify({ text: 'my private view 4,321' })
    useWrites.setState({ attempts: { [`${SID}:evidence`]: { op: 'op-1', request: typed } }, locked: { [`${SID}:view`]: true }, sending: {} })
    useModelNotice.setState({ notice: { kind: 'saved', n: 2, by: 'Priya', sid: SID } })
    forgetThisPerson()
    expect(useWrites.getState().attempts).toEqual({})
    expect(JSON.stringify(useWrites.getState())).not.toMatch(/my private/)
    expect(useWrites.getState().locked).toEqual({ [`${SID}:view`]: true }) // it may have saved: a reload still says
    expect(useModelNotice.getState().notice).toBeNull()
  })

  const block = () => {
    const c = render(<ViewModelTabBlock />).container
    fireEvent.click(c.querySelector('[data-testid="view-model-toggle-all"]')!)
    return c
  }

  it('HIGH (6): a stale View: none of its words are drawn and nothing offers an edit; the draft is kept and comes back with the next valid View', () => {
    const c = block()
    openFigure(c, figure.id, '450')
    expect(c.querySelectorAll('[data-view]').length).toBeGreaterThan(20) // CONTRAST: a valid View is drawn
    act(() => { useViewStore.setState({ stale: true }) })
    expect(c.querySelectorAll('[data-view]').length).toBe(0)
    expect(c.querySelector('[data-model-editor], [data-model-value-edit], [data-model-add-figure], [data-model-select]')).toBeNull()
    expect(c.querySelector('[data-testid="view-model-not-current-why"]')?.textContent).toBe(MODEL_EDIT_WORDS.reading)
    expect(modelEditNow().base).toBeNull() // the edit gate offers no base either
    expect(useModelTab.getState().editing?.typed).toBe('450')
    act(() => { useViewStore.setState({ stale: false }) })
    expect((c.querySelector(`[data-model-editor-input="${figure.id}"]`) as HTMLInputElement).value).toBe('450')
    expect(modelEditNow().base).toBe(1)
  })

  it('HIGH (6): Add a figure\'s typing is a draft too: kept while a stale View draws no form, and back in the form with the next valid View', () => {
    const c = block()
    fireEvent.click(c.querySelector('[data-model-add-figure="open"]')!)
    typeIn(c, '[data-model-add-figure="name"]', 'Sales team')
    typeIn(c, '[data-model-add-figure="typed"]', '4 to 6')
    act(() => { useViewStore.setState({ stale: true }) })
    expect(c.querySelector('[data-model-add-figure]')).toBeNull()
    act(() => { useViewStore.setState({ stale: false }) })
    const value = (k: string) => (c.querySelector(`[data-model-add-figure="${k}"]`) as HTMLInputElement | null)?.value
    expect([value('name'), value('typed'), value('unit')]).toEqual(['Sales team', '4 to 6', ''])
  })

  it('catch: an editor drawn again once the View is valid takes focus back only from nowhere, never from where the person put it', () => {
    const c = block()
    openFigure(c, figure.id, '450')
    const input = () => c.querySelector(`[data-model-editor-input="${figure.id}"]`)
    expect(document.activeElement).toBe(input()) // opened from its row: the field takes focus
    const chat = document.body.appendChild(document.createElement('input')) // the chat's composer, say
    try {
      chat.focus()
      act(() => { useViewStore.setState({ stale: true }) })
      act(() => { useViewStore.setState({ stale: false }) })
      expect([document.activeElement === chat, (input() as HTMLInputElement).value]).toEqual([true, '450'])
      // CONTRAST: focus that had nowhere to go (it was in the field the tab stopped drawing) comes back to it.
      chat.blur()
      act(() => { useViewStore.setState({ stale: true }) })
      act(() => { useViewStore.setState({ stale: false }) })
      expect(document.activeElement).toBe(input())
    } finally { chat.remove() }
  })

  it('catch: what a write came to never takes focus from where the person put it', async () => {
    readFails = 1
    hold()
    const c = block()
    openFigure(c, figure.id, '450')
    fireEvent.click(c.querySelector(`[data-model-editor-save="${figure.id}"]`)!)
    await waitFor(() => expect(posts().length).toBe(1))
    const chat = document.body.appendChild(document.createElement('input'))
    try {
      chat.focus()
      release()
      await waitFor(() => expect(c.querySelector('[data-testid="view-model-not-current-unshown"]')?.textContent).toBe(MODEL_EDIT_WORDS.savedNotShown))
      expect(document.activeElement).toBe(chat)
    } finally { chat.remove() }
  })

  it('HIGH: setting Olumi\'s change aside is one write of the tab\'s: drawn again while core has it, the notice says so and sends nothing more', async () => {
    view = heldView(wire)
    useViewStore.setState({ view })
    hold()
    const c = block()
    fireEvent.click(c.querySelector('[data-testid="view-model-held-aside"]')!)
    fireEvent.click(c.querySelector('[data-testid="view-model-held-confirm"]')!)
    await waitFor(() => expect(posts().length).toBe(1))
    act(() => { useViewStore.setState({ stale: true }) }) // a change elsewhere (the chat): the tab draws no View for a while
    act(() => { useViewStore.setState({ stale: false }) })
    expect(c.querySelector('[data-testid="view-model-held-sending"]')?.textContent).toBe(MODEL_EDIT_WORDS.settingAside)
    fireEvent.click(c.querySelector('[data-testid="view-model-held-aside"]')!)
    expect(c.querySelector('[data-testid="view-model-held-confirm"]')).toBeNull() // inert while core has it
    release()
    await waitFor(() => expect(useModelTab.getState().busy).toBeNull())
    expect(posts().map((p) => p.path)).toEqual(['/api/proposals/9/discard'])
  })

  it('catch: a set-aside core refuses while the tab draws no View is said there, and on the notice once it is drawn again', async () => {
    view = heldView(wire)
    useViewStore.setState({ view })
    answer = { status: 409, body: { error: 'Olumi\'s change was already decided.' } }
    hold()
    const c = block()
    fireEvent.click(c.querySelector('[data-testid="view-model-held-aside"]')!)
    fireEvent.click(c.querySelector('[data-testid="view-model-held-confirm"]')!)
    await waitFor(() => expect(posts().length).toBe(1))
    act(() => { useViewStore.setState({ stale: true }) })
    release()
    await waitFor(() => expect(c.querySelector('[data-testid="view-model-not-current-unshown"]')?.textContent).toBe('Olumi\'s change was already decided.'))
    act(() => { useViewStore.setState({ stale: false }) })
    expect(c.querySelector('[data-testid="view-model-held-error"]')?.textContent).toBe('Olumi\'s change was already decided.')
  })

  it('catch: a set-aside refusal is said only on the change it was about; once the View no longer holds that change, it goes', async () => {
    view = heldView(wire)
    useViewStore.setState({ view })
    answer = { status: 409, body: { error: 'Olumi\'s change was already decided.' } }
    hold()
    const c = block()
    fireEvent.click(c.querySelector('[data-testid="view-model-held-aside"]')!)
    fireEvent.click(c.querySelector('[data-testid="view-model-held-confirm"]')!)
    await waitFor(() => expect(posts().length).toBe(1))
    act(() => { useViewStore.setState({ stale: true }) })
    release()
    await waitFor(() => expect(c.querySelector('[data-testid="view-model-not-current-unshown"]')?.textContent).toBe('Olumi\'s change was already decided.'))
    act(() => { useViewStore.setState({ stale: false, view: wire }) }) // decided elsewhere meanwhile: nothing held now
    expect(useModelTab.getState().receipt).toBeNull()
    const next = heldView(wire)
    act(() => { useViewStore.setState({ view: { ...next, proposal: { ...next.proposal!, id: 10 } } }) }) // Olumi holds another change
    expect(c.querySelector('[data-testid="view-model-held"]')).not.toBeNull()
    expect(c.querySelector('[data-testid="view-model-held-error"]')).toBeNull()
  })

  it('HIGH (3): a Try without saving that lands after the person is forgotten leaves nothing of it', async () => {
    answer = { status: 200, body: { scenario: SID, version: { id: 1, n: 1 }, hypothetical: true, saved: false,
      variants: [{ hypothetical: true, edits: [], blocked: null, stopped: null, moved: false, why_not: null, rows: [], most_likely: null }] } }
    hold()
    const c = block()
    openFigure(c, figure.id, '4,321')
    fireEvent.click(c.querySelector(`[data-model-editor-try="${figure.id}"]`)!)
    await waitFor(() => expect(posts().map((p) => p.path)).toEqual([`/api/scenarios/${SID}/whatif`]))
    forgetThisPerson()
    release()
    await new Promise((r) => setTimeout(r, 30))
    expect(useWhatIf.getState().shown).toBeNull()
    // CONTRAST: on the scenario still on screen, the what-if is kept (drawn over the chances).
    cleanup(); resetModelTab(); gate = null
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view, status: 'ready', error: null, stale: false, at: null })
    useMe.setState({ me: { id: wire.you_id, name: wire.you }, status: 'ready' })
    const d = block()
    openFigure(d, figure.id, '4,321')
    fireEvent.click(d.querySelector(`[data-model-editor-try="${figure.id}"]`)!)
    await waitFor(() => expect(useWhatIf.getState().shown?.typed).toBe('4,321'))
  })

  it('HIGH (6): a failed read: none of the View it kept is drawn, nothing offers an edit, and the failure is said in the read\'s words', () => {
    const c = block()
    openFigure(c, figure.id, '450')
    act(() => { useViewStore.setState({ error: 'Olumi could not read this scenario just now.' }) })
    expect(c.querySelectorAll('[data-view]').length).toBe(0)
    expect(c.querySelector('[data-model-editor], [data-model-value-edit], [data-model-select]')).toBeNull()
    const why = c.querySelector('[data-testid="view-model-not-current-why"]')!
    expect([why.textContent, why.getAttribute('role')]).toEqual(['Olumi could not read this scenario just now.', 'alert'])
    expect(modelEditNow().base).toBeNull()
    expect(useModelTab.getState().editing?.typed).toBe('450')
  })
})
