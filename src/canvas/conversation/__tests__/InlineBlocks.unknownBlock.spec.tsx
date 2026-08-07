/**
 * Seamlessness R7 — unknown block kinds get a VISIBLE fallback card.
 *
 * Schema-version skew is the platform's documented #1 hazard: a consumer on
 * an older schema silently drops content it doesn't know, which presents as
 * the AI saying less than it said. The InlineBlocks default branch used to
 * `return null` (verified absence A13) — it must now render the honest
 * "can't display this part" card while KEEPING the existing telemetry
 * (event name unchanged — dashboards depend on it; it now means "unknown
 * block type, fallback card shown").
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'

const { trackEventMock } = vi.hoisted(() => ({ trackEventMock: vi.fn() }))
vi.mock('../../../lib/posthog', () => ({
  trackEvent: trackEventMock,
}))

import { InlineBlocks } from '../InlineBlocks'
import type { ConversationBlock } from '../types'

const unknownBlock = (type: string): ConversationBlock =>
  ({ type, some_field: 'from a newer CEE' }) as unknown as ConversationBlock

beforeEach(() => {
  trackEventMock.mockClear()
})

describe('InlineBlocks — unknown block kinds (R7)', () => {
  it('renders the fallback card instead of silently dropping the block', () => {
    render(<InlineBlocks blocks={[unknownBlock('shiny_new_kind')]} />)
    const card = screen.getByTestId('v5-unsupported-block')
    expect(card).toHaveAttribute('data-block-type', 'shiny_new_kind')
  })

  it('the card copy is honest user-facing language about the app version', () => {
    render(<InlineBlocks blocks={[unknownBlock('another_new_kind')]} />)
    const card = screen.getByTestId('v5-unsupported-block')
    expect(card.textContent).toMatch(/can.t display/i)
    expect(card.textContent).toMatch(/app version/i)
  })

  it('keeps the existing telemetry, once per unknown type', () => {
    render(
      <InlineBlocks
        blocks={[unknownBlock('telemetry_kind_a'), unknownBlock('telemetry_kind_a')]}
      />,
    )
    const calls = trackEventMock.mock.calls.filter(
      (c) => c[0] === 'unknown_block_type_suppressed' && c[1]?.block_type === 'telemetry_kind_a',
    )
    expect(calls).toHaveLength(1)
  })

  it('renders one card per unknown block, and known blocks are unaffected', () => {
    render(
      <InlineBlocks
        blocks={[
          unknownBlock('kind_x'),
          unknownBlock('kind_y'),
          { type: 'v5_unsupported', blockType: 'wrapped_by_mapper', raw: {} } as unknown as ConversationBlock,
        ]}
      />,
    )
    expect(screen.getAllByTestId('v5-unsupported-block')).toHaveLength(3)
  })
})
