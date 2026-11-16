/**
 * V12 team and commitment: the Funding-Commit form (board words, existing write), the Sprint-MyView private view (visible fields, shared
 * model options as marked suggestions, always-shown note, Olumi asks card), the driver differ mark and Sprint-Differ group 3 empty state.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../../../client'
import { setPagePerson, setTeamFetch } from '../../../../olumiCore/team/api'
import { resetWrites } from '../../../../olumiCore/team/writes'
import { differencesShape, resetDifferences, type Differences } from '../../../../olumiCore/team/differences'
import { resetDrafts } from '../../../../olumiCore/team/drafts'
import { CommitForm, COMMIT_WORDS } from '../CommitForm'
import { DriverDifferMark } from '../DriverDifferMark'
import { FrameEntry } from '../../views/FrameEntry'
import { emptyConsequence, groupDifferences, NOTHING_CALCULATED } from '../../views/differGroups'
import { WhereWeDiffer } from '../../views/WhereWeDiffer'

const core = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/debate/differences.core.json'), 'utf8'))
const fx: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5/effects.view3.json'), 'utf8'))
const limits = { question: 300, aim: 300, option: 120, options: 5, link_words: 200, links: 5 }
const view = (over: Partial<View> = {}, collab: Record<string, unknown> = {}): View =>
  ({ ...fx, gated: false, you_id: '1', ...over, collab: { ...fx.collab, frame_words: { limits }, ...collab } } as View)

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

describe('Record what you will do', () => {
  it('draws the board\'s words, the Proposed tag and the footnote', () => {
    render(<CommitForm sid="s_x" view={view()} onWrote={async () => true} />)
    expect(screen.getByTestId('commit-form-heading').textContent).toBe('Record what you will do')
    expect(screen.getByTestId('commit-form-proposed').textContent).toBe('Proposed')
    for (const t of ['What will you do?', 'What do you expect to happen?', 'When would you reconsider?']) expect(screen.getByLabelText(t)).toBeTruthy()
    expect(screen.getByTestId('commit-form-keep').textContent).toBe('Keep it')
    expect(screen.getByTestId('commit-form-footnote').textContent).toBe('You can compare what happened with what you expected later.')
    expect(COMMIT_WORDS.keep).toBe('Keep it')
  })
  it('holds Keep it until all three are answered, then posts them to the existing commitments route as typed', async () => {
    const sent = serve(() => ({ status: 201, body: { commitment: 3 } }))
    let wrote = 0
    render(<CommitForm sid="s_x" view={view()} onWrote={async () => { wrote++; return true }} />)
    const keep = screen.getByTestId('commit-form-keep') as HTMLButtonElement
    expect(keep.disabled).toBe(true)
    fireEvent.change(screen.getByTestId('commit-form-action'), { target: { value: 'Ring the funder' } })
    fireEvent.change(screen.getByTestId('commit-form-expect'), { target: { value: 'A yes by May' } })
    expect(keep.disabled).toBe(true)
    fireEvent.change(screen.getByTestId('commit-form-reconsider'), { target: { value: 'If it slips past June' } })
    expect(keep.disabled).toBe(false)
    fireEvent.click(keep)
    await waitFor(() => expect(wrote).toBe(1))
    const post = sent.filter((s) => s.method === 'POST')
    expect(post.length).toBe(1)
    expect(post[0]!.url).toMatch(/\/commitments$/)
    expect(post[0]!.body).toMatchObject({ action: 'Ring the funder', owner: '1', expect: 'A yes by May', reconsider: 'If it slips past June', version: 1 })
    expect((screen.getByTestId('commit-form-action') as HTMLTextAreaElement).value).toBe('')
  })
  it('is not offered before a model version is approved', () => {
    render(<CommitForm sid="s_x" view={view({ version: null })} onWrote={async () => true} />)
    expect(screen.queryByTestId('commit-form')).toBeNull()
  })
})

describe('Your view, private until revealed', () => {
  const withOptions = view({}, { private_view_prompt: 'What do you know that others may not?' })
  it('shows its fields open, with the note always, and the shared model\'s options as marked suggestions', () => {
    render(<FrameEntry sid="s_x" view={withOptions} onWrote={async () => true} defaultOpen />)
    expect(screen.getByTestId('frame-heading').textContent).toBe('Your view, private until revealed')
    expect(screen.getByTestId('frame-question').tagName).toBe('TEXTAREA')
    expect(screen.getByTestId('frame-aim').tagName).toBe('TEXTAREA')
    expect(screen.getByTestId('frame-private-note').textContent).toBe('Private until everyone has added theirs, then revealed together.')
    const titles = withOptions.model!.cards.filter((c) => c.family === 'option' && c.status === null).map((c) => c.heading)
    expect(titles.length).toBeGreaterThan(0)
    titles.forEach((t, i) => {
      expect((screen.getByTestId(`frame-option-${i}`) as HTMLInputElement).value).toBe(t)
      expect(screen.getByTestId(`frame-option-${i}-from-model`).textContent).toBe('From the shared model')
    })
  })
  it('drops the mark once a suggestion is reworded, and sends the person\'s own words', async () => {
    const sent = serve(() => ({ status: 201, body: { contribution: 4 } }))
    render(<FrameEntry sid="s_x" view={withOptions} onWrote={async () => true} defaultOpen />)
    fireEvent.change(screen.getByTestId('frame-option-0'), { target: { value: 'My own option' } })
    expect(screen.queryByTestId('frame-option-0-from-model')).toBeNull()
    fireEvent.change(screen.getByTestId('frame-text'), { target: { value: 'My view' } })
    fireEvent.click(screen.getByTestId('frame-give'))
    await waitFor(() => expect(sent.some((s) => s.method === 'POST')).toBe(true))
    const body = sent.find((s) => s.method === 'POST')!.body as { frame: { options: string[] } }
    expect(body.frame.options[0]).toBe('My own option')
  })
  it('suggestions alone are not a whole view: Give waits for a part the person wrote', () => {
    render(<FrameEntry sid="s_x" view={withOptions} onWrote={async () => true} defaultOpen />)
    fireEvent.change(screen.getByTestId('frame-text'), { target: { value: 'My view' } })
    expect((screen.getByTestId('frame-give') as HTMLButtonElement).disabled).toBe(true)
  })
  it('has a separate Olumi asks card with its own private input, joined to the view\'s words on give', async () => {
    const sent = serve(() => ({ status: 201, body: { contribution: 4 } }))
    render(<FrameEntry sid="s_x" view={withOptions} onWrote={async () => true} defaultOpen />)
    expect(screen.getByTestId('frame-olumi-asks-label').textContent).toBe('Olumi asks')
    expect(screen.getByTestId('frame-olumi-asks-prompt').textContent).toBe('What do you know that others may not?')
    expect(screen.getByTestId('frame-olumi-ask-private').textContent).toBe('Only you see this until the reveal')
    fireEvent.change(screen.getByTestId('frame-olumi-ask'), { target: { value: 'The lease ends in June' } })
    fireEvent.change(screen.getByTestId('frame-question'), { target: { value: 'Is it the lease?' } })
    fireEvent.change(screen.getByTestId('frame-text'), { target: { value: 'My view' } })
    fireEvent.click(screen.getByTestId('frame-give'))
    await waitFor(() => expect(sent.some((s) => s.method === 'POST')).toBe(true))
    expect((sent.find((s) => s.method === 'POST')!.body as { text: string }).text).toBe('My view\n\nThe lease ends in June')
  })
  it('draws no Olumi asks card when core sends no prompt', () => {
    render(<FrameEntry sid="s_x" view={view()} onWrote={async () => true} defaultOpen />)
    expect(screen.queryByTestId('frame-olumi-asks')).toBeNull()
  })
  it('opens by default in Where we differ before a reveal and a first view, and stays a link otherwise', () => {
    serve(() => ({ status: 200, body: core }))
    const gated = view({ gated: true }, { shared: [], mine: [] })
    render(<WhereWeDiffer sid="s_x" view={gated} onWrote={async () => true} />)
    expect(screen.getByTestId('frame-entry')).toBeTruthy()
  })
})

describe('the driver differ mark', () => {
  it('draws two person marks and the evidence glyph only when evidence is what differs', () => {
    const { container, rerender } = render(<DriverDifferMark people={[{ id: '1' }, { id: '2' }, { id: '3' }]} evidence />)
    expect(container.querySelectorAll('[data-differ-person]').length).toBe(2)
    expect(container.querySelector('[data-differ-evidence]')).not.toBeNull()
    rerender(<DriverDifferMark people={[{ id: '1' }, { id: '2' }]} evidence={false} />)
    expect(container.querySelector('[data-differ-evidence]')).toBeNull()
    rerender(<DriverDifferMark people={[{ id: '1' }]} evidence />)
    expect(container.querySelector('[data-testid="driver-differ-mark"]')).toBeNull()
  })
})

describe('Calculated consequences, empty', () => {
  const base = core.differences[0]
  const link = { ...base, kind: 'link', record: 'link:a:b', cards: ['a', 'b'], status: 'pending', options: [], steps: [] }
  const calc = { ...base, status: 'changes', steps: [] }
  const shape = (rows: unknown[]) => differencesShape({ ...core, differences: rows }) as Differences
  it('is given for differences with none calculated, and never when one is, nor when there are no differences', () => {
    const g = emptyConsequence(shape([link]))
    expect(g?.id).toBe('consequence')
    expect(g?.rows).toEqual([])
    expect(emptyConsequence(shape([link, calc]))).toBeNull()
    expect(emptyConsequence(shape([]))).toBeNull()
    expect(groupDifferences(shape([link])).map((x) => x.id)).toEqual(['reasoning']) // the grouping itself is unchanged
  })
  it('draws the group 3 heading and "Nothing here is calculated yet." after a revealed comparison with none calculated', async () => {
    serve(() => ({ status: 200, body: { ...core, differences: [link] } }))
    render(<WhereWeDiffer sid="s_x" view={view()} onWrote={async () => true} />)
    await waitFor(() => expect(screen.getByTestId('differ-group-consequence-empty').textContent).toBe(NOTHING_CALCULATED))
    expect(screen.getByTestId('differ-group-consequence-heading').textContent).toBeTruthy()
  })
})
