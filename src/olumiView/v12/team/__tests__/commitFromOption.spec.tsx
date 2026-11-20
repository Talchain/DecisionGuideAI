/** A commitment starts from its option ("Commit to this" in the option's details) and marks that option on the canvas; the mark opens its record. */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ToastProvider } from '../../../../canvas/ToastContext'
import { LaneEditingLayer } from '../../edit/LaneEditingLayer'
import { useLaneInspector } from '../../edit/inspectorStore'
import { useViewStore } from '../../../store'
import { resetDrafts, draftOf } from '../../../../olumiCore/team/drafts'
import { CommitFormFoot } from '../CommitForm'
import { CommittedMark } from '../CommittedMark'
import { SID, approved, install, uninstall, type Stub } from '../../edit/__tests__/harness'
import type { View } from '../../../client'

let stub: Stub
beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '1'); stub = install() })
afterEach(() => { cleanup(); uninstall(); resetDrafts(); vi.unstubAllEnvs(); useLaneInspector.setState({ current: null, peek: null }) })

const OPT = 'single_country_test', OTHER = 'broader_entry'
const stored = (option: { id: string; heading: string } | null, over: Record<string, unknown> = {}) => ({
  id: 7, at: '2026-11-18', by: 'Paul', by_id: 'p_1', action: 'Open one market first', owner: 'Paul', owner_id: 'p_1', expect: 'Sign-ups by March', reconsider: 'Below 50',
  keeps: [], outcomes: [], option, version: 1, expect_band: null, review_on: null, trigger: null, ...over,
})
const withCommitments = (list: unknown[]): View => { const v = approved(); return { ...v, collab: { ...v.collab, commitments: list } } as unknown as View }

describe('Commit to this', () => {
  it('on an option opens the form bound to that option, and keeping it posts the option id and the approved version', async () => {
    useLaneInspector.getState().open({ kind: 'card', id: OPT })
    render(<ToastProvider><LaneEditingLayer /><CommitFormFoot /></ToastProvider>)
    fireEvent.click(await screen.findByTestId('lane-inspector-commit'))
    expect(await screen.findByTestId('commit-form-option')).toHaveAttribute('data-option', OPT)
    fireEvent.change(screen.getByTestId('commit-form-action'), { target: { value: 'Open one market first' } })
    fireEvent.change(screen.getByTestId('commit-form-expect'), { target: { value: 'Sign-ups by March' } })
    fireEvent.change(screen.getByTestId('commit-form-reconsider'), { target: { value: 'Below 50' } })
    stub.answer.body = { commitment: 7 }
    fireEvent.click(screen.getByTestId('commit-form-keep'))
    await waitFor(() => expect(stub.posts().some((c) => c.path.endsWith('/commitments'))).toBe(true))
    const body = stub.posts().find((c) => c.path.endsWith('/commitments'))!.body as Record<string, unknown>
    expect(body.option).toBe(OPT)
    expect(body.version).toBe(1)
  })
  it('an option set aside after "Commit to this" is never written unseen: the form names no option and the POST carries option null', async () => {
    useLaneInspector.getState().open({ kind: 'card', id: OPT })
    render(<ToastProvider><LaneEditingLayer /><CommitFormFoot /></ToastProvider>)
    fireEvent.click(await screen.findByTestId('lane-inspector-commit'))
    await screen.findByTestId('commit-form-option')
    const v = useViewStore.getState().view!
    useViewStore.setState({ view: { ...v, model: { ...v.model!, cards: v.model!.cards.map((c) => (c.id === OPT ? { ...c, status: 'set_aside' } : c)) } } as View })
    await waitFor(() => expect(screen.queryByTestId('commit-form-option')).toBeNull())
    fireEvent.change(screen.getByTestId('commit-form-action'), { target: { value: 'Open one market first' } })
    fireEvent.change(screen.getByTestId('commit-form-expect'), { target: { value: 'Sign-ups by March' } })
    fireEvent.change(screen.getByTestId('commit-form-reconsider'), { target: { value: 'Below 50' } })
    stub.answer.body = { commitment: 8 }
    fireEvent.click(screen.getByTestId('commit-form-keep'))
    await waitFor(() => expect(stub.posts().some((c) => c.path.endsWith('/commitments'))).toBe(true))
    expect((stub.posts().find((c) => c.path.endsWith('/commitments'))!.body as Record<string, unknown>).option ?? null).toBeNull() // api.ts sends no key for no option
  })
  it('surfaces step A: it is the FIRST control of the box\'s one action row and the row\'s only filled (green) one; a preview of the same option has no such control', async () => {
    useLaneInspector.getState().open({ kind: 'card', id: OPT })
    render(<ToastProvider><LaneEditingLayer /><CommitFormFoot /></ToastProvider>)
    const commit = await screen.findByTestId('lane-inspector-commit')
    const controls = [...screen.getByTestId('lane-inspector-actions').querySelectorAll('button')]
    expect(controls[0]).toBe(commit)
    expect(controls.filter((b) => /(^|\s)bg-success(\s|$)/.test(b.className))).toEqual([commit])
    cleanup(); useLaneInspector.setState({ current: null, peek: { kind: 'card', id: OPT } })
    render(<ToastProvider><LaneEditingLayer /><CommitFormFoot /></ToastProvider>)
    expect(await screen.findByTestId('lane-peek')).toHaveAttribute('data-box-card', OPT)
    expect(screen.queryByTestId('lane-inspector-commit')).toBeNull()
  })
  it('surfaces step A: an option the team committed to says so in its box, previewed and pinned, by the commitment\'s id and saved words; CONTRAST another option\'s box does not', async () => {
    useViewStore.setState({ view: withCommitments([stored({ id: OPT, heading: 'Test one country before broader commitment' })]) })
    for (const state of [{ current: null, peek: { kind: 'card' as const, id: OPT } }, null]) {
      if (state === null) useLaneInspector.getState().open({ kind: 'card', id: OPT }); else useLaneInspector.setState(state)
      render(<ToastProvider><LaneEditingLayer /></ToastProvider>)
      const line = await screen.findByTestId('lane-inspector-committed')
      expect(line).toHaveAttribute('data-commitment', '7')
      expect(line.textContent).toBe('Committed · 2026-11-18 · Open one market first')
      // Its place in the box: after the header, before the actions (the agreed order).
      const after = (a: string, b: string) => (screen.getByTestId(a).compareDocumentPosition(screen.getByTestId(b)) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      expect(after('lane-inspector-kind', 'lane-inspector-committed')).toBe(true)
      if (state === null) expect(after('lane-inspector-committed', 'lane-inspector-actions')).toBe(true)
      cleanup(); useLaneInspector.setState({ current: null, peek: null })
    }
    for (const state of [{ current: null, peek: { kind: 'card' as const, id: OTHER } }, null]) {
      if (state === null) useLaneInspector.getState().open({ kind: 'card', id: OTHER }); else useLaneInspector.setState(state)
      render(<ToastProvider><LaneEditingLayer /></ToastProvider>)
      expect((await screen.findByTestId('lane-inspector-title')).closest('[data-box-card]')).toHaveAttribute('data-box-card', OTHER)
      expect(screen.queryByTestId('lane-inspector-committed'), 'CONTRAST: another option, previewed or pinned').toBeNull()
      cleanup(); useLaneInspector.setState({ current: null, peek: null })
    }
  })
  it('CONTRAST: a factor card offers no "Commit to this"', async () => {
    const factor = approved().model!.cards.find((c) => c.family !== 'option' && c.family !== 'risk')!
    useLaneInspector.getState().open({ kind: 'card', id: factor.id })
    render(<ToastProvider><LaneEditingLayer /></ToastProvider>)
    await screen.findByTestId('lane-inspector-title')
    expect(screen.queryByTestId('lane-inspector-commit')).toBeNull()
  })
})

describe('the committed mark', () => {
  const both = () => render(<><CommittedMark card={OPT} /><CommittedMark card={OTHER} /></>)
  it('is on the option a stored commitment names, by its id, with core\'s date and the saved words; another option has none', () => {
    useViewStore.setState({ view: withCommitments([stored({ id: OPT, heading: 'Test one country before broader commitment' })]) })
    both()
    const mark = document.querySelector(`[data-committed-mark="${OPT}"]`)!
    expect(mark).not.toBeNull()
    expect(mark.getAttribute('aria-label')).toBe('Committed · 2026-11-18\nOpen one market first')
    expect(document.querySelector(`[data-committed-mark="${OTHER}"]`)).toBeNull()
  })
  it('pressing it opens that commitment\'s record ("What happened") through the existing opener', () => {
    useViewStore.setState({ view: withCommitments([stored({ id: OPT, heading: 'x' })]) })
    both()
    expect(draftOf<{ open: boolean }>(`${SID}:outcome:7`)?.open).toBeFalsy()
    fireEvent.click(document.querySelector(`[data-committed-mark="${OPT}"]`)!)
    expect(draftOf<{ open: boolean }>(`${SID}:outcome:7`)?.open).toBe(true)
  })
  it('a commitment that names no option marks no card', () => {
    useViewStore.setState({ view: withCommitments([stored(null)]) })
    both()
    expect(document.querySelector('[data-committed-mark]')).toBeNull()
  })
})
