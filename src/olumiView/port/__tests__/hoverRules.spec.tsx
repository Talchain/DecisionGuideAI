/**
 * Rules the analysis lane's files keep, bound by what the person gets (S4 round 3, Codex review-analysis-2):
 *  - hover is the one Tip: no native `title` is drawn on the Analysis or Reasoning tabs (the figure editor's own controls are another file's), and each hover
 *    is reachable by REAL keyboard focus, not only a pointer;
 *  - every disclosure button names the region it opens (`aria-controls` resolves to a drawn element while it is open);
 *  - the analysis recipes reach the OUTPUTS DOCK: `.olumi-look` is the canvas's (ReactFlow) class and the dock is its sibling, so no analysis rule sits behind it.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../../client'
import { useViewStore } from '../../store'
import { useMe } from '../../../olumiCore/me'
import { PortAnalysisTab } from '../PortAnalysisTab'
import { ViewReasoningBlock } from '../../ViewReasoning'
import { tipOnFocus } from '../../__tests__/tipHelpers'
import { viewOf } from './viewAt'

const ready = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
}
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

/** The figure editor draws its own pencil (another file's, with its own rule); everything else on these tabs says its longer words through the Tip. */
const NATIVE = '[title]:not([data-testid*="-edit-"]):not([data-testid*="-aside-edit-"])'
const offenders = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>(NATIVE)].map((e) => `${e.tagName.toLowerCase()}[${e.getAttribute('data-view') ?? e.getAttribute('data-testid') ?? ''}] title="${(e.getAttribute('title') ?? '').slice(0, 40)}"`)

describe('hover is the one Tip: no native title on the analysis lane', () => {
  for (const name of ['golden/bakery', 'golden/european', 'golden/pricing', 'golden/app-launch'] as const) {
    it(`${name}: the Analysis tab and the Reasoning tab draw no native title`, () => {
      const view = viewOf(name)
      ready(view)
      const a = render(<PortAnalysisTab />)
      expect(offenders(a.container), 'Analysis').toEqual([])
      cleanup()
      ready(view)
      const r = render(<ViewReasoningBlock />)
      expect(offenders(r.container), 'Reasoning').toEqual([])
    })
  }
  it('the analysis lane\'s source writes no title= attribute (the guard for what a given View does not reach)', () => {
    const root = path.resolve('src/olumiView')
    const files = [
      ...readdirSync(path.join(root, 'port')).filter((n) => n.endsWith('.tsx')).map((n) => path.join('port', n)),
      ...readdirSync(path.join(root, 'reasoning')).filter((n) => n.endsWith('.tsx')).map((n) => path.join('reasoning', n)),
      'ViewReasoning.tsx',
      'ViewChances.tsx',
    ]
    const found = files.flatMap((f) => readFileSync(path.join(root, f), 'utf8').split('\n').flatMap((line, i) => (/(^|[\s<])title=[{"']/.test(line) ? [`${f}:${i + 1}`] : [])))
    expect(found).toEqual([])
  })
  it('bakery: the chart\'s lens heading, the lead-change words and a ranking\'s figure mark each reach the Tip by REAL keyboard focus', async () => {
    const view = viewOf('golden/bakery'), run = view.model!.run!
    ready(view); render(<PortAnalysisTab />)
    const goal = run.lenses!.find((l) => l.id === 'goal')!
    const heading = document.querySelector<HTMLElement>('[data-view="run.lead"]')!
    expect([heading.getAttribute('title'), heading.tabIndex]).toEqual([null, 0])
    expect(await tipOnFocus(heading)).toBe(goal.title)
    const mark = document.querySelector<HTMLElement>('[data-find-out-figure] [role="img"]')
    if (mark !== null) expect([mark.getAttribute('title'), mark.tabIndex, await tipOnFocus(mark)]).toEqual([null, 0, mark.getAttribute('aria-label')])
  })
})

describe('a mark inside a pressable Limits row keeps its words reachable', () => {
  it('every golden: a Limits row that carries Olumi\'s mark says the mark\'s own title in the row\'s one Tip, as its body line', async () => {
    let seen = 0
    for (const name of ['golden/bakery', 'golden/european', 'golden/pricing', 'golden/app-launch'] as const) {
      ready(viewOf(name)); render(<PortAnalysisTab />)
      for (const row of document.querySelectorAll<HTMLElement>('[data-limit-option]')) {
        const mark = row.querySelector<HTMLElement>('[role="img"][aria-label]')
        if (mark === null) continue
        seen += 1
        expect((await tipOnFocus(row)).includes(mark.getAttribute('aria-label')!), `${name}: ${row.dataset['limitOption']}`).toBe(true)
      }
      cleanup()
    }
    expect(seen, 'at least one golden draws a marked Limits row').toBeGreaterThan(0)
  })
})

describe('every disclosure names the region it opens', () => {
  it('european: the chart\'s "more", the long reading\'s toggle, the rests\' "show more" and the examine list\'s press each carry aria-controls resolving to a drawn region once open', () => {
    const view = viewOf('golden/european')
    ready(view); render(<PortAnalysisTab />)
    for (const id of ['analysis-chart-more', 'analysis-why-toggle', 'reasoning-rests-more']) {
      const btn = screen.getByTestId(id)
      expect([id, btn.getAttribute('aria-expanded')]).toEqual([id, 'false'])
      // the chart's and the long reading's region is drawn only when open, so closed they name nothing (the rests' target is always drawn)
      if (id !== 'reasoning-rests-more') expect(btn.getAttribute('aria-controls'), `${id}: closed`).toBeNull()
      fireEvent.click(btn)
      expect([id, btn.getAttribute('aria-expanded')]).toEqual([id, 'true'])
      const region = document.getElementById(btn.getAttribute('aria-controls') ?? '')
      expect([id, region !== null]).toEqual([id, true])
    }
    cleanup()
    ready(view); render(<ViewReasoningBlock />)
    const more = screen.queryByTestId('reasoning-examine-more')
    if (more !== null) {
      fireEvent.click(more)
      expect([more.getAttribute('aria-expanded'), document.getElementById(more.getAttribute('aria-controls') ?? '') !== null]).toEqual(['true', true])
    }
  })
})

describe('the analysis recipes reach the outputs dock', () => {
  const css = readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8')
  const block = css.slice(css.indexOf('/* analysis */'), css.indexOf('/* LINKS'))
  const rules = block.split('\n').filter((l) => l.startsWith('.'))
  it('every `ok-an-*` class a component uses has a rule, and no such rule stands behind `.olumi-look` (the canvas\'s class; the dock is its sibling) or on `--o-s` (the canvas\'s scale, undefined in the dock)', () => {
    const used = new Set(['port/PortAnalysisTab.tsx', 'port/WhatMovesIt.tsx'].flatMap((f) => [...readFileSync(path.resolve('src/olumiView', f), 'utf8').matchAll(/ok-an-[a-z-]+/g)].map((m) => m[0])))
    expect([...used].length).toBeGreaterThan(0)
    for (const c of used) expect(rules.some((r) => r.startsWith(`.${c} `)), `${c} has a rule at the root`).toBe(true)
    expect(rules.length).toBeGreaterThan(0)
    expect(rules.filter((r) => r.includes('.olumi-look')), 'behind the canvas class').toEqual([])
    expect(block.includes('--o-s'), 'the canvas label scale').toBe(false)
  })
  it('no rule is left for a scope icon the lane no longer draws', () => {
    expect(block.includes('ok-an-scope-kind') || block.includes('ok-an-scope-note')).toBe(false)
  })
})
