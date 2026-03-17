/**
 * Storybook stories for OutputsDock Results Panel
 * Task Q.2: Visual regression baselines
 *
 * TODO: Complete once real staging fixtures are captured
 * - Import actual fixture JSON files
 * - Configure Zustand store with fixture data
 * - Generate visual regression snapshots
 */

import type { Meta, StoryObj } from '@storybook/react'
import { OutputsDock } from './OutputsDock'

const meta = {
  title: 'Canvas/OutputsDock/Results',
  component: OutputsDock,
  parameters: {
    layout: 'fullscreen',
    // TODO: Configure with fixture data
  },
} satisfies Meta<typeof OutputsDock>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Story 1: Normal Analysis
 * Baseline scenario with clear winner, moderate complexity
 *
 * TODO: Replace with real fixture data from normal-analysis.json
 */
export const NormalAnalysis: Story = {
  name: 'Normal Analysis',
  parameters: {
    docs: {
      description: {
        story: 'Quantitative goal, 2 options, clear winner (>15% separation), 5 factors, moderate robustness',
      },
    },
  },
  // TODO: Configure Zustand mock with normalAnalysisFixture
}

/**
 * Story 2: Close Call
 * Narrow decision with fragile edges
 *
 * TODO: Replace with real fixture data from close-call.json
 */
export const CloseCall: Story = {
  name: 'Close Call Decision',
  parameters: {
    docs: {
      description: {
        story: 'Win probabilities within 5%, fragile edge present, one constraint between 0.4-0.6 probability',
      },
    },
  },
  // TODO: Configure Zustand mock with closeCallFixture
}

/**
 * Story 3: Sensitivity Dominated
 * One dominant factor driving the outcome
 *
 * TODO: Replace with real fixture data from sensitivity-dominated.json
 */
export const SensitivityDominated: Story = {
  name: 'Sensitivity Dominated',
  parameters: {
    docs: {
      description: {
        story: 'One factor with elasticity > 0.6, demonstrating high sensitivity',
      },
    },
  },
  // TODO: Configure Zustand mock with sensitivityDominatedFixture
}

/**
 * Story 4: Edge Case
 * Minimal model with single option
 *
 * TODO: Replace with real fixture data from edge-case.json
 */
export const EdgeCase: Story = {
  name: 'Edge Case (Single Option)',
  parameters: {
    docs: {
      description: {
        story: 'Qualitative goal, single option (status quo), no constraints, no CEE review',
      },
    },
  },
  // TODO: Configure Zustand mock with edgeCaseFixture
}
