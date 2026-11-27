import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMe } from '../../../../olumiCore/me'
import { useUIStore } from '../../../../stores/uiStore'
import type { View } from '../../../client'
import { proposalVisual, versionVisual } from '../../../fixtures/core-o-v2m/runwayVisuals'
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
const chartSelector = '[data-form="CH-bands"]'

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
})

describe('Core’s reply visual in chat', () => {
  it.each([
    { binding: 'version', visual: versionVisual },
    { binding: 'proposal', visual: proposalVisual },
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
    expect(chart.querySelector('[data-band-range]')).toHaveAttribute('x', '50%')
    expect(chart.querySelector('[data-band-range]')).toHaveAttribute('width', '50%')
    expect(chart.querySelector('[data-band-middle]')).toHaveAttribute('x1', '75%')
    if ('version' in visual) {
      expect(chart.querySelector('[data-band-point]')).toHaveAttribute('cx', '60%')
      expect(chart.querySelector('[data-band-withheld-track]')).toBeNull()
    } else {
      const withheld = rows[1]!
      expect(withheld.querySelector('[data-band-withheld-track]')).toHaveClass('ok-scale-withheld')
      expect(withheld.querySelector('[data-band-range], [data-band-middle], [data-band-point]')).toBeNull()
    }
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
