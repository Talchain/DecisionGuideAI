/**
 * The V2 foot-of-panel ask box (27 Sep 2026): it hands the typed words to the SAME
 * Ask Olumi drawer the ✦ acts open, as an editable draft. It sends nothing itself.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../../../canvas/conversation/askAi', () => ({ askAi: vi.fn(() => 'sent') }))

import { askAi } from '../../../../canvas/conversation/askAi'
import { ReasoningAskBox, REASONING_ASK_COPY } from '../sections/ReasoningAskBox'

const T = 'analysis-new-ask-box'
afterEach(() => {
  cleanup()
  vi.mocked(askAi).mockClear().mockReturnValue('sent')
})

describe('the Reasoning panel ask box', () => {
  it('shows the prototype placeholder', () => {
    render(<ReasoningAskBox />)
    expect(screen.getByPlaceholderText(REASONING_ASK_COPY.placeholder)).toBeInTheDocument()
  })

  it('Enter sends the typed words verbatim in one click, then clears', () => {
    render(<ReasoningAskBox />)
    const input = screen.getByTestId(`${T}-input`)
    fireEvent.change(input, { target: { value: '  Why is churn the biggest driver?  ' } })
    fireEvent.submit(screen.getByTestId(T))
    expect(askAi).toHaveBeenCalledTimes(1)
    expect(askAi).toHaveBeenCalledWith(
      expect.objectContaining({ userWords: '  Why is churn the biggest driver?  ' }),
    )
    expect(input).toHaveValue('')
  })

  it('CONTRAST: blank text opens nothing, and the send act is disabled', () => {
    render(<ReasoningAskBox />)
    fireEvent.change(screen.getByTestId(`${T}-input`), { target: { value: '   ' } })
    fireEvent.submit(screen.getByTestId(T))
    expect(askAi).not.toHaveBeenCalled()
    expect(screen.getByTestId(`${T}-send`)).toBeDisabled()
  })
})

it('a busy send retains the person’s exact words in the ask box', () => {
  render(<ReasoningAskBox />)
  const input = screen.getByTestId(`${T}-input`)
  fireEvent.change(input, { target: { value: '  Keep this thought  ' } })
  vi.mocked(askAi).mockReturnValueOnce('busy')
  fireEvent.submit(screen.getByTestId(T))
  expect(input).toHaveValue('  Keep this thought  ')
  expect(askAi).toHaveBeenCalledWith({ userWords: '  Keep this thought  ' })
})
