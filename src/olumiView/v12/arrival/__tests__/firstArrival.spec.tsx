/**
 * V12 first arrival: the card a member reads above the private-view box while core still holds them. No network, no store: the component
 * takes one View. Rows: a held reader reads the five lines (the privacy line is core's, drawn as given); the brief is whole behind a
 * closed disclosure; a member core does not hold reads nothing (contrast); a held reader who has already sent messages still reads it, in
 * words that stay true for them; nothing core holds back is in its text; an empty brief draws no brief row; it is gone once the gate
 * opens; and it moves no focus. Invented words only.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../../../client'
import { FirstArrival } from '../FirstArrival'
import { tipOf } from '../../../__tests__/tipHelpers'

const fx: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5/effects.view3.json'), 'utf8'))
const BRIEF = 'Tallow & Wick makes candles for hotels.\n\nWe want ideas for a second product the same buyers would order, and a view on which to try first.'
/** Kim, a member core holds: not the brief's writer, and no view of her own yet. */
const held = (over: Partial<View> = {}): View => ({ ...fx, gated: true, you: 'Kim', you_id: '3', brief: BRIEF, ...over } as View)
const SAMS_VIEW = 'Hotels will not pay more than they do for candles.', EARLY_VIEW = 'Diffusers sell where candles are banned.'
const REPLY = 'A reply that draws on what Sam said about price.', KEPT = 'Offer a refill service to the ten largest hotels.', EVIDENCE = 'Three hotels asked for diffusers last quarter.'

afterEach(cleanup)

describe('FirstArrival: a reader core holds', () => {
  it('reads a headline and one line with a lock; core\'s privacy sentence and the reveal sentence are hover words only (CHANGED BY DESIGN, v10 review item 9)', async () => {
    render(<FirstArrival view={held()} />)
    const card = screen.getByTestId('first-arrival')
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Your view comes first')
    expect(card.querySelectorAll('p')[0]!.textContent).toBe('Say what you think before you read the others’, so the team hears what only you know.')
    expect(screen.getByTestId('first-arrival-brief-toggle').textContent).toBe('The brief this scenario started from')
    expect(await tipOf(screen.getByTestId('first-arrival-private'))).toBe(fx.team_words.views.private)
    expect(screen.getByTestId('first-arrival-private').querySelector('svg')).toBeTruthy()
    expect(await tipOf(screen.getByTestId('first-arrival-why'))).toBe('Once everyone has given or skipped a view, any of you can reveal them all together.')
    expect(screen.queryByTestId('first-arrival-reveal')).toBeNull()
    // At rest, those three lines are everything it says; the lock and eye sentences are not in the text.
    expect(card.textContent).toBe(['Your view comes first', 'Say what you think before you read the others’, so the team hears what only you know.', 'The brief this scenario started from'].join(''))
  })

  it('carries core\'s privacy line as given in the lock\'s title (CHANGED BY DESIGN, v10 review item 9), and no hover when core gives none', async () => {
    const words = (line: string) => ({ ...fx.team_words, views: { ...fx.team_words.views, private: line } })
    render(<FirstArrival view={held({ team_words: words('Core’s own line about privacy.') })} />)
    expect(await tipOf(screen.getByTestId('first-arrival-private'))).toBe('Core’s own line about privacy.')
    cleanup()
    render(<FirstArrival view={held({ team_words: words('') })} />)
    expect(screen.getByTestId('first-arrival')).toBeTruthy()
    const bare = screen.getByTestId('first-arrival-private')
    expect([bare.hasAttribute('title'), bare.hasAttribute('tabindex')], 'no native title, and no empty hover to reach').toEqual([false, false])
  })

  it('keeps the brief behind a closed disclosure and opens it whole, as written', () => {
    render(<FirstArrival view={held()} />)
    const toggle = screen.getByTestId('first-arrival-brief-toggle')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('first-arrival-brief')).toBeNull()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const brief = screen.getByTestId('first-arrival-brief')
    expect(brief.textContent).toBe(BRIEF)
    expect(toggle.getAttribute('aria-controls')).toBe(brief.id)
    fireEvent.click(toggle)
    expect(screen.queryByTestId('first-arrival-brief')).toBeNull()
  })

  it('draws no brief row when the brief is empty', () => {
    render(<FirstArrival view={held({ brief: '   ' })} />)
    expect(screen.getByTestId('first-arrival')).toBeTruthy()
    expect(screen.queryByTestId('first-arrival-brief-toggle')).toBeNull()
  })

  it('still reads it after sending messages of their own, and no word says they are new, have joined or were invited', () => {
    const mine = { ...fx.chat[0]!, id: 9101, by: 'Kim', by_id: '3', said: 'What have you tried so far?' }
    render(<FirstArrival view={held({ chat: [...fx.chat, mine] } as Partial<View>)} />)
    fireEvent.click(screen.getByTestId('first-arrival-brief-toggle'))
    const said = screen.getByTestId('first-arrival').textContent!.replace(BRIEF, '')
    expect(said).toContain('Your view comes first')
    expect(said).not.toMatch(/\bnew\b|\bjoin|\binvit|\bwelcome/i)
  })

  it('draws nothing core holds back: no teammate\'s view, reply, kept idea or evidence is in its text, with the brief open', () => {
    const shared = [{ ...fx.collab.shared[0]!, text: SAMS_VIEW }, { ...fx.collab.shared[1]!, text: EARLY_VIEW }]
    const reply = { ...fx.chat[0]!, id: 9102, answer: { ...fx.chat[0]!.answer!, answer: [{ text: REPLY }] } }
    const view = held({ collab: { ...fx.collab, shared }, chat: [reply], kept: [{ id: 9103, turn: 9102, text: KEPT, by: 'olumi', kept_by: { id: '2', name: 'Sam' }, at: '2026-11-17T08:00:00Z', concerns: [] }],
      evidence: [{ ...(fx.evidence[0] ?? {}), id: 9104, by: 'Sam', text: EVIDENCE }] } as unknown as Partial<View>)
    render(<FirstArrival view={view} />)
    fireEvent.click(screen.getByTestId('first-arrival-brief-toggle'))
    const text = screen.getByTestId('first-arrival').textContent!
    expect(text).toContain(BRIEF) // the probe sees the card's whole text
    for (const heldBack of [SAMS_VIEW, EARLY_VIEW, REPLY, KEPT, EVIDENCE, 'Sam']) expect(text).not.toContain(heldBack)
  })

  it('moves no focus when it is drawn', () => {
    render(<FirstArrival view={held()} />)
    expect(document.activeElement).toBe(document.body)
  })
})

describe('FirstArrival: a member core does not hold', () => {
  it('reads nothing: one who has given or skipped a view, or who wrote the brief (contrast: the same View, held, draws the card)', () => {
    const { container } = render(<FirstArrival view={held({ gated: false })} />)
    expect(container.innerHTML).toBe('')
    cleanup()
    render(<FirstArrival view={held()} />)
    expect(screen.getByTestId('first-arrival')).toBeTruthy()
  })

  it('is gone once the gate opens: the same View re-drawn after they give or skip', () => {
    const { rerender, container } = render(<FirstArrival view={held()} />)
    expect(screen.getByTestId('first-arrival')).toBeTruthy()
    rerender(<FirstArrival view={held({ gated: false })} />)
    expect(container.innerHTML).toBe('')
  })

  it('holds nobody on a View from a core without the field', () => {
    const { gated: _gated, ...older } = held()
    const { container } = render(<FirstArrival view={older as View} />)
    expect(container.innerHTML).toBe('')
  })
})
