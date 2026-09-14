/**
 * The option panel's "Ask Olumi" prompt — no ranking, no race, a real question.
 *
 * ⭐ WHAT THIS PINS, AND WHY IT IS A PROPERTY TEST RATHER THAN A STRING PIN.
 * The shipped prompt for an option node was *"How does {label} compare to the
 * other options?"* — a request for a comparison between options, which is the
 * race framing Paul has ruled out repeatedly ("never a winner; the three
 * legitimate questions are the most likely outcome, the range of uncertainty,
 * and what would change the answer"). Pinning the replacement sentence verbatim
 * would stop the NEXT edit from being reworded, not from re-introducing the
 * defect. So these assert the PROPERTIES the ruling is about, and a reword that
 * keeps them passes.
 *
 * ⚠ THE LEXICON GUARD HAS ITS OWN POSITIVE CONTROL (trap 13). An "absent from
 * this string" assertion is vacuous unless the pattern is shown to SEE the
 * language it bans, so the first test feeds it the exact sentence that used to
 * ship and requires a hit. Without that, a typo in the pattern would leave the
 * whole file green while banning nothing.
 *
 * ⚠ BOUND BY IDENTITY, NOT BY A VALUE PREDICATE (trap 19). The render test
 * clicks `inspector-quick-ask` — the exact testid of the option panel's own ask
 * button — and reads the text that reached `_prefillChat`. It does not search
 * the DOM for "a button containing a question", which a neighbouring control
 * could satisfy.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { InspectorQuickActions } from '../InspectorQuickActions'
import { ASK_TEMPLATES, resolveAskTemplate } from '../../inspectorStrings'
import { useGuidanceStore } from '../../../../stores/guidanceStore'

vi.mock('../../../../conversation/revealOlumi', () => ({
  revealOlumiSurface: vi.fn(),
}))

/**
 * Language that asks the product to rank options against one another, or to
 * name a winner. Paul's standing ruling: the product is not entitled to state
 * that conclusion, so an affordance must not ask for it on the user's behalf.
 */
const RANKING_LEXICON =
  /\b(compares?|compared|comparing|comparison|versus|vs\.?|winner|wins?|winning|beats?|outperforms?|ranks?|ranked|ranking|best|better|superior|which one)\b/i

/** The user is the author and the decision-maker — the ask must address them. */
const FIRST_PERSON = /\b(I|me|my|mine|we|us|our)\b/

const OPTION_LABEL = 'Pilot in Germany'

beforeEach(() => {
  vi.clearAllMocks()
  useGuidanceStore.setState({
    _sendMessage: null,
    _prefillChat: null,
    _dispatchAction: null,
  } as never)
})

describe('the instrument itself', () => {
  it('POSITIVE CONTROL — the lexicon sees the ranking sentence that used to ship', () => {
    expect(RANKING_LEXICON.test('How does Pilot in Germany compare to the other options?')).toBe(true)
  })

  it('POSITIVE CONTROL — the first-person pattern can fail', () => {
    expect(FIRST_PERSON.test('What drives this the most?')).toBe(false)
  })
})

describe('ASK_TEMPLATES.option — the sentence the option panel asks on the user’s behalf', () => {
  const template = ASK_TEMPLATES.option

  it('names the clicked element', () => {
    expect(template).toContain('{label}')
  })

  it('asks a question', () => {
    expect(template).toContain('?')
  })

  it('does not ask the product to rank this option against the others', () => {
    expect(template).not.toMatch(RANKING_LEXICON)
  })

  it('invites the user’s own judgement rather than substituting for it', () => {
    expect(template).toMatch(FIRST_PERSON)
  })

  it('resolves with the element label substituted in', () => {
    const resolved = resolveAskTemplate('option', { label: OPTION_LABEL })
    expect(resolved).toContain(OPTION_LABEL)
    expect(resolved).not.toMatch(RANKING_LEXICON)
  })
})

describe('the option panel’s Ask Olumi button — the live path', () => {
  it('prefills a question that names the option and asks for no ranking', () => {
    const prefill = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefill } as never)

    render(
      <InspectorQuickActions
        elementId="opt-de-1"
        elementLabel={OPTION_LABEL}
        panelType="option"
      />,
    )

    fireEvent.click(screen.getByTestId('inspector-quick-ask'))

    expect(prefill).toHaveBeenCalledTimes(1)
    const sent = prefill.mock.calls[0][0] as string
    expect(sent).toContain(OPTION_LABEL)
    expect(sent).toContain('?')
    expect(sent).not.toMatch(RANKING_LEXICON)
    expect(sent).toMatch(FIRST_PERSON)
  })
})
