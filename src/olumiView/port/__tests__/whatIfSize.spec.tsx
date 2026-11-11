/**
 * SCI-13 (DL 11 Nov; core `wip/science-size` 7e998523, `### SCI-13 field`): a what-if says the size of what happens beside each chance,
 * over the same draws: core's `variants[].size[].line`, verbatim, beside the variant's chance rows in the existing what-if surfaces (the
 * dock's "What-if, not saved" box and the What if lens's key card). Bound by identity: each line by its option and aim ids and its View path.
 * The real path: the reviewer's six-to-seven developers replay as core's own `whatif-size.test.ts` builds it (the Paul extraction fixture
 * approved as version 1 through core's Service with a scripted draft, no provider), then `GET …/view` and `POST …/whatif` (developers = 7)
 * through core's own route at 7e998523; both responses copied unedited (`fixtures/sci13-size-replay.{view3,whatif}.json`).
 */
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../../client'
import { useViewStore } from '../../store'
import { useMe } from '../../../olumiCore/me'
import { clearWhatIf, useWhatIf, type WhatIfAnswer } from '../../whatif'
import { WhatIfShown } from '../../ViewChances'
import { Compare } from '../../WhatIfCompare'

const read = <T,>(n: string): T => JSON.parse(readFileSync(path.resolve('src/olumiView/port/__tests__/fixtures', n), 'utf8')) as T
const view = read<View>('sci13-size-replay.view3.json'), answer = read<WhatIfAnswer>('sci13-size-replay.whatif.json')
const variant = answer.variants[0]!, size = variant.size!
const show = (v = variant) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  useWhatIf.setState({ shown: { sid: view.id, base: view.model!.edit_base!, quantity: 'developers', typed: '7', variant: v } })
}
afterEach(() => { cleanup(); clearWhatIf(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })
const lines = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>('[data-whatif-size]')].map((e) => [e.getAttribute('data-whatif-size'), e.getAttribute('data-view'), e.textContent])
const want = size.map((s, k) => [`${s.option}:${s.goal}`, `whatif.size.${k}.line`, s.line])

describe('size beside chance, on the six-to-seven developers replay (core\'s route at 7e998523)', () => {
  it('SZ0 control: core answers one entry per live option per aim, each read, and the reviewer\'s line is among them', () => {
    expect(size.map((s) => [s.option, s.goal, s.read])).toEqual([
      ['hire_a_tech_lead', 'increase_productivity', true], ['hire_two_developers', 'increase_productivity', true], ['hire_a_tech_lead_and_one_developer', 'increase_productivity', true],
      ['hire_a_tech_lead', 'maintain_code_quality', true], ['hire_two_developers', 'maintain_code_quality', true], ['hire_a_tech_lead_and_one_developer', 'maintain_code_quality', true],
    ])
    expect(size.find((s) => s.option === 'hire_two_developers' && s.goal === 'maintain_code_quality')!.line).toBe("In this what-if, 'Hire two developers' on 'Maintain code quality': the chance is about 22% before and after, met in the same draws of all 10,000; "
      + "the middle of 'Change in defects found after release' moves from 6.01% to 5.16%.")
  })

  it('SZ1: the dock\'s what-if box draws every line, verbatim, under its own option\'s chance rows', () => {
    show(); render(<WhatIfShown model={view.model!} />)
    const box = document.querySelector<HTMLElement>('[data-testid="view-whatif"]')!
    // Grouped by option, each under its option's block, in core's order within it (never re-ranked here).
    expect(lines(box).slice().sort()).toEqual(want.slice().sort())
    const cards = [...box.querySelectorAll<HTMLElement>('[data-whatif-card]')]
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards) {
      const option = card.getAttribute('data-whatif-card')!
      expect(lines(card), option).toEqual(want.filter((_, k) => size[k]!.option === option))
    }
  })

  it('SZ2: the What if lens\'s key card draws the same lines, each under its option', () => {
    show(); const c = render(<Compare model={view.model!} shown={useWhatIf.getState().shown!} />).container
    expect(lines(c).slice().sort()).toEqual(want.slice().sort())
    for (const s of size) expect(c.querySelector(`[data-whatif-size="${s.option}:${s.goal}"]`)!.closest('[data-whatif-key-option]')!.getAttribute('data-whatif-key-option')).toBe(s.option)
  })

  it('SZ3 contrast: an answer with no `size` (an older core) draws no such line, and the chance rows are drawn as before', () => {
    const { size: _drop, ...older } = variant
    show(older as typeof variant); render(<WhatIfShown model={view.model!} />)
    expect(document.querySelectorAll('[data-whatif-size]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-whatif-card]')).toHaveLength(variant.rows.length)
  })
})
