/**
 * ⛔ A PENDING PROPOSAL'S RUN IS NEVER READ AS THE CURRENT MODEL (DL ruling, 4 Nov; the design lead's R3 look check, shot 5-proposal-ticked):
 * while core's View shows a pending proposal, its model and its Run are the proposal's (core view.ts:370 `shownModel = pending ?? version`),
 * so an option whose chance moved only because another record changed carried no mark. Core says it shows the proposal's model exactly when
 * `proposal` is set and `model.edit_base` is null (view.ts:380); a held proposal shows the approved version and keeps `edit_base`. Then every
 * Run-derived line on a card (each chance row, each option's value on a worked-out figure) carries core's own ↻ (its key item `changed`),
 * hover "If approved". Fixture: core's proposal golden (1dd2ca9), a 2-change proposal held on version 1.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import type { View } from '../client'
import { ifApprovedMarkOf } from '../layout'
import { ViewCard, ViewCardNode } from '../../canvas/nodes/ViewCardNode'
import { useViewStore } from '../store'

const read = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', n), 'utf8'))
const pending = read('proposal.view.json'), none = read('european.view.json')
const held: View = { ...pending, model: { ...pending.model!, edit_base: pending.version!.id } }
const changed = pending.model!.key.findIndex((k) => k.id === 'changed')
afterEach(() => { cleanup(); useViewStore.setState({ view: null }) })

describe('while core shows a pending proposal, every Run-derived line carries ↻ "If approved"', () => {
  it('the mark is core\'s `changed` key item, from core\'s pending state alone: shown proposal yes; held proposal, none, or no View: no', () => {
    expect([pending.proposal !== null, pending.model!.edit_base, changed >= 0]).toEqual([true, null, true])
    expect(ifApprovedMarkOf(pending)).toEqual({ glyph: pending.model!.key[changed]!.glyph, title: 'If approved', i: changed })
    expect(pending.model!.key[changed]!.glyph).toBe('↻')
    expect([ifApprovedMarkOf(held), ifApprovedMarkOf(none), ifApprovedMarkOf(null)]).toEqual([null, null, null])
  })

  it('each chance row of each option, and each option\'s value on a worked-out figure, carries the mark beside core\'s value', () => {
    const mark = ifApprovedMarkOf(pending)!
    const options = pending.model!.cards.filter((c) => c.family === 'option' && c.rows.some((r) => r.kind === 'chance'))
    expect(options.length).toBeGreaterThan(1)
    for (const card of options) {
      const c = render(<ViewCard card={card} ifApproved={mark} />).container
      card.rows.forEach((r, i) => {
        if (r.kind !== 'chance') return
        const m = c.querySelector(`[data-view-row="${card.id}.rows.${i}"] [data-if-approved]`)
        expect([m?.textContent ?? null, m?.getAttribute('title') ?? null, m?.getAttribute('data-view') ?? null], card.id).toEqual(['↻', 'If approved', `key.${changed}.glyph`])
      })
    }
    const worked = pending.model!.cards.find((c) => c.figure !== null && (c.values?.length ?? 0) > 1)!
    const w = render(<ViewCard card={worked} ifApproved={mark} />).container
    expect([...w.querySelectorAll('[data-value-row] [data-if-approved]')].map((e) => e.textContent)).toEqual(worked.values!.map(() => '↻'))
  })

  it('on the canvas: the card node reads it from the View on screen, so a held proposal or none draws no mark', () => {
    const card = pending.model!.cards.find((c) => c.family === 'option' && c.rows.some((r) => r.kind === 'chance'))!
    const node = () => render(<ReactFlowProvider><ViewCardNode {...({ id: card.id, data: { card, label: card.heading }, selected: false, type: 'viewCard' } as unknown as NodeProps)} /></ReactFlowProvider>).container
    const counts: number[] = []
    for (const v of [pending, held, none]) { useViewStore.setState({ view: v }); counts.push(node().querySelectorAll('[data-if-approved]').length); cleanup() }
    expect(counts).toEqual([card.rows.filter((r) => r.kind === 'chance').length, 0, 0])
  })

  it('CONTRAST: with no pending proposal shown, no card carries it', () => {
    for (const card of pending.model!.cards) expect(render(<ViewCard card={card} ifApproved={null} />).container.querySelector('[data-if-approved]'), card.id).toBeNull()
  })
})

/**
 * R5 (DL 4 Nov; poc-core-server's field, core wip/r5-if-approved c91f363): core marks each Run-derived value a pending proposal MOVES with
 * `if_approved: { glyph, title }` (title "if approved; now <the base version's value>", in core's words), null where nothing moves. Drawn
 * verbatim beside the value; it replaces the blanket mark wherever core sends the key. Fixture: core's own proposal golden at c91f363.
 */
describe('R5: core\'s own if_approved, only on the values a pending proposal moves', () => {
  const r5: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/r5', 'proposal.view3.json'), 'utf8'))
  const blanket = ifApprovedMarkOf(r5)
  type Marked = { if_approved?: { glyph: string; title: string } | null }

  it('each chance row carries core\'s mark verbatim where core gives one, and none where core gives null', () => {
    const options = r5.model!.cards.filter((c) => c.family === 'option' && c.rows.some((r) => r.kind === 'chance'))
    const seen: (string | null)[] = []
    for (const card of options) {
      const c = render(<ViewCard card={card} ifApproved={blanket} />).container
      card.rows.forEach((r, i) => {
        if (r.kind !== 'chance') return
        const core = (r as Marked).if_approved ?? null, m = c.querySelector(`[data-view-row="${card.id}.rows.${i}"] [data-if-approved]`)
        expect([m?.textContent ?? null, m?.getAttribute('title') ?? null, m?.getAttribute('data-view') ?? null], `${card.id} ${i}`)
          .toEqual(core === null ? [null, null, null] : [core.glyph, core.title, `${card.id}.rows.${i}.if_approved.glyph`])
        seen.push(core?.title ?? null)
      })
      cleanup()
    }
    expect(seen).toContain('if approved; now about 50% chance')
    expect(seen).toContain(null)
  })

  it('each option\'s value on a worked-out figure: core\'s mark where it moved, none where it did not', () => {
    const worked = r5.model!.cards.find((c) => c.figure !== null && (c.values?.length ?? 0) > 1)!
    const w = render(<ViewCard card={worked} ifApproved={blanket} />).container
    const marks = [...w.querySelectorAll('[data-value-row]')].map((row) => row.querySelector('[data-if-approved]')?.getAttribute('title') ?? null)
    expect(marks).toEqual(worked.values!.map((b) => (b as Marked).if_approved?.title ?? null))
    expect(marks.some((t) => t === null) && marks.some((t) => t !== null)).toBe(true)
  })
})
