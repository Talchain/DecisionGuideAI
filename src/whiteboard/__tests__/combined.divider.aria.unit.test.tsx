// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { FlagsProvider } from '@/lib/flags'
import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'

vi.mock('@/whiteboard/tldraw', () => ({
  Tldraw: () => <div data-testid="tldraw-mock" />,
}))
vi.mock('@/sandbox/panels/IntelligencePanel', () => ({ IntelligencePanel: () => <div aria-label="Intelligence Panel" /> }))
vi.mock('@/sandbox/panels/GoalsOkrsPanel', () => ({ GoalsOkrsPanel: () => <div aria-label="Goals Panel" /> }))

const renderCombined = () =>
  render(
    <ThemeProvider>
      <FlagsProvider value={{ sandbox: true, scenarioSnapshots: true } as any}>
        <MemoryRouter initialEntries={[`/decisions/demo/sandbox/combined`]}>
          <Routes>
            <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
          </Routes>
        </MemoryRouter>
      </FlagsProvider>
    </ThemeProvider>
  )

describe('Combined divider a11y', () => {
  it('has proper ARIA and announces width on keyup only', async () => {
    renderCombined()
    // Panels start collapsed; open using the header toggle (has aria-controls)
    const showBtns = screen.getAllByRole('button', { name: /show panels/i })
    const headerToggle = showBtns.find(el => el.getAttribute('aria-controls') === 'panels-region') as HTMLButtonElement
    expect(headerToggle).toBeTruthy()
    headerToggle.click()

    const sep = screen.getByRole('separator', { name: /resize panels/i })
    expect(sep).toHaveAttribute('aria-orientation', 'vertical')
    expect(Number(sep.getAttribute('aria-valuemin'))).toBe(240)
    expect(Number(sep.getAttribute('aria-valuemax'))).toBe(560)
    const initialNow = Number(sep.getAttribute('aria-valuenow'))

    // KeyDown should change value but not announce yet
    sep.focus()
    fireEvent.keyDown(sep, { key: 'ArrowRight' })
    const midNow = Number(sep.getAttribute('aria-valuenow'))
    expect(midNow).toBe(initialNow + 16)

    // Live region should be empty until keyup
    const announcer = screen.getByRole('status', { hidden: true })
    expect(announcer.textContent).toBe('')

    // On keyup, announcement updates
    fireEvent.keyUp(sep, { key: 'ArrowRight' })
    expect(announcer.textContent).toMatch(/Panel width/i)
  })
})
