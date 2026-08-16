import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ModelBuildingNotices } from '@talchain/schemas/boundary'

// MessageBubble imports the conversation module, whose persistence services
// depend on this binding even though this display-only spec never calls them.
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }),
    }),
  },
  isSupabaseAvailable: () => false,
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

import { MessageBubble } from '../MessageBubble'
import { ModelBuildingNoticesStrip } from '../ModelBuildingNoticesStrip'
import type { ConversationMessage } from '../types'

const ALL_NOTICES: ModelBuildingNotices = {
  total_count: 9,
  groups: [
    { kind: 'detail_not_connected', count: 1 },
    { kind: 'relationship_not_used', count: 2 },
    { kind: 'alternative_consolidated', count: 1 },
    { kind: 'conflict_resolved_conservatively', count: 2 },
    { kind: 'target_not_modelled_as_threshold', count: 1 },
    { kind: 'other', count: 2 },
  ],
  details_redacted: true,
}

const noop = async () => {}

describe('ModelBuildingNoticesStrip', () => {
  it('renders compact grouped neutral copy with an accessible note label and no actions', () => {
    render(<ModelBuildingNoticesStrip notices={ALL_NOTICES} />)

    const strip = screen.getByRole('note', { name: 'Model-building notices' })
    expect(strip.textContent).toContain('9 modelling choices noted')
    expect(strip.textContent).toContain('1 detail not connected')
    expect(strip.textContent).toContain('2 relationships not used')
    expect(strip.textContent).toContain('1 alternative consolidated')
    expect(strip.textContent).toContain('2 conflicts handled conservatively')
    expect(strip.textContent).toContain('1 target not modelled as a threshold')
    expect(strip.textContent).toContain('2 other modelling choices')
    expect(strip.textContent).toContain('Details are not shown.')
    expect(strip.querySelector('button')).toBeNull()
    expect(strip.querySelector('a')).toBeNull()
  })

  it('uses concise wrap-safe group copy and never exposes enum tokens', () => {
    render(<ModelBuildingNoticesStrip notices={ALL_NOTICES} />)

    const groups = screen.getByRole('list', { name: 'Grouped model-building notices' })
    const rows = Array.from(groups.querySelectorAll('li'))
    expect(rows).toHaveLength(6)
    for (const row of rows) {
      expect((row.textContent ?? '').length).toBeLessThan(48)
    }
    expect(groups.textContent).not.toContain('detail_not_connected')
    expect(groups.textContent).not.toContain('conflict_resolved_conservatively')
  })

  it('does not traverse drifted detail fields or render sensitive-looking values', () => {
    const drifted = {
      ...ALL_NOTICES,
      label: 'SECRET_LABEL',
      raw_reason: 'because you said this was true',
      groups: ALL_NOTICES.groups.map((group, index) =>
        index === 0
          ? { ...group, node_id: 'fac_margin', value: '£250,000' }
          : group,
      ),
    } as ModelBuildingNotices

    render(<ModelBuildingNoticesStrip notices={drifted} />)
    const text = screen.getByTestId('model-building-notices').textContent ?? ''
    for (const forbidden of [
      'SECRET_LABEL',
      'you said',
      'fac_margin',
      '£250,000',
      'raw_reason',
    ]) {
      expect(text).not.toContain(forbidden)
    }
  })

  it('renders nothing without the literal redaction attestation', () => {
    const invalid = { ...ALL_NOTICES, details_redacted: false } as unknown as ModelBuildingNotices
    const { container } = render(<ModelBuildingNoticesStrip notices={invalid} />)
    expect(container.innerHTML).toBe('')
  })

  it('is assistant-only, absent means no DOM, and the strip sits after text before blocks', () => {
    const base: ConversationMessage = {
      id: 'assistant-1',
      role: 'assistant',
      content: 'A first model is ready.',
      blocks: [{ type: 'commentary', text: 'A compact block.' }],
      modelBuildingNotices: ALL_NOTICES,
      timestamp: new Date('2026-08-16T09:00:00Z'),
    }
    const { rerender } = render(<MessageBubble message={base} onChipClick={noop} />)

    const bubble = screen.getByTestId('message-assistant')
    const notice = screen.getByTestId('model-building-notices')
    const block = screen.getByTestId('block-container')
    const text = bubble.firstElementChild
    expect(text?.textContent).toContain('A first model is ready.')
    expect(text).not.toBeNull()
    expect(text!.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(notice.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    rerender(<MessageBubble message={{ ...base, modelBuildingNotices: undefined }} onChipClick={noop} />)
    expect(screen.queryByTestId('model-building-notices')).toBeNull()

    rerender(
      <MessageBubble
        message={{ ...base, role: 'user', modelBuildingNotices: ALL_NOTICES }}
        onChipClick={noop}
      />,
    )
    expect(screen.queryByTestId('model-building-notices')).toBeNull()
  })
})
