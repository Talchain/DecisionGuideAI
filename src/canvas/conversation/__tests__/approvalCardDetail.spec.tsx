/** Stage 1: proposal-bound approval shows the producer's complete change before consent. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ActionChipRow } from '../ActionChipRow'
import { SuggestedChips } from '../zones/SuggestedChips'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { buildRestoredThread, readServerConversationTurns, reconcileRestoredHeldControls } from '../serverConversationTurns'
import type { ActionChip, ConversationMessage } from '../types'
import served from './fixtures/served-held-proposal-sdwire4.json'

const ID = 'agent-approve-proposal:gmh_0123456789ab'
const DETAIL = "  Change the model's target to £2m by September 2027.\nKeep the revenue baseline from your brief; the growth rate remains Olumi's estimate.  "
const approval = (overrides: Partial<ActionChip> = {}): ActionChip => ({
  id: ID, label: 'Apply this change', intent: 'primary', message: 'Yes, apply that change.', detail: DETAIL, ...overrides,
})
const SUGGESTION: ActionChip = {
  id: 'agent-next-strengthen', label: 'Strengthen the model', intent: 'secondary', message: 'What would strengthen the model?',
}
const REASON = 'The details of this change are missing, so it cannot be approved.'
const RUN = { runNotCurrent: false, currentRunComputedAt: null }
const TURN = { turn_id: 'proposal-turn', created_at: '2026-10-17T14:01:00Z', user_message: 'Correct the target', assistant_message: 'Review this change.' }
const PID = 'gmh_0123456789ab'
const wireAction = { id: ID, label: 'Apply this change', message: 'Yes, apply that change.', detail: DETAIL }
const amend = { id: 'agent-amend-proposal', label: 'Change something first', message: 'Before you apply it, I want to change some of it.' }
const offer = { turn_id: TURN.turn_id, proposal_id: PID, suggested_actions: [wireAction, amend] }

afterEach(cleanup)

for (const surface of ['ActionChipRow', 'SuggestedChips'] as const) {
  const mount = (chips: ActionChip[], disabled = false) => {
    const press = vi.fn(async (_chip: ActionChip) => {})
    const view = render(surface === 'ActionChipRow'
      ? <ActionChipRow chips={chips} onChipClick={press} disabled={disabled} />
      : <SuggestedChips chips={chips} onChipClick={press} isThinking={disabled} proposalFields={null} />)
    return { ...view, press }
  }

  describe(`${surface}: approval detail`, () => {
    it('shows the full, plain detail immediately before its button and describes that button', () => {
      const chip = approval()
      const { press } = mount([chip])
      const button = screen.getByRole('button', { name: chip.label })
      const detail = button.previousElementSibling!
      expect(detail.tagName).toBe('P')
      expect(detail.textContent).toBe(DETAIL)
      expect(detail.childElementCount).toBe(0)
      expect(button).toHaveAttribute('aria-describedby', detail.id)
      expect(button).not.toHaveAttribute('title')
      expect(button).toBeEnabled()
      fireEvent.click(button)
      expect(press).toHaveBeenCalledWith(chip)
    })

    it('still shows detail when its complete text equals the button label', () => {
      const chip = approval({ detail: 'Apply this change' })
      mount([chip])
      const button = screen.getByRole('button', { name: chip.label })
      expect(button.previousElementSibling?.textContent).toBe(chip.detail)
      expect(button).toBeEnabled()
    })

    it.each([undefined, '', ' \n\t '])('withholds approval for missing or blank detail (%j)', detail => {
      const { press } = mount([approval({ detail })])
      const button = screen.getByRole('button', { name: 'Apply this change' })
      expect(button).toBeDisabled()
      expect(button.previousElementSibling?.textContent).toBe(REASON)
      expect(button).toHaveAttribute('aria-describedby', screen.getByText(REASON).id)
      fireEvent.click(button)
      expect(press).not.toHaveBeenCalled()
    })

    it('leaves suggested replies unchanged', () => {
      const { press } = mount([SUGGESTION])
      const button = screen.getByRole('button', { name: SUGGESTION.label })
      expect(button.textContent).toBe(SUGGESTION.label)
      expect(button).toBeEnabled()
      expect(button).not.toHaveAttribute('aria-describedby')
      expect(screen.queryByText(REASON)).toBeNull()
      fireEvent.click(button)
      expect(press).toHaveBeenCalledWith(SUGGESTION)
    })

    it('never borrows another chip’s detail to enable an approval', () => {
      const sibling = { ...SUGGESTION, detail: 'An unrelated growth estimate is 30%.' }
      const { press } = mount([sibling, approval({ detail: undefined })])
      const approve = screen.getByRole('button', { name: 'Apply this change' })
      expect(approve).toBeDisabled()
      expect(approve.previousElementSibling?.textContent).toBe(REASON)
      fireEvent.click(approve)
      expect(press).not.toHaveBeenCalled()
      const suggestion = screen.getByRole('button', { name: /Strengthen the model/ })
      expect(suggestion).toBeEnabled()
      fireEvent.click(suggestion)
      expect(press).toHaveBeenCalledWith(sibling)
    })

    it('keeps an in-flight or disabled card non-interactive even with complete detail', () => {
      const { press } = mount([approval()], true)
      const button = screen.getByRole('button', { name: 'Apply this change' })
      expect(button).toBeDisabled()
      expect(button.previousElementSibling?.textContent).toBe(DETAIL)
      fireEvent.click(button)
      expect(press).not.toHaveBeenCalled()
    })
  })
}

describe('V5 mapping and live-card reload retain the same detail', () => {
  it('maps each action’s own detail verbatim without moving it to a sibling', () => {
    const chips = buildSuggestedActionChips([], [wireAction, amend])
    expect(chips.map(chip => [chip.id, chip.detail])).toEqual([[ID, DETAIL], [amend.id, undefined]])
  })

  it('restores the current held-offer card with its complete detail before approval', () => {
    const turns = readServerConversationTurns([TURN])!
    const thread = buildRestoredThread(turns, RUN, [offer])
    const reply = thread.find(message => message.id === `restored-assistant-${TURN.turn_id}`)!
    expect(reply.actionChips?.[0].detail).toBe(DETAIL)
    render(<SuggestedChips chips={reply.actionChips!} onChipClick={vi.fn(async () => {})} proposalFields={null} />)
    const button = screen.getByRole('button', { name: wireAction.label })
    expect(button.previousElementSibling?.textContent).toBe(DETAIL)
    expect(button).toBeEnabled()
  })

  it('restores detail from the served proposal_fields approval, as well as held_proposal_offers', () => {
    const fields = served.read_R1.proposal_fields
    const expected = fields.proposals[0].approve_action
    const thread = buildRestoredThread(readServerConversationTurns(served.read_R1.conversation_turns)!, RUN,
      served.read_R1.held_proposal_offers, fields)
    const chips = thread.flatMap(message => message.actionChips ?? []).filter(chip => chip.id === expected.id)
    expect(chips).toHaveLength(1)
    expect(chips[0].detail).toBe(expected.detail)
    render(<SuggestedChips chips={chips} onChipClick={vi.fn(async () => {})} proposalFields={fields} />)
    const button = screen.getByRole('button', { name: expected.label })
    expect(button.previousElementSibling?.textContent).toBe(expected.detail)
    expect(button).toBeEnabled()
  })

  it('reconciles detail only from an exact fresh held authority; absent or mismatched authority retires the controls', () => {
    const message: ConversationMessage = { id: 'local-answer', role: 'assistant', content: TURN.assistant_message,
      timestamp: new Date(TURN.created_at), heldProposalId: PID, heldTurnId: TURN.turn_id, actionChips: [approval()] }
    expect(reconcileRestoredHeldControls([message], [offer])[0].actionChips?.[0].detail).toBe(DETAIL)
    expect(reconcileRestoredHeldControls([message], [])[0].actionChips).toBeUndefined()
    expect(reconcileRestoredHeldControls([message], [{ ...offer, turn_id: 'another-turn' }])[0].actionChips).toBeUndefined()
  })

  it('does not restore an obsolete approval from historical suggested_actions alone', () => {
    const turns = readServerConversationTurns([{ ...TURN, suggested_actions: [wireAction, amend] }])!
    expect(buildRestoredThread(turns, RUN).every(message => !message.actionChips?.length)).toBe(true)
  })

  it('keeps historical SuggestedChips hidden even with detail', () => {
    const { container } = render(<SuggestedChips chips={[approval()]} onChipClick={vi.fn(async () => {})} isHistorical proposalFields={null} />)
    expect(container.firstChild).toBeNull()
  })
})
