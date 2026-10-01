/**
 * ⭐ M3: AN ASKED PRE-MORTEM WITH NO PLAN OFFERS EVERY PLAN (CEE #2480 `method-turn.ts` `choosePlan`; DL 380e54 M3 row).
 *
 * A generic "Run a pre-mortem" press with no plan answers with RC's choose_plan turn: ONE button per own option
 * (`agent-premortem-plan:<12 hex>`, label ‘<option>’) and then "Talk it through". D1 has four options, so that is four
 * or five chips, and the row's 0-3 rule (D-K) cut it to three: the last plan or "Talk it through" was silently lost.
 * A choice of plans is the method's own question, not a suggestion, so a turn that carries one keeps its whole set.
 * Every other turn keeps the 0-3 rule.
 *
 * Bound by chip IDENTITY (the `agent-premortem-plan:` id prefix), never by label or message text.
 */
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { SuggestedChips } from '../zones/SuggestedChips'
import { ChatThread } from '../zones/ChatThread'
import type { ActionChip, ConversationMessage } from '../types'

// ChatThread reaches lib/supabase, which throws at module scope without its env (threadMountIdentity.spec.tsx).
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))
vi.mock('../../../adapters/plot', () => ({ plot: { validatePatch: vi.fn() } }))

// CEE #2480 `choosePlan` + `TALK_IT_THROUGH_CHIP`, shapes verbatim; the 12-hex suffix is `stateKeyHash({option_id})`.
const plan = (hex: string, option: string): ActionChip => ({
  id: `agent-premortem-plan:${hex}`, label: `‘${option}’`, message: `Run a pre-mortem on ‘${option}’.`,
})
const D1_PLANS = [
  plan('0a1b2c3d4e5f', 'AI Reporting Module Sprint'),
  plan('1b2c3d4e5f60', 'Continue Current Plan'),
  plan('2c3d4e5f6071', 'Integration Bug Fix Sprint'),
  plan('3d4e5f607182', 'Split Sprint Capacity'),
]
const TALK: ActionChip = { id: 'agent-talk-it-through', label: 'Talk it through', message: 'Let’s talk it through.' }
// CEE `NEXT_STEP_CHIPS` plus two more ordinary chips: a turn with no plan choice.
const ORDINARY: ActionChip[] = [
  { id: 'agent-next-pre-mortem', label: 'Run a pre-mortem', message: 'Run a pre-mortem with me: imagine this decision went badly. What most plausibly went wrong?' },
  { id: 'agent-next-what-would-change', label: 'What would change the result?', message: 'What would most likely change this result?' },
  { id: 'agent-next-strengthen', label: 'Strengthen the model', message: 'What would most strengthen this model?' },
  { id: 'agent-extra-1', label: 'Extra one', message: 'Extra one.' },
  { id: 'agent-extra-2', label: 'Extra two', message: 'Extra two.' },
]

afterEach(cleanup)

function shownIds(chips: ActionChip[]): string[] {
  render(<SuggestedChips chips={chips} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
  return chips.map((c) => c.id).filter((id) => screen.queryByTestId(`suggested-chip-${id}`) !== null)
}

describe('SuggestedChips: a choose_plan turn keeps every plan and "Talk it through"', () => {
  it('RED: four plans + Talk it through (D1) = all five, in the producer’s order', () => {
    const chips = [...D1_PLANS, TALK]
    expect(shownIds(chips)).toEqual(chips.map((c) => c.id))
  })

  it('RED: three plans + Talk it through = all four; "Talk it through" is not the one cut', () => {
    const chips = [...D1_PLANS.slice(0, 3), TALK]
    expect(shownIds(chips)).toEqual(chips.map((c) => c.id))
    expect(screen.getByTestId('suggested-chip-agent-talk-it-through').textContent).toBe('Talk it through')
  })

  it('control: an ordinary turn still shows at most three (D-K unchanged)', () => {
    expect(shownIds(ORDINARY)).toEqual(ORDINARY.slice(0, 3).map((c) => c.id))
  })

  it('control: a run turn (consent + Talk it through) is under the cap and unchanged', () => {
    const consent: ActionChip = { id: 'agent-approve-proposal:gmh_0123456789ab', label: 'Record these links', intent: 'primary', message: 'Yes, record those.' }
    expect(shownIds([consent, TALK])).toEqual([consent.id, TALK.id])
  })

  it('⛔ identity, not words: a plan-worded label or a mid-id prefix does not lift the cap', () => {
    const wordedOnly = ORDINARY.map((c, i) => ({ ...c, label: `‘Plan ${i}’`, message: `Run a pre-mortem on ‘Plan ${i}’.` }))
    expect(shownIds(wordedOnly)).toHaveLength(3)
    cleanup()
    const midId = ORDINARY.map((c, i) => ({ ...c, id: `x-agent-premortem-plan:${i}` }))
    expect(shownIds(midId)).toHaveLength(3)
  })
})

describe('ChatThread: the method set rides the latest reply only', () => {
  const savedScroll = Element.prototype.scrollIntoView
  beforeAll(() => { Element.prototype.scrollIntoView = function () {} })
  afterAll(() => { Element.prototype.scrollIntoView = savedScroll })

  const msg = (id: string, role: 'user' | 'assistant', content: string, actionChips?: ActionChip[]) =>
    ({ id, role, content, ...(actionChips ? { actionChips } : {}) }) as ConversationMessage
  const thread = (messages: ConversationMessage[]) => render(<ChatThread {...({
    messages, isThinking: false, longRunningHint: null, nodeCount: 13, patchBlockStates: new Map(), patchRejections: new Map(),
    onChipClick: vi.fn(), onPatchAccept: vi.fn(), onPatchDismiss: vi.fn(), onFeedback: vi.fn(), onRetry: vi.fn(),
  } as unknown as React.ComponentProps<typeof ChatThread>)} />)
  const CHOOSE = msg('a1', 'assistant', 'Which plan should we stress?', [...D1_PLANS, TALK])

  it('RED: the latest reply carrying the choose_plan set shows all five under it', () => {
    thread([msg('u1', 'user', 'Run a pre-mortem'), CHOOSE])
    for (const c of [...D1_PLANS, TALK]) expect(screen.getByTestId(`suggested-chip-${c.id}`)).toBeTruthy()
  })

  it('control: once a later reply lands, the earlier plan set is not offered again', () => {
    thread([msg('u1', 'user', 'Run a pre-mortem'), CHOOSE, msg('u2', 'user', 'Let’s talk it through.'), msg('a2', 'assistant', 'Sure.')])
    for (const c of [...D1_PLANS, TALK]) expect(screen.queryByTestId(`suggested-chip-${c.id}`)).toBeNull()
  })
})
