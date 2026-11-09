/**
 * SC-02, said once (core run.shared_rests, candidate f1fa8790): when every option's chance for an aim rests on the same line, core says it
 * once in `run.shared_rests` and no row carries it. The Analysis tab draws that line once, in that aim's group, at its View path.
 * Fixture: core's own viewOf on golden european with every option's chance resting on the same records (core rests-once.test input(true)),
 * produced on core f1fa8790 + wip/ai-jobs-msgs (local merge e211c4a3), unedited.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../../client'
import { useViewStore } from '../../store'
import { PortAnalysisTab } from '../PortAnalysisTab'
import { viewOf } from './viewAt'

const put = (view: View) => useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
const leaves = (text: string) => [...document.querySelectorAll<HTMLElement>('[data-testid="port-analysis-tab"] *')].filter((e) => e.children.length === 0 && e.textContent === text)
afterEach(cleanup)

describe('SC-02: what every option\'s chance for an aim rests on, said once on the Analysis tab', () => {
  it('core\'s shared line is drawn once, in its aim\'s group, at run.shared_rests.<i>.text; no row repeats it', () => {
    const view = viewOf('core/sc02-european-shared-rests'), s = view.model!.run!.shared_rests!
    expect(s).toHaveLength(1)
    put(view); render(<PortAnalysisTab />)
    const drawn = document.querySelectorAll('[data-view="run.shared_rests.0.text"]')
    expect(drawn).toHaveLength(1)
    expect(drawn[0]!.textContent).toBe(s[0]!.text)
    expect(drawn[0]!.closest('[data-testid="port-aim-group"]')!.getAttribute('data-aim')).toBe(s[0]!.aim_id)
    expect(leaves(s[0]!.text)).toHaveLength(1)
    // Core took it off the rows: none of that aim's rows draws a rests-on line of its own.
    for (const o of s[0]!.options) expect(document.querySelector(`[data-option-id="${o}"] [data-testid="port-row-rests-on"]`)).toBeNull()
  })

  it('contrast: a View with no shared line (golden european) draws none, and each row keeps its own line', () => {
    const view = viewOf('golden/european')
    expect(view.model!.run!.shared_rests ?? null).toBeNull()
    put(view); render(<PortAnalysisTab />)
    expect(document.querySelectorAll('[data-testid="port-aim-rests"]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-testid="port-row-rests-on"]').length).toBeGreaterThan(0)
  })
})
