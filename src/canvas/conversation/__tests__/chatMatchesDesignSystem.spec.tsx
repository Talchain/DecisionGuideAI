/**
 * The chat panel matches Olumi Design System v5 where the build had drifted
 * (Paul, 26 Sep 2026, from the Chat Atlas review: "fix the differences where
 * the build doesn't match the design").
 *
 * DS v5 §21 is still the chat authority: the AI panel proposal v3.1 §14 keeps
 * "all block rendering, message styling, block states (DS v5 §21)" unchanged.
 * One arm per difference, each bound to the component's own test id.
 *
 * NOT covered here, deliberately:
 *   - the analysis result card (UI #2118 owns `V5AnalysisResultBlock`);
 *   - evidence severity colours (the #1450 severity channel keeps one warning
 *     visible among routine cards; forcing §21.2's info would undo that);
 *   - §20's `border-l-2` disclosure (Paul's rule: no single-line borders).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ChatThread } from '../zones/ChatThread'
import { SuggestedChips } from '../zones/SuggestedChips'
import { InlineBlocks } from '../InlineBlocks'
import { V5HeldProposalBlock } from '../../../v5/blocks/V5HeldProposalBlock'
import { V5UnsupportedBlock } from '../../../v5/blocks/V5UnsupportedBlock'
import type {
  ActionChip,
  ConversationMessage,
  V5ComparisonBlock,
  V5GraphPatchBlock,
  V5HeldProposalBlock as V5HeldProposalBlockType,
} from '../types'

vi.mock('../../store', () => {
  const state = {
    nodes: [] as Array<{ id: string }>,
    edges: [],
    selectNodeWithoutHistory: vi.fn(),
    selectNodes: vi.fn(),
    setShowInspectorPanel: vi.fn(),
    setHighlightedNodes: vi.fn(),
    setHighlightedEdges: vi.fn(),
  }
  return {
    useCanvasStore: Object.assign(
      (selector: (s: unknown) => unknown) => selector(state),
      { getState: () => state, setState: vi.fn(), subscribe: vi.fn() },
    ),
  }
})

vi.mock('../../../stores/uiStore', () => ({
  useUIStore: Object.assign(
    (selector: (s: unknown) => unknown) => selector({}),
    { getState: () => ({ setActiveOutputTab: vi.fn() }), setState: vi.fn() },
  ),
}))

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const noop = vi.fn().mockResolvedValue(undefined)

function cssRule(selector: string): string {
  const css = readFileSync(join(__dirname, '..', 'Conversation.module.css'), 'utf8')
  const start = css.indexOf(`\n${selector} {`)
  expect(start, `${selector} rule exists`).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('}', start))
}

describe('§21.1 the user message sits on the right', () => {
  // ChatMessage wraps every message in a BLOCK div, where `align-self` does
  // nothing. A block box of its own width, pushed right, is what moves it.
  it('the user bubble is a fit-content box pushed right, not align-self alone', () => {
    const rule = cssRule('.messageBubbleUser')
    expect(rule).toMatch(/width:\s*fit-content/)
    expect(rule).toMatch(/margin-left:\s*auto/)
  })

  it('the assistant bubble is untouched: left, no background', () => {
    const rule = cssRule('.messageBubbleAssistant')
    expect(rule).not.toMatch(/margin-left:\s*auto/)
    expect(rule).toMatch(/background:\s*transparent/)
  })
})

describe('§21.3 thinking is three pulsing info dots', () => {
  it('the chat thread shows three text-info dots and no node shapes while a turn is in flight', () => {
    const messages: ConversationMessage[] = [
      { id: 'u1', role: 'user', content: 'Should we raise the price?', timestamp: new Date() },
    ]
    render(
      <ChatThread
        messages={messages}
        isThinking={true}
        longRunningHint={null}
        nodeCount={3}
        patchBlockStates={new Map()}
        patchRejections={new Map()}
        onChipClick={noop}
        onPatchAccept={vi.fn()}
        onPatchDismiss={vi.fn()}
        onFeedback={vi.fn()}
        onRetry={vi.fn()}
      />,
    )
    const indicator = screen.getByTestId('thinking-indicator')
    const dots = within(indicator).getAllByTestId('thinking-dot')
    expect(dots).toHaveLength(3)
    for (const dot of dots) expect(dot.className).toMatch(/\bbg-info\b/)
    expect(indicator.querySelector('svg')).toBeNull()
    // The words stay for screen readers and for the long-running hint.
    expect(within(indicator).getByText(/Thinking/)).toBeInTheDocument()
  })
})

describe('§21.2 Accept is the filled primary action', () => {
  const approve: ActionChip = {
    id: 'agent-approve-proposal:prop_6cecb570acfa504b598e863118f788c2',
    label: 'Record these 2 levels',
    intent: 'primary',
    prompt: 'Record these 2 levels',
  }
  const amend: ActionChip = { id: 'agent-amend-proposal', label: 'Change something first', intent: 'secondary', prompt: 'Change something first' }
  const run: ActionChip = { id: 'agent-run-analysis', label: 'Run analysis', intent: 'primary', prompt: 'Run the analysis' }

  it('the consent chip is filled; its amend partner and other chips stay outlined', () => {
    render(<SuggestedChips chips={[approve, amend]} onChipClick={noop} />)
    const yes = screen.getByTestId(`suggested-chip-${approve.id}`)
    const change = screen.getByTestId('suggested-chip-agent-amend-proposal')
    expect(yes.className).toMatch(/\bbg-primary\b/)
    expect(yes.className).toMatch(/\btext-text-on-color\b/)
    expect(change.className).not.toMatch(/\bbg-primary\b/)
    expect(change.className).toMatch(/\bbg-panel\b/)
  })

  it('a chip that is not a consent chip is never filled, whatever its intent', () => {
    render(<SuggestedChips chips={[run]} onChipClick={noop} />)
    expect(screen.getByTestId('suggested-chip-agent-run-analysis').className).not.toMatch(/\bbg-primary\b/)
  })

  it('held proposal: Continue is filled, "Not now" is a quiet text link', () => {
    const block: V5HeldProposalBlockType = {
      type: 'v5_held_proposal',
      proposal_id: 'gmh_ab12cd34ef56',
      summary: 'Add a "regulatory delay" risk feeding into Launch on time',
      mutation_class: 'structural',
      reason_code: 'STRUCTURAL_APPLY_HELD',
      confirm: { label: 'Continue with this change', message: 'Yes' },
    }
    render(<V5HeldProposalBlock block={block} />)
    const confirm = screen.getByTestId('v5-held-proposal-confirm')
    const dismiss = screen.getByTestId('v5-held-proposal-dismiss')
    expect(confirm.className).toMatch(/\bbg-primary\b/)
    expect(dismiss.className).not.toMatch(/\bbg-primary\b/)
    expect(dismiss.className).not.toMatch(/\brounded-full\b/)
    expect(dismiss.className).toMatch(/\btext-text-light\b/)
    expect(dismiss.className).toMatch(/\bunderline\b/)
  })
})

describe('§21.2 type colour on the model-change and comparison cards', () => {
  it('a model change card carries the goal colour: complete border and dot', () => {
    const block: V5GraphPatchBlock = {
      type: 'v5_graph_patch',
      status: 'applied',
      operation: 'set_factor_value',
      target_id: 'fac_friction',
      before: { value: 0.8 },
      after: { value: 0.65 },
    }
    render(<InlineBlocks blocks={[block]} />)
    expect(screen.getByTestId('v5-change-receipt').className).toMatch(/\bborder-goal\/30\b/)
    expect(screen.getByTestId('block-badge-dot').className).toMatch(/blockBadgeDotGoal/)
  })

  it('a comparison card carries the option colour: complete border and dot', () => {
    const block: V5ComparisonBlock = {
      type: 'v5_comparison',
      narrative: 'How the two options compare on the goal.',
      options: [
        { option_id: 'opt_london', label: 'Hire in London', win_probability: 0.62 },
        { option_id: 'opt_remote', label: 'Hire remotely', win_probability: 0.38 },
      ],
    } as V5ComparisonBlock
    render(<InlineBlocks blocks={[block]} />)
    expect(screen.getByTestId('v5-comparison').className).toMatch(/\bborder-option\/30\b/)
    expect(screen.getByTestId('block-badge-dot').className).toMatch(/blockBadgeDotOption/)
  })
})

describe('§17.6 an unsupported block is neutral, with the Info icon', () => {
  it('shows a text-light Info icon and keeps the plain-English copy', () => {
    render(<V5UnsupportedBlock block={{ type: 'v5_unsupported', blockType: 'future_block', raw: {} }} />)
    const card = screen.getByTestId('v5-unsupported-block')
    const icon = card.querySelector('svg')
    expect(icon).not.toBeNull()
    expect(icon!.getAttribute('class') ?? '').toMatch(/\btext-text-light\b/)
    expect(card.className).toMatch(/\bborder-panel-border\b/)
    expect(card.textContent).toMatch(/can.t display this part of the response yet/)
  })
})
