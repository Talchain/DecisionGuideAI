/**
 * Narrow layout + keyboard — controls are native, focusable buttons (inherently
 * keyboard-operable) and the panel renders within a narrow (~360px) container.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FocusNowPanel } from '../FocusNowPanel'
import { buildFocusRows } from '../buildFocusRows'
import { serverRow } from '../__fixtures__/focus.fixtures'

const staticRows = buildFocusRows({}).rows

function renderNarrow(ui: React.ReactElement) {
  return render(<div style={{ width: 360 }}>{ui}</div>)
}

describe('FocusNowPanel keyboard + narrow', () => {
  it('row toggles are native, focusable buttons', () => {
    renderNarrow(<FocusNowPanel summary={null} rows={staticRows} banner={{ kind: 'none' }} />)
    const row = screen.getByRole('button', { name: /define what success/i })
    expect(row.tagName).toBe('BUTTON')
    expect(row).not.toHaveAttribute('tabindex', '-1')
    row.focus()
    expect(document.activeElement).toBe(row)
  })

  it('the action and re-run controls are native buttons', () => {
    renderNarrow(
      <FocusNowPanel
        summary={null}
        rows={staticRows}
        banner={{ kind: 'stale', canRerun: true }}
        onRerun={() => {}}
      />,
    )
    expect(screen.getByTestId('focus-rerun').tagName).toBe('BUTTON')
    fireEvent.click(screen.getByRole('button', { name: /add a risk worth watching/i }))
    expect(screen.getByTestId('focus-action').tagName).toBe('BUTTON')
  })

  it('renders the reveal control inside a narrow container without error', () => {
    renderNarrow(
      <FocusNowPanel summary={null} rows={[serverRow, ...staticRows]} banner={{ kind: 'none' }} />,
    )
    expect(screen.getByTestId('focus-reveal')).toBeInTheDocument()
  })
})
