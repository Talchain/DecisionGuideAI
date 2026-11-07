/**
 * Strategy lane (7 Nov): the header's opener and the Overview over the canvas stage, bound to the View core served on :3994 (olumi-core
 * wip/strategy-n1 297e0c15): core's words for the control and the page heading, the pressed state, and nothing without core's key.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useOverview } from '../strategy/overview/useOverview'
import { StrategyOverviewOpener, StrategyOverviewStage } from '../strategy/overview/StrategyOverviewOpener'
import { StrategyOverviewPage } from '../strategy/overview/StrategyOverviewPage'
import { ViewLensBar } from '../ViewLensBar'

const served: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/strategy', 'growth-reveal-n1.view3.json'), 'utf8'))
const none: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-reveal.view3.json'), 'utf8'))
const Both = () => (<><StrategyOverviewOpener /><StrategyOverviewStage>{(view, close) => <StrategyOverviewPage view={view} onClose={close} />}</StrategyOverviewStage></>)

beforeEach(() => { useOverview.setState({ open: false }); useViewStore.setState({ uuid: '00000000-0000-4000-8000-0d2f87ec6d67', sid: served.id, view: served, status: 'ready', error: null, stale: false, at: null }) })
afterEach(() => cleanup())

describe('the Strategy Overview from the header (served View)', () => {
  it('the opener says core’s words and opens the page over the stage with core’s heading; pressing again or Close returns the board', () => {
    render(<Both />)
    const opener = screen.getByTestId('strategy-overview-opener')
    expect(opener).toHaveTextContent(served.strategy!.headings.overview)
    expect(opener).toHaveTextContent('Strategy overview')
    expect(opener).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByTestId('strategy-overview-stage')).toBeNull()
    fireEvent.click(opener)
    expect(opener).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('strategy-overview-page')).toHaveTextContent(served.strategy!.overview.heading)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('strategy-overview-stage')).toBeNull()
    expect(opener).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(opener); fireEvent.click(opener)
    expect(screen.queryByTestId('strategy-overview-stage')).toBeNull()
  })
  it('Esc closes the page and focus goes back to the opener; Close does the same (UI session, 7 Nov)', async () => {
    render(<Both />)
    const opener = screen.getByTestId('strategy-overview-opener')
    opener.focus(); fireEvent.click(opener)
    expect(screen.getByTestId('strategy-overview-stage')).toBeInTheDocument()
    screen.getByRole('button', { name: 'Close' }).focus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('strategy-overview-stage')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(opener))
    opener.focus(); fireEvent.click(opener)
    screen.getByRole('button', { name: 'Close' }).focus()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(document.activeElement).toBe(opener))
  })
  it('Esc in the header’s Explore menu closes the menu alone; the Overview stays open (zero-call smoke, 7 Nov)', () => {
    useOverview.setState({ open: true })
    render(<><Both /><ViewLensBar nav /></>)
    fireEvent.click(screen.getByTestId('lens-bar-explore'))
    const item = screen.getByTestId('lens-bar-explore-menu').querySelector('[role="menuitemradio"]') as HTMLElement
    item.focus()
    fireEvent.keyDown(item, { key: 'Escape' })
    expect(screen.getByTestId('strategy-overview-stage')).toBeInTheDocument()
  })
  it('the header’s Model · Explore · Team sits above the Overview’s layer, so it stays in reach over the page', () => {
    useOverview.setState({ open: true })
    render(<><Both /><ViewLensBar nav /></>)
    const z = (el: Element) => Number(/\bz-\[(\d+)\]/.exec(el.className)?.[1] ?? NaN)
    expect(z(screen.getByTestId('lens-bar'))).toBeGreaterThan(z(screen.getByTestId('strategy-overview-stage')))
  })
  it('without core’s strategy key there is no opener and no stage, even if the store was left open', () => {
    useViewStore.setState({ view: none }); useOverview.setState({ open: true })
    const { container } = render(<Both />)
    expect(container).toBeEmptyDOMElement()
  })
})
