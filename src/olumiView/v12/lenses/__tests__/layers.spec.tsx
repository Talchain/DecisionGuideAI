/**
 * V12 layers: the list is built only from fields the View holds; an option's entry is that option's card; no strength is invented; no Robustness.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { View } from '../../../client'
import { cardLinks, optionCards } from '../../../layout'
import { useViewStore } from '../../../store'
import { LeftSidebar } from '../../../../components/layout/LeftSidebar'
import { edgeTableOf, evidenceOf, layerEntries, marksOf, optionLayerId, optionPathOf, sensitiveAssumptionsOf } from '../layers'
import { LensesMenu } from '../LensesMenu'
import { useLayer } from '../store'

const golden = (): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden/european.view.json'), 'utf8'))
afterEach(() => { cleanup(); useLayer.setState({ layer: 'full', sid: null }); useViewStore.setState({ view: null, sid: null }) })

describe('the layer entries', () => {
  it('lists Full model, one entry per option as the View has them, then only the analysis layers the View can fill', () => {
    const v = golden(), options = optionCards(v.model!)
    expect(options.length).toBeGreaterThan(1)
    const e = layerEntries(v)
    expect(e.filter((x) => x.kind === 'option').map((x) => [x.id, x.label])).toEqual(options.map((o) => [optionLayerId(o.id), o.heading]))
    expect(e[0]).toMatchObject({ id: 'full', label: 'Full model' })
    expect(e.map((x) => x.id)).toEqual(expect.arrayContaining(['sensitivity', 'sensitive_assumptions', 'causal', 'evidence']))
  })

  it('never lists Robustness (the View has no such field)', () => {
    expect(layerEntries(golden()).some((x) => /robust/i.test(x.label))).toBe(false)
  })

  it('CONTRAST: a View with no causal link, no driver and no figure lists neither causal, sensitivity nor evidence; no View lists nothing', () => {
    const v = golden()
    for (const l of v.model!.links) l.causal = null
    for (const c of v.model!.cards) { c.driver = null; c.figure = null }
    expect(layerEntries(v).map((x) => x.id)).toEqual(['full', ...optionCards(v.model!).map((o) => optionLayerId(o.id))])
    expect(layerEntries(null)).toEqual([])
  })

  it('Sensitive assumptions are the sensitive figures that are Olumi\'s: dropping the Olumi author drops the entry', () => {
    const v = golden()
    expect(sensitiveAssumptionsOf(v.model!).has('existing_market_acquisitions')).toBe(true)
    for (const c of v.model!.cards) { c.author = { by: 'person', text: 'x', title: 'x' }; c.olumi = null }
    expect(sensitiveAssumptionsOf(v.model!).size).toBe(0)
    expect(layerEntries(v).some((e) => e.id === 'sensitive_assumptions')).toBe(false)
  })
})

describe('the edge table', () => {
  it('has a row for every card link, with sign and strength from the View; an unsized link shows core\'s own words, never a number', () => {
    const v = golden(), rows = edgeTableOf(v.model!)
    expect(rows.length).toBe(cardLinks(v.model!).length)
    expect(rows.filter((r) => r.sign !== null).length).toBe(v.model!.links.filter((l) => l.causal != null).length)
    expect(rows.length).toBeGreaterThan(0)
    const r = rows.find((x) => x.sign !== null)!
    expect(r.sign).toBe('decreases')
    expect(r.strength).toBe('stays a claim in words')
    expect(r.strength).not.toMatch(/\d/)
  })

  it('a sized link shows its likely figure and range in its own unit; the reserved comparable strength is never read', () => {
    const v = golden(), l = v.model!.links.find((x) => x.causal != null)!
    l.causal!.strength = { state: 'sized', figure: 'x', low: 1, likely: 2, high: 3, unit: 'customers', per: null, share: 0.9, relative_to: null }
    const r = edgeTableOf(v.model!).find((x) => x.index === v.model!.links.indexOf(l))!
    expect(r.strength).toBe('2 customers (1 to 3)')
    expect(JSON.stringify(r)).not.toContain('0.9')
  })
})

describe('the edge table (CONTRAST)', () => {
  it('an unsized or in-words link never shows a number, even if a stray likely value rides on it', () => {
    const v = golden(), l = v.model!.links.find((x) => x.causal != null)!
    l.causal!.strength = { state: 'unsized', figure: null, low: 1, likely: 2, high: 3, unit: 'customers', per: null, share: null, relative_to: null }
    l.size = { record: 'r', text: 'no strength yet', title: 't', edit: null }
    expect(edgeTableOf(v.model!).find((x) => x.index === v.model!.links.indexOf(l))!.strength).toBe('no strength yet')
  })
})

describe('evidence quality', () => {
  it('Grounded needs evidence that concerns the figure; Assumed is Olumi\'s without evidence; No data is the team\'s without evidence', () => {
    const v = golden()
    const before = evidenceOf(v)
    expect(before.basis.get('existing_market_acquisitions')).toBe('assumed')
    expect(before.basis.get('starting_customers')).toBe('nodata')
    expect(before.grounded).toBe(0)
    v.evidence = [{ id: 1, at: '', by: 'x', by_id: 'x', text: 't', source: null, link: null, concerns: ['starting_customers'], stance: 'supports', version: null } as never]
    const after = evidenceOf(v)
    expect(after.basis.get('starting_customers')).toBe('grounded')
    expect(after.basis.get('churn_rate')).toBe('nodata') // CONTRAST: a figure the evidence does not concern stays as it was
    expect(after.grounded).toBe(1)
  })
})

describe('evidence quality reads the stance', () => {
  const ev = (concerns: string[], stance: string) => ({ id: 1, at: '', by: 'x', by_id: 'x', text: 't', source: null, link: null, concerns, stance, version: null }) as never
  it('challenging evidence is never Grounded; a challenge beside support still shows; unclear stays unclear', () => {
    const v = golden()
    v.evidence = [ev(['starting_customers'], 'challenges'), ev(['churn_rate'], 'supports'), ev(['churn_rate'], 'challenges'), ev(['existing_market_acquisitions'], 'unclear')]
    const e = evidenceOf(v)
    expect(e.basis.get('starting_customers')).toBe('challenged')
    expect(e.basis.get('churn_rate')).toBe('challenged')
    expect(e.basis.get('existing_market_acquisitions')).toBe('unclear')
    expect(e.grounded).toBe(0)
    expect(e.challenged).toBe(2)
    v.evidence = [ev(['starting_customers'], 'supports')] // CONTRAST: supporting evidence alone is Grounded
    expect(evidenceOf(v).basis.get('starting_customers')).toBe('grounded')
  })
})

describe('the edge table author', () => {
  it('sits in the Sign cell with the direction, never in the Strength cell', () => {
    useViewStore.setState({ view: golden() })
    useLayer.setState({ layer: 'causal', sid: null })
    render(<LeftSidebar layers={<LensesMenu />} />)
    fireEvent.click(screen.getByRole('button', { name: 'Layers' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Causal graph' }))
    const rows = screen.getAllByRole('row').slice(1)
    const withAuthor = rows.filter((r) => r.querySelector('[data-edge-author]') !== null)
    expect(withAuthor.length).toBeGreaterThan(0)
    for (const r of withAuthor) {
      const cells = r.querySelectorAll('td')
      expect(cells[2]!.querySelector('[data-edge-author]')).not.toBeNull()
      expect(cells[3]!.querySelector('[data-edge-author]')).toBeNull()
    }
  })
})

describe('a layer does not carry into another scenario', () => {
  it('drops back to the full model when the scenario changes', async () => {
    const { useActiveLayer } = await import('../store')
    const { renderHook, act } = await import('@testing-library/react')
    useViewStore.setState({ view: golden(), sid: 'a' })
    const { chooseLayer } = await import('../store')
    chooseLayer('causal')
    const h = renderHook(() => useActiveLayer())
    expect(h.result.current).toBe('causal')
    act(() => useViewStore.setState({ sid: 'b' }))
    expect(h.result.current).toBe('full')
  })
})

describe('option focus', () => {
  it('keeps the option, what it sets and leads to, and what it rests on; another option is not on its path', () => {
    const m = golden().model!, p = optionPathOf(m, 'broader_entry')
    for (const id of ['broader_entry', 'customers', 'churn_rate', 'country_readiness']) expect(p.cards.has(id), id).toBe(true)
    expect(p.cards.has('single_country_test')).toBe(false)
    expect(marksOf(golden(), optionLayerId('broader_entry'))?.dim).toBe(true)
    expect(marksOf(golden(), 'full')).toBeNull()
  })
})

describe('the menu in the left floating menu', () => {
  it('opens a list of the entries, applies a layer, and the full model comes back; nothing renders without a View', () => {
    const { rerender } = render(<LeftSidebar layers={<LensesMenu />} />)
    expect(screen.queryByTestId('v12-layers')).toBeNull()
    useViewStore.setState({ view: golden() })
    rerender(<LeftSidebar layers={<LensesMenu />} />)
    fireEvent.click(screen.getByRole('button', { name: 'Layers' }))
    const menu = screen.getByRole('menu', { name: 'Layers' })
    // The level of detail leads the menu (Paul, 18 Nov: Simple | Detailed lives here), then core's layers in core's order.
    expect(within(menu).getAllByRole('menuitemradio').map((b) => b.textContent)).toEqual(['Simple', 'Detailed', ...layerEntries(golden()).map((e) => e.label)])
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Causal graph' }))
    expect(useLayer.getState().layer).toBe('causal')
    const edges = screen.getByTestId('v12-layers-edges')
    expect(within(edges).getByText('stays a claim in words')).toBeTruthy()
    expect(within(edges).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['From', 'To', 'Sign', 'Strength'])
    fireEvent.click(screen.getByRole('button', { name: 'Layers' }))
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitemradio', { name: 'Full model' }))
    expect(useLayer.getState().layer).toBe('full')
    expect(screen.queryByTestId('v12-layers-panel')).toBeNull()
  })

  it('the slots: an undo control takes the Undo place and the layers button follows it; the other tools stay', () => {
    render(<LeftSidebar showUndo={false} onSelectClick={() => {}} undoControl={<button type="button" aria-label="Undo (editing lane)" />} layers={<button type="button" aria-label="Layers" />} />)
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual(['Select mode', 'Hand mode', 'Undo (editing lane)', 'Layers'])
  })
})
