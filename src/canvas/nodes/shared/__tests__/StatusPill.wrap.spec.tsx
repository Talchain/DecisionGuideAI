/** A long ruled sentence wraps inside the card instead of running past its edge (risk card, served 20 Oct 2026). */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusPill } from '../StatusPill'
import { UNFINISHED_CONTRIBUTION_COPY } from '../analysisParticipation'

describe('StatusPill wrap', () => {
  it('a wrapping pill may shrink and break its line, and keeps the whole sentence', () => {
    render(<StatusPill testId="p" label={UNFINISHED_CONTRIBUTION_COPY} title={UNFINISHED_CONTRIBUTION_COPY} wrap />)
    const el = screen.getByTestId('p')
    expect(el.className).toContain('whitespace-normal')
    expect(el.className).not.toContain('whitespace-nowrap')
    expect(el.textContent).toBe(UNFINISHED_CONTRIBUTION_COPY)
  })
  it('CONTRAST: every other pill keeps its one-line anatomy', () => {
    render(<StatusPill testId="q" label="Needs input" />)
    expect(screen.getByTestId('q').className).toContain('whitespace-nowrap')
  })
})
