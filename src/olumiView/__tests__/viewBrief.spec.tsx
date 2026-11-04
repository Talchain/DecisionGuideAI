/**
 * THE LANE'S SUMMARY IS CORE'S VIEW (DL 4 Nov): on the olumi-core lane the top bar's Summary draws the View's question, its Run lines and
 * each option's rows, word for word with core's hovers, and nothing of the adapter's saved model. Asserted from core's goldens, never
 * from words written here, so the rows prove the Summary is View-fed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } } }))
import european from '../golden/european.view.json'
import studio from '../golden/studio.view.json'
import type { View } from '../client'
import { TopBar } from '../../components/layout/TopBar'
import { ToastProvider } from '../../canvas/ToastContext'
import { useCanvasStore } from '../../canvas/store'
import { useViewStore } from '../store'

afterEach(() => { cleanup(); vi.unstubAllEnvs(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }) })

const open = (view: View) => {
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: 's_0123456789ab', view, error: null, status: 'ready', stale: false })
  useCanvasStore.setState({ currentScenarioId: '00000000-0000-4000-8000-0123456789ab' })
  render(<MemoryRouter><ToastProvider><TopBar scenarioTitle="T" onTitleChange={vi.fn()} onSave={vi.fn()} onShare={vi.fn()} /></ToastProvider></MemoryRouter>)
  fireEvent.click(screen.getByTestId('view-brief-trigger'))
  return screen.getByTestId('view-brief-panel')
}

describe('the lane\'s Summary draws the View', () => {
  it('the question, the Run\'s lead and most-likely line, and every option with each chance row\'s aim, value and marks, verbatim', () => {
    const v = european as unknown as View, m = v.model!, panel = open(v)
    expect(within(panel).getByTestId('view-brief-question').textContent).toBe(m.question.text)
    expect(within(panel).getByText(m.run!.lead!)).toBeTruthy()
    const likely = within(panel).getByTestId('view-brief-most-likely')
    expect([likely.textContent, likely.getAttribute('title')]).toEqual([m.run!.most_likely!.text, m.run!.most_likely!.title])
    const options = m.cards.filter((c) => c.family === 'option')
    expect(options.length).toBeGreaterThan(1)
    for (const card of options) {
      const box = within(panel).getByTestId(`view-brief-option-${card.id}`)
      expect(box.textContent).toContain(card.heading)
      card.rows.forEach((row, i) => {
        const p = box.querySelector(`[data-view-brief-row="${card.id}.${i}"]`)!
        expect(p.getAttribute('title')).toBe(row.title)
        if (row.kind === 'none') expect(p.textContent).toBe(row.text)
        else {
          expect(p.textContent).toContain(`${row.aim} ${row.kind === 'chance' ? row.approx : ''}${row.value}`)
          if (row.olumi) expect(within(p as HTMLElement).getByLabelText(row.olumi.title).textContent).toContain(row.olumi.glyph)
        }
      })
    }
    // No card that is not an option, and nothing of the saved-model Summary.
    expect(panel.querySelectorAll('[data-testid^="view-brief-option-"]')).toHaveLength(options.length)
    expect(screen.queryByTestId('decision-brief-trigger')).toBeNull()
  })

  it('what the Run waits on, its head, words and each item, as the View says them', () => {
    const v = studio as unknown as View, w = v.model!.run!.waits_on!, panel = open(v)
    const box = within(panel).getByTestId('view-brief-waits')
    expect(box.textContent).toContain(w.head)
    expect(box.textContent).toContain(w.text)
    for (const item of w.items) expect(within(box).getByText(item.text).getAttribute('title')).toBe(item.title)
  })

  it('no model in the View (none yet, or a read that failed): no Summary control, rather than an empty one', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    useViewStore.setState({ view: null, status: 'loading' })
    render(<MemoryRouter><ToastProvider><TopBar scenarioTitle="T" onTitleChange={vi.fn()} onSave={vi.fn()} onShare={vi.fn()} /></ToastProvider></MemoryRouter>)
    expect(screen.queryByTestId('view-brief-trigger')).toBeNull()
  })
})
