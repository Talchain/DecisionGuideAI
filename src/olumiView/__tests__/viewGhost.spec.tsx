/**
 * Proposal ghosts on the core lane (DL 4 Nov, R2): while a proposal is held the View's model is the proposal's, and a card it adds carries
 * core's `+` change. That card is drawn as the original canvas's proposal ghost (translucent, a solid info border, never dashed) with
 * core's words for it as its caption; a card it changes (`↻`) or keeps is drawn as before.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View, ViewCard as Card } from '../client'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'

const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'proposal.view.json'), 'utf8'))
const cards = view.model!.cards
const changed = cards.find((c) => c.change?.kind === 'changed')!
const kept = cards.find((c) => c.change === null)!
// Core's own mark for an added record (view.ts: glyph '+', title 'Proposed addition', kind 'added'), on a card of the wire View.
const added: Card = { ...kept, id: 'added_one', change: { glyph: '+', title: 'Proposed addition', kind: 'added' } }

afterEach(cleanup)
const root = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-view-card]')!

describe('a card the proposal adds is drawn as a ghost', () => {
  it('opaque (nothing faded at rest, 9 Nov craft), a solid info border, never dashed, with core\'s words as its caption', () => {
    const c = render(<ViewCard card={added} />).container
    const el = root(c)
    expect(el.dataset['proposedCard']).toBe('true')
    expect(el.className.split(' ')).toEqual(expect.arrayContaining(['bg-panel', 'border-info']))
    expect(el.className).not.toContain('border-dashed')
    expect(c.querySelector('[data-view="added_one.change.title"]')?.textContent).toBe('Proposed addition')
  })
  it('CONTRAST: a card the proposal keeps is drawn as before; one it changes is not the ghost (opaque, its own mark: cardReadable.spec)', () => {
    const k = root(render(<ViewCard card={kept} />).container)
    expect(k.dataset['proposedCard']).toBeUndefined()
    expect(k.className.split(' ')).toEqual(expect.arrayContaining(['bg-panel', 'border-border']))
    expect(k.querySelector(`[data-view="${kept.id}.change.title"]`)).toBeNull()
    cleanup()
    // Plan v3 finish line (DL/PL 7 Nov): a changed card is told apart at rest, by the proposal's border on an opaque card, never the ghost.
    const c = root(render(<ViewCard card={changed} />).container)
    expect(c.dataset['proposedCard']).toBeUndefined()
    expect(c.dataset['changedCard']).toBe('true')
    expect(c.className.split(' ')).toEqual(expect.arrayContaining(['bg-panel', 'border-info']))
    expect(c.className).not.toContain('bg-panel/80')
  })
})

describe('the applied-edit pulse on a View card', () => {
  it('the original card\'s ring while the canvas holds the card as just applied; none otherwise', () => {
    const on = root(render(<ViewCard card={kept} pulsed />).container)
    expect([on.dataset['pulsed'], on.className.includes('ai-highlight-pulse')]).toEqual(['true', true])
    cleanup()
    const off = root(render(<ViewCard card={kept} />).container)
    expect([off.dataset['pulsed'], off.className.includes('ai-highlight-pulse')]).toEqual([undefined, false])
  })
})
