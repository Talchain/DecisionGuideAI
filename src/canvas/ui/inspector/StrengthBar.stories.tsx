import type { Meta, StoryObj } from '@storybook/react'
import { StrengthBar } from './StrengthBar'

const meta = {
  title: 'Inspector/StrengthBar',
  component: StrengthBar,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'panel' },
  },
} satisfies Meta<typeof StrengthBar>

export default meta
type Story = StoryObj<typeof meta>

export const Positive: Story = {
  name: 'Positive (weight: 0.7)',
  args: { weight: 0.7, direction: 'positive' },
  decorators: [
    (Story) => (
      <div style={{ width: 320, padding: 16, background: 'var(--bg-panel, #FEFEFE)' }}>
        <Story />
      </div>
    ),
  ],
}

export const Negative: Story = {
  name: 'Negative (weight: 0.4)',
  args: { weight: 0.4, direction: 'negative' },
  decorators: [
    (Story) => (
      <div style={{ width: 320, padding: 16, background: 'var(--bg-panel, #FEFEFE)' }}>
        <Story />
      </div>
    ),
  ],
}

export const Neutral: Story = {
  name: 'Neutral (weight: 0)',
  args: { weight: 0, direction: 'positive' },
  decorators: [
    (Story) => (
      <div style={{ width: 320, padding: 16, background: 'var(--bg-panel, #FEFEFE)' }}>
        <Story />
      </div>
    ),
  ],
}

export const MaxStrength: Story = {
  name: 'Max strength (weight: 1.0)',
  args: { weight: 1.0, direction: 'positive' },
  decorators: [
    (Story) => (
      <div style={{ width: 320, padding: 16, background: 'var(--bg-panel, #FEFEFE)' }}>
        <Story />
      </div>
    ),
  ],
}
