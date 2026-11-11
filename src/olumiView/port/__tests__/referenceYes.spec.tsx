/**
 * The "Yes, use existing trends" button on a no-change reference wait row (DL 11 Nov; contract: olumi-core 00c7b6f3, `waits_on.items[].reference`).
 * The row's words are core's, the answer is the person's. Bound by IDENTITY: the item's id and the option's id differ, so a write keyed on
 * the wrong one fails. The write route is a placeholder until INT-6, so the write is a spy here; what is asserted is what the page sends.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { View } from '../../client'
import { writes } from '../../client'
import { REFERENCE_YES } from '../../ReferenceYes'
import { useModelNotice } from '../../notice'
import { useViewStore } from '../../store'
import { useMe } from '../../../olumiCore/me'
import { resetWrites } from '../../../olumiCore/team/writes'
import { TeamApiError } from '../../../olumiCore/team/api'
import { PortAnalysisTab } from '../PortAnalysisTab'
import { viewOf } from './viewAt'

// Core's sentence for the question (olumi-core src/shared/option-reference.ts), as the View would carry it: used only to build the row.
const QUESTION = 'For this comparison, should ‘Evening classes’ use the existing trends, with no extra change from this option?'
const withReference = (view: View, editBase: number | null = view.model!.edit_base): View => {
  const run = view.model!.run!, w = run.waits_on!
  const item = { id: 'ref_row_1', text: QUESTION, title: QUESTION, answer: true, unknown: null, edit: null, reference: { option: 'evening_classes' } }
  return { ...view, model: { ...view.model!, edit_base: editBase, run: { ...run, waits_on: { ...w, items: [...w.items, item] } } } } as View
}
const ready = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  render(<PortAnalysisTab />)
}
const row = (id: string) => document.querySelector<HTMLElement>(`[data-testid="focus-card"][data-row-id="${id}"]`)!
const open = (id: string) => fireEvent.click(within(row(id)).getAllByRole('button')[0]!)
const yes = () => screen.queryByTestId('act-reference-yes-evening_classes')

beforeEach(() => { resetWrites(); useModelNotice.setState({ notice: null }) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

describe('a no-change reference wait row', () => {
  it('RY1: the button is on the reference row only, the pen is not, and the question is core\'s string; a numeric wait row is unchanged', () => {
    const view = withReference(viewOf('golden/studio'))
    ready(view)
    const items = view.model!.run!.waits_on!.items
    expect(items.filter((it) => it.reference !== undefined)).toHaveLength(1)
    for (const it of items) { open(`wait:${it.id}`); expect(row(`wait:${it.id}`)).toHaveTextContent(it.text); open(`wait:${it.id}`) }
    open('wait:ref_row_1')
    // The reference row: core's question verbatim, the button, no pen (edit null, and nothing offers a figure here).
    const ref = row('wait:ref_row_1')
    expect(ref).toHaveTextContent(items[items.length - 1]!.text)
    expect(ref).toHaveTextContent(QUESTION)
    expect(within(ref).getByRole('button', { name: REFERENCE_YES })).toBe(yes())
    expect(screen.queryByTestId('act-edit-ref_row_1')).toBeNull()
    expect(within(ref).queryByText('✎')).toBeNull()
    // CONTRAST: the numeric rows keep their pen where core allows a typed figure, and never the button.
    for (const it of items.filter((x) => x.reference === undefined)) {
      open(`wait:${it.id}`)
      expect(within(row(`wait:${it.id}`)).queryByRole('button', { name: REFERENCE_YES })).toBeNull()
      expect(screen.queryByTestId(`act-edit-${it.id}`) !== null, it.id).toBe(it.edit !== null)
    }
  })

  it('RY2: with no reference on any row there is no button anywhere (the numeric rows alone)', () => {
    ready(viewOf('golden/studio'))
    expect(screen.queryByRole('button', { name: REFERENCE_YES })).toBeNull()
  })

  it('RY3: the press sends the base, the option\'s id (not the row\'s) and one op; it is disabled while sending; the View is read again and the version is said', async () => {
    const view = withReference(viewOf('golden/studio'))
    let release!: () => void
    const send = vi.spyOn(writes, 'confirmReference').mockImplementation(() => new Promise((res) => { release = () => res({ version: 5, n: 5, receipt: 'r' }) }))
    const modelChanged = vi.fn(async () => true)
    ready(view)
    useViewStore.setState({ modelChanged } as never)
    open('wait:ref_row_1')
    fireEvent.click(yes()!)
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    expect(send.mock.calls[0]!.slice(0, 3)).toEqual([view.id, view.model!.edit_base, 'evening_classes'])
    expect(typeof send.mock.calls[0]![3]).toBe('string')
    await waitFor(() => expect(yes()).toBeDisabled())
    fireEvent.click(yes()!)
    expect(send).toHaveBeenCalledTimes(1)
    release()
    await waitFor(() => expect(modelChanged).toHaveBeenCalledTimes(1))
    expect(useModelNotice.getState().notice).toMatchObject({ kind: 'saved', n: 5, by: null, sid: view.id })
  })

  it('RY4: a refused write says core\'s words, reads the row again, and can be sent again', async () => {
    const view = withReference(viewOf('golden/studio'))
    const send = vi.spyOn(writes, 'confirmReference').mockRejectedValueOnce(new TeamApiError(409, 'The model changed since you opened this.')).mockResolvedValueOnce({ version: 6, n: 6, receipt: 'r' })
    const refresh = vi.fn(async () => true), modelChanged = vi.fn(async () => true)
    ready(view)
    useViewStore.setState({ refresh, modelChanged } as never)
    open('wait:ref_row_1')
    fireEvent.click(yes()!)
    expect(await screen.findByTestId('act-reference-error-evening_classes')).toHaveTextContent('The model changed since you opened this.')
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(yes()).not.toBeDisabled()
    fireEvent.click(yes()!)
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(modelChanged).toHaveBeenCalledTimes(1))
  })

  it('RY5: while a proposal is held (no edit base) nothing is offered to write, so there is no button', () => {
    ready(withReference(viewOf('golden/studio'), null))
    open('wait:ref_row_1')
    expect(yes()).toBeNull()
    expect(row('wait:ref_row_1')).toHaveTextContent(QUESTION)
  })
})
