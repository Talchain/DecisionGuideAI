/**
 * "What could change the result" on the olumi-core lane (UI recovery row 16, DL 10 Nov 2026): the previous accordion around the driver
 * chart, the tab's one home for what moves each option's chance. Fixtures are core's own captures.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { View } from '../../client'
import { useViewStore } from '../../store'
import { useMe } from '../../../olumiCore/me'
import { PortAnalysisTab } from '../PortAnalysisTab'
import { tornadoRowsOf } from '../DriverTornado'
import { WhatWouldChange } from '../WhatWouldChange'
import { viewOf } from './viewAt'

const ready = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
}
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })
const drawn = (path: string) => document.querySelectorAll(`[data-view="${path}"]`).length

describe('What could change the result: the previous accordion on core\'s View', () => {
  it('WC1: titled and sub-titled in core\'s words, open at first, counting the charted options', () => {
    const view = viewOf('real/hiring')
    ready(view)
    render(<WhatWouldChange model={view.model!} />)
    const section = screen.getByTestId('accordion-tornado')
    expect(within(section).getByRole('heading', { name: view.lens_words.label.what_changes })).toBeInTheDocument()
    expect(section).toHaveTextContent(view.lens_words.hint.what_changes)
    expect(within(section).getByRole('button', { expanded: true })).toBeInTheDocument()
    expect(within(section).getByTestId('port-driver-tornado').querySelectorAll('[data-tornado-row]')).toHaveLength(tornadoRowsOf(view.model!).length)
    expect(tornadoRowsOf(view.model!).length).toBe(3)
  })

  it('WC2: the chart carries a key for its three marks, apart from the axis', () => {
    const view = viewOf('real/hiring')
    ready(view)
    render(<WhatWouldChange model={view.model!} />)
    const key = screen.getByTestId('port-driver-tornado-key')
    expect([...key.children].map((e) => e.textContent)).toEqual(['low', 'high', 'now'])
    expect(screen.getByTestId('port-driver-tornado-axis')).not.toContainElement(key)
  })

  it('WC3: core\'s line on what the two chances are is said once in the tab, here, with the hero\'s disclosure open too', () => {
    const view = viewOf('golden/bakery')
    ready(view)
    render(<PortAnalysisTab />)
    const s = view.model!.run!.sensitivity
    expect(within(screen.getByTestId('accordion-tornado')).getByText(s.text)).toHaveAttribute('data-view', 'run.sensitivity.text')
    const toggle = screen.queryByTestId('port-evidence-toggle')
    if (toggle !== null) fireEvent.click(toggle)
    expect(drawn('run.sensitivity.text')).toBe(1)
    expect(screen.queryByTestId('port-evidence-tab-drivers')).toBeNull()
    expect(screen.queryByTestId('port-evidence-drivers')).toBeNull()
  })

  it('WC4: an option\'s driver sentence that no row says is said here, once; one a row says is not repeated', () => {
    const view = structuredClone(viewOf('golden/bakery'))
    const m = view.model!
    const withDriver = m.cards.filter((c) => c.family === 'option' && c.driver != null)
    expect(withDriver.length).toBeGreaterThan(1)
    // The first option loses its chance rows, so no row says its driver sentence; the second keeps its own.
    const orphan = withDriver[0]!, kept = withDriver[1]!
    orphan.rows = orphan.rows.filter((r) => r.kind !== 'chance')
    ready(view)
    render(<PortAnalysisTab />)
    const section = screen.getByTestId('accordion-tornado')
    expect(section.querySelector(`[data-view="${orphan.id}.driver.text"]`)).toHaveTextContent(orphan.driver!.text)
    expect(section.querySelector(`[data-view="${kept.id}.driver.text"]`)).toBeNull()
    expect(drawn(`${orphan.id}.driver.text`)).toBe(1)
    // The kept option's sentence stays its own row's to say (in the row's detail): never more than once anywhere.
    expect(drawn(`${kept.id}.driver.text`)).toBeLessThanOrEqual(1)
  })

  it('WC5: nothing to say draws no section', () => {
    const view = structuredClone(viewOf('real/hiring'))
    for (const c of view.model!.cards) c.driver = null
    ready(view)
    const { container } = render(<WhatWouldChange model={view.model!} />)
    expect(container).toBeEmptyDOMElement()
  })
})
