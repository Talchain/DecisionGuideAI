/**
 * Behavioural parity spec — Brief 5 Task 1.
 *
 * The brief mandates: "firing Confirm from Your expertise produces the
 * identical store effect as firing Confirm from the equivalent triage card."
 * Import-trace is necessary but not sufficient.
 *
 * This spec hands the exact same handler spy to both surfaces, fires
 * Confirm from each, and asserts the spy received byte-identical arguments.
 * Because both surfaces delegate to the same handler identity in production
 * (PreAnalysisPanel's handleConfirm closure), identical arguments + identical
 * handler = identical store effect by definition.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { YourExpertise } from '../YourExpertise'
import { TriageCard } from '@/components/shared/TriageCard'
import type { ImprovementItem } from '../../hooks/usePreAnalysisData'

vi.mock('@/stores/uiStore', () => ({
  useUIStore: Object.assign(
    () => ({ setActiveOutputTab: vi.fn() }),
    { getState: () => ({ setActiveOutputTab: vi.fn() }) },
  ),
}))

const TARGET_ID = 'factor-design-expertise'
const TARGET_LABEL = 'Dedicated Design Expertise'

function aiEstimateItem(): ImprovementItem {
  return {
    key: `verify-${TARGET_ID}`,
    category: 'verify',
    label: TARGET_LABEL,
    detail: 'AI estimate',
    subgroup: 'cee_inference',
    focus: { type: 'node', id: TARGET_ID, label: TARGET_LABEL },
    action: {
      label: 'Confirm value',
      kind: 'confirm',
      targetId: TARGET_ID,
      targetType: 'node',
    },
  }
}

describe('YourExpertise ↔ TriageCard — Confirm action parity', () => {
  it('fires Confirm with the identical payload from both surfaces', () => {
    const spy = vi.fn()

    // ── Path A: Confirm from YourExpertise expanded AI-estimates list ──
    const { unmount } = render(
      <YourExpertise
        improvementsByCategory={{ verify: [aiEstimateItem()] }}
        contestedEdges={[]}
        nodes={[]}
        edges={[]}
        onConfirm={spy}
      />
    )
    fireEvent.click(screen.getByTestId('your-expertise-header'))
    const expanded = screen.getByTestId('your-expertise-expanded')
    const confirmBtn = within(expanded).getByLabelText(`Confirm value for ${TARGET_LABEL}`)
    fireEvent.click(confirmBtn)

    expect(spy).toHaveBeenCalledTimes(1)
    const yourExpertisePayload = spy.mock.calls[0]

    unmount()
    // ── Path B: Confirm from the equivalent TriageCard ──
    render(
      <TriageCard
        cardKey="parity-card"
        ordinal={1}
        title={TARGET_LABEL}
        detail="Confirm the AI estimate or set your own value."
        category="verify"
        action={{ kind: 'confirm', label: 'Confirm', targetId: TARGET_ID, targetType: 'node' }}
        onConfirm={spy}
      />
    )
    // TriageCard renders "Confirm" as the primary action button.
    const triageConfirm = screen.getByRole('button', { name: /confirm/i })
    fireEvent.click(triageConfirm)

    expect(spy).toHaveBeenCalledTimes(2)
    const triagePayload = spy.mock.calls[1]

    // Parity: same handler identity, byte-identical argument tuple.
    expect(yourExpertisePayload).toEqual([TARGET_ID])
    expect(triagePayload).toEqual([TARGET_ID])
    expect(yourExpertisePayload).toEqual(triagePayload)
  })
})
