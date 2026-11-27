/** A DOM row count for the 1232x704 panel budget. jsdom does not measure pixel height. */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

const chat = vi.hoisted(() => ({ prefill: vi.fn() }))
vi.mock('../../ViewChat', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../ViewChat')>()), prefillComposer: chat.prefill }))

import type { View } from '../../client'
import { CHECK_WORDS } from '../../check/words'
import { useViewStore } from '../../store'
import { REASONING_LABELS, RESTS_AT_REST, ViewReasoningBlock } from '../../ViewReasoning'
import { controls } from '../../../styles/controls'
import { clearWhatIf } from '../../whatif'
import { useMe } from '../../../olumiCore/me'
import { viewOf } from '../../port/__tests__/viewAt'

const ready = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
}
afterEach(() => { cleanup(); clearWhatIf(); chat.prefill.mockReset(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

const ROW = [
  'h3', '[data-check-aim-heading]', '[data-check-aim-line]', '[data-check-item]:not([data-check-tile])',
  '[data-check-more]:not([data-check-heading-toggle])', // The heading already counts a toggle in the same row.
  '[data-testid="view-reasoning-rests-toggle"]', '[data-rest] > p', '[data-rest-figure]',
  '[data-testid="view-reasoning-answered-toggle"]', '[data-testid="view-reasoning-commitment-records-toggle"]',
  '[data-examined]',
  '[data-testid="view-reasoning-premises-toggle"]', '[data-testid="reasoning-commit-open"]',
  '[data-testid="reasoning-commitment"] li', '[data-testid="reasoning-rests-key"]',
].join(', ')
const rows = () => {
  const panel = screen.getByTestId('view-reasoning')
  const visible = (selector: string) => [...panel.querySelectorAll(selector)].filter((row) => row.closest('[hidden]') === null).length
  return visible(ROW) + Math.ceil(visible('[data-check-tile]') / 2)
}
const CAPACITY_ROWS = 12
const goldens = readdirSync(path.resolve('src/olumiView/golden')).filter((n) => n.endsWith('.view.json')).sort()
const restsToggle = () => screen.getByTestId('view-reasoning-rests-toggle')

describe('Check at rest fits the 1232x704 panel row budget', () => {
  it('european: the rests door is closed at rest and reveals the groups, with further figures behind one press', () => {
    const view = viewOf('golden/european')
    ready(view); render(<ViewReasoningBlock />)
    const atRest = rows()
    expect(atRest, 'the total at rest').toBeLessThanOrEqual(CAPACITY_ROWS)
    expect(restsToggle()).toHaveAttribute('aria-expanded', 'false')
    expect(restsToggle().querySelector('[data-count]')).toHaveTextContent(String(view.model!.run!.rests.length))
    expect(document.querySelectorAll('[data-rest]')).toHaveLength(0)
    fireEvent.click(restsToggle())
    expect(rows()).toBeGreaterThan(atRest)
    const groups = [...document.querySelectorAll('[data-rest]')]
    expect(groups).toHaveLength(RESTS_AT_REST)
    expect(groups.every((g) => g.querySelectorAll('[data-rest-figure]').length <= 1)).toBe(true)
    expect(screen.getAllByTestId('reasoning-rests-more')).toHaveLength(1)
    fireEvent.click(screen.getByTestId('reasoning-rests-more'))
    expect([...document.querySelectorAll<HTMLElement>('[data-rest]')].map((group) => group.dataset.rest)).toEqual(view.model!.run!.rests.map((group) => group.id))
  })

  for (const name of goldens) {
    it(`${name}: Check groups and disclosures stay within the fixed budget`, () => {
      const view = viewOf(`golden/${name.replace(/\.view\.json$/, '')}`)
      expect(view.model, `${name}: a golden must supply a model`).not.toBeNull()
      ready(view); render(<ViewReasoningBlock />)
      expect(document.querySelectorAll('[data-rest]')).toHaveLength(0)
      for (const group of document.querySelectorAll('[data-check-group]')) {
        const kind = group.getAttribute('data-check-group')
        expect(group.querySelectorAll('[data-check-item]').length).toBeLessThanOrEqual(kind === 'needs' ? 4 : kind === 'examine' ? 1 : 2)
        if (kind === 'needs') expect(group.querySelectorAll('[data-check-item]:not([data-check-tile])')).toHaveLength(0)
      }
      expect(document.querySelectorAll('[data-check-aim-line]')).toHaveLength(0)
      console.info(`[fit] ${name}: ${rows()}`)
      expect(rows(), `${name}: ${rows()} rows`).toBeLessThanOrEqual(CAPACITY_ROWS)
    })
  }

  it('pricing: the door reveals its only group and figure without an inner fold', () => {
    ready(viewOf('golden/pricing')); render(<ViewReasoningBlock />)
    expect(document.querySelectorAll('[data-rest]')).toHaveLength(0)
    expect(rows()).toBeLessThanOrEqual(CAPACITY_ROWS)
    fireEvent.click(restsToggle())
    expect(document.querySelectorAll('[data-rest]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-rest-figure]')).toHaveLength(1)
    expect(screen.queryByTestId('reasoning-rests-more')).toBeNull()
  })
})

describe('Check actions are disclosed on selection', () => {
  it('a text question offers a quiet fill action and a challenge shows its card through selection alone', () => {
    const view = viewOf('golden/app-launch')
    view.model!.questions = []
    ready(view)
    render(<ViewReasoningBlock />)
    const select = (key: string) => {
      const row = document.querySelector(`[data-check-item="${key}"]`)!
      fireEvent.click(row)
      return within(row.closest('li')!)
    }
    expect(screen.queryByRole('button', { name: REASONING_LABELS.fill })).toBeNull()
    const question = select('q:0')
    const fill = question.getByRole('button', { name: REASONING_LABELS.fill })
    expect([fill.className.includes(controls.act), fill.className.includes('border-panel-border')]).toEqual([false, true])
    expect(question.getByRole('button', { name: view.model!.coaching_questions![0] })).toBeInTheDocument()
    fireEvent.click(fill)
    expect(chat.prefill.mock.calls).toEqual([[view.model!.coaching_questions![0]]])
    cleanup()
    const cap = viewOf('real/capacity'); ready(cap)
    render(<ViewReasoningBlock />)
    const challenge = document.querySelector<HTMLButtonElement>('[data-check-item^="c:"]')!
    expect(challenge).toBeInTheDocument()
    expect(challenge.className.includes(controls.act)).toBe(false)
    fireEvent.click(challenge)
    expect(challenge).toHaveAttribute('aria-expanded', 'true')
    const region = document.getElementById(challenge.getAttribute('aria-controls')!)!
    expect(within(region).getAllByRole('button').map((button) => button.textContent)).toEqual([CHECK_WORDS.ask])
  })
})
