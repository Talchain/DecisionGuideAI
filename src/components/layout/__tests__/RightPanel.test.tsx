import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RightPanel } from '../RightPanel'

describe('RightPanel', () => {
  it('renders children inside a right-aligned panel', () => {
    render(
      <RightPanel width="24rem" data-testid="right-panel">
        <div>Panel content</div>
      </RightPanel>,
    )

    const panel = screen.getByTestId('right-panel')
    expect(panel).toBeInTheDocument()
    expect(screen.getByText('Panel content')).toBeInTheDocument()
  })
})
