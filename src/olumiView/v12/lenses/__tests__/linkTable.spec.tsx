/** V12 link table: every link is a row ("n/a" where the View holds no sign), tagged Proposed with its count and legend, and a row and its canvas link are one selection both ways. */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { View } from '../../../client'
import { useCanvasStore } from '../../../../canvas/store'
import { drawViewCanvas, viewLinkDataOf } from '../../../canvas'
import { cardLinks } from '../../../layout'
import { LayerPanel, LENSES_TESTID, LINK_LEGEND } from '../LensesMenu'
import { edgeTableOf } from '../layers'

const golden = (): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden/european.view.json'), 'utf8'))
const noSelection = () => useCanvasStore.setState({ selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null } } as never)
afterEach(() => { cleanup(); noSelection(); useCanvasStore.setState({ nodes: [], edges: [] }) })
const mount = (v: View) => {
  drawViewCanvas(v.model!, new Map())
  return render(<LayerPanel view={v} layer="causal" onClose={() => undefined} />)
}
const edgeId = (link: NonNullable<View['model']>['links'][number]) =>
  useCanvasStore.getState().edges.find((edge) => viewLinkDataOf(edge)?.link === link)!.id

describe('link table', () => {
  it('draws a row for every card link, "n/a" in the sign column where the View holds no sign, and a sign where it does', () => {
    const v = golden(), n = cardLinks(v.model!).length
    const typed = v.model!.links.filter((l) => l.causal != null)[0]!
    const untyped = cardLinks(v.model!).find(({ link }) => link.causal == null)
    // the golden View types every link: strip one so the table must still draw it
    const target = untyped?.link ?? cardLinks(v.model!).find(({ link }) => link !== typed)!.link
    target.causal = null
    mount(v)
    const rows = screen.getByTestId(`${LENSES_TESTID}-edges`).querySelectorAll('tbody tr')
    expect(rows).toHaveLength(n)
    const row = (l: typeof target) => screen.getByTestId(`${LENSES_TESTID}-edges`).querySelector(`tr[data-edge-id="${edgeId(l)}"]`) as HTMLElement
    expect(within(row(target)).getByText('n/a')).toBeInTheDocument()
    expect(row(typed).querySelector('[data-edge-na]')).toBeNull() // CONTRAST: a link with a sign says n/a nowhere
  })
  it('says Proposed, "n of N links" and the footnote legend', () => {
    const v = golden()
    mount(v)
    expect(screen.getByTestId(`${LENSES_TESTID}-tag`)).toHaveTextContent('Proposed')
    expect(screen.getByTestId(`${LENSES_TESTID}-count`)).toHaveTextContent(`${edgeTableOf(v.model!).length} of ${v.model!.links.length} links`)
    expect(screen.getByTestId(`${LENSES_TESTID}-legend`)).toHaveTextContent(LINK_LEGEND)
    expect(LINK_LEGEND).toBe('? sign not settled. n/a: the View holds no sign. Dashed: doubted.')
  })
  it('pressing a row selects that link in the canvas store, and only that link', () => {
    const v = golden()
    mount(v)
    fireEvent.click(screen.getByTestId(`${LENSES_TESTID}-edges`).querySelector(`tr[data-edge-id="${edgeId(v.model!.links[2]!)}"]`)!)
    expect([...useCanvasStore.getState().selection.edgeIds]).toEqual([edgeId(v.model!.links[2]!)])
  })
  it('binds the refreshed link rows when Core sends the same links again', () => {
    const v = golden()
    const table = mount(v)
    const refreshed = golden()
    act(() => { drawViewCanvas(refreshed.model!, new Map()) })
    table.rerender(<LayerPanel view={refreshed} layer="causal" onClose={() => undefined} />)
    const row = screen.getByTestId(`${LENSES_TESTID}-edges`).querySelector('[data-edge="2"]')!
    expect(row).toHaveAttribute('data-edge-id', edgeId(refreshed.model!.links[2]!))
  })
  it('a link selected on the canvas marks its row, and no other (CONTRAST: nothing selected marks none)', () => {
    const v = golden(), [a, b] = [v.model!.links[0]!, v.model!.links[1]!]
    mount(v)
    const sel = (l: typeof a) => screen.getByTestId(`${LENSES_TESTID}-edges`).querySelector(`tr[data-edge-id="${edgeId(l)}"]`)!.getAttribute('aria-selected')
    expect(sel(a)).toBe('false')
    act(() => { useCanvasStore.setState({ selection: { nodeIds: new Set(), edgeIds: new Set([edgeId(a)]), anchorPosition: null } } as never) })
    expect(sel(a)).toBe('true')
    expect(sel(b)).toBe('false')
  })
})
