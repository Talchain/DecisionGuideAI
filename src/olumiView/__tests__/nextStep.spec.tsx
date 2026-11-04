/**
 * Lane C (Paul 3 Nov: a first-time person knows what they are looking at and what to do next within a minute). The one next step,
 * highlighted at the top of the Olumi tab, chosen from what the View already states; and Olumi's newest reply first. Core's goldens.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { NEXT_STEP_WORDS, nextStepOf, ViewChat } from '../ViewChat'

const golden = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8'))
const show = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false })
  return render(<ViewChat />).container
}
const step = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-testid="view-next-step"]')

beforeEach(() => useUIStore.setState({ activeOutputTab: 'olumi' } as never))
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null }) })

describe('the next step', () => {
  it('a proposal held: check it, then approve or set aside, with core\'s change card and its two buttons inside the step', () => {
    const c = show(golden('proposal'))
    expect(step(c)?.getAttribute('data-step')).toBe('approve')
    expect(step(c)).toHaveTextContent(NEXT_STEP_WORDS.approve)
    expect(step(c)?.querySelector('[data-testid="view-chat-proposal"]')).not.toBeNull()
    expect(c.querySelectorAll('[data-testid="view-chat-proposal"]')).toHaveLength(1)
  })

  it('no proposal and the chances wait on a figure the person can type: that figure, in core\'s words, with its editor', () => {
    const view = golden('bakery'), item = view.model!.run!.waits_on!.items.find((i) => i.edit !== null)!
    const c = show(view)
    expect(step(c)?.getAttribute('data-step')).toBe('figure')
    expect(step(c)).toHaveTextContent(NEXT_STEP_WORDS.figure)
    expect(step(c)).toHaveTextContent(item.text)
    fireEvent.click(step(c)!.querySelector(`[data-testid="next-figure-edit-${item.id}"]`)!)
    expect(step(c)!.querySelector(`label[for="next-figure-${item.id}"]`)?.textContent).toBe(item.edit!.prompt)
  })

  it('nothing to approve or type, and they are the only member: bring a colleague in, which opens Team', () => {
    const view = golden('pricing')
    expect(view.model!.run!.waits_on).toBeNull()
    const c = show(view)
    expect(step(c)?.getAttribute('data-step')).toBe('invite')
    expect(step(c)).toHaveTextContent(NEXT_STEP_WORDS.invite)
    fireEvent.click(c.querySelector('[data-testid="view-next-invite"]')!)
    expect(useUIStore.getState().activeOutputTab).toBe('team')
  })

  it('a team already, with nothing to approve or type: no step (the conversation is the next step)', () => {
    const view = golden('pricing')
    const c = show({ ...view, collab: { ...view.collab, alone: false } })
    expect(step(c)).toBeNull()
  })

  it('the order: a held proposal comes before a figure, and a figure before an invitation; core\'s own states only', () => {
    const bakery = golden('bakery'), proposal = golden('proposal')
    expect(nextStepOf({ ...bakery, proposal: proposal.proposal })?.kind).toBe('approve')
    expect(nextStepOf(bakery)?.kind).toBe('figure')
    // A figure core does not let them type is never offered as their step.
    const run = bakery.model!.run!, waits = run.waits_on!
    const untypeable = { ...bakery, model: { ...bakery.model!, run: { ...run, waits_on: { ...waits, items: waits.items.map((i) => ({ ...i, edit: null })) } } } }
    expect(nextStepOf(untypeable)?.kind).toBe('invite')
    // While a proposal is held core gives no version to edit: no figure step either.
    expect(nextStepOf({ ...bakery, model: { ...bakery.model!, edit_base: null }, collab: { ...bakery.collab, alone: false } })).toBeNull()
  })
})

describe('Olumi\'s newest reply first', () => {
  it('the newest turn shows Olumi\'s reply above the words it answers; earlier turns are folded under it, each at its own path', () => {
    const view = golden('s_ce285b3617bb'), last = view.chat.length - 1
    expect(last).toBeGreaterThan(0)
    const c = show(view)
    const latest = c.querySelector(`[data-testid="view-chat-latest"] [data-view-turn="chat.${last}"]`)!
    const answer = latest.querySelector(`[data-view="chat.${last}.answer.answer.0.text"]`)!, said = latest.querySelector(`[data-view="chat.${last}.said"]`)!
    expect(answer.compareDocumentPosition(said) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const earlier = c.querySelector('[data-testid="view-chat-earlier"]')!
    expect(earlier.tagName).toBe('DETAILS')
    expect(earlier.querySelectorAll('[data-view-turn]')).toHaveLength(last)
    expect(earlier.querySelector('[data-view-turn="chat.0"] [data-view="chat.0.said"]')?.textContent).toBe(view.chat[0]!.said)
  })
})
