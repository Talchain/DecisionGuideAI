/**
 * THE LANE'S SUMMARY IS CORE'S (core API v1.16, DL 7 Nov): the top bar's Summary opens core's Summary of the saved version on screen and
 * draws its blocks word for word, with core's two exports. Asserted from core's own Summary output (golden/*.summary.json, written by
 * olumi-core's summaryOf from its View goldens), never from words written here.
 * Replaces viewBrief.spec: the top bar no longer mounts the View-fed side panel (ViewBrief.tsx), whose body the other specs still bind.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } } }))
import european from '../golden/european.view.json'
import proposal from '../golden/proposal.view.json'
import bakerySummary from '../golden/bakery.summary.json'
import studioSummary from '../golden/studio.summary.json'
import europeanSummary from '../golden/european.summary.json'
import type { View } from '../client'
import { setTeamFetch } from '../../olumiCore/team/api'
import { NOT_FOR_THIS_PAGE, useMe } from '../../olumiCore/me'
import { TopBar } from '../../components/layout/TopBar'
import { ToastProvider } from '../../canvas/ToastContext'
import { useCanvasStore } from '../../canvas/store'
import { useViewStore } from '../store'
import { readSummary, summaryPath, SUMMARY_SHAPE_CHANGED, SUMMARY_VERSION_NOT_SERVED, type Summary } from '../summary'
import { SummaryDocument, SUMMARY_DOWNLOAD_LABEL, SUMMARY_PRINT_LABEL } from '../ViewSummary'

const SID = 's_0123456789ab'
afterEach(() => { cleanup(); vi.unstubAllEnvs(); setTeamFetch(null); useMe.setState({ me: null, status: 'none' }); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null }) })

/** What a block says: its parts' words with each mark's glyph after them, as core's Markdown says it. */
const said = (b: Summary['blocks'][number]) => b.parts.map((p) => `${p.text}${p.mark ? ` ${p.mark.glyph}` : ''}`).join('')
const GOLDEN = { bakery: bakerySummary, studio: studioSummary, european: europeanSummary } as unknown as Record<string, Summary>

describe('the Summary document draws core\'s blocks exactly', () => {
  for (const [n, s] of Object.entries(GOLDEN)) {
    it(`${n}: every block is drawn once, in core's order, as its own tag, its text exactly the block's words`, () => {
      const { container } = render(<SummaryDocument summary={s} />)
      const drawn = [...container.querySelectorAll<HTMLElement>('[data-summary-block]')]
      expect(drawn.map((el) => Number(el.dataset['summaryBlock']))).toEqual(s.blocks.map((_, i) => i))
      drawn.forEach((el, i) => {
        const b = s.blocks[i]!
        expect(el.textContent, `block ${i}`).toBe(said(b))
        expect(el.tagName.toLowerCase()).toBe(b.tag === 'meta' ? 'p' : b.tag)
        // A mark carries its hover; a link its address; bold is bold, by the part's own fields.
        b.parts.forEach((p) => { if (p.mark) expect(within(el).getAllByLabelText(p.mark.title).length).toBeGreaterThan(0) })
        expect([...el.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(b.parts.flatMap((p) => (p.href === null ? [] : [p.href])))
      })
      // Every list item sits in a list.
      for (const li of container.querySelectorAll('li')) expect(li.parentElement?.tagName).toBe('UL')
    })
  }
  it('a mutant that swaps two blocks\' words is caught by identity', () => {
    const s = GOLDEN['bakery']!, swapped = { ...s, blocks: [s.blocks[1]!, s.blocks[0]!, ...s.blocks.slice(2)] }
    const el = render(<SummaryDocument summary={swapped} />).container.querySelector('[data-summary-block="0"]')!
    expect(el.textContent).not.toBe(said(s.blocks[0]!))
  })
  it('the golden is core\'s: the chance it states for an option is the number in its facts', () => {
    const s = bakerySummary as unknown as { options: { id: string; rows: { kind: string; value?: string; chance?: number }[] }[]; blocks: Summary['blocks'] }
    const oven = s.options.find((o) => o.id === 'second_oven')!.rows.find((r) => r.kind === 'chance')!
    expect(oven.chance).toBe(0.7162)
    expect(s.blocks.some((b) => said(b).includes(oven.value!))).toBe(true)
  })
})

describe('core\'s route, read and exported', () => {
  it('paths: the latest saved version, or one by number; md and html by format', () => {
    expect(summaryPath(SID)).toBe(`/api/scenarios/${SID}/summary`)
    expect(summaryPath(SID, 2, 'md')).toBe(`/api/scenarios/${SID}/summary?at=2&format=md`)
    expect(summaryPath(SID, null, 'html')).toBe(`/api/scenarios/${SID}/summary?format=html`)
  })
  it('a Summary in another shape, or of another version, is said, never drawn', async () => {
    setTeamFetch((async () => new Response(JSON.stringify({ ...bakerySummary, schema: 'olumi.summary/0' }), { status: 200 })) as unknown as typeof fetch)
    await expect(readSummary(SID)).rejects.toThrow(SUMMARY_SHAPE_CHANGED)
    setTeamFetch((async () => new Response(JSON.stringify(bakerySummary), { status: 200 })) as unknown as typeof fetch)
    await expect(readSummary(SID, 2)).rejects.toThrow(SUMMARY_VERSION_NOT_SERVED)
  })
})

const bar = (view: View, at: number | null = null) => {
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view, error: null, status: 'ready', stale: false, at })
  useCanvasStore.setState({ currentScenarioId: '00000000-0000-4000-8000-0123456789ab' })
  render(<MemoryRouter><ToastProvider><TopBar scenarioTitle="T" onTitleChange={vi.fn()} onSave={vi.fn()} onShare={vi.fn()} /></ToastProvider></MemoryRouter>)
}

/** Core as the browser holds it: the Summary, and `/api/me` naming whoever's private link the browser holds now. */
const coreAs = (holder: string) => (async (path: string) => new Response(JSON.stringify(path === '/api/me' ? { me: { id: holder, name: holder } } : europeanSummary), { status: 200 })) as unknown as typeof fetch

describe('a Summary read is bound to the person the page was opened for (Codex, integrated review 7 Nov)', () => {
  it('RED before the fix: another private link opened in this browser since: the read is dropped, never drawn, in the person\'s words', async () => {
    useMe.setState({ me: { id: 'p_paul', name: 'Paul' }, status: 'ready' })
    setTeamFetch(coreAs('p_sam'))
    await expect(readSummary(SID)).rejects.toThrow(NOT_FOR_THIS_PAGE)
    bar(european as unknown as View)
    fireEvent.click(screen.getByTestId('summary-trigger'))
    await waitFor(() => expect(screen.getByTestId('summary-error').textContent).toBe(NOT_FOR_THIS_PAGE))
    expect(screen.queryByTestId('summary-document')).toBeNull()
    expect(screen.queryByTestId('summary-download')).toBeNull() // no export of a Summary this page may not show
    expect(screen.queryByTestId('summary-print')).toBeNull()
  })
  it('contrast: the same person still holds the browser: the read is drawn', async () => {
    useMe.setState({ me: { id: 'p_paul', name: 'Paul' }, status: 'ready' })
    setTeamFetch(coreAs('p_paul'))
    await expect(readSummary(SID)).resolves.toMatchObject({ schema: 'olumi.summary/1' })
    bar(european as unknown as View)
    fireEvent.click(screen.getByTestId('summary-trigger'))
    await waitFor(() => expect(screen.getByTestId('summary-document')).toBeTruthy())
    expect(screen.getByTestId('summary-download')).toBeTruthy()
  })
})

describe('the top bar\'s Summary on the lane', () => {
  it('opens core\'s Summary of the saved version, drawn verbatim, with Download Markdown and Print or save as PDF on core\'s routes', async () => {
    const asked: string[] = []
    setTeamFetch((async (path: string) => { asked.push(path); return new Response(JSON.stringify(europeanSummary), { status: 200 }) }) as unknown as typeof fetch)
    bar(european as unknown as View)
    fireEvent.click(screen.getByTestId('summary-trigger'))
    const page = screen.getByTestId('summary-page')
    await waitFor(() => expect(within(page).getByTestId('summary-document')).toBeTruthy())
    expect(asked).toEqual([`/api/scenarios/${SID}/summary`])
    const s = europeanSummary as unknown as Summary
    expect(within(page).getAllByRole('heading', { level: 1 })[0]!.textContent).toBe(said(s.blocks[0]!))
    expect(within(page).getByTestId('summary-download').getAttribute('href')).toBe(`/api/scenarios/${SID}/summary?at=1&format=md`)
    expect(within(page).getByTestId('summary-download').textContent).toBe(SUMMARY_DOWNLOAD_LABEL)
    expect(within(page).getByTestId('summary-print').getAttribute('href')).toBe(`/api/scenarios/${SID}/summary?at=1&format=html`)
    expect(within(page).getByTestId('summary-print').textContent).toBe(SUMMARY_PRINT_LABEL)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('summary-page')).toBeNull()
    expect(document.activeElement).toBe(screen.getByTestId('summary-trigger')) // focus goes back to the control that opened it
  })
  it('an earlier version on screen: its own Summary, asked for by number', async () => {
    const asked: string[] = []
    setTeamFetch((async (path: string) => { asked.push(path); return new Response(JSON.stringify(europeanSummary), { status: 200 }) }) as unknown as typeof fetch)
    bar(european as unknown as View, 1)
    fireEvent.click(screen.getByTestId('summary-trigger'))
    await waitFor(() => expect(screen.getByTestId('summary-document')).toBeTruthy())
    expect(asked).toEqual([`/api/scenarios/${SID}/summary?at=1`])
    expect(screen.getByTestId('summary-download').getAttribute('href')).toBe(`/api/scenarios/${SID}/summary?at=1&format=md`)
  })
  it('a proposal held: still the saved version\'s Summary (core never summarises a held proposal), not hidden', () => {
    bar({ ...(european as unknown as View), proposal: (proposal as unknown as View).proposal })
    expect(screen.getByTestId('summary-trigger')).toBeTruthy()
  })
  it('a read that fails says so in the page', async () => {
    setTeamFetch((async () => new Response(JSON.stringify({ error: 'That scenario is not available to you.' }), { status: 404 })) as unknown as typeof fetch)
    bar(european as unknown as View)
    fireEvent.click(screen.getByTestId('summary-trigger'))
    await waitFor(() => expect(screen.getByTestId('summary-error').textContent).toBe('That scenario is not available to you.'))
  })
  it('nothing saved yet (no View, or a View with no version): no Summary control, rather than an empty one', () => {
    bar({ ...(european as unknown as View), version: null })
    expect(screen.queryByTestId('summary-trigger')).toBeNull()
    cleanup()
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    act(() => { useViewStore.setState({ view: null, status: 'loading' }) })
    render(<MemoryRouter><ToastProvider><TopBar scenarioTitle="T" onTitleChange={vi.fn()} onSave={vi.fn()} onShare={vi.fn()} /></ToastProvider></MemoryRouter>)
    expect(screen.queryByTestId('summary-trigger')).toBeNull()
  })
  it('the exports are pinned to the version read: a newer save between the read and the click never exports another version', async () => {
    const at3 = { ...(europeanSummary as unknown as Summary), version: { id: 3, n: 3, at: '2026-11-03T00:00:00.000Z', by: 'Paul' } }
    setTeamFetch((async () => new Response(JSON.stringify(at3), { status: 200 })) as unknown as typeof fetch)
    bar(european as unknown as View)
    fireEvent.click(screen.getByTestId('summary-trigger'))
    await waitFor(() => expect(screen.getByTestId('summary-document')).toBeTruthy())
    expect(screen.getByTestId('summary-download').getAttribute('href')).toBe(`/api/scenarios/${SID}/summary?at=3&format=md`)
    expect(screen.getByTestId('summary-print').getAttribute('href')).toBe(`/api/scenarios/${SID}/summary?at=3&format=html`)
  })
  it('showing the latest, the page reads again when the latest saved version changes', async () => {
    const asked: string[] = []
    setTeamFetch((async (path: string) => { asked.push(path); return new Response(JSON.stringify(europeanSummary), { status: 200 }) }) as unknown as typeof fetch)
    bar(european as unknown as View)
    fireEvent.click(screen.getByTestId('summary-trigger'))
    await waitFor(() => expect(screen.getByTestId('summary-document')).toBeTruthy())
    expect(asked).toEqual([`/api/scenarios/${SID}/summary`])
    const v = european as unknown as View
    act(() => { useViewStore.setState({ view: { ...v, version: { ...v.version!, id: 2, n: 2 } } }) })
    await waitFor(() => expect(asked).toEqual([`/api/scenarios/${SID}/summary`, `/api/scenarios/${SID}/summary`]))
  })
  it('the page does not reappear unasked: the scenario changes (or nothing is saved) while it is open, then a version is there again', async () => {
    setTeamFetch((async () => new Response(JSON.stringify(europeanSummary), { status: 200 })) as unknown as typeof fetch)
    bar(european as unknown as View)
    fireEvent.click(screen.getByTestId('summary-trigger'))
    await waitFor(() => expect(screen.getByTestId('summary-document')).toBeTruthy())
    act(() => { useViewStore.setState({ sid: null, view: null }) })
    expect(screen.queryByTestId('summary-page')).toBeNull()
    act(() => { useViewStore.setState({ sid: SID, view: european as unknown as View }) })
    expect(screen.queryByTestId('summary-page')).toBeNull()
    cleanup()
  })
  it('the dialog traps Tab: from the last control it wraps to the first, and Shift+Tab from the first to the last', async () => {
    setTeamFetch((async () => new Response(JSON.stringify(europeanSummary), { status: 200 })) as unknown as typeof fetch)
    bar(european as unknown as View)
    fireEvent.click(screen.getByTestId('summary-trigger'))
    await waitFor(() => expect(screen.getByTestId('summary-document')).toBeTruthy())
    const page = screen.getByTestId('summary-page')
    const stops = [...page.querySelectorAll<HTMLElement>('a[href], button')]
    const first = stops[0]!, last = stops[stops.length - 1]!
    expect(last).toBe(screen.getByTestId('summary-close'))
    last.focus()
    expect(fireEvent.keyDown(last, { key: 'Tab' })).toBe(false)
    expect(document.activeElement).toBe(first)
    expect(fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })).toBe(false)
    expect(document.activeElement).toBe(last)
  })
  it('a mark is an image with the mark\'s title as its name, and the space sits outside it', () => {
    const s = GOLDEN['studio']!
    const { container } = render(<SummaryDocument summary={s} />)
    const part = s.blocks.flatMap((b) => b.parts).find((p) => p.mark)!
    const mark = within(container).getAllByRole('img').find((m) => m.getAttribute('aria-label') === part.mark!.title)!
    expect(mark.getAttribute('title')).toBe(part.mark!.title)
    expect(mark.textContent).toBe(part.mark!.glyph)
  })
})
