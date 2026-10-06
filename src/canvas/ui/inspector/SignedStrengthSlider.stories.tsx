import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { SignedStrengthSlider } from './SignedStrengthSlider'

const meta = {
  title: 'Inspector/SignedStrengthSlider',
  component: SignedStrengthSlider,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'panel' },
  },
} satisfies Meta<typeof SignedStrengthSlider>

export default meta
type Story = StoryObj<typeof meta>

/** Wrapper that manages slider state for interactive stories */
function SliderWrapper({ initial = 0 }: { initial?: number }) {
  const [value, setValue] = useState(initial)
  return (
    <div style={{ width: 320, padding: 16, background: 'var(--bg-panel, #FEFEFE)' }}>
      <SignedStrengthSlider value={value} onChange={setValue} />
      <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 8 }}>
        weight: {Math.abs(value).toFixed(2)}, direction: {value >= 0 ? 'positive' : 'negative'}
      </p>
    </div>
  )
}

export const Neutral: Story = {
  name: 'Neutral (0.00)',
  render: () => <SliderWrapper initial={0} />,
}

export const StrongPositive: Story = {
  name: 'Strong positive (+0.80)',
  render: () => <SliderWrapper initial={0.8} />,
}

export const WeakNegative: Story = {
  name: 'Weak negative (-0.25)',
  render: () => <SliderWrapper initial={-0.25} />,
}

export const StrongNegative: Story = {
  name: 'Strong negative (-0.90)',
  render: () => <SliderWrapper initial={-0.9} />,
}
