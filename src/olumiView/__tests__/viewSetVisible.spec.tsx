/**
 * ⛔ AN OPEN FIGURE EDITOR IS NEVER HIDDEN (R4 real-AI witness run 3, github-3c: "view-figure-set-current_output not visible"; BLOCK, a dead
 * control). The card's ✎ and its editor sit in the card's at-rest wrapper, `invisible` unless the card is hovered or selected
 * (ViewCardNode.tsx). Opening the editor makes the card taller, the canvas lays the graph out again at the drawn heights (canvas.ts), the
 * card can move from under the pointer, and the re-laid nodes carry no selection: the open form and its Set button went `visibility:
 * hidden`. The wrapper now stays visible while it holds an open form (`has-[form]:visible`) or focus (`focus-within:visible`); the badge's
 * wrapper, a focusable button, while it holds focus. jsdom applies no Tailwind, so the rows bind the wrapper's own rule around the real Set
 * button. Fixture: core's european golden (a card core offers to edit).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { useMe } from '../../olumiCore/me'

const SID = 's_0123456789ab'
const view: View = { ...JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'european.view.json'), 'utf8')), id: SID }
const card = view.model!.cards.find((c) => c.figure?.edit)!
const badged = view.model!.cards.find((c) => c.badge !== null)!
beforeEach(() => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view, status: 'ready', error: null, stale: false })
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
})
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }); useMe.setState({ me: null, status: 'none' }) })

describe('an open figure editor stays visible, whether or not its card is hovered or selected', () => {
  it('the card neither hovered nor selected: ✎ opens the editor, and the wrapper holding Set stays visible while it is open or focused', () => {
    render(<ViewCard card={card} selected={false} />)
    fireEvent.click(screen.getByTestId(`view-figure-edit-${card.id}`))
    const set = screen.getByTestId(`view-figure-set-${card.id}`)
    const wrap = set.closest<HTMLElement>('[data-at-rest-hidden]')!
    expect(wrap).not.toBeNull()
    expect(wrap.classList.contains('invisible'), 'still hidden at rest when closed').toBe(true)
    expect([wrap.classList.contains('has-[form]:visible'), wrap.classList.contains('focus-within:visible')]).toEqual([true, true])
  })

  it('the badge (a focusable button) stays visible while it holds focus', () => {
    render(<ViewCard card={badged} selected={false} />)
    const wrap = document.querySelector<HTMLElement>(`[data-view="${badged.id}.badge.text"]`)!.closest<HTMLElement>('[data-at-rest-hidden]')!
    expect(wrap.classList.contains('focus-within:visible')).toBe(true)
  })

  it('CONTRAST: a selected card shows them with no rule at all', () => {
    render(<ViewCard card={card} selected />)
    expect(screen.getByTestId(`view-figure-edit-${card.id}`).closest<HTMLElement>('[data-at-rest-hidden]')!.className).toBe('')
  })
})
