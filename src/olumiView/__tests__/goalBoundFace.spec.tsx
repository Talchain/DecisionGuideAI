/**
 * DL 6 Nov (the aim-label correction: a label names the outcome alone, "Increase productivity"): an aim's or limit's target, core's own
 * words from its target record (`card.bound.text`, "at least £7,000/month"), is on the card's FACE under its heading, as the previous
 * PoC's "Target: …" line, never only inside the selected card's other words, so the number is never hidden.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import type { View, ViewModel } from '../client'
import { ViewCardNode } from '../../canvas/nodes/ViewCardNode'

const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/pricing.view.json'), 'utf8'))
type Card = ViewModel['cards'][number]
const goal = view.model!.cards.find((c) => c.id === 'profit_goal')!
const draw = (card: Card) => render(<ReactFlowProvider><ViewCardNode {...({ id: card.id, data: { card, label: card.heading }, selected: false, type: 'viewCard' } as unknown as NodeProps)} /></ReactFlowProvider>).container
afterEach(cleanup)

describe("an aim's target on its card face", () => {
  it("catch: the goal card's face shows core's bound text under its heading, once, outside the selected-only words", () => {
    const c = draw(goal)
    const at = c.querySelectorAll('[data-view="profit_goal.bound.text"]')
    expect(at).toHaveLength(1)
    expect(at[0]!.textContent).toBe(goal.bound!.text)
    expect(at[0]!.closest('[data-view-more]')).toBeNull()
    expect(at[0]!.closest('[hidden]')).toBeNull()
  })
  it('must not change: a card with no bound shows no target line and no extra cue', () => {
    const c = draw({ ...goal, bound: null } as Card)
    expect(c.querySelector('[data-view$=".bound.text"]')).toBeNull()
    expect(c.querySelector('[data-view="profit_goal.heading"]')!.textContent).toBe(goal.heading)
  })
})
