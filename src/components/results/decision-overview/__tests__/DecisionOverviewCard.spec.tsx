/**
 * Wave 1 (Analysis-tab rebuild) — Decision overview card (brief §4).
 *
 * Orientation surface: framing quality + one framing question + the
 * persistent Actions menu. Four-state machine designed; only ready and
 * needs-input are reachable LIVE (analysis_ready.status). Thin /
 * contradictory / unverified exist in code + copy but are reachable only
 * via stateOverride (fixture gallery) — no dark product mounts (plan review
 * B3). No classification pills anywhere (deferred to Wave 5).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { DecisionOverviewCard } from '../DecisionOverviewCard'
import { useCanvasStore } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'

function flagOn() {
  localStorage.setItem('feature.decisionOverview', '1')
}

const READY = { status: 'ready', options: [{ id: 'o1' }], goal_node_id: 'g1' }
const NEEDS_INPUT = {
  status: 'needs_user_input',
  options: [],
  goal_node_id: 'g1',
  user_questions: ['What does success look like?', 'Which options are realistic?', 'Q3', 'Q4'],
}

beforeEach(() => {
  localStorage.clear()
  useCanvasStore.setState({ ceeAnalysisReady: null } as never)
  useGuidanceStore.setState({ guidanceItems: [], _sendMessage: null } as never)
})

describe('DecisionOverviewCard — flag gate', () => {
  it('renders NOTHING when the flag is off (byte-identical pin)', () => {
    useCanvasStore.setState({ ceeAnalysisReady: READY } as never)
    const { container } = render(<DecisionOverviewCard title="Launch decision" />)
    expect(container.firstChild).toBeNull()
  })
})

describe('DecisionOverviewCard — ready state (live)', () => {
  beforeEach(() => {
    flagOn()
    useCanvasStore.setState({ ceeAnalysisReady: READY } as never)
  })

  it('collapsed and quiet: meta label, title, framing-has-the-basics line', () => {
    render(<DecisionOverviewCard title="Launch decision" />)
    expect(screen.getByText('Decision overview')).toBeInTheDocument()
    expect(screen.getByText('Launch decision')).toBeInTheDocument()
    expect(screen.getByText('Framing has the basics')).toBeInTheDocument()
    // Collapsed by default: dimension chips hidden until expanded.
    expect(screen.queryByText('Constraints')).not.toBeInTheDocument()
    const bar = screen.getByTestId('brief-bar')
    expect(bar.tagName).toBe('BUTTON')
    expect(bar).toHaveAttribute('aria-expanded', 'false')
  })

  it('expands to the four canonical dimensions (Goal, Context, Constraints, Options)', () => {
    render(<DecisionOverviewCard title="Launch decision" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    expect(screen.getByTestId('brief-bar')).toHaveAttribute('aria-expanded', 'true')
    for (const dim of ['Goal', 'Context', 'Constraints', 'Options']) {
      expect(screen.getByText(dim)).toBeInTheDocument()
    }
  })

  it('never says "good framing" or implies objective correctness', () => {
    render(<DecisionOverviewCard title="t" />)
    expect(screen.queryByText(/good framing|good enough/i)).not.toBeInTheDocument()
  })
})

describe('DecisionOverviewCard — needs-input state (live)', () => {
  beforeEach(() => {
    flagOn()
    useCanvasStore.setState({ ceeAnalysisReady: NEEDS_INPUT } as never)
  })

  it('auto-expands and shows at most three focused questions', () => {
    render(<DecisionOverviewCard title="t" />)
    expect(screen.getByTestId('brief-bar')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('What does success look like?')).toBeInTheDocument()
    expect(screen.getByText('Which options are realistic?')).toBeInTheDocument()
    expect(screen.queryByText('Q4')).not.toBeInTheDocument()
  })
})

describe('DecisionOverviewCard — gallery-only states (stateOverride)', () => {
  beforeEach(() => flagOn())

  it('contradictory: auto-expands and pauses reliance on the read', () => {
    render(<DecisionOverviewCard title="t" stateOverride="contradictory" />)
    expect(screen.getByText('The brief contains a conflict')).toBeInTheDocument()
    expect(screen.getByTestId('brief-bar')).toHaveAttribute('aria-expanded', 'true')
  })

  it('thin: auto-expands with the one-clarification line', () => {
    render(<DecisionOverviewCard title="t" stateOverride="thin" />)
    expect(screen.getByText('Framing needs one clarification')).toBeInTheDocument()
  })

  it('unverified: labels the claim as unverified, never asserts it is false', () => {
    render(<DecisionOverviewCard title="t" stateOverride="unverified" />)
    expect(screen.getByText(/unverified/i)).toBeInTheDocument()
    expect(screen.queryByText(/false|wrong|incorrect/i)).not.toBeInTheDocument()
  })
})

describe('DecisionOverviewCard — framing question (producer-backed)', () => {
  beforeEach(() => {
    flagOn()
    useCanvasStore.setState({ ceeAnalysisReady: READY } as never)
  })

  it('promotes the TOP guidance item as the one framing question with a work-through route', () => {
    const sendMessage = vi.fn()
    useGuidanceStore.setState({
      guidanceItems: [
        { item_id: 'g2', signal_code: 's', category: 'should_fix', source: 'analysis', title: 'Lower-priority', primary_action: { type: 'discuss', prompt: 'x' }, priority: 10 },
        { item_id: 'g1', signal_code: 's', category: 'must_fix', source: 'analysis', title: 'What would make option B clearly better?', primary_action: { type: 'discuss', prompt: 'Work through the framing question' }, priority: 90 },
      ],
      _sendMessage: sendMessage,
    } as never)
    render(<DecisionOverviewCard title="t" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    expect(screen.getByText('What would make option B clearly better?')).toBeInTheDocument()
    expect(screen.queryByText('Lower-priority')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /work through with olumi/i }))
    expect(sendMessage).toHaveBeenCalledTimes(1)
  })

  it('renders NO framing question when no guidance exists (never fabricates)', () => {
    render(<DecisionOverviewCard title="t" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    expect(screen.queryByText(/framing question/i)).not.toBeInTheDocument()
  })
})
