/**
 * The bias check as one more icon in the action bar's row (Paul, 14 Oct 2026: icon-only row; bias is an icon that asks
 * Olumi to explain and counter it). ⛔ EXPECTATION CHANGED: the old "Check for:" disclosure and its expanded card
 * (why sentence, science claim, an offer press) are gone; a press now sends ONE `discuss` chip turn about that bias.
 * Rows are bound by identity: the claim id in each control's test id, and the exact words the fixture's bias carries.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGuidanceStore } from '../../../stores/guidanceStore'
import { ASK_BUSY_NOTICE } from '../../askAi'
import { ACTION_BAR_COPY, ActionBar } from '../ActionBar'
import { BiasRiskIcons } from '../BiasRiskRow'
import { parseActionBar, type ActionBarV1, type ActionOffer } from '../actionBarContract'
import { parseBiasRisk } from '../biasRiskContract'
import { EXAMPLE_BAR, MORE_OPTIONS, REVIEW } from './actionBarContractExample'

vi.mock('../../revealOlumi', () => ({ revealOlumiSurface: vi.fn() }))

const WIDEN: ActionOffer = { ...MORE_OPTIONS, group: 'gap', offer_key: '238eb45e85c31ecf' }
const ANCHOR: ActionOffer = { ...REVIEW, group: 'review', label: 'Check estimate', press_id: 'act:bias_anchoring', offer_key: 'be2a321235e1a126' }
const NARROW_WHY = 'These options all work through the same lever, which can hide better routes.'
const ANCHOR_WHY = 'Olumi’s starting figure for ‘Migration preparation effort’ could pull later estimates towards it.'
const view = parseBiasRisk({
  v: 1,
  items: [
    { claim_id: 'DSK-B-007', name: 'Narrow framing', why: NARROW_WHY, action_id: 'more_options', press_id: WIDEN.press_id, offer_key: WIDEN.offer_key },
    { claim_id: 'DSK-B-001', name: 'Anchoring', why: ANCHOR_WHY, action_id: 'bias_anchoring', press_id: ANCHOR.press_id, offer_key: ANCHOR.offer_key,
      science: { claim_id: 'DSK-B-001', claim_title: 'Anchoring and insufficient adjustment', evidence_strength: 'strong' } },
  ],
}, [WIDEN, ANCHOR])!

/** The exact turn each bias must send, written out by hand from the fixture's own name and why sentence. */
const ANCHOR_ASK = 'Briefly explain how anchoring could be affecting this model — Olumi’s starting figure for ‘Migration preparation effort’ could pull later estimates towards it — and suggest a few practical ways to counter it here.'
const NARROW_ASK = 'Briefly explain how narrow framing could be affecting this model — These options all work through the same lever, which can hide better routes — and suggest a few practical ways to counter it here.'
const chip = (text: string) => ({ action_type: 'discuss', label: text, message: text, source: 'chip' })

let dispatch: ReturnType<typeof vi.fn>
let onResult: ReturnType<typeof vi.fn>
let clock = Date.UTC(2026, 9, 14)

beforeEach(() => {
  // The half-second re-press clock is module-wide: every row starts a minute after the last, so no row sees another's press.
  vi.useFakeTimers({ toFake: ['Date'] })
  clock += 60_000
  vi.setSystemTime(clock)
  dispatch = vi.fn()
  onResult = vi.fn()
  useGuidanceStore.setState({ _dispatchAction: dispatch, _isConversationBusy: () => false } as never)
})

afterEach(() => {
  vi.useRealTimers()
})

const renderIcons = () => render(<BiasRiskIcons view={view} className="icon-token" onResult={onResult} />)

describe('BiasRiskIcons', () => {
  it('draws one icon per bias, in CEE’s order, named “Check for: <bias>” and showing no words', () => {
    renderIcons()
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((el) => el.getAttribute('data-testid'))).toEqual(['bias-risk-press-DSK-B-007', 'bias-risk-press-DSK-B-001'])
    expect(screen.getByTestId('bias-risk-press-DSK-B-007')).toHaveAccessibleName('Check for: Narrow framing')
    expect(screen.getByTestId('bias-risk-press-DSK-B-001')).toHaveAccessibleName('Check for: Anchoring')
    for (const button of buttons) {
      expect(button.textContent).toBe('')
      expect(button.className).toBe('icon-token') // the bar's own icon classes, so it matches its neighbours
      expect(button.querySelector('svg.lucide-scan-eye')).not.toBeNull()
    }
  })

  it('a press sends ONE discuss chip turn about THAT bias, quoting its own why sentence; ⛔ CONTRAST: the other bias sends its own', () => {
    renderIcons()
    fireEvent.click(screen.getByTestId('bias-risk-press-DSK-B-001'))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(chip(ANCHOR_ASK))
    const sent = dispatch.mock.calls[0]![0] as { message: string }
    expect(sent.message).toContain(ANCHOR_WHY.slice(0, -1))
    expect(sent.message).toContain('anchoring')
    expect(sent.message).not.toContain(NARROW_WHY.slice(0, -1))
    expect(onResult).toHaveBeenLastCalledWith('sent')

    fireEvent.click(screen.getByTestId('bias-risk-press-DSK-B-007'))
    expect(dispatch).toHaveBeenCalledTimes(2) // another bias is never dropped by the first one's clock
    expect(dispatch).toHaveBeenLastCalledWith(chip(NARROW_ASK))
  })

  it('a second press of the same bias inside half a second sends nothing more; ⛔ CONTRAST: after it, it sends again', () => {
    renderIcons()
    fireEvent.click(screen.getByTestId('bias-risk-press-DSK-B-001'))
    fireEvent.click(screen.getByTestId('bias-risk-press-DSK-B-001'))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(onResult).toHaveBeenLastCalledWith('refire')
    vi.setSystemTime(clock + 501)
    fireEvent.click(screen.getByTestId('bias-risk-press-DSK-B-001'))
    expect(dispatch).toHaveBeenCalledTimes(2)
  })

  it('while Olumi is answering, a press sends nothing and says so', () => {
    useGuidanceStore.setState({ _isConversationBusy: () => true } as never)
    const toasts: unknown[] = []
    const onToast = (e: Event) => toasts.push((e as CustomEvent).detail)
    window.addEventListener('topbar:show-toast', onToast)
    renderIcons()
    fireEvent.click(screen.getByTestId('bias-risk-press-DSK-B-001'))
    window.removeEventListener('topbar:show-toast', onToast)
    expect(dispatch).not.toHaveBeenCalled()
    expect(toasts).toEqual([{ message: ASK_BUSY_NOTICE, level: 'warning' }])
    expect(onResult).toHaveBeenLastCalledWith('busy')
  })

  it('⛔ the “Check for:” disclosure and its card are gone: no visible words, no toggle, no explanation, before or after a press', () => {
    renderIcons()
    const assertNoDisclosure = () => {
      expect(screen.queryByText(/Check for:/)).toBeNull()
      expect(screen.queryByTestId('bias-risk-toggle')).toBeNull()
      expect(screen.queryAllByTestId(/^bias-risk-item-/)).toHaveLength(0)
      expect(screen.queryByText(ANCHOR_WHY)).toBeNull()
      expect(screen.queryByText(NARROW_WHY)).toBeNull()
      expect(screen.queryByText(/Decision-science claim:/)).toBeNull()
      expect(document.querySelector('[aria-expanded]')).toBeNull()
    }
    assertNoDisclosure()
    fireEvent.click(screen.getByTestId('bias-risk-press-DSK-B-001'))
    assertNoDisclosure()
    // POSITIVE CONTROL: the probe is looking at a drawn bias row.
    expect(screen.getAllByRole('button', { name: /^Check for: / })).toHaveLength(2)
  })
})

describe('in the action bar', () => {
  const withBias = (): ActionBarV1 => parseActionBar({
    ...EXAMPLE_BAR,
    bias_risk: { v: 1, items: [{ claim_id: 'DSK-B-007', name: 'Narrow framing', why: NARROW_WHY, action_id: MORE_OPTIONS.action_id, press_id: MORE_OPTIONS.press_id, offer_key: MORE_OPTIONS.offer_key }] },
  })!

  it('the bias icon sits in the row after CEE’s icons and before ⋯, drawn like its neighbours; ⛔ no bias_risk, no bias icon', () => {
    const { unmount } = render(<ActionBar bar={withBias()} surface="chat" compact={false} />)
    const row = screen.getByTestId('action-bar').firstElementChild as HTMLElement
    const order = Array.from(row.querySelectorAll('button')).map((el) => el.getAttribute('data-testid'))
    expect(order.slice(-3)).toEqual(['action-bar-icon-pre_mortem', 'bias-risk-press-DSK-B-007', 'action-bar-more'])
    expect(screen.getByTestId('bias-risk-press-DSK-B-007').className).toBe(screen.getByTestId('action-bar-icon-review').className)
    unmount()

    render(<ActionBar bar={parseActionBar(EXAMPLE_BAR)!} surface="chat" compact={false} />)
    expect(screen.getByTestId('action-bar-icon-pre_mortem')).toBeInTheDocument() // POSITIVE CONTROL: the bar is drawn
    expect(screen.queryAllByTestId(/^bias-risk-press-/)).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /^Check for: / })).toBeNull()
  })

  it('a press sends the bias turn, never the matched offer’s own chip', () => {
    render(<ActionBar bar={withBias()} surface="chat" />)
    fireEvent.click(screen.getByTestId('bias-risk-press-DSK-B-007'))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(chip(NARROW_ASK))
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ id: MORE_OPTIONS.press_id }))
  })

  it('with no conversation mounted, a press is never dead: it says where to go', () => {
    useGuidanceStore.setState({ _dispatchAction: null } as never)
    render(<ActionBar bar={withBias()} surface="reasoning" />)
    fireEvent.click(screen.getByTestId('bias-risk-press-DSK-B-007'))
    expect(screen.getByTestId('action-bar-notice')).toHaveTextContent(ACTION_BAR_COPY.noConversation)
  })
})
