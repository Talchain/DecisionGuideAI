/**
 * COLLAB — the navigation entry point to the blind-panel owner page.
 *
 * Before this existed, `/scenario/:id/panel` was URL-only: a pilot host had to
 * be handed the address out of band. This pins the TopBar entry: present with
 * the exact owner-panel href when the canvas is showing a persisted scenario,
 * absent otherwise (a guest scenario cannot mint a round — CEE refuses it —
 * so an entry point would be a control that lies).
 *
 * ⚠ jsdom CANNOT prove the control is VISIBLE — presence and href only. The
 * visibility rung belongs to the browser witness after deploy.
 *
 * The href expectation is a LITERAL, written from the user's side on purpose:
 * asserting `ownerPanelHash(...)` here would only prove the component agrees
 * with the helper, not that either is right. `panelRoute.spec.ts` binds the
 * helper to the deployed route table; this file binds the component to the
 * same literal shape.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { TopBar } from '../TopBar'
import { ToastProvider } from '../../../canvas/ToastContext'

function renderTopBar(panelScenarioId: string | null | undefined): void {
  render(
    <MemoryRouter>
      <ToastProvider>
        <TopBar
          scenarioTitle="Pricing decision"
          onTitleChange={vi.fn()}
          onShare={vi.fn()}
          panelScenarioId={panelScenarioId}
        />
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('TopBar blind-panel entry point', () => {
  it('links to the owner panel page for THIS scenario', () => {
    renderTopBar('scn-entry-1')
    const link = screen.getByTestId('topbar-panel-link')
    expect(link).toHaveAttribute('href', '#/scenario/scn-entry-1/panel')
  })

  it('is a real link with an accessible name a person can find', () => {
    renderTopBar('scn-entry-1')
    const byName = screen.getByRole('link', { name: /ask your team/i })
    // IDENTITY: the named link IS the entry point, not some neighbour.
    expect(byName).toBe(screen.getByTestId('topbar-panel-link'))
  })

  it('percent-encodes the scenario id in the href', () => {
    renderTopBar('a b')
    expect(screen.getByTestId('topbar-panel-link')).toHaveAttribute(
      'href',
      '#/scenario/a%20b/panel',
    )
  })

  it('is absent without a persisted scenario — with the Share control as the positive control', () => {
    renderTopBar(null)
    expect(screen.queryByTestId('topbar-panel-link')).toBeNull()
    // POSITIVE CONTROL: the bar itself rendered; absence is not an empty page.
    expect(screen.getByRole('button', { name: /share decision/i })).toBeInTheDocument()
  })

  it('is absent when the prop is not passed at all (every existing call site)', () => {
    renderTopBar(undefined)
    expect(screen.queryByTestId('topbar-panel-link')).toBeNull()
  })
})
