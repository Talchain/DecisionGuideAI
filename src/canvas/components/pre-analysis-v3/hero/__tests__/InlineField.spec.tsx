/**
 * InlineField commit-gating regressions (adversarial review findings):
 * - Escape must revert, never commit (the blur it triggers used to commit
 *   the escaped draft).
 * - Enter must commit exactly once (its follow-up blur used to double-commit,
 *   double-writing history).
 * - A failed blur-commit keeps the input pending so Save can retry without
 *   refocusing.
 * - A blur with no user input after an external value change must not write
 *   the stale draft back over the update.
 */

import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { InlineField } from '../InlineField'

function Harness({
  onCommit,
  initial = '20%',
}: {
  onCommit: (raw: string) => true | string
  initial?: string
}) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <InlineField
        label="Success"
        ariaLabel="Success measure"
        inputId="ifs"
        placeholder="What would count as success?"
        value={value}
        onCommit={raw => {
          const result = onCommit(raw)
          if (result === true) setValue(raw)
          return result
        }}
      />
      <button type="button" onClick={() => setValue('99%')}>
        external update
      </button>
    </>
  )
}

describe('InlineField — commit gating', () => {
  it('Escape reverts the draft and never commits (including via its blur)', () => {
    const onCommit = vi.fn(() => true as const)
    render(<Harness onCommit={onCommit} />)
    const input = screen.getByLabelText('Success measure')
    fireEvent.change(input, { target: { value: '55' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.blur(input)
    expect(onCommit).not.toHaveBeenCalled()
    expect(input).toHaveValue('20%')
  })

  it('Enter commits exactly once (the follow-up blur no-ops)', () => {
    const onCommit = vi.fn(() => true as const)
    render(<Harness onCommit={onCommit} />)
    const input = screen.getByLabelText('Success measure')
    fireEvent.change(input, { target: { value: '55' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('55')
  })

  it('after a failed blur-commit, Save retries without refocusing', () => {
    let accept = false
    const onCommit = vi.fn((_raw: string) => (accept ? (true as const) : 'Enter a number'))
    render(<Harness onCommit={onCommit} />)
    const input = screen.getByLabelText('Success measure')
    fireEvent.change(input, { target: { value: 'better vibes' } })
    fireEvent.blur(input)
    expect(screen.getByText('Enter a number')).toBeInTheDocument()
    // User fixes nothing but clicks Save again after the input was unblocked.
    accept = true
    fireEvent.click(screen.getByRole('button', { name: 'Save success' }))
    expect(onCommit).toHaveBeenCalledTimes(2)
  })

  it('a blur with no user input after an external update does not commit the stale draft', () => {
    const onCommit = vi.fn(() => true as const)
    render(<Harness onCommit={onCommit} />)
    const input = screen.getByLabelText('Success measure')
    // Focus, but type nothing.
    fireEvent.focus(input)
    // External commit lands while focused (e.g. another surface wrote the node).
    fireEvent.click(screen.getByRole('button', { name: 'external update' }))
    fireEvent.blur(input)
    expect(onCommit).not.toHaveBeenCalled()
  })
})
