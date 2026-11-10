/**
 * The previous Model tab's sections on the core lane (DL brief A4, 10 Nov): Limits, structural issues, the model card and the audit trail,
 * each drawn from core's View in core's words (model/sections.tsx). Fixtures: core's own golden Views. Bound by identity (card and entry ids).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { View } from '../client'
import { ViewModelTab } from '../ViewModelTab'
import { MODEL_SECTION_LABELS, ModelSections } from '../model/sections'
import { useViewStore } from '../store'
import { resetModelTab } from '../model/state'
import { registerFocusHelpers } from '../../canvas/utils/focusHelpers'

const golden = (n: string): View => JSON.parse(readFileSync(path.resolve(`src/olumiView/golden/${n}.view.json`), 'utf8'))
const european = golden('european'), launch = golden('app-launch')
afterEach(() => { cleanup(); useViewStore.setState({ view: null }); try { localStorage.clear() } catch { /* none */ } resetModelTab() })
const draw = (v: View) => render(<ModelSections model={v.model!} version={v.version} />).container
const open = (c: HTMLElement, id: string) => fireEvent.click(c.querySelector(`[data-testid="${id}"] button`)!)

describe('the previous Model tab\'s sections, from the View', () => {
  it('the fixtures hold what the rows bind to', () => {
    expect(european.model!.cards.filter((c) => c.bound != null).length).toBeGreaterThan(1)
    expect(european.model!.cards.some((c) => c.bound?.olumi) && european.model!.cards.some((c) => c.bound != null && !c.bound.olumi)).toBe(true)
    expect(launch.model!.run!.waits_on!.items.length).toBeGreaterThan(1)
    expect((launch.model!.run!.shared_blockers ?? []).length).toBeGreaterThan(0)
  })

  it('Limits: every card with a bound, by its id, in core\'s words; Olumi\'s mark only where core marks it; pressing a heading shows its card', () => {
    const focus = vi.fn(); registerFocusHelpers(focus, vi.fn())
    const c = draw(european), sec = c.querySelector('[data-testid="view-model-limits"]')!
    expect(sec.querySelector('h3')?.textContent).toBe(MODEL_SECTION_LABELS.limits)
    const bound = european.model!.cards.filter((k) => k.bound != null)
    expect([...sec.querySelectorAll('[data-model-limit]')].map((e) => e.getAttribute('data-model-limit'))).toEqual(bound.map((k) => k.id))
    for (const k of bound) {
      const row = sec.querySelector(`[data-model-limit="${k.id}"]`)!
      expect(row.querySelector('button')?.textContent).toBe(k.heading)
      expect(row.querySelector('p')?.textContent).toBe(`${k.bound!.olumi ? `${k.bound!.olumi.glyph} ` : ''}${k.bound!.text}`)
      expect(row.querySelector('[data-model-limit-olumi]') !== null).toBe(k.bound!.olumi != null)
    }
    fireEvent.click(sec.querySelector(`[data-model-limit="${bound[0]!.id}"] button`)!)
    expect(focus).toHaveBeenCalledWith(bound[0]!.id)
  })

  it('Structural issues: core\'s blockers said once each, and what the chance waits on, item by item', () => {
    const c = draw(launch), sec = c.querySelector('[data-testid="view-model-structure"]')!, run = launch.model!.run!
    const texts = [...new Set((run.shared_blockers ?? []).map((b) => b.text))]
    expect([...sec.querySelectorAll('[data-model-structure="blocked"] li')].map((e) => e.textContent)).toEqual(texts)
    expect(sec.querySelector('[data-view="model.run.waits_on.text"]')?.textContent).toBe(run.waits_on!.text)
    expect([...sec.querySelectorAll('[data-model-waits]')].map((e) => [e.getAttribute('data-model-waits'), e.textContent])).toEqual(run.waits_on!.items.map((i) => [i.id, i.text]))
    // CONTRAST: a run with no blocker and nothing waited on draws no section at all.
    expect(european.model!.run!.waits_on).toBeNull()
    expect((european.model!.run!.shared_blockers ?? []).length + (european.model!.run!.coverage ?? []).length).toBe(0)
    expect(draw(european).querySelector('[data-testid="view-model-structure"]')).toBeNull()
  })

  it('Model card: what would strengthen the model, each entry whole, closed until opened', () => {
    const c = draw(european)
    const head = c.querySelector('[data-testid="view-model-card"] button')!
    expect(head.textContent).toContain(MODEL_SECTION_LABELS.card)
    expect(head.getAttribute('aria-expanded')).toBe('false')
    open(c, 'view-model-card')
    expect(head.getAttribute('aria-expanded')).toBe('true')
    const s = european.model!.sharpen
    expect([...c.querySelectorAll('[data-model-sharpen]')].map((e) => [e.getAttribute('data-model-sharpen'), e.textContent])).toEqual(s.map((x) => [x.id, `${x.lead} ${x.emphasis}${x.rationale}`]))
  })

  it('Audit trail: the version core shows and its date, how core read each aim, and Olumi\'s own assumptions, each said once', () => {
    const c = draw(european); open(c, 'view-model-audit')
    const sec = c.querySelector('[data-testid="view-model-audit"]')!, run = european.model!.run!
    expect(sec.querySelector('[data-view="version.label"]')?.textContent).toBe(european.version!.label)
    expect(sec.querySelector('[data-view="version.at_text"]')?.textContent).toBe(european.version!.at_text)
    expect([...sec.querySelectorAll('[data-model-audit="readings"] li')].map((e) => e.textContent)).toEqual([...new Set(run.readings.map((r) => r.text))])
    expect([...sec.querySelectorAll('[data-model-audit="notes"] li')].map((e) => e.textContent)).toEqual([...new Set(run.notes.map((n) => n.text))])
    // What changed in the version and what was removed, by identity, when core sends them.
    const v: View = { ...european, version: { ...european.version!, changed: ['A changed line'] }, model: { ...european.model!, removed: [{ id: 'gone', heading: 'Gone card', title: 'Gone card was removed' }] } }
    const d = draw(v); open(d, 'view-model-audit')
    expect(d.querySelector('[data-model-audit-changed="0"]')?.textContent).toBe('A changed line')
    expect(d.querySelector('[data-model-audit-removed="gone"]')?.textContent).toBe('Gone cardGone card was removed')
  })

  it('a model with nothing for a section draws none of it; the tab mounts the sections under its outline, and not while filtering', () => {
    const m = { ...european.model!, cards: european.model!.cards.map((k) => ({ ...k, bound: null })), sharpen: [], removed: [], run: null }
    const c = render(<ModelSections model={m} version={null} />).container
    for (const id of ['view-model-limits', 'view-model-structure', 'view-model-card', 'view-model-audit']) expect(c.querySelector(`[data-testid="${id}"]`), id).toBeNull()
    useViewStore.setState({ view: european })
    const t = render(<ViewModelTab model={european.model!} />).container
    expect(t.querySelector('[data-testid="view-model-tab"] [data-testid="view-model-limits"]')).not.toBeNull()
    expect(t.querySelector('[data-testid="view-model-audit"] [data-view="version.label"]') ?? t.querySelector('[data-testid="view-model-audit"]')).not.toBeNull()
    fireEvent.change(t.querySelector('[data-testid="view-model-filter"]')!, { target: { value: 'customers' } })
    expect(t.querySelector('[data-testid="view-model-sections"]')).toBeNull()
  })
})
