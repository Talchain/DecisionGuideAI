/**
 * Accessibility — no axe violations across key states; region naming + operable
 * controls. color-contrast is disabled (repo convention: a flagged DS
 * token-level landmine, not a panel defect).
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe, configureAxe } from 'vitest-axe'
import { FocusNowPanel } from '../FocusNowPanel'
import { buildFocusRows } from '../buildFocusRows'
import type { FocusNowProps } from '../focusTypes'

configureAxe({ rules: { 'color-contrast': { enabled: false } } })

const staticRows = buildFocusRows({}).rows
function renderPanel(overrides: Partial<FocusNowProps> = {}) {
  const props: FocusNowProps = { summary: null, rows: staticRows, banner: { kind: 'none' }, ...overrides }
  return render(<FocusNowPanel {...props} />)
}

async function expectNoViolations(container: HTMLElement) {
  const results = await axe(container)
  expect(results.violations).toEqual([])
}

describe('FocusNowPanel accessibility', () => {
  it('has no violations when collapsed', async () => {
    const { container } = renderPanel()
    await expectNoViolations(container)
  })

  it('has no violations with a row expanded', async () => {
    const { container } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /define what success/i }))
    await expectNoViolations(container)
  })

  it('has no violations with the stale banner shown', async () => {
    const { container } = renderPanel({ banner: { kind: 'stale', canRerun: true }, onRerun: () => {} })
    await expectNoViolations(container)
  })

  it('has no violations in the empty state', async () => {
    const { container } = renderPanel({ rows: [] })
    await expectNoViolations(container)
  })

  it('names the panel region and the icon-only re-run affordance', () => {
    renderPanel({ banner: { kind: 'stale', canRerun: true }, onRerun: () => {} })
    expect(screen.getByRole('region', { name: 'Strengthen your model' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Re-run analysis' })).toBeInTheDocument()
  })
})
