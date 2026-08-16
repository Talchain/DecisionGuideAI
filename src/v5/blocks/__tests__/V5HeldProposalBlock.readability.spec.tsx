/**
 * The confirm card — readability and typed dispatch (scoreboard Q3, L-59).
 *
 * Measured on 16 Aug at UI `f15bccaf`: the held-changes card "restates all 6
 * ops in one paragraph with the same 70-character option name repeated five
 * times, each truncated mid-word ... A user confirming a structural change
 * cannot skim what they are confirming." And separately: the product's own
 * inline action came back with "You did not ask me to edit the model, so I have
 * not" — the signature of an UNTYPED chip click.
 *
 * Scope honesty, stated because it bounds every claim below: the mid-word `…`
 * is in the PRODUCER's bytes (CEE clamps names before it composes the summary).
 * The UI can render what it is given without clipping it further, stop
 * repeating it, and stop losing the producer's typed intent. It cannot
 * reconstruct a name the producer truncated, and does not pretend to.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { V5HeldProposalBlock } from '../V5HeldProposalBlock'
import { useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import type { V5HeldProposalBlock as V5HeldProposalBlockType } from '../../../canvas/conversation/types'

function block(over: Partial<V5HeldProposalBlockType> = {}): V5HeldProposalBlockType {
  return {
    type: 'v5_held_proposal',
    proposal_id: 'gmh_1',
    summary: 'Add option A',
    mutation_class: 'structural',
    reason_code: 'STRUCTURAL_APPLY_HELD',
    confirm: { label: 'Confirm these changes', message: 'confirm gmh_1' },
    ...over,
  } as V5HeldProposalBlockType
}

beforeEach(() => {
  useGuidanceStore.setState({ _sendChip: vi.fn() } as never)
})

describe('naming each change once', () => {
  it('renders a multi-change plan as a LIST, one change per row', () => {
    const summary = [
      'add option Hire 2 Mid-Level Engineers Plus a Sales Engineer (Under £...',
      'add factor Sales Engineering Capacity',
      'link Sales Engineering Capacity to Throughput of Convertible Leads',
    ].join('\n')
    render(<V5HeldProposalBlock block={block({ summary })} />)

    const list = screen.getByTestId('v5-held-proposal-summary')
    expect(list.tagName).toBe('UL')
    expect(list.getAttribute('data-consent-line-count')).toBe('3')
    expect(screen.getAllByTestId(/v5-held-proposal-summary-line-/)).toHaveLength(3)
  })

  it('states a line the producer emitted TWICE exactly once', () => {
    const repeated = 'add option Hire 2 Mid-Level Engineers (Under £...'
    const summary = [repeated, 'add factor Sales Engineering Capacity', repeated].join('\n')
    render(<V5HeldProposalBlock block={block({ summary })} />)
    expect(screen.getByTestId('v5-held-proposal-summary').getAttribute('data-consent-line-count')).toBe('2')
  })

  it('OPPOSITE TWIN — a single-line summary renders as a paragraph, verbatim', () => {
    // The change must be invisible for every producer that did not delimit.
    const summary = 'Add a constraint keeping the budget at or below £250,000.'
    render(<V5HeldProposalBlock block={block({ summary })} />)
    const p = screen.getByTestId('v5-held-proposal-summary')
    expect(p.tagName).toBe('P')
    expect(p.textContent).toBe(summary)
  })

  it('OPPOSITE TWIN — two DIFFERENT lines both survive', () => {
    const summary = 'add option A\nadd option B'
    render(<V5HeldProposalBlock block={block({ summary })} />)
    const rows = screen.getAllByTestId(/v5-held-proposal-summary-line-/)
    expect(rows.map((r) => r.textContent)).toEqual(['add option A', 'add option B'])
  })

  it('wraps rather than truncates — no clipping class anywhere on the summary', () => {
    // jsdom cannot prove wrapping (trap 3). It CAN prove the class that clips
    // is absent and the class that wraps is present, which is the whole of the
    // UI's contribution to "wrap, not truncate".
    render(<V5HeldProposalBlock block={block({ summary: 'add option A\nadd option B' })} />)
    const list = screen.getByTestId('v5-held-proposal-summary')
    expect(list.className).toContain('break-words')
    expect(list.className).not.toContain('truncate')
  })
})

describe('L-59 — the inline action dispatches TYPED, not as bare text', () => {
  it('forwards the producer action_type on confirm', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip } as never)
    render(
      <V5HeldProposalBlock
        block={block({
          confirm: {
            label: 'Confirm these changes',
            message: 'confirm gmh_1',
            action_type: 'add_constraint',
          },
        })}
      />,
    )
    fireEvent.click(screen.getByTestId('v5-held-proposal-confirm'))
    expect(sendChip).toHaveBeenCalledWith('Confirm these changes', 'confirm gmh_1', {
      action_type: 'add_constraint',
    })
  })

  it('forwards the producer action_type on decline', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip } as never)
    render(
      <V5HeldProposalBlock
        block={block({
          decline: { label: 'Not now', message: 'decline gmh_1', action_type: 'add_constraint' },
        })}
      />,
    )
    fireEvent.click(screen.getByTestId('v5-held-proposal-dismiss'))
    expect(sendChip).toHaveBeenCalledWith('Not now', 'decline gmh_1', {
      action_type: 'add_constraint',
    })
  })

  it('OPPOSITE TWIN — omits the meta entirely when the producer declared none', () => {
    // The UI never AUTHORS a type. No producer type ⇒ exactly today's turn.
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip } as never)
    render(<V5HeldProposalBlock block={block()} />)
    fireEvent.click(screen.getByTestId('v5-held-proposal-confirm'))
    expect(sendChip).toHaveBeenCalledWith('Confirm these changes', 'confirm gmh_1', undefined)
  })
})
