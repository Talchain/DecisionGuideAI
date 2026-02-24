/**
 * Storybook stories for GraphTextView (Structure Tab)
 * Task Q.2: Visual regression baselines
 *
 * TODO: Complete once real staging fixtures are captured
 * - Import actual fixture JSON files
 * - Extract nodes/edges from fixture data
 * - Configure robustness edge sets from fixture
 * - Generate visual regression snapshots
 */

import type { Meta, StoryObj } from '@storybook/react'
import { GraphTextView } from './GraphTextView'

const meta = {
  title: 'Canvas/OutputsDock/Structure',
  component: GraphTextView,
  parameters: {
    layout: 'fullscreen',
    // TODO: Configure with fixture data
  },
  args: {
    // Default no-op handlers for all stories
    onNodeClick: (nodeId: string) => console.log('Node clicked:', nodeId),
    onEdgeClick: (edgeId: string) => console.log('Edge clicked:', edgeId),
  },
} satisfies Meta<typeof GraphTextView>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Story 1: Normal Analysis - Structure View
 * Baseline scenario with clear winner, moderate complexity
 *
 * TODO: Replace with real fixture data from normal-analysis.json
 * - Extract nodes[] and edges[] from fixture
 * - Extract fragileEdgeIds and robustEdgeIds from robustness analysis
 */
export const NormalAnalysis: Story = {
  name: 'Normal Analysis - Structure',
  parameters: {
    docs: {
      description: {
        story: 'Quantitative goal, 2 options, clear winner, 5 factors. Shows typical graph structure with mixed robustness.',
      },
    },
  },
  args: {
    nodes: [],
    edges: [],
    fragileEdgeIds: new Set(),
    robustEdgeIds: new Set(),
  },
  // TODO: Configure with normalAnalysisFixture nodes/edges
}

/**
 * Story 2: Close Call - Structure View
 * Narrow decision with fragile edges highlighted
 *
 * TODO: Replace with real fixture data from close-call.json
 */
export const CloseCall: Story = {
  name: 'Close Call - Structure',
  parameters: {
    docs: {
      description: {
        story: 'Win probabilities within 5%, fragile edges present. Structure view highlights sensitivity.',
      },
    },
  },
  args: {
    nodes: [],
    edges: [],
    fragileEdgeIds: new Set(),
    robustEdgeIds: new Set(),
  },
  // TODO: Configure with closeCallFixture nodes/edges
}

/**
 * Story 3: Sensitivity Dominated - Structure View
 * One dominant factor driving the outcome
 *
 * TODO: Replace with real fixture data from sensitivity-dominated.json
 */
export const SensitivityDominated: Story = {
  name: 'Sensitivity Dominated - Structure',
  parameters: {
    docs: {
      description: {
        story: 'One factor with high elasticity. Structure view shows dominant causal path.',
      },
    },
  },
  args: {
    nodes: [],
    edges: [],
    fragileEdgeIds: new Set(),
    robustEdgeIds: new Set(),
  },
  // TODO: Configure with sensitivityDominatedFixture nodes/edges
}

/**
 * Story 4: Edge Case - Structure View
 * Minimal model with single option
 *
 * TODO: Replace with real fixture data from edge-case.json
 */
export const EdgeCase: Story = {
  name: 'Edge Case - Structure',
  parameters: {
    docs: {
      description: {
        story: 'Qualitative goal, single option (status quo only). Minimal structure.',
      },
    },
  },
  args: {
    nodes: [],
    edges: [],
    fragileEdgeIds: new Set(),
    robustEdgeIds: new Set(),
  },
  // TODO: Configure with edgeCaseFixture nodes/edges
}
