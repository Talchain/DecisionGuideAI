import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'

const { focusByTargetMock } = vi.hoisted(() => ({ focusByTargetMock: vi.fn() }))
vi.mock('../../../utils/focusHelpers', () => ({
  focusByTarget: focusByTargetMock,
}))

import { EntityLink } from '../EntityLink'

beforeEach(() => { focusByTargetMock.mockReset() })
afterEach(() => cleanup())

describe('EntityLink (brief §9.2 click-to-highlight)', () => {
  it('renders the label as a button', () => {
    render(<EntityLink id="n1" label="Revenue goal" />)
    const btn = screen.getByTestId('entity-link-n1')
    expect(btn).toHaveTextContent('Revenue goal')
    expect(btn.tagName).toBe('BUTTON')
  })

  it('calls focusByTarget with node type by default', () => {
    render(<EntityLink id="n1" label="Goal A" />)
    screen.getByTestId('entity-link-n1').click()
    expect(focusByTargetMock).toHaveBeenCalledWith('n1', 'node')
  })

  it('routes edge kind through focusByTarget as "edge"', () => {
    render(<EntityLink id="e1" label="Influence" kind="edge" />)
    screen.getByTestId('entity-link-e1').click()
    expect(focusByTargetMock).toHaveBeenCalledWith('e1', 'edge')
  })

  it('treats factor/option/goal/risk/outcome as nodes', () => {
    render(<EntityLink id="f1" label="Factor X" kind="factor" />)
    screen.getByTestId('entity-link-f1').click()
    expect(focusByTargetMock).toHaveBeenCalledWith('f1', 'node')
  })

  it('exposes an accessible label naming the target', () => {
    render(<EntityLink id="n2" label="Pick a snack" />)
    expect(screen.getByLabelText(/highlight pick a snack on the canvas/i)).toBeInTheDocument()
  })
})
