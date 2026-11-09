/**
 * DL round 5 (9 Nov; the r5 re-score's second loss): on the hiring board the canvas said "about 23% chance" while the Analysis panel showed
 * "Not checked yet: maintaining code quality" for every option straight under "Chance of 'increase productivity'". One field read two ways:
 * core lists the unchecked aim's row first, and the panel grouped aims in first-appearance order. The aim the lead speaks of now goes
 * first; every other group still follows, nothing dropped. Fixture: the View core 3ff64f75 served for the judged hiring run (candidate
 * check 20261109T043515Z), unedited.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../../client'
import { useViewStore } from '../../store'
import { PortAnalysisTab } from '../PortAnalysisTab'
import { viewOf } from './viewAt'

const put = (view: View) => useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
afterEach(cleanup)

describe('the Analysis panel opens on the aim its lead names, the one the canvas gives a chance for', () => {
  it('hiring: the first option row is each option\'s chance for "increase productivity"; code quality still follows, after it', () => {
    const view = viewOf('real/hiring-unchecked-first'), m = view.model!
    const tech = m.cards.find((c) => c.id === 'hire_a_tech_lead')!
    // The precondition, core's: the unchecked aim's row comes first, the headline's aim second.
    expect([tech.rows[0]!.aim_id, tech.rows[1]!.aim_id, tech.headline!.aim_id]).toEqual(['maintaining_code_quality', 'increase_productivity', 'increase_productivity'])
    put(view); render(<PortAnalysisTab />)
    const groups = [...document.querySelectorAll('[data-testid="port-aim-group"]')].map((g) => g.getAttribute('data-aim'))
    expect(groups[0]).toBe('increase_productivity')
    expect(groups).toContain('maintaining_code_quality')
    const first = document.querySelector('[data-testid="port-option-row"]')!
    expect(first.textContent).toContain(tech.headline!.text)
    expect(first.textContent).not.toContain('Not checked yet')
  })
})
