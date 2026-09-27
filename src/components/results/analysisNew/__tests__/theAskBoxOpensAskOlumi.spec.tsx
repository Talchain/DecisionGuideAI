/**
 * The V2 foot-of-panel ask box (27 Sep 2026): it hands the typed words to the SAME
 * Ask Olumi drawer the ✦ acts open, as an editable draft. It sends nothing itself.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

import { openAskOlumi } from '../../coaching/askOlumiStore'
import { ReasoningAskBox, REASONING_ASK_COPY } from '../sections/ReasoningAskBox'

const T = 'analysis-new-ask-box'
afterEach(() => {
  cleanup()
  vi.mocked(openAskOlumi).mockClear()
})

describe('the Reasoning panel ask box', () => {
  it('shows the prototype placeholder', () => {
    render(<ReasoningAskBox />)
    expect(screen.getByPlaceholderText(REASONING_ASK_COPY.placeholder)).toBeInTheDocument()
  })

  it('Enter opens Ask Olumi with the typed words as the draft, then clears', () => {
    render(<ReasoningAskBox />)
    const input = screen.getByTestId(`${T}-input`)
    fireEvent.change(input, { target: { value: '  Why is churn the biggest driver?  ' } })
    fireEvent.submit(screen.getByTestId(T))
    expect(openAskOlumi).toHaveBeenCalledTimes(1)
    expect(openAskOlumi).toHaveBeenCalledWith(
      expect.objectContaining({ draft: 'Why is churn the biggest driver?', label: REASONING_ASK_COPY.label }),
    )
    expect(input).toHaveValue('')
  })

  it('CONTRAST: blank text opens nothing, and the send act is disabled', () => {
    render(<ReasoningAskBox />)
    fireEvent.change(screen.getByTestId(`${T}-input`), { target: { value: '   ' } })
    fireEvent.submit(screen.getByTestId(T))
    expect(openAskOlumi).not.toHaveBeenCalled()
    expect(screen.getByTestId(`${T}-send`)).toBeDisabled()
  })
})
