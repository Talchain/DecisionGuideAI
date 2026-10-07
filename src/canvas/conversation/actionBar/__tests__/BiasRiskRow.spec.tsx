import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BiasRiskRow } from '../BiasRiskRow'
import { parseBiasRisk } from '../biasRiskContract'
import { pressOffer } from '../pressOffer'
import { MORE_OPTIONS, REVIEW, REVISION } from './actionBarContractExample'

vi.mock('../pressOffer', () => ({ pressOffer: vi.fn() }))

const WIDEN = { ...MORE_OPTIONS, offer_key: '238eb45e85c31ecf' }
const ANCHOR = { ...REVIEW, label: 'Check estimate', press_id: 'act:bias_anchoring', offer_key: 'be2a321235e1a126' }
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

describe('BiasRiskRow', () => {
  beforeEach(() => vi.mocked(pressOffer).mockReset())

  it('shows one exact collapsed line, then both explanations and only the supplied science claim', () => {
    render(<BiasRiskRow view={view} revision={REVISION} type={{ body: 'body-token', meta: 'meta-token' }} />)
    const toggle = screen.getByTestId('bias-risk-toggle')
    expect(toggle).toHaveTextContent('Check for: Narrow framing · Anchoring')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(NARROW_WHY)).toBeInTheDocument()
    expect(screen.getByText(ANCHOR_WHY)).toBeInTheDocument()
    expect(screen.getByText('Decision-science claim: Anchoring and insufficient adjustment · strong evidence')).toBeInTheDocument()
    expect(screen.getByTestId('bias-risk-item-DSK-B-007')).not.toHaveTextContent('Decision-science claim:')
  })

  it('presses the identity-bound anchoring offer with this revision', () => {
    render(<BiasRiskRow view={view} revision={REVISION} type={{ body: 'body-token', meta: 'meta-token' }} />)
    fireEvent.click(screen.getByTestId('bias-risk-toggle'))
    fireEvent.click(screen.getByTestId('bias-risk-press-DSK-B-001'))
    expect(pressOffer).toHaveBeenCalledWith(ANCHOR, REVISION)
  })
})
