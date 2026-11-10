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
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { ViewCard, ViewCardNode } from '../../canvas/nodes/ViewCardNode'
import { NodeQuickActions } from '../../canvas/nodes/shared/NodeQuickActions'
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
  // R25 (Paul's 6 Nov test: "I can't find manual editing"): the ✎ is the at-rest cue wherever core offers an edit; its words stay quiet
  // until hover, focus or selection. The wrapper carries no hiding rule, so the open editor and its Set can never be hidden (R4 run 3).
  it('the card neither hovered nor selected: the ✎ glyph is drawn at rest, opens the editor, and nothing wraps Set in a hiding rule', () => {
    render(<ViewCard card={card} selected={false} />)
    expect(screen.getByTestId(`view-figure-glyph-${card.id}`).textContent).toBe('✎')
    const wrap = screen.getByTestId(`view-figure-edit-${card.id}`).closest<HTMLElement>('[data-figure-edit-wrap]')!
    expect(wrap.className).toBe('')
    fireEvent.click(screen.getByTestId(`view-figure-edit-${card.id}`))
    expect(screen.getByTestId(`view-figure-set-${card.id}`).closest('[data-figure-edit-wrap]')).toBe(wrap)
  })

  it('R25: a View card node draws no "More actions" (⋯) button, whose menu the lane never mounts', () => {
    render(<ReactFlowProvider><ViewCardNode {...({ id: card.id, data: { card, label: card.heading }, selected: true, type: 'viewCard' } as unknown as NodeProps)} /></ReactFlowProvider>)
    expect(screen.getByTestId(`view-figure-glyph-${card.id}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`node-action-menu-${card.id}`)).toBeNull()
  })

  it('must not change: the legacy canvas\'s quick actions still draw ⋯ (its context menu is mounted there)', () => {
    render(<NodeQuickActions nodeId="legacy" nodeType="factor" label="Legacy" alwaysVisible />)
    expect(screen.getByTestId('node-action-menu-legacy')).toBeInTheDocument()
  })

  it('the badge (a focusable button) stays visible while it holds focus', () => {
    // A badge core names in words is on the face at rest (f687bf91, DL 7 Nov), so it is never hidden; a glyphs-only badge (core sends no
    // `icon`/`words`) is the one that waits for hover, and it must stay visible while it holds focus.
    // DL 9 Nov (the face never changes height on hover or focus): a glyphs-only badge is at rest too, so it is visible whether or not it holds focus.
    const { icon: _i, words: _w, face: _f, ...plain } = badged.badge as NonNullable<typeof badged.badge> & { icon?: string; words?: string; face?: string }
    const { unmount } = render(<ViewCard card={{ ...badged, badge: plain } as typeof badged} selected={false} />)
    const text = document.querySelector<HTMLElement>(`[data-view="${badged.id}.badge.text"]`)!
    expect([text.closest(`[data-badge-at-rest="${badged.id}"]`) !== null, text.closest('.invisible'), text.closest('[data-at-rest-hidden]')]).toEqual([true, null, null])
    unmount()
    render(<ViewCard card={badged} selected={false} />)
    const named = document.querySelector<HTMLElement>(`[data-badge-at-rest="${badged.id}"]`)
    if (named !== null) expect(named.closest('[data-at-rest-hidden]'), 'a named badge is never hidden at rest').toBeNull()
  })

  it('CONTRAST: a selected card shows them with no rule at all', () => {
    render(<ViewCard card={card} selected />)
    expect(screen.getByTestId(`view-figure-edit-${card.id}`).closest<HTMLElement>('[data-figure-edit-wrap]')!.className).toBe('')
  })
})
