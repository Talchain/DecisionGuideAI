/**
 * V12 manual editing: each hand edit reaches ITS core route with the right body, on the version the form opened on; core's refusal is shown in
 * its own words; nothing is sent when core takes no edit (a proposal held, an earlier version).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { submitEdit, writeKeyOf } from '../EditForm'
import { laneWrites, viewUndoOf } from '../editRoutes'
import { editGateNow } from '../editGate'
import { useViewStore } from '../../../store'
import { TeamApiError } from '../../../../olumiCore/team/api'
import { BASE, RISK_EDIT, LINK_SIZE, SID, approved, install, uninstall, type Stub } from './harness'

let stub: Stub
beforeEach(() => { stub = install() })
afterEach(uninstall)
const open = { sid: SID, base: BASE } as const
const base = `/api/scenarios/${SID}`

describe('each hand edit reaches its own core route', () => {
  it('rename posts /rename with the card and the new name, on the opened base', async () => {
    await submitEdit({ ...open, kind: 'rename', record: 'broader_entry', current: 'x' }, { label: '  Go wide ' })
    expect(stub.posts()).toHaveLength(1)
    expect(stub.posts()[0]!.path).toBe(`${base}/rename`)
    expect(stub.posts()[0]!.body).toMatchObject({ base: BASE, record: 'broader_entry', label: 'Go wide' })
  })
  it('add a factor posts /figures with its name, figure and no unit when none', async () => {
    const r = await submitEdit({ ...open, kind: 'figure-add' }, { label: 'Weekly churn', typed: '10 to 30', unit: '' })
    expect(stub.posts()[0]!.path).toBe(`${base}/figures`)
    expect(stub.posts()[0]!.body).toMatchObject({ base: BASE, label: 'Weekly churn', typed: '10 to 30' })
    expect(stub.posts()[0]!.body).not.toHaveProperty('unit')
    expect(r.record).toBe('new_card')
  })
  it.each([['choice', 'Add a pilot'], ['claim', 'Churn is seasonal'], ['question', 'Who owns hiring?']] as const)('add %s posts /strategy/items with its kind and words and no concerns when none', async (item, text) => {
    await submitEdit({ ...open, kind: 'item', item, concerns: [], about: null, pickFigure: null }, { text })
    expect(stub.posts()[0]!.path).toBe(`${base}/strategy/items`)
    expect(stub.posts()[0]!.body).toMatchObject({ base: BASE, kind: item, text })
    expect(stub.posts()[0]!.body).not.toHaveProperty('concerns')
  })
  it('a risk from a figure names that figure in concerns; from the empty canvas it names the one picked', async () => {
    await submitEdit({ ...open, kind: 'item', item: 'risk', concerns: ['customers'], about: 'Customer base', pickFigure: null }, { text: 'Key client leaves' })
    expect(stub.posts()[0]!.body).toMatchObject({ kind: 'risk', text: 'Key client leaves', concerns: ['customers'] })
    await submitEdit({ ...open, kind: 'item', item: 'risk', concerns: [], about: null, pickFigure: [{ id: 'starting_customers', heading: 'x' }] }, { text: 'Supply gap', concern: 'starting_customers' })
    expect(stub.posts()[1]!.body).toMatchObject({ kind: 'risk', concerns: ['starting_customers'] })
  })
  it('a link strength posts /size with the line\'s record and what was typed (not /edit)', async () => {
    await submitEdit({ ...open, kind: 'size', edit: LINK_SIZE.edit, subject: 'Speed' }, { typed: ' -4 to -1 ' })
    expect(stub.posts()[0]!.path).toBe(`${base}/size`)
    expect(stub.posts()[0]!.body).toMatchObject({ base: BASE, record: 'i_speed', typed: '-4 to -1' })
    expect(stub.calls.some((c) => c.path.endsWith('/edit'))).toBe(false)
  })
  it('a risk\'s size posts /size with only the fields filled (chance alone, then both)', async () => {
    await submitEdit({ ...open, kind: 'size', edit: RISK_EDIT, subject: 'Slow ramp' }, { chance: '1 in 5', change: '' })
    expect(stub.posts()[0]!.path).toBe(`${base}/size`)
    expect(stub.posts()[0]!.body).toMatchObject({ base: BASE, record: 'slow_ramp', chance: '1 in 5' })
    expect(stub.posts()[0]!.body).not.toHaveProperty('change')
    await submitEdit({ ...open, kind: 'size', edit: RISK_EDIT, subject: 'Slow ramp' }, { chance: '20%', change: '-50' })
    expect(stub.posts()[1]!.body).toMatchObject({ chance: '20%', change: '-50' })
  })
  it('a plain figure change posts /edit; taking a link off posts /links/remove with the View\'s own handle', async () => {
    await submitEdit({ ...open, kind: 'figure-edit', record: 'starting_customers', edit: { prompt: 'p', ask: 'a' } }, { typed: '1200' })
    expect(stub.posts()[0]!.path).toBe(`${base}/edit`)
    expect(stub.posts()[0]!.body).toMatchObject({ base: BASE, quantity: 'starting_customers', typed: '1200' })
    await submitEdit({ ...open, kind: 'remove-link', remove: { record: 'i_speed', part: null } }, {})
    expect(stub.posts()[1]!.path).toBe(`${base}/links/remove`)
    expect(stub.posts()[1]!.body).toMatchObject({ base: BASE, record: 'i_speed', part: null })
  })
  it('the write keys are the existing editors\' own, so one write is one write wherever it is pressed', () => {
    expect(writeKeyOf({ ...open, kind: 'figure-add' })).toBe(`${SID}:add-figure`)
    expect(writeKeyOf({ ...open, kind: 'rename', record: 'a', current: '' })).toBe(`${SID}:rename:a`)
    expect(writeKeyOf({ ...open, kind: 'figure-edit', record: 'a', edit: { prompt: '', ask: '' } })).toBe(`${SID}:edit:a`)
  })
})

describe('core\'s refusals are shown in its own words, and nothing reads as saved', () => {
  it('a 400 from /size is thrown as core\'s sentence', async () => {
    stub.answer = { status: 400, body: { error: 'A chance is between 0% and 100%.' } }
    await expect(submitEdit({ ...open, kind: 'size', edit: RISK_EDIT, subject: 's' }, { chance: '150%' })).rejects.toMatchObject({ message: 'A chance is between 0% and 100%.' })
  })
  it('a risk with no figure is core\'s refusal, as it says it', async () => {
    stub.answer = { status: 400, body: { error: 'A risk needs a figure it would move: name one in concerns.' } }
    await expect(submitEdit({ ...open, kind: 'item', item: 'risk', concerns: [], about: null, pickFigure: [] }, { text: 'x' })).rejects.toBeInstanceOf(TeamApiError)
  })
  it('a question held on a figure\'s range saved NO version: it is never reported as saved', async () => {
    stub.answer = { status: 200, body: { record: 'customers', held: 'range' } }
    await expect(submitEdit({ ...open, kind: 'item', item: 'question', concerns: [], about: null, pickFigure: null }, { text: 'Is it 10?' })).rejects.toMatchObject({ message: 'Nothing was added to the model.' })
  })
})

describe('no edit is sent when core takes none', () => {
  it('while Olumi\'s change is held (edit_base null) the gate says core\'s words and nothing is posted', async () => {
    const v = approved()
    useViewStore.setState({ view: { ...v, proposal: { id: 4, base: 1, heading: 'A change', on: 'x' }, model: { ...v.model!, edit_base: null }, model_words: { ...(v.model_words ?? {}), withdrawnHeld: 'Set aside the pending change first.' } } as never })
    const g = editGateNow()
    expect(g).toEqual({ ok: false, why: 'Set aside the pending change first.', held: true })
    await expect(submitEdit({ ...open, kind: 'rename', record: 'a', current: '' }, { label: 'x' })).rejects.toMatchObject({ message: 'Set aside the pending change first.' })
    expect(stub.posts()).toHaveLength(0)
  })
  it('on an earlier version nothing is posted', async () => {
    useViewStore.setState({ at: 1 })
    await expect(submitEdit({ ...open, kind: 'figure-add' }, { label: 'a', typed: '1' })).rejects.toBeInstanceOf(TeamApiError)
    expect(stub.posts()).toHaveLength(0)
  })
  it('a form opened on another scenario is refused', async () => {
    await expect(submitEdit({ sid: 's_ffffffffffff', base: BASE, kind: 'figure-add' }, { label: 'a', typed: '1' })).rejects.toBeInstanceOf(TeamApiError)
    expect(stub.posts()).toHaveLength(0)
  })
})

describe('the undo route and the View\'s offer', () => {
  it('posts exactly {base, undoes, op} to /undo', async () => {
    await laneWrites.undo(SID, { base: 4, undoes: 4, op: 'op-1' })
    expect(stub.posts().map((p) => [p.path, p.body])).toEqual([[`${base}/undo`, { base: 4, undoes: 4, op: 'op-1' }]])
  })
  it('there is no redo route in this slice', () => {
    expect((laneWrites as Record<string, unknown>)['redo']).toBeUndefined()
  })
  it('model.undo is read defensively: absent, malformed or without available is no offer', () => {
    const withUndo = (u: unknown) => ({ ...approved(), model: { ...approved().model!, undo: u } }) as never
    expect(viewUndoOf(approved())).toBeNull()
    expect(viewUndoOf(withUndo('x'))).toBeNull()
    expect(viewUndoOf(withUndo({ label: 'l' }))).toBeNull()
    expect(viewUndoOf(withUndo({ available: false, version: null, n: null, label: null, why_not: 'Someone else has changed the model.' }))).toEqual({ available: false, version: null, n: null, label: null, why_not: 'Someone else has changed the model.' })
    expect(viewUndoOf(withUndo({ available: true, version: 7, n: 3, label: 'Undo: rename', why_not: null }))).toEqual({ available: true, version: 7, n: 3, label: 'Undo: rename', why_not: null })
  })
})
