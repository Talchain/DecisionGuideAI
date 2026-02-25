import type { Meta, StoryObj } from '@storybook/react'
import { expect } from '@storybook/test'
import { useEffect } from 'react'
import { NodeInspector } from './NodeInspector'
import { useCanvasStore } from '../store'

const meta = {
  title: 'Inspector/NodeInspector',
  component: NodeInspector,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'panel' },
  },
} satisfies Meta<typeof NodeInspector>

export default meta
type Story = StoryObj<typeof meta>

const noop = () => {}

/** B.I.12: Assert Summary section height ≤200px at 320px width */
async function assertSummaryHeight(canvasElement: HTMLElement) {
  // Allow store + render to settle
  await new Promise(r => setTimeout(r, 100))
  const summary = canvasElement.querySelector('[data-testid="node-inspector-summary"]')
  // Hard-fail if summary element is missing (selector broke)
  expect(summary).toBeTruthy()
  expect((summary as HTMLElement).clientHeight).toBeLessThanOrEqual(200)
}

/** Wrapper that sets up canvas store state before rendering */
function StoreWrapper({
  nodeId,
  storeState,
}: {
  nodeId: string
  storeState: Parameters<typeof useCanvasStore.setState>[0]
}) {
  useEffect(() => {
    useCanvasStore.setState(storeState)
  }, [storeState])

  return (
    <div style={{ width: 320, background: 'var(--bg-panel, #FEFEFE)', borderRadius: 8 }}>
      <NodeInspector nodeId={nodeId} onClose={noop} />
    </div>
  )
}

export const FactorNode: Story = {
  name: 'Factor — with observed state',
  render: () => (
    <StoreWrapper
      nodeId="f1"
      storeState={{
        nodes: [
          {
            id: 'f1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Customer satisfaction score',
              description: 'Measured quarterly via NPS survey',
              category: 'KPI',
              kind: 'factor',
              observedState: { value: 72, baseline: 65, unit: '%' },
            },
          },
        ],
        edges: [],
        goalThreshold: null,
        goalConstraints: [],
        outcomeNodeId: null,
        touchedNodeIds: new Set(),
      }}
    />
  ),
  play: async ({ canvasElement }) => { await assertSummaryHeight(canvasElement) },
}

export const GoalNodeUndefined: Story = {
  name: 'Goal — threshold not set (coaching card)',
  render: () => (
    <StoreWrapper
      nodeId="g1"
      storeState={{
        nodes: [
          {
            id: 'g1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: { label: 'Increase revenue to £2M', kind: 'goal' },
          },
        ],
        edges: [],
        goalThreshold: null,
        goalConstraints: [],
        outcomeNodeId: 'g1',
        touchedNodeIds: new Set(),
      }}
    />
  ),
  play: async ({ canvasElement }) => { await assertSummaryHeight(canvasElement) },
}

export const GoalNodeDefined: Story = {
  name: 'Goal — threshold set',
  render: () => (
    <StoreWrapper
      nodeId="g1"
      storeState={{
        nodes: [
          {
            id: 'g1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: { label: 'Increase revenue to £2M', kind: 'goal' },
          },
        ],
        edges: [],
        goalThreshold: 2000000,
        goalConstraints: [],
        outcomeNodeId: 'g1',
        touchedNodeIds: new Set(),
      }}
    />
  ),
  play: async ({ canvasElement }) => { await assertSummaryHeight(canvasElement) },
}

export const OptionNode: Story = {
  name: 'Option — with interventions',
  render: () => (
    <StoreWrapper
      nodeId="o1"
      storeState={{
        nodes: [
          {
            id: 'o1',
            type: 'option',
            position: { x: 0, y: 0 },
            data: {
              label: 'Hire 3 engineers',
              kind: 'option',
              interventions: { f1: 85, f2: 120000 },
            },
          },
          {
            id: 'f1',
            type: 'factor',
            position: { x: 100, y: 0 },
            data: { label: 'Team size', observedState: { value: 12, unit: 'people' } },
          },
          {
            id: 'f2',
            type: 'factor',
            position: { x: 200, y: 0 },
            data: { label: 'Annual cost', observedState: { value: 90000, unit: '£' } },
          },
        ],
        edges: [],
        goalThreshold: null,
        goalConstraints: [],
        outcomeNodeId: null,
        touchedNodeIds: new Set(),
      }}
    />
  ),
  play: async ({ canvasElement }) => { await assertSummaryHeight(canvasElement) },
}

export const DecisionNode: Story = {
  name: 'Decision — minimal',
  render: () => (
    <StoreWrapper
      nodeId="d1"
      storeState={{
        nodes: [
          {
            id: 'd1',
            type: 'decision',
            position: { x: 0, y: 0 },
            data: { label: 'How to grow the team?', kind: 'decision' },
          },
        ],
        edges: [],
        goalThreshold: null,
        goalConstraints: [],
        outcomeNodeId: null,
        touchedNodeIds: new Set(),
      }}
    />
  ),
  play: async ({ canvasElement }) => { await assertSummaryHeight(canvasElement) },
}

// ── S.8: Phase 2 Summary feature stories ────────────────────────────

/** Minimal report fixture for post-analysis stories */
const minimalReport = {
  schema: 'report.v1' as const,
  meta: { seed: 42, response_id: 'test-1', elapsed_ms: 1200 },
  model_card: { response_hash: 'abc123', response_hash_algo: 'sha256' as const, normalized: true as const },
  results: { conservative: 100, likely: 150, optimistic: 200 },
  confidence: { level: 'medium' as const, why: 'Test' },
  drivers: [],
}

export const FactorPreAnalysisNoValue: Story = {
  name: 'Factor — pre-analysis, no value (coaching prompt)',
  render: () => (
    <StoreWrapper
      nodeId="f1"
      storeState={{
        nodes: [
          {
            id: 'f1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: { label: 'Customer satisfaction', kind: 'factor', category: 'controllable' },
          },
        ],
        edges: [],
        goalThreshold: null,
        goalConstraints: [],
        outcomeNodeId: null,
        touchedNodeIds: new Set(),
      }}
    />
  ),
  play: async ({ canvasElement }) => { await assertSummaryHeight(canvasElement) },
}

export const FactorPostAnalysis: Story = {
  name: 'Factor — post-analysis (influence + confidence bars)',
  render: () => (
    <StoreWrapper
      nodeId="f1"
      storeState={{
        nodes: [
          {
            id: 'f1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Customer satisfaction',
              kind: 'factor',
              category: 'KPI',
              observedState: { value: 72, baseline: 65, unit: '%' },
            },
          },
        ],
        edges: [
          { id: 'e1', source: 'f1', target: 'g1', data: { weight: 0.7, direction: 'positive' } },
        ],
        goalThreshold: 200,
        goalConstraints: [],
        outcomeNodeId: null,
        touchedNodeIds: new Set(),
        results: {
          status: 'complete',
          progress: 100,
          report: {
            ...minimalReport,
            factor_sensitivity: [
              { factor_id: 'f1', elasticity: 0.85, confidence: 0.3, influence_score: 0.85 },
              { factor_id: 'f2', elasticity: 0.4, confidence: 0.7, influence_score: 0.4 },
            ],
          },
        },
      }}
    />
  ),
  play: async ({ canvasElement }) => { await assertSummaryHeight(canvasElement) },
}

export const FactorPostAnalysisFragile: Story = {
  name: 'Factor — post-analysis with fragile badge',
  render: () => (
    <StoreWrapper
      nodeId="f1"
      storeState={{
        nodes: [
          {
            id: 'f1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Customer satisfaction',
              kind: 'factor',
              category: 'KPI',
              observedState: { value: 72, baseline: 65, unit: '%' },
            },
          },
        ],
        edges: [
          { id: 'e1', source: 'f1', target: 'g1', data: { weight: 0.7, direction: 'positive' } },
          { id: 'e-fragile', source: 'f2', target: 'f1', data: { weight: 0.5, direction: 'negative' } },
        ],
        goalThreshold: 200,
        goalConstraints: [],
        outcomeNodeId: null,
        touchedNodeIds: new Set(),
        results: {
          status: 'complete',
          progress: 100,
          report: {
            ...minimalReport,
            factor_sensitivity: [
              { factor_id: 'f1', elasticity: 0.85, confidence: 0.3, influence_score: 0.85 },
            ],
            robustness: {
              fragile_edges: [
                { edge_id: 'e-fragile', switch_probability: 0.6, from_id: 'f2', to_id: 'f1' },
              ],
              recommendation_stability: 0.72,
            },
          },
        },
      }}
    />
  ),
  play: async ({ canvasElement }) => { await assertSummaryHeight(canvasElement) },
}

export const GoalChecklist: Story = {
  name: 'Goal — checklist (pre-analysis, items failing)',
  render: () => (
    <StoreWrapper
      nodeId="g1"
      storeState={{
        nodes: [
          {
            id: 'g1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: { label: 'Increase revenue', kind: 'goal' },
          },
        ],
        edges: [],
        goalThreshold: null,
        goalConstraints: [],
        outcomeNodeId: 'g1',
        touchedNodeIds: new Set(),
      }}
    />
  ),
  play: async ({ canvasElement }) => { await assertSummaryHeight(canvasElement) },
}

export const GoalPostAnalysis: Story = {
  name: 'Goal — post-analysis (goal probability)',
  render: () => (
    <StoreWrapper
      nodeId="g1"
      storeState={{
        nodes: [
          {
            id: 'g1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: { label: 'Increase revenue to £2M', kind: 'goal' },
          },
        ],
        edges: [
          { id: 'e1', source: 'f1', target: 'g1', data: { weight: 0.7, direction: 'positive' } },
        ],
        goalThreshold: 2000000,
        goalConstraints: [],
        outcomeNodeId: 'g1',
        touchedNodeIds: new Set(),
        results: {
          status: 'complete',
          progress: 100,
          report: {
            ...minimalReport,
            option_comparison: [
              { option_id: 'o1', probability_of_goal: 0.73, win_probability: 0.62 },
            ],
            robustness: {
              recommended_option_id: 'o1',
              recommendation_stability: 0.85,
            },
          },
        },
      }}
    />
  ),
  play: async ({ canvasElement }) => { await assertSummaryHeight(canvasElement) },
}

export const OptionPostAnalysis: Story = {
  name: 'Option — post-analysis (win probability)',
  render: () => (
    <StoreWrapper
      nodeId="o1"
      storeState={{
        nodes: [
          {
            id: 'o1',
            type: 'option',
            position: { x: 0, y: 0 },
            data: {
              label: 'Hire 3 engineers',
              kind: 'option',
              interventions: { f1: 85 },
            },
          },
          {
            id: 'f1',
            type: 'factor',
            position: { x: 100, y: 0 },
            data: { label: 'Team size', observedState: { value: 12, unit: 'people' } },
          },
        ],
        edges: [],
        goalThreshold: 200,
        goalConstraints: [],
        outcomeNodeId: null,
        touchedNodeIds: new Set(),
        results: {
          status: 'complete',
          progress: 100,
          report: {
            ...minimalReport,
            option_comparison: [
              { option_id: 'o1', probability_of_goal: 0.65, win_probability: 0.62 },
            ],
          },
        },
      }}
    />
  ),
  play: async ({ canvasElement }) => { await assertSummaryHeight(canvasElement) },
}

export const ActionRow: Story = {
  name: 'Factor — confirmed (action row checkmark highlighted)',
  render: () => (
    <StoreWrapper
      nodeId="f1"
      storeState={{
        nodes: [
          {
            id: 'f1',
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Customer satisfaction score',
              kind: 'factor',
              category: 'KPI',
              observedState: { value: 72, baseline: 65, unit: '%' },
            },
          },
        ],
        edges: [],
        goalThreshold: null,
        goalConstraints: [],
        outcomeNodeId: null,
        touchedNodeIds: new Set(),
        confirmedNodeIds: new Set(['f1']),
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    await assertSummaryHeight(canvasElement)
    // P.5: Confirm button SHOULD be rendered for Factor nodes
    const actionRow = canvasElement.querySelector('[data-testid="inspector-action-row"]')
    expect(actionRow).toBeTruthy()
    const buttons = actionRow?.querySelectorAll('button') ?? []
    expect(buttons.length).toBe(2)
    // First button is Confirm (Check), second is Edit (Pencil)
    expect(buttons[0]?.getAttribute('aria-label')).toBe('Unmark as reviewed')
    expect(buttons[1]?.getAttribute('aria-label')).toBe('Edit assumptions')
  },
}

export const GoalActionRow: Story = {
  name: 'Goal — action row (no Confirm button, P.1)',
  render: () => (
    <StoreWrapper
      nodeId="g1"
      storeState={{
        nodes: [
          {
            id: 'g1',
            type: 'goal',
            position: { x: 0, y: 0 },
            data: { label: 'Increase revenue to £2M', kind: 'goal' },
          },
        ],
        edges: [],
        goalThreshold: 2000000,
        goalConstraints: [],
        outcomeNodeId: 'g1',
        touchedNodeIds: new Set(),
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    await assertSummaryHeight(canvasElement)
    // P.5: Confirm button should NOT be rendered for Goal nodes
    const actionRow = canvasElement.querySelector('[data-testid="inspector-action-row"]')
    expect(actionRow).toBeTruthy()
    // Only the Edit (Pencil) button should be present, not the Confirm (Check) button
    const buttons = actionRow?.querySelectorAll('button') ?? []
    expect(buttons.length).toBe(1)
    expect(buttons[0]?.getAttribute('aria-label')).toBe('Edit assumptions')
  },
}
