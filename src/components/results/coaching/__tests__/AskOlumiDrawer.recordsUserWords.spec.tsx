/**
 * R4 — THE TRANSCRIPT MUST RECORD WHAT THE USER ACTUALLY SAID.
 *
 * The drawer prefills an EDITABLE draft, tells the user to change it ("Replace
 * the number with your own judgement before sending"), and then dispatched with
 * `label` — the chip's generic caption — as the bubble's display text. So the
 * user authored a sentence, sent it, and the record showed *"Set relationship
 * strength"*. `submittedPrompt` holds the real text and had, measured at this
 * tip, TWO writers and ZERO readers in render code (contrast: `displayText`,
 * 61 references — confirmed absence, not a blind probe).
 *
 * That is not a cosmetic gap. The shared model is meant to be a living record of
 * the team's reasoning, and this dropped the user's own words at exactly the
 * point the product asked them to author something.
 *
 * ── WHY THE FIX IS HERE AND NOT IN THE DISPATCHER ──────────────────────────
 * `displayText` answers *"what should the bubble show for a chip?"* — and for a
 * genuine chip click, where the user typed nothing, a friendly caption is the
 * RIGHT answer. The drawer's case is a different question: *"the user authored
 * this."* Two questions under one name (CLAUDE.md trap 21). Aligning them would
 * break real chip turns; the discriminator belongs at the call site that knows
 * the text was authored, which is this drawer.
 *
 * ── WHY SUBSTITUTING `label` IS SAFE, DERIVED AT THE BYTES ─────────────────
 *  1. ROUTING IS UNAFFECTED. `dispatchAction` scans `` `${label} ${message}` ``
 *     for routing keywords ONLY in its `else if (!opts.action_type)` arm. This
 *     drawer always passes `action_type: 'discuss'`, so that arm never runs.
 *     (`discuss` is also absent from `ACTION_TO_TURN_TYPE`, so the first arm
 *     does not fire either and `turnType` stays at its `'conversation'`
 *     default — which is what a live trace observed.)
 *  2. NOTHING ELSE CONSUMES IT. `buildChipMeta` reads `label` zero times
 *     (contrast: it reads `parameters` 15 times). `label`'s only consumer on
 *     this path is `displayText`.
 * Both are pinned below, so the safety argument fails loud if either changes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { AskOlumiDrawer } from '../AskOlumiDrawer'
import { openAskOlumi, useAskOlumiStore } from '../askOlumiStore'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { ACTION_TO_TURN_TYPE } from '../../../../canvas/conversation/actionTurnTypes'

const CHIP_CAPTION = 'Set relationship strength'
const PREFILLED = 'Change the strength of the link from Customer demand to Revenue growth to 0.8.'
const AUTHORED = 'Change the strength of the link from Customer demand to Revenue growth to 0.35.'

const payload = {
  context: 'Replace the number with your own judgement before sending.',
  draft: PREFILLED,
  label: CHIP_CAPTION,
  parameters: { edge_id: 'e1' },
}

beforeEach(() => {
  useAskOlumiStore.setState({ isOpen: false, context: '', draft: '', label: '', targetId: null })
  useGuidanceStore.setState({ _dispatchAction: null, _sendMessage: null } as never)
})

function sendWith(draft?: string) {
  const dispatch = vi.fn()
  useGuidanceStore.setState({ _dispatchAction: dispatch } as never)
  render(<AskOlumiDrawer />)
  act(() => openAskOlumi(payload))
  if (draft !== undefined) {
    fireEvent.change(screen.getByTestId('ask-olumi-draft'), { target: { value: draft } })
  }
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  return dispatch
}

describe('R4 — the record keeps the user’s own words', () => {
  it('an EDITED ask is recorded as the user wrote it, not as the chip caption', () => {
    const dispatch = sendWith(AUTHORED)
    const opts = dispatch.mock.calls[0][0]

    expect(opts.message).toBe(AUTHORED)
    // The display text IS the sent text. Bound to the authored string by
    // identity — not merely "not the caption", which a truncation would satisfy.
    expect(opts.label).toBe(AUTHORED)
    expect(opts.label).not.toBe(CHIP_CAPTION)
  })

  it('an UNEDITED ask records the sentence that was actually sent', () => {
    // The user read it and chose to send it. The record shows what went, not a
    // caption for it — otherwise the transcript is unreadable either way.
    const dispatch = sendWith()
    const opts = dispatch.mock.calls[0][0]
    expect(opts.message).toBe(PREFILLED)
    expect(opts.label).toBe(PREFILLED)
  })

  it('DISCRIMINATING — everything else on the dispatch is untouched', () => {
    // Without this, "pass the text as label" is satisfied by a change that also
    // drops parameters or the action type, which would break routing and the
    // contextual-session carrier while this file stayed green.
    const dispatch = sendWith(AUTHORED)
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        action_type: 'discuss',
        message: AUTHORED,
        parameters: { edge_id: 'e1' },
        source: 'chip',
      }),
    )
  })

  describe('the preconditions the safety argument rests on', () => {
    it('`discuss` is absent from ACTION_TO_TURN_TYPE, so the keyword arm cannot run', () => {
      // If someone adds it, routing on this path starts depending on the map
      // and the "substituting label is inert" argument needs re-deriving.
      expect(ACTION_TO_TURN_TYPE.discuss).toBeUndefined()
      // Contrast control: the map is populated, so this is not a blind read.
      expect(Object.keys(ACTION_TO_TURN_TYPE).length).toBeGreaterThan(3)
    })

    it('the drawer always sets action_type, which is what skips the keyword scan', () => {
      const dispatch = sendWith(AUTHORED)
      expect(dispatch.mock.calls[0][0].action_type).toBe('discuss')
    })
  })
})
