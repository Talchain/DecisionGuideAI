/**
 * Batch F (DL 12 Oct; pairs with F CEE's technique (c)): CEE carries the policy's one-sentence science basis on
 * `guidance.slot1.science`, only where it is true of the variant. The row offers a "Why?" beside its why line that opens
 * and shows that sentence VERBATIM. With no field, there is no control: the UI authors no science.
 *
 * SELF-AUTHORED science sentence (constructed, not wire): CEE's field is new in Batch F, so no served capture exists yet.
 * The row shape is the coach's contract shape, as in guidanceRow.spec.tsx.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { readGuidance } from '../guidanceRows'
import { GuidanceRows } from '../zones/GuidanceRows'
import { saveTranscript, loadTranscript, clearAllTranscripts } from '../utils/transcriptStore'
import type { ConversationMessage } from '../types'

afterEach(() => { cleanup(); clearAllTranscripts() })

const SCIENCE = 'Sizing the link that a comparison turns on reduces the uncertainty that most affects the decision (value of information).'
const ROW = {
  policy_id: 'RC-STRENGTHEN-ITEM', priority: 'P1', variant: 'S1', state_key_hash: 'skh_science',
  copy: { title: 'The comparison rests on a link nobody has sized yet.', why: "Until it is sized, Olumi can't compare the options on your goal.", question: null },
}

function mount(slot1: Record<string, unknown>) {
  const guidance = readGuidance({ guidance: { slot1 } })!
  render(<GuidanceRows guidance={guidance} />)
  return screen.getByTestId('guidance-row-slot1')
}

describe('guidance row: CEE\'s science basis behind a visible "Why?"', () => {
  it('⭐ with slot1.science: a visible "Why?" opens and shows the sentence verbatim', () => {
    const row = mount({ ...ROW, science: SCIENCE })
    const why = within(row).getByRole('button', { name: 'Why?' })
    expect(why).toBeVisible()
    expect(why).toHaveAttribute('aria-expanded', 'false')
    expect(within(row).queryByText(SCIENCE)).toBeNull()

    fireEvent.click(why)
    expect(why).toHaveAttribute('aria-expanded', 'true')
    expect(within(row).getByTestId('guidance-row-slot1-science')).toHaveTextContent(SCIENCE)
    expect(within(row).getByTestId('guidance-row-slot1-science').textContent).toBe(SCIENCE)
    expect(within(row).getByText(SCIENCE)).toBeVisible()

    fireEvent.click(why)
    expect(within(row).queryByText(SCIENCE)).toBeNull()
  })

  it('the control sits with the row\'s why line, which still says its own words', () => {
    const row = mount({ ...ROW, science: SCIENCE })
    expect(within(row).getByTestId('guidance-row-slot1-why')).toHaveTextContent(ROW.copy.why)
    expect(within(row).getByTestId('guidance-row-slot1-science-toggle')).toBe(within(row).getByRole('button', { name: 'Why?' }))
  })

  it('CONTRAST: no slot1.science, no control (and no science text)', () => {
    const row = mount(ROW)
    expect(within(row).queryByRole('button', { name: 'Why?' })).toBeNull()
    expect(within(row).queryByTestId('guidance-row-slot1-science')).toBeNull()
    expect(within(row).getByTestId('guidance-row-slot1-why')).toHaveTextContent(ROW.copy.why)
  })

  it('CONTRAST: an empty or non-string science field is no field', () => {
    for (const science of ['', '   ', 42, { text: SCIENCE }]) {
      const row = mount({ ...ROW, science })
      expect(within(row).queryByRole('button', { name: 'Why?' })).toBeNull()
      cleanup()
    }
  })

  it('the science sentence survives a transcript reload, so the reopened row still offers it', () => {
    const guidance = readGuidance({ guidance: { slot1: { ...ROW, science: SCIENCE } } })!
    const msg = { id: 'a1', role: 'assistant', content: 'x', timestamp: new Date(), guidance } as ConversationMessage
    saveTranscript('scenario-science', [msg])
    const restored = loadTranscript('scenario-science')!.messages[0] as ConversationMessage
    expect(restored.guidance?.slot1?.science).toBe(SCIENCE)
  })
})
