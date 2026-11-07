/**
 * A reason every option shares, said once (the strategy audit, 7 Nov, on the served strategy case: "cannot be worked out yet · Sustainable
 * enterprise growth" on all four route cards; the V11 boards Paul approved on 7 Nov: a route card shows its title until a figure exists).
 * Core sends that reason once (`run.shared_blockers`, by aim id and option ids) and each covered card a short row; the panel says the reason
 * once (ViewChances `SharedBlockers`) and the card leaves the covered rows to it. A row that is the option's own reason stays on its card.
 * Fixtures are core's own Views: hosting (one aim's reason shared by every option, the other aim's each option's own), app-launch (every
 * row shared), bakery (a core before the field). Every expectation is bound by card id, aim id and row index, never by the row's words.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import type { View, ViewCard } from '../client'
import { useViewStore } from '../store'
import { ViewCardNode } from '../../canvas/nodes/ViewCardNode'
import { SharedBlockers } from '../ViewChances'
import { sharedAimsOf } from '../layout'

const read = (p: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView', p), 'utf8'))
const hosting = read('fixtures/real/hosting.view3.json'), launch = read('golden/app-launch.view.json'), bakery = read('golden/bakery.view.json')
const options = (v: View) => v.model!.cards.filter((c) => c.family === 'option')
/** The real node (ReactFlow's node component), reading core's View from the store as the canvas does. */
function draw(v: View, card: ViewCard): HTMLElement {
  useViewStore.setState({ view: v } as never)
  return render(<ReactFlowProvider><ViewCardNode {...({ id: card.id, data: { card, label: card.heading }, selected: false, type: 'viewCard' } as unknown as NodeProps)} /></ReactFlowProvider>).container
}
const rowText = (c: HTMLElement, id: string, i: number) => c.querySelector(`[data-view="${id}.rows.${i}.text"]`)
const noneAt = (card: ViewCard, aim: string) => card.rows.findIndex((r) => r.kind === 'none' && r.aim_id === aim)
afterEach(() => { cleanup(); useViewStore.setState({ view: null } as never) })

describe('a reason every option shares is said once, in the panel; the cards show their titles', () => {
  it("catch: no card carries the shared reason's row; each option's own reason stays on its card, in core's words", () => {
    const [shared] = hosting.model!.run!.shared_blockers!
    const own = 'protect_delivery_quality'
    expect(hosting.model!.run!.shared_blockers).toHaveLength(1)
    expect(shared!.aim_id).not.toBe(own)
    const cards = options(hosting)
    expect(cards.map((c) => c.id).sort()).toEqual([...shared!.options].sort())
    for (const card of cards) {
      const c = draw(hosting, card), s = noneAt(card, shared!.aim_id), o = noneAt(card, own)
      expect(s, card.id).toBeGreaterThanOrEqual(0)
      expect(o, card.id).toBeGreaterThanOrEqual(0)
      expect(rowText(c, card.id, s), `${card.id}: the shared reason`).toBeNull()
      expect(rowText(c, card.id, o)!.textContent, `${card.id}: its own reason`).toBe((card.rows[o] as { text: string }).text)
      expect(c.querySelector(`[data-view="${card.id}.heading"]`)!.textContent).toBe(card.heading)
      cleanup()
    }
  })

  it('catch: where every row waits on a shared reason, each card draws no row at all and the panel says each reason once, verbatim', () => {
    const blockers = launch.model!.run!.shared_blockers!
    expect(blockers.length).toBeGreaterThan(1)
    for (const card of options(launch)) {
      expect(card.rows.length).toBeGreaterThan(0)
      const c = draw(launch, card)
      expect(c.querySelectorAll(`[data-view^="${card.id}.rows."]`), card.id).toHaveLength(0)
      expect(c.querySelector(`[data-view="${card.id}.heading"]`)!.textContent).toBe(card.heading)
      cleanup()
    }
    const panel = render(<SharedBlockers run={launch.model!.run!} />).container
    blockers.forEach((b, i) => {
      const at = panel.querySelectorAll(`[data-view="run.shared_blockers.${i}.text"]`)
      expect(at).toHaveLength(1)
      expect(at[0]!.textContent).toBe(b.text)
    })
  })

  it('catch: by identity: an option the shared reason does not name keeps that row (labelled fixture)', () => {
    // ⚠ LABELLED FIXTURE: no core View on file names only some options in a shared reason, so hosting's is narrowed to its first option.
    const v = structuredClone(hosting), b = v.model!.run!.shared_blockers![0]!
    const [named, other] = options(v)
    b.options = [named!.id]
    expect(sharedAimsOf(v, named!.id)).toEqual([b.aim_id])
    expect(sharedAimsOf(v, other!.id)).toEqual([])
    const i = noneAt(other!, b.aim_id)
    expect(rowText(draw(v, other!), other!.id, i)!.textContent).toBe((other!.rows[i] as { text: string }).text)
    cleanup()
    expect(rowText(draw(v, named!), named!.id, noneAt(named!, b.aim_id))).toBeNull()
  })

  it('must not change: a core before the field (no `shared_blockers`) leaves every row on its card', () => {
    expect(bakery.model!.run?.shared_blockers).toBeUndefined()
    let rows = 0
    for (const card of options(bakery)) {
      const c = draw(bakery, card)
      card.rows.forEach((r, i) => { if (r.kind === 'none') { rows++; expect(rowText(c, card.id, i)!.textContent).toBe(r.text) } })
      cleanup()
    }
    expect(rows).toBeGreaterThan(0)
  })
})
