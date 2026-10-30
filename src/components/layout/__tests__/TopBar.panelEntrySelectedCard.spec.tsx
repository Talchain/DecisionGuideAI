/**
 * S4 (30 Oct): "Ask your team" carries the ONE selected card into round setup, which offers it only where a panel can
 * answer it. No selection, or several, carries nothing (the bare link, as before).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TopBar } from '../TopBar'
import { ToastProvider } from '../../../canvas/ToastContext'
import { useCanvasStore } from '../../../canvas/store'

const node = (id: string, selected: boolean) => ({ id, type: 'factor', position: { x: 0, y: 0 }, data: { label: id }, selected })
const renderTopBar = () => render(
  <MemoryRouter><ToastProvider>
    <TopBar scenarioTitle="Churn" onTitleChange={vi.fn()} onShare={vi.fn()} panelScenarioId="scn-1" />
  </ToastProvider></MemoryRouter>,
)

describe('TopBar "Ask your team" and the selected card', () => {
  beforeEach(() => useCanvasStore.setState({ nodes: [] }))

  it('one selected card rides as the round\'s prefilled target', () => {
    useCanvasStore.setState({ nodes: [node('monthly_churn', true), node('churn_warning', false)] as never })
    renderTopBar()
    expect(screen.getByTestId('topbar-panel-link')).toHaveAttribute('href', '#/scenario/scn-1/panel?factor=monthly_churn')
  })

  it('NEGATIVE: two selected cards carry nothing', () => {
    useCanvasStore.setState({ nodes: [node('monthly_churn', true), node('churn_warning', true)] as never })
    renderTopBar()
    expect(screen.getByTestId('topbar-panel-link')).toHaveAttribute('href', '#/scenario/scn-1/panel')
  })
})
