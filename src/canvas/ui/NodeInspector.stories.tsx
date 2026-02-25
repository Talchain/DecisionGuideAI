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
