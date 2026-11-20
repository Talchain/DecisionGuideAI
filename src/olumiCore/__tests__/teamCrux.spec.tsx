/**
 * Team critique 2, track C1 (Paul's go, 19 Nov): on core's own TM-04 output (the View Cara reads, and core's GET …/differences for her),
 * - the count is of issues: Ana and Cara naming the same missing factor are one place (core sends one `factor:<row>` each);
 * - each option's chance with each person's figure is drawn under core's sentence, before what would settle it and the actions;
 * - the canvas card the team's figures differ on draws each person's revealed figure under its range bar, on the bar's axis.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View } from '../../olumiView/client'
import { useViewStore } from '../../olumiView/store'
import { CoreCard } from '../../olumiView/previous/CoreCard'
import { setLevel, useSimpleLevel } from '../../olumiView/v12/simpleStore'
import { WhereWeDiffer } from '../../olumiView/v12/views/WhereWeDiffer'
import { countDifferences, issueOf } from '../../olumiView/v12/views/differGroups'
import { setTeamFetch } from '../team/api'
import { tipOf } from '../../olumiView/__tests__/tipHelpers'
import { resetDifferences, type Differences } from '../team/differences'
import { CardSplit, type CardPerson } from '../team/CardDispute'

const FX = path.resolve('src/olumiView/fixtures/debate')
const view: View = JSON.parse(readFileSync(path.join(FX, 'tm04-cara.view3.json'), 'utf8'))
const core: Differences = JSON.parse(readFileSync(path.join(FX, 'tm04-differences.core.json'), 'utf8'))
const figure = core.differences.find((d) => (d.kind ?? 'figure') === 'figure')!
const CARD = figure.record
const other = view.model!.cards.find((c) => c.id !== CARD && !core.differences.some((d) => (d.cards ?? []).includes(c.id)) && c.family !== 'option' && c.family !== 'goal')!.id

const serve = (answer: Differences) => setTeamFetch((async (url: string) =>
  String(url).endsWith('/differences') ? new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } })
    : new Response(JSON.stringify({ error: 'not here' }), { status: 404, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch)

beforeEach(() => {
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  serve(core)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000000', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
})
afterEach(() => { cleanup(); setTeamFetch(null); resetDifferences(); vi.unstubAllEnvs(); useSimpleLevel.setState({ levels: {} }); try { window.localStorage.removeItem(`olumi.v12.level.${view.id}`) } catch { /* none */ } })

describe('the count is of issues, not of rows', () => {
  it('Ana and Cara naming the same missing factor are one place; CONTRAST: a factor in other words stays its own place', () => {
    const factors = core.differences.filter((d) => d.kind === 'factor')
    expect(factors.map((d) => d.record), 'precondition: core sends one row per person').toHaveLength(2)
    expect(new Set(factors.map((d) => d.label)).size, 'precondition: the same words').toBe(1)
    expect(countDifferences(core)).toEqual({ places: 4, changes: 2 })
    const reworded = { ...core, differences: core.differences.map((d) => d.record === factors[1]!.record ? { ...d, label: 'Whether delivery staff are free alongside current work' } : d) }
    expect(countDifferences(reworded)).toEqual({ places: 5, changes: 2 })
    expect(issueOf({ ...factors[0]!, label: `  ${factors[0]!.label.toUpperCase()} ` })).toBe(issueOf(factors[1]!))
  })
})

describe('each option\'s chance sits under core\'s sentence', () => {
  it('on the figure Priya and Tom differ on, the chances come after the sentence and before what would settle it and the actions', async () => {
    render(<WhereWeDiffer sid={view.id} view={view} onWrote={async () => true} />)
    const at = `differ-row-${figure.record}${figure.goal ? `-${figure.goal}` : ''}`
    const status = await screen.findByTestId(`${at}-status`)
    const options = screen.getByTestId(`${at}-options`), actions = screen.getByTestId(`${at}-actions`), drawn = screen.getByTestId(`${at}-drawn`)
    const before = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    expect(before(status, options)).toBe(true)
    expect(before(options, actions)).toBe(true)
    expect(drawn.contains(options), 'the chances are no longer at the card\'s foot').toBe(false)
    const apart = screen.queryByTestId(`${at}-apart`)
    if (figure.settle.length > 0) expect(before(options, apart!)).toBe(true)
  })
})

describe('the canvas shows the split', () => {
  const drawCard = (id: string) => {
    const card = view.model!.cards.find((c) => c.id === id)!
    const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
    return render(<ReactFlowProvider><Node {...({ id, type: 'viewCard', data: { card, label: card.heading }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
      positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
  }
  it('at Simple and at Working (Detailed), the card Priya and Tom differ on draws each one\'s revealed figure under its face, on one axis with the card\'s own range, named on hover with the figure\'s words; CONTRAST: a card no difference is about draws none', async () => {
    const want = figure.sides.map((s) => {
      const f = view.collab.shared.find((x) => x.id === s.view)!.figures.find((x) => x.quantity === CARD)! as { low: number; high: number; text: string }
      return { id: s.holder_id, title: `${s.holder}: ${f.text}`, lo: String(f.low), hi: String(f.high) }
    })
    expect(want.map((w) => w.title)).toEqual(['Priya: 6 to 12 months', 'Tom: 1 to 3 months'])
    for (const level of ['simple', 'working'] as const) {
      setLevel(level, view.id)
      const mine = drawCard(CARD)
      const rows = await waitFor(() => { const r = mine.querySelectorAll(`[data-core-card="${CARD}"] [data-card-split="${CARD}"] [data-card-person]`); expect(r.length, level).toBe(2); return [...r] as HTMLElement[] })
      expect(rows.some((r) => r.title !== '' || r.querySelector('[title]') !== null), 'never a native title').toBe(false)
      const said: { id: string | undefined; title: string; lo: string | undefined; hi: string | undefined }[] = []
      for (const r of rows) said.push({ id: r.dataset.cardPerson, title: await tipOf(r.querySelector<HTMLElement>('[tabindex]')!), lo: r.dataset.rangeLo, hi: r.dataset.rangeHi })
      expect(said, level).toEqual(want)
      cleanup()
    }
    setLevel('simple', view.id)
    const theirs = drawCard(other)
    await waitFor(() => expect(theirs.querySelector(`[data-core-card="${other}"]`)).not.toBeNull())
    expect(theirs.querySelector('[data-card-split]')).toBeNull()
  })
})

describe('the split is read against the card\'s own range, in one unit (Codex C1 HOLD 1 and 2)', () => {
  const card = view.model!.cards.find((c) => c.id === CARD)!
  const withRange = (unit: string) => ({ ...card, figure: { ...card.figure!, range: { low: 0.25, likely: null, high: 12, unit } } }) as typeof card
  const people: CardPerson[] = [
    { id: '12', holder: 'Priya', lo: 6, hi: 12, text: '6 to 12 months', unit: 'month' },
    { id: '13', holder: 'Tom', lo: 1, hi: 3, text: '1 to 3 months', unit: 'month' },
  ]
  const marks = (c: HTMLElement) => [...c.querySelectorAll('[data-card-person-mark]')].map((r) => [Number(r.getAttribute('x')), Number(r.getAttribute('width'))])
  it('in the same unit: the card\'s range is the band behind each row, on the range bar\'s 0-based scale (0 to 20 for 0.25 to 12), its ends labelled with the unit', () => {
    const { container } = render(<CardSplit card={withRange('month')} people={people} />)
    const split = container.querySelector('[data-card-split]') as HTMLElement
    expect([split.dataset.axisMin, split.dataset.axisMax]).toEqual(['0', '20'])
    expect(marks(split)).toEqual([[30, 30], [5, 10]])
    const band = split.querySelector('[data-card-split-model]')!
    expect([Number(band.getAttribute('x')), Number(band.getAttribute('width'))]).toEqual([1.25, 58.75])
    expect(split.querySelector('[data-card-split-axis]')!.textContent).toBe('020 month')
  })
  it('CONTRAST, another unit: the card\'s range is never drawn beside the people\'s figures, and the axis is theirs alone', () => {
    const { container } = render(<CardSplit card={withRange('week')} people={people} />)
    const split = container.querySelector('[data-card-split]') as HTMLElement
    expect(split.querySelector('[data-card-split-model]')).toBeNull()
    expect(split.querySelector('[data-card-split-axis]')!.textContent).toBe('020 month')
    expect(marks(split)).toEqual([[30, 30], [5, 10]])
  })
  it('one person alone draws nothing', () => {
    const { container } = render(<CardSplit card={withRange('month')} people={people.slice(0, 1)} />)
    expect(container.querySelector('[data-card-split]')).toBeNull()
  })
})
