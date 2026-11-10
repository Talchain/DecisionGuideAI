/**
 * Existing behaviour, now with its row (DL 10 Nov): opening a card's editor at the overview zoom first moves the camera so that card is at
 * zoom 1 (ViewCardNode: `centreOn(centre, { zoom: 1 })`), centred on that card; at zoom 1 already, nothing moves.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render } from '@testing-library/react'
import { ReactFlowProvider, useStoreApi, type NodeProps } from '@xyflow/react'
import type { View } from '../client'
import { useOpenFigureEdits } from '../FigureEdit'
import { ViewCardV10 } from '../v10'

const setCenter = vi.fn(), seen: string[] = []
vi.mock('@xyflow/react', async (orig) => ({
  ...(await orig<typeof import('@xyflow/react')>()),
  useReactFlow: () => ({ setCenter, getInternalNode: (id: string) => { seen.push(id); return { internals: { positionAbsolute: { x: 100, y: 200 } }, measured: { width: 180, height: 90 } } } }),
}))

afterEach(() => { cleanup(); setCenter.mockClear(); seen.length = 0; useOpenFigureEdits.setState({ open: new Map() }) })
const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'hiring.view3.json'), 'utf8'))
const card = view.model!.cards.find((c) => c.id === 'hire_tech_lead')!

const draw = (zoom: number) => {
  const Zoom = () => { const api = useStoreApi(); api.setState({ transform: [0, 0, zoom] }); return null }
  return render(<ReactFlowProvider><Zoom /><ViewCardV10 {...({ id: card.id, data: { card, label: card.heading }, selected: false, type: 'viewCard' } as unknown as NodeProps)} /></ReactFlowProvider>)
}
const openEditor = () => act(() => { useOpenFigureEdits.setState({ open: new Map([[card.id, { prompt: 'p', ask: 'a' }]]) }) })

describe('opening a card\'s editor at the overview', () => {
  it('moves the camera so THAT card (by id) is centred at zoom 1', () => {
    draw(0.449)
    expect(setCenter).not.toHaveBeenCalled()
    openEditor()
    expect(seen).toContain(card.id)
    expect(setCenter).toHaveBeenCalledTimes(1)
    expect(setCenter.mock.calls[0]).toEqual([100 + 180 / 2, 200 + 90 / 2, expect.objectContaining({ zoom: 1 })])
  })
  it('CONTRAST: at zoom 1 (the full face) opening the editor moves nothing', () => {
    draw(1)
    openEditor()
    expect(setCenter).not.toHaveBeenCalled()
  })
})
