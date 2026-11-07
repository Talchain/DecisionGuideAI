/**
 * V11 change 4 (Paul, 6 Nov): trying a range lights the paths between the card the figure sits on and what it moves. The links on a directed
 * path from that card to a lit option or to an aim are drawn in the header ink. Bound by identity (link indices, card ids) on core's real
 * Views and core's real what-if answer (fixtures/v11/README.md).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Position, ReactFlowProvider } from '@xyflow/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { movedOptions, triedPathLinks, useReveal, useTriedCards } from '../reveal'
import { RevealDock } from '../RevealDock'
import { clearWhatIf } from '../whatif'
import { setTeamFetch } from '../../olumiCore/team/api'
import { ViewLinkEdge } from '../../canvas/edges/ViewLinkEdge'
import { EdgeLabelLayer } from './edgeLabelLayer'

const fx = (n: string) => readFileSync(path.resolve('src/olumiView/fixtures/v11', n), 'utf8')
const real: View = JSON.parse(fx('consulting-marks.view3.json'))
const whatif = JSON.parse(fx('consulting-whatif-priya.json'))
const model = real.model!
const DIAG = 'paid_enterprise_diagnostic'
const at = (from: string, to: string) => model.links.findIndex((l) => l.from === from && l.to === to)
const PRIYA = real.collab.shared.find((v) => v.by === 'Priya')!

beforeEach(() => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-a88ba245176e', sid: real.id, view: real, status: 'ready', error: null, stale: false, at: null })
  useReveal.setState({ selected: null, card: null, evidence: null })
})
afterEach(() => { cleanup(); setTeamFetch(null); clearWhatIf(); useTriedCards.setState({ ids: [], links: [] }) })

describe('which links lie on a path from the tried card to what it moves (real View)', () => {
  it('Priya\'s figure sits on the diagnostic: its links on to the aims are on a path, through the quantities that feed them, in both directions of search', () => {
    const moved = movedOptions(model, whatif.variants[0].rows)
    expect(moved).toEqual([DIAG])
    const got = triedPathLinks(model, DIAG, moved)
    // Core's links: the diagnostic into its four quantities (10-13), and those quantities on to time_to_first_cash and the two aims (0-5).
    expect(got).toEqual([0, 1, 2, 3, 4, 5, 10, 11, 12, 13].sort((a, b) => a - b))
    // The chain Paul named: diagnostic > time to contract > time to first cash > the aim.
    for (const [f, t] of [[DIAG, 'time_to_contract'], ['time_to_contract', 'time_to_first_cash'], ['time_to_first_cash', 'generate_revenue_quickly']] as const) expect(got).toContain(at(f, t))
  })

  it('CONTRAST: links into the start, from a sibling option, or on another option\'s own branch are not lit', () => {
    const got = triedPathLinks(model, DIAG, [DIAG])
    for (const [f, t] of [['buyer_transfer_test', DIAG], ['add_consulting', 'time_to_contract'], ['focus_product_sales', 'time_to_contract'], ['payment_slippage', 'contract_to_cash'], ['consultancy_buyers_may_buy_product', 'add_consulting']] as const) {
      expect(at(f, t)).toBeGreaterThanOrEqual(0)
      expect(got).not.toContain(at(f, t))
    }
  })

  it('a figure on a quantity lights only the way down from it to the aim; a lit option it cannot reach lights nothing of its own', () => {
    expect(triedPathLinks(model, 'time_to_contract', [])).toEqual([at('time_to_contract', 'time_to_first_cash'), at('time_to_first_cash', 'generate_revenue_quickly')])
    // The diagnostic is lit but time_to_contract does not lead to it: link 10 (diagnostic > time_to_contract) runs the wrong way.
    expect(triedPathLinks(model, 'time_to_contract', [DIAG])).toEqual([0, 4])
  })

  it('a lit option is a target as well as the aims, and a start reaches it by every route, one step or two', () => {
    const got = triedPathLinks(model, 'consultancy_buyers_may_buy_product', ['add_consulting'])
    expect(got).toContain(at('consultancy_buyers_may_buy_product', 'add_consulting'))
    expect(got).toContain(at('add_consulting', 'time_to_contract'))
    // The claim also reaches add_consulting through buyer_transfer_test, so that two-step route is on a path too.
    expect(got).toContain(at('consultancy_buyers_may_buy_product', 'buyer_transfer_test'))
    expect(got).toContain(at('buyer_transfer_test', 'add_consulting'))
  })

  it('nothing to start from, or a start that is no card, lights no link; the "page:question" ends are ignored', () => {
    expect(triedPathLinks(model, null, [DIAG])).toEqual([])
    expect(triedPathLinks(model, 'nope', [DIAG])).toEqual([])
    const withPage = { ...model, links: [...model.links, { ...model.links[0]!, from: 'page:question', to: DIAG }, { ...model.links[0]!, from: DIAG, to: 'page:question' }] }
    expect(triedPathLinks(withPage, DIAG, [DIAG])).toEqual(triedPathLinks(model, DIAG, [DIAG]))
  })
})

describe('on the canvas', () => {
  const Edge = ViewLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element
  const edge = (i: number) => {
    const link = model.links[i]!
    return render(
      <ReactFlowProvider><EdgeLabelLayer><svg>
        <Edge id={`l${i}`} source={link.from} target={link.to} sourceX={0} sourceY={0} targetX={100} targetY={100}
          sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link, i }} />
      </svg></EdgeLabelLayer></ReactFlowProvider>,
    ).container
  }
  const lit = at('time_to_first_cash', 'generate_revenue_quickly'), other = at('add_consulting', 'time_to_contract')

  it('a lit link is drawn in the header ink at width 2 and marked; every other keeps its stroke; clearing drops it', () => {
    act(() => useTriedCards.setState({ ids: [DIAG], links: [lit] }))
    let c = edge(lit)
    const g = c.querySelector(`[data-view-link="links.${lit}"]`)!
    expect(g).toHaveAttribute('data-tried-link')
    const p = c.querySelector<SVGPathElement>('path.react-flow__edge-path')!
    expect(p.style.stroke).toBe('var(--text-header)')
    expect(p.style.strokeWidth).toBe('2')
    cleanup()
    // A causal link not on the path is drawn as before (no dimming, no mark).
    c = edge(other)
    expect(c.querySelector('[data-tried-link]')).toBeNull()
    expect(c.querySelector<SVGPathElement>('path.react-flow__edge-path')!.style.strokeWidth).toBe('1')
    expect(c.querySelector<SVGPathElement>('path.react-flow__edge-path')!.style.opacity).toBe('')
    cleanup()
    act(() => useTriedCards.setState({ ids: [], links: [] }))
    c = edge(lit)
    expect(c.querySelector('[data-tried-link]')).toBeNull()
  })

  it('a reason link on the path is drawn while tried, though no card is hovered', () => {
    const reason = model.links.findIndex((l) => l.kind !== 'plain' && !l.from.startsWith('page:'))
    if (reason < 0) return
    act(() => useTriedCards.setState({ links: [reason] }))
    expect(edge(reason).querySelector('[data-tried-link]')).not.toBeNull()
  })
})

describe('from the dock', () => {
  it('trying Priya\'s figure puts the path links in the store with the lit cards; dropping the try clears both', async () => {
    setTeamFetch((async (_u: unknown, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return new Response(JSON.stringify({ me: { id: real.you_id, name: real.you } }), { status: 200 })
      return new Response(JSON.stringify(whatif), { status: 200 })
    }) as unknown as typeof fetch)
    useReveal.setState({ selected: PRIYA.id })
    render(<RevealDock view={real} />)
    await act(async () => { fireEvent.click(screen.getByTestId('reveal-dock-try')) })
    await screen.findByTestId('reveal-dock-tried')
    await waitFor(() => expect(useTriedCards.getState().links).toEqual(triedPathLinks(model, DIAG, [DIAG])))
    expect(useTriedCards.getState().ids).toContain(DIAG)
    expect(useTriedCards.getState().links).toContain(at('time_to_first_cash', 'generate_revenue_quickly'))
    fireEvent.click(screen.getByTestId('reveal-dock-untry'))
    await waitFor(() => expect(useTriedCards.getState()).toMatchObject({ ids: [], links: [] }))
  })
})
