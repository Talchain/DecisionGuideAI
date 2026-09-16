/**
 * THE VALUES SURVIVE THE WHOLE UI CARRIER, ASSERTED EXACTLY — not "a
 * `parameters` token is present somewhere".
 *
 * ## Why this exists rather than another scanner
 *
 * `everyAskCarriesItsBlockId.spec.ts` proves each call SITE passes
 * `parameters`. The review was right that it is narrower than its name: it
 * matches a literal `openAskOlumi({`, a variable named `rec`, and ANY
 * `parameters` token — `parameters: {}` would satisfy it. It is static lint
 * evidence about the source, and it says nothing about whether a value
 * survives.
 *
 * This spec drives the real store and the real component and asserts the EXACT
 * object arrives at the dispatcher.
 *
 * ## ⛔ WHAT THIS DOES NOT PROVE, AND THE LIMIT IS THE WHOLE POINT
 *
 * Coaching traced the CEE side and found the first failed boundary:
 * **`parameters.block_id` is never read by CEE at all** — not "resolution
 * fails", nothing attempts it. The only consumer of `chip.parameters` is
 * `turn-executor.ts:6059`, gated at `:6051-6054` to the three typed MUTATION
 * action types, and a phase-3 recommendation chip is not one. Their sweep
 * carried contrast controls (target 0, `block_id` 91, `parameters` 849,
 * `action_type` 901), so the zero is a measurement.
 *
 * So this is a carrier test and NOT a context-recovery claim. The finding body
 * does not reach the model today, and no assertion here says otherwise. The
 * receiver repair is Coaching's and is in flight.
 *
 * ## The id shape, pinned here because it was ASSERTED TO ANOTHER LANE
 *
 * I told Coaching that `parameters.block_id` carries the RAW producer UUID and
 * not the prefixed recommendation id, so their resolver can match it directly.
 * That claim is now guarded: if the two ever collapse onto one value, this
 * fails rather than quietly making their resolver miss.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { AskOlumiDrawer } from '../AskOlumiDrawer'
import { openAskOlumi, useAskOlumiStore } from '../askOlumiStore'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { buildRecommendations, toStrengthenPhase3Item } from '../../strengthen/buildRecommendations'

/** A producer block id in the shape the wire actually carries (8/8 on `1dd2133d`). */
const BLOCK_UUID = '558e05de-46a6-5369-8c99-4bb6ae19b036'

afterEach(() => {
  cleanup()
  useAskOlumiStore.setState({ isOpen: false, parameters: undefined, draft: '', context: '' })
  useGuidanceStore.setState({ _dispatchAction: null, _sendMessage: null })
})

describe('the parameters survive the drawer dispatch, by value', () => {
  beforeEach(() => {
    useGuidanceStore.setState({ _sendMessage: null })
  })

  it('dispatches the exact parameters object it was opened with', () => {
    const dispatch = vi.fn()
    useGuidanceStore.setState({ _dispatchAction: dispatch })

    openAskOlumi({
      context: 'Anchoring: the three-month launch is treated as fixed.',
      draft: 'Work through the anchoring finding with me.',
      label: 'Work through with Olumi',
      parameters: { block_id: BLOCK_UUID },
      source: 'chip',
    })

    render(<AskOlumiDrawer />)
    fireEvent.click(screen.getByText('Send'))

    expect(dispatch).toHaveBeenCalledTimes(1)
    const sent = dispatch.mock.calls[0]![0] as { parameters?: unknown; message?: unknown }
    // BY VALUE, not by presence. `parameters: {}` must not satisfy this.
    expect(sent.parameters).toEqual({ block_id: BLOCK_UUID })
    // And the user's own words are what is sent as the message.
    expect(sent.message).toBe('Work through the anchoring finding with me.')
  })

  it('sends the user’s EDITED words, with the parameters unchanged', () => {
    // The two must not be coupled: editing the text must not drop the id, and
    // carrying the id must not overwrite what the person wrote.
    const dispatch = vi.fn()
    useGuidanceStore.setState({ _dispatchAction: dispatch })

    openAskOlumi({
      context: 'Anchoring',
      draft: 'seed',
      label: 'Work through with Olumi',
      parameters: { block_id: BLOCK_UUID },
    })
    render(<AskOlumiDrawer />)
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Is the deadline actually negotiable?' },
    })
    fireEvent.click(screen.getByText('Send'))

    const sent = dispatch.mock.calls[0]![0] as { parameters?: unknown; message?: unknown }
    expect(sent.message).toBe('Is the deadline actually negotiable?')
    expect(sent.parameters).toEqual({ block_id: BLOCK_UUID })
  })

  it('CONTRAST: an ask opened with no parameters dispatches none', () => {
    // Without this the assertions above could hold on a component that
    // fabricated a parameters object (trap 13 — an absence needs a presence).
    const dispatch = vi.fn()
    useGuidanceStore.setState({ _dispatchAction: dispatch })

    openAskOlumi({ context: 'c', draft: 'd', label: 'l' })
    render(<AskOlumiDrawer />)
    fireEvent.click(screen.getByText('Send'))

    const sent = dispatch.mock.calls[0]![0] as { parameters?: unknown }
    expect(sent.parameters).toBeUndefined()
  })
})

describe('the id the drawer carries is the producer’s, not the UI’s', () => {
  it('keeps the raw block id in parameters while the recommendation id is prefixed', () => {
    // Driven through the REAL builders, because this is the claim I made to
    // Coaching and their resolver is being written against it.
    const item = toStrengthenPhase3Item({
      item_id: BLOCK_UUID,
      title: 'A load-bearing assumption',
      detail: 'Your model leans on this and nothing has tested it.',
      primary_action: { type: 'discuss' },
      actionLabel: 'Work through with Olumi',
      targetIds: [],
      priority: 1,
    } as never)

    const recs = buildRecommendations({
      goalThreshold: null,
      analysisComplete: true,
      hasLeadingOption: true,
      flipThresholds: null,
      fragileEdges: [],
      factors: [],
      robustness: { status: null, level: null },
      biasFindingTypes: [],
      phase3Items: [item],
    } as never)

    const rec = recs.find((r) => r.id.startsWith('strengthen:phase3:'))
    expect(rec, 'the phase-3 recommendation must exist, or this proves nothing').toBeDefined()
    expect(rec!.id).toBe(`strengthen:phase3:${BLOCK_UUID}`)
    // ⭐ THE DISCRIMINATION: the carried id is the RAW producer id. If these
    // ever collapse onto one value, Coaching's resolver silently misses.
    expect(rec!.action.parameters).toEqual({ block_id: BLOCK_UUID })
    expect(rec!.action.parameters).not.toEqual({ block_id: rec!.id })
  })
})
