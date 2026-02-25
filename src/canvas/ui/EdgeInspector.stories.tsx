import type { Meta, StoryObj } from '@storybook/react'
import { expect } from '@storybook/test'
import { useEffect } from 'react'
import { EdgeInspector } from './EdgeInspector'
import { useCanvasStore } from '../store'
import { ToastProvider } from '../ToastContext'

const meta = {
  title: 'Inspector/EdgeInspector',
  component: EdgeInspector,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'panel' },
  },
} satisfies Meta<typeof EdgeInspector>

export default meta
type Story = StoryObj<typeof meta>

const noop = () => {}

/** B.I.12: Assert Summary section height ≤200px at 320px width */
async function assertSummaryHeight(canvasElement: HTMLElement) {
  // Allow store + render to settle
  await new Promise(r => setTimeout(r, 100))
  const summary = canvasElement.querySelector('[data-testid="edge-inspector-summary"]')
  // Hard-fail if summary element is missing (selector broke)
  expect(summary).toBeTruthy()
  expect((summary as HTMLElement).clientHeight).toBeLessThanOrEqual(200)
}

/** Wrapper that sets up canvas store and ToastProvider */
function StoreWrapper({
  edgeId,
  storeState,
}: {
  edgeId: string
  storeState: Parameters<typeof useCanvasStore.setState>[0]
}) {
  useEffect(() => {
    useCanvasStore.setState(storeState)
  }, [storeState])

  return (
    <ToastProvider>
      <div style={{ width: 320, background: 'var(--bg-panel, #FEFEFE)', borderRadius: 8 }}>
        <EdgeInspector edgeId={edgeId} onClose={noop} />
      </div>
    </ToastProvider>
  )
}

const baseNodes = [
  { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Team morale' } },
  { id: 'n2', type: 'goal', position: { x: 200, y: 0 }, data: { label: 'Productivity' } },
]

export const PositiveEdge: Story = {
  name: 'Positive connection (Helps)',
  render: () => (
    <StoreWrapper
      edgeId="e1"
      storeState={{
        nodes: baseNodes,
        edges: [
          {
            id: 'e1',
            type: 'styled',
            source: 'n1',
            target: 'n2',
            data: {
              weight: 0.7,
              direction: 'positive',
              belief: 0.85,
              label: 'Higher morale increases output',
              confidence: 0.85,
              style: 'solid' as const,
              curvature: 0.15,
              pathType: 'bezier' as const,
            },
          },
        ],
        touchedNodeIds: new Set(),
        runMeta: { ceeReview: null },
      }}
    />
  ),
  play: async ({ canvasElement }) => { await assertSummaryHeight(canvasElement) },
}

export const NegativeEdge: Story = {
  name: 'Negative connection (Hurts)',
  render: () => (
    <StoreWrapper
      edgeId="e1"
      storeState={{
        nodes: baseNodes,
        edges: [
          {
            id: 'e1',
            type: 'styled',
            source: 'n1',
            target: 'n2',
            data: {
              weight: 0.4,
              direction: 'negative',
              belief: 0.6,
              confidence: 0.6,
              style: 'solid' as const,
              curvature: 0.15,
              pathType: 'bezier' as const,
            },
          },
        ],
        touchedNodeIds: new Set(),
        runMeta: { ceeReview: null },
      }}
    />
  ),
  play: async ({ canvasElement }) => { await assertSummaryHeight(canvasElement) },
}

export const WithSuggestion: Story = {
  name: 'With AI weight suggestion',
  render: () => (
    <StoreWrapper
      edgeId="e1"
      storeState={{
        nodes: baseNodes,
        edges: [
          {
            id: 'e1',
            type: 'styled',
            source: 'n1',
            target: 'n2',
            data: {
              weight: 0.5,
              direction: 'positive',
              belief: 0.5,
              confidence: 0.5,
              style: 'solid' as const,
              curvature: 0.15,
              pathType: 'bezier' as const,
            },
          },
        ],
        touchedNodeIds: new Set(),
        runMeta: {
          ceeReview: {
            weight_suggestions: [
              {
                edge_id: 'e1',
                suggested_weight: 0.82,
                suggested_belief: 0.9,
                confidence: 'high' as const,
                rationale: 'Literature suggests a strong positive correlation between team morale and productivity.',
                auto_applied: false,
              },
            ],
          },
        },
      }}
    />
  ),
  play: async ({ canvasElement }) => { await assertSummaryHeight(canvasElement) },
}

export const NeutralEdge: Story = {
  name: 'Neutral (zero effect)',
  render: () => (
    <StoreWrapper
      edgeId="e1"
      storeState={{
        nodes: baseNodes,
        edges: [
          {
            id: 'e1',
            type: 'styled',
            source: 'n1',
            target: 'n2',
            data: {
              weight: 0,
              direction: 'positive',
              belief: 0.5,
              confidence: 0.5,
              style: 'solid' as const,
              curvature: 0.15,
              pathType: 'bezier' as const,
            },
          },
        ],
        touchedNodeIds: new Set(),
        runMeta: { ceeReview: null },
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

export const EdgeWithStrengthBar: Story = {
  name: 'Edge — with strength bar (positive)',
  render: () => (
    <StoreWrapper
      edgeId="e1"
      storeState={{
        nodes: baseNodes,
        edges: [
          {
            id: 'e1',
            type: 'styled',
            source: 'n1',
            target: 'n2',
            data: {
              weight: 0.7,
              direction: 'positive',
              beliefExists: 0.85,
              belief: 0.85,
              style: 'solid' as const,
              curvature: 0.15,
              pathType: 'bezier' as const,
            },
          },
        ],
        touchedNodeIds: new Set(),
        runMeta: { ceeReview: null },
      }}
    />
  ),
  play: async ({ canvasElement }) => { await assertSummaryHeight(canvasElement) },
}

export const EdgeNegativeFragile: Story = {
  name: 'Edge — negative + fragile pill',
  render: () => (
    <StoreWrapper
      edgeId="e1"
      storeState={{
        nodes: baseNodes,
        edges: [
          {
            id: 'e1',
            type: 'styled',
            source: 'n1',
            target: 'n2',
            data: {
              weight: 0.4,
              direction: 'negative',
              beliefExists: 0.6,
              belief: 0.6,
              style: 'solid' as const,
              curvature: 0.15,
              pathType: 'bezier' as const,
            },
          },
        ],
        touchedNodeIds: new Set(),
        runMeta: { ceeReview: null },
        results: {
          status: 'complete',
          progress: 100,
          report: {
            ...minimalReport,
            robustness: {
              fragile_edges: [
                { edge_id: 'e1', switch_probability: 0.5, from_id: 'n1', to_id: 'n2' },
              ],
              recommendation_stability: 0.68,
            },
          },
        },
      }}
    />
  ),
  play: async ({ canvasElement }) => { await assertSummaryHeight(canvasElement) },
}
