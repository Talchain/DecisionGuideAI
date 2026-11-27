import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMe } from '../../../../olumiCore/me'
import { useUIStore } from '../../../../stores/uiStore'
import type { View } from '../../../client'
import { proposalVisual, savedVisual, versionVisual } from '../../../fixtures/core-o-v2m/runwayVisuals'
import * as tabRing from '../../../reasoning/tabRing'
import { useViewStore } from '../../../store'
import { ViewChat } from '../../../ViewChat'

const { call } = vi.hoisted(() => ({
  call: vi.fn(async () => { throw new Error('Unexpected Core call') }),
}))
vi.mock('../../../../olumiCore/team/api', async (original) => ({
  ...await original<typeof import('../../../../olumiCore/team/api')>(), call,
}))
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))

const served: View = JSON.parse(readFileSync('src/olumiView/fixtures/real/capacity.view3.json', 'utf8'))
const chartSelector = '[data-form="CH-bands"][data-quantity]' // the chart root; each band inside is the same registered form

function ready(visual: unknown) {
  const chat = served.chat.map((turn) => turn.answer === null ? turn : { ...turn, answer: { ...turn.answer, visual } })
  useViewStore.setState({
    uuid: '00000000-0000-4000-8000-000000000001', sid: served.id, view: { ...served, chat },
    status: 'ready', error: null, stale: false, at: null,
  })
}

const fetchStub = vi.fn(async () => { throw new Error('Unexpected fetch') })
beforeEach(() => {
  vi.stubGlobal('fetch', fetchStub)
  useMe.setState({ me: { id: served.you_id, name: served.you }, status: 'ready' })
  useUIStore.setState({ activeOutputTab: 'olumi' })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' })
  useMe.setState({ me: null, status: 'none' })
  expect(call).not.toHaveBeenCalled()
  expect(fetchStub).not.toHaveBeenCalled()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('Core’s reply visual in chat', () => {
  it.each([
    { binding: 'version', visual: versionVisual },
    { binding: 'proposal', visual: proposalVisual },
    { binding: 'saved version with its proposal', visual: savedVisual },
  ])('draws the $binding payload in Core’s order with its heading, labels and text', ({ visual }) => {
    ready(visual)
    const { container } = render(<ViewChat />)
    expect(container.querySelectorAll(chartSelector)).toHaveLength(1)
    const chart = container.querySelector(chartSelector)!
    expect(chart.querySelector('[data-band-heading]')?.textContent).toBe(visual.label)
    const rows = [...chart.querySelectorAll('[data-band-option]')]
    expect(rows.map((row) => [
      row.getAttribute('data-band-option'),
      row.querySelector('[data-band-letter]')?.textContent,
      row.querySelector('[data-band-label]')?.textContent,
      row.querySelector('[data-band-words]')?.textContent,
    ])).toEqual(visual.options.map(({ option, letter, label, text }) => [option, letter, label, text]))
    expect(chart.querySelectorAll('[data-band-track]')).toHaveLength(visual.options.length)
    expect(chart.querySelector('[data-outcome-band]')).toHaveAttribute('x', '50%')
    expect(chart.querySelector('[data-outcome-band]')).toHaveAttribute('width', '50%')
    expect(chart.querySelector('[data-outcome-mid]')).toHaveAttribute('x1', '75%')
    if (!visual.options.some((lane) => 'withheld' in lane)) {
      expect(chart.querySelector('[data-outcome-point]')).toHaveAttribute('cx', '60%')
      expect(chart.querySelector('[data-outcome-point]')).toHaveClass('fill-option')
      expect(chart.querySelector('[data-band-withheld-track]')).toBeNull()
    } else {
      const withheld = rows[1]!
      expect(withheld.querySelector('[data-band-withheld-track]')).toHaveClass('ok-scale-withheld')
      expect(withheld.querySelector('[data-outcome-band], [data-outcome-mid], [data-outcome-point]')).toBeNull()
    }
  })

  it('distinguishes a narrow range from a single value on a 0–100 axis', () => {
    ready({
      ...savedVisual,
      options: [
        { option: 'narrow', letter: 'A', label: 'Narrow range', text: '80–80.2 months, around 80.1', p10: 80, p50: 80.1, p90: 80.2 },
        { option: 'flat', letter: 'B', label: 'Single value', text: '80 months', p10: 80, p50: 80, p90: 80 },
        { option: 'anchor', letter: 'C', label: 'Upper anchor', text: '100 months', p10: 100, p50: 100, p90: 100 },
      ],
    })
    const { container } = render(<ViewChat />)
    const narrow = container.querySelector('[data-band-option="narrow"]')!
    const band = narrow.querySelector<SVGRectElement>('[data-outcome-band]')!
    expect(band).toHaveAttribute('data-outcome-band', '80:80.2')
    expect(band).toHaveClass('stroke-option') // too narrow to see: a 2 px option-colour outline keeps it a band, with no inline style
    expect(band).toHaveAttribute('stroke-width', '2')
    expect(band.getAttribute('style')).toBeNull()
    expect(narrow.querySelector('[data-outcome-mid]')).toHaveAttribute('x1', '80.1%')
    expect(narrow.querySelector('[data-outcome-point]')).toBeNull()
    const flat = container.querySelector('[data-band-option="flat"]')!
    expect(flat.querySelector('[data-outcome-point]')).toHaveAttribute('cx', '80%')
    expect(flat.querySelector('[data-outcome-band], [data-outcome-mid]')).toBeNull()
  })

  it('draws plain reply rows that leave the canvas alone', () => {
    const ring = vi.spyOn(tabRing, 'ringFrom')
    const press = vi.spyOn(tabRing, 'pressCard')
    ready(savedVisual)
    const { container, unmount } = render(<ViewChat />)
    const chart = container.querySelector(chartSelector)!
    expect(chart.querySelector('button, [role="button"], [tabindex]')).toBeNull()
    const label = chart.querySelector('[data-band-label]')!
    fireEvent.mouseEnter(label)
    fireEvent.focus(label)
    fireEvent.click(label)
    fireEvent.mouseLeave(label)
    unmount()
    expect(ring).not.toHaveBeenCalled()
    expect(press).not.toHaveBeenCalled()
    expect(label.parentElement?.querySelector('[data-band-letter]')).toHaveClass('text-text-light')
  })

  it.each([
    ['absent visual', undefined],
    ['extra chart field', { ...versionVisual, binding: { kind: 'version', id: 7 } }],
    ['extra option field', { ...proposalVisual, options: [{ ...proposalVisual.options[0], provenance: 'olumi' }] }],
    ['old lanes payload', {
      kind: 'visual', chart: 'CH-bands', quantity: 'runway', run: 'runway-run-1', unit: 'month',
      binding: { kind: 'version', id: 7, label: 'version 7' },
      lanes: [{ ...versionVisual.options[0], state: 'value', if_absent: [], if_approved: null, provenance: { kind: 'theirs', author: null } }],
    }],
  ])('keeps the reply and skips the chart for %s', (_name, visual) => {
    ready(visual)
    const { container, getByTestId } = render(<ViewChat />)
    expect(container.querySelector(chartSelector)).toBeNull()
    expect(getByTestId('view-chat-answer')).toBeInTheDocument()
  })
})
