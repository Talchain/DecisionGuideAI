import { expect } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/react'

/** What the one Tip says for an element: nothing at the instant the pointer arrives, then its words once the 150 ms delay has run (look/Tip.tsx). */
export const hoverWords = async (el: HTMLElement): Promise<string | null> => {
  fireEvent.pointerEnter(el)
  expect(document.querySelector('[role="tooltip"]'), 'not at the instant of arrival').toBeNull()
  const tip = await waitFor(() => { const t = document.querySelector('[role="tooltip"]'); if (t === null) throw new Error('no tip yet'); return t })
  const words = tip.textContent
  fireEvent.pointerLeave(el)
  return words
}
