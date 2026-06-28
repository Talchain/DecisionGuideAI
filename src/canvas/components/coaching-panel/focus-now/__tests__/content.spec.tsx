/**
 * FocusNowPanel content — static rows render safely (and never claim a detection),
 * server rows render their fields, and the summary renders verbatim or is omitted.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { FocusNowPanel } from '../FocusNowPanel'
import { buildFocusRows } from '../buildFocusRows'
import type { FocusNowProps, FocusRow } from '../focusTypes'

const staticRows = buildFocusRows({}).rows
function renderPanel(overrides: Partial<FocusNowProps> = {}) {
  const props: FocusNowProps = { summary: null, rows: staticRows, banner: { kind: 'none' }, ...overrides }
  return render(<FocusNowPanel {...props} />)
}

describe('FocusNowPanel content', () => {
  it('renders the header and the static hygiene rows', () => {
    renderPanel()
    expect(screen.getByRole('heading', { name: 'Strengthen your model' })).toBeInTheDocument()
    expect(screen.getByText('Define what success looks like')).toBeInTheDocument()
    expect(screen.getByText('Set a time horizon')).toBeInTheDocument()
    expect(screen.getByText('Add a risk worth watching')).toBeInTheDocument()
    expect(screen.getByText('Capture an insight while it is fresh')).toBeInTheDocument()
  })

  it('a static row shows why + try this, but never a "noticed" line', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /define what success looks like/i }))
    const body = screen.getByTestId('focus-card-body')
    expect(within(body).getByTestId('focus-why')).toBeInTheDocument()
    expect(within(body).getByTestId('focus-try')).toBeInTheDocument()
    expect(within(body).queryByTestId('focus-noticed')).toBeNull()
  })

  it('a server row renders its "what Olumi noticed" line verbatim', () => {
    const row: FocusRow = {
      id: 'sv',
      ownership: 'server_sourced',
      source: 'coaching_signal',
      primary: 'Server title',
      noticed: 'Olumi noticed this thing.',
      whyItMatters: 'Because reasons.',
    }
    renderPanel({ rows: [row] })
    fireEvent.click(screen.getByRole('button', { name: /server title/i }))
    expect(screen.getByTestId('focus-noticed')).toHaveTextContent('Olumi noticed this thing.')
  })

  it('renders the summary line verbatim when present, omits it when null', () => {
    const { rerender } = renderPanel({ summary: 'Here is your orientation.' })
    expect(screen.getByTestId('focus-summary')).toHaveTextContent('Here is your orientation.')
    rerender(<FocusNowPanel summary={null} rows={staticRows} banner={{ kind: 'none' }} />)
    expect(screen.queryByTestId('focus-summary')).toBeNull()
  })

  it('shows the honest empty state when there are no rows', () => {
    renderPanel({ rows: [] })
    expect(screen.getByTestId('focus-empty')).toHaveTextContent('Nothing to focus on right now.')
  })
})
