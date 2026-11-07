/**
 * THE MODEL TAB AS THE PLACE TO CHANGE THE MODEL BY HAND (Paul 7 Nov). Saved writes are HIGH tier: each row pins the exact request core
 * gets (route, body, the base the editor opened on), that the editor closes only once the View read after the save lands, and that a
 * refusal is core's own words with the person's typing kept. The gate is the canvas editors' own (own page, latest version, `edit_base`).
 * Plain | Expert is a content switch, the person's preference kept under the dock's key. Fixture: the R5 european View from the wire
 * (fixtures/real/european-22cards.view3.json, edit_base 1), bound by card id.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { setTeamFetch } from '../../olumiCore/team/api'
import { resetWrites } from '../../olumiCore/team/writes'
import { useMe } from '../../olumiCore/me'
import { ViewModelTab } from '../ViewModelTab'
import { resetModelTab, useModelTab } from '../model/state'

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
beforeEach(() => {
  view = wire
  gate = null
  calls = []
  answer = { status: 201, body: { version: 2, n: 2, receipt: 'r' } }
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ method, path: String(u), body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (method === 'GET' && String(u) === '/api/me') return new Response(JSON.stringify({ me: { id: wire.you_id, name: wire.you } }), { status: 200 })
    if (method === 'GET') return new Response(JSON.stringify(view), { status: 200 })
    if (gate !== null) await gate
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view, status: 'ready', error: null, stale: false, at: null })
  useMe.setState({ me: { id: wire.you_id, name: wire.you }, status: 'ready' })
})
afterEach(() => {
  cleanup(); setTeamFetch(null); resetWrites()
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
    fireEvent.click(c.querySelector(`[data-model-select="links.${k}"]`)!)
    fireEvent.click(c.querySelector(`[data-model-detail="links.${k}"] [data-model-action="strength"]`)!)
    expect(c.querySelector(`[data-view-edit-prompt="${figure.id}"]`)?.textContent).toBe(figure.figure!.edit!.prompt)
    fireEvent.change(c.querySelector(`[data-model-editor-input="links.${k}"]`)!, { target: { value: '2' } })
    fireEvent.click(c.querySelector(`[data-model-editor-save="links.${k}"]`)!)
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
    fireEvent.click(c.querySelector(`[data-model-select="links.${k}"]`)!)
    fireEvent.click(c.querySelector(`[data-model-remove-link-open="links.${k}"]`)!)
    expect(posts()).toEqual([]) // asked first
    fireEvent.click(c.querySelector(`[data-model-remove-link-yes="links.${k}"]`)!)
    await waitFor(() => expect(posts().map((p) => p.path)).toEqual([`/api/scenarios/${SID}/links/remove`]))
    const body = posts()[0]!.body as Record<string, unknown>
    expect([body['base'], body['record'], body['part'], typeof body['op']]).toEqual([1, 'rel_x', 'part_y', 'string'])
    // CONTRAST: the detail of a line core does not mark is open, and offers no removal.
    const other = wire.model!.links.findIndex((_, i) => i !== k)
    fireEvent.click(c.querySelector(`[data-model-select="links.${other}"]`)!)
    expect(c.querySelector(`[data-model-detail="links.${other}"]`)).not.toBeNull()
    expect(c.querySelector(`[data-model-remove-link-open="links.${other}"]`)).toBeNull()
  })
})
