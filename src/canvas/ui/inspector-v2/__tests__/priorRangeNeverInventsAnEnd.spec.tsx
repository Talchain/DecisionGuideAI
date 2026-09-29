/**
 * ⭐ ONE END TYPED IS NOT A RANGE — the inspector never invents the other end.
 *
 * Both range editors on the external-factor pane completed a half-typed range
 * with a number nobody entered, and `setPriorRange` then wrote it to the card
 * AND sent it to Olumi as the user's own judgement (`prior_range_edit`):
 *   - the panel's Max box wrote `range_min: 0` (`rangeMin ?? 0`), and its Min
 *     box wrote a point range `[min, min]` (`rangeMax ?? parsed`);
 *   - the "Show model detail" fields wrote `range_max: 1` / `range_min: 0`.
 * A factor with no range on record (the ordinary drafted case: `prior` absent)
 * reached all four with one keystroke.
 *
 * The rule is the thin-UI one: the UI writes what the user stated and nothing
 * else. A typed end is HELD in its box until the other end exists — stored, or
 * typed in the sibling box — and only then is the pair written, once.
 *
 * CLAIM TYPE: jsdom render of the mounted panel (InspectorRouter's
 * 'factor-external' target) + the real canvas store. Every `setPriorRange` call
 * writes the card before any send, so "the card's prior is untouched" proves no
 * call was made, and therefore nothing was sent.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.setConfig({ testTimeout: 30_000 })

vi.mock('@xyflow/react', () => ({
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

vi.mock('../../../hooks/useNodeDisplayMetadata', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useNodeDisplayMetadata: () => ({ influence: null, influenceProvenance: null, sensitivityRank: null, valueOfInformation: null }),
  }
})

vi.mock('../useAnalysisResults', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useRobustness: () => ({ flip_thresholds: [] }) }
})

const NODE_ID = 'fac_fx_rate'

function factor(prior?: Record<string, unknown>) {
  return {
    id: NODE_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: 'FX rate', kind: 'factor', category: 'external', ...(prior ? { prior } : {}) },
  }
}

async function mount(prior?: Record<string, unknown>) {
  const { useCanvasStore } = await import('../../../store')
  const { FactorExternalPanel } = await import('../panels/FactorExternalPanel')
  useCanvasStore.setState({ nodes: [factor(prior)] as never, edges: [], results: undefined } as never)
  render(<FactorExternalPanel nodeId={NODE_ID} techMode onClose={() => {}} onNavigate={() => {}} />)
  return () => (useCanvasStore.getState().nodes.find((n) => n.id === NODE_ID)?.data as Record<string, unknown>)?.prior
}

function type(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

function expandModelDetail() {
  fireEvent.click(screen.getByRole('button', { name: /show model detail/i }))
}

beforeEach(() => cleanup())
afterEach(() => cleanup())

describe('the panel Min/Max boxes', () => {
  it('Max alone writes nothing: no invented minimum of 0', async () => {
    const prior = await mount()
    type(screen.getByLabelText('Max'), '0.8')
    expect(prior()).toBeUndefined()
    expect((screen.getByLabelText('Max') as HTMLInputElement).value).toBe('0.8')
  })

  it('Min alone writes nothing: no invented point range [min, min]', async () => {
    const prior = await mount()
    type(screen.getByLabelText('Min'), '0.2')
    expect(prior()).toBeUndefined()
  })

  it('the second end completes the pair, written once with exactly the typed ends', async () => {
    const prior = await mount()
    type(screen.getByLabelText('Max'), '0.8')
    type(screen.getByLabelText('Min'), '0.2')
    expect(prior()).toEqual({ range_min: 0.2, range_max: 0.8 })
  })

  it('CONTROL: with a stored range, one end edits against the STORED other end (unchanged)', async () => {
    const prior = await mount({ distribution: 'uniform', range_min: 0.2, range_max: 0.6 })
    type(screen.getByLabelText('Max'), '0.9')
    expect(prior()).toEqual({ distribution: 'uniform', range_min: 0.2, range_max: 0.9 })
  })
})

describe('the "Show model detail" range fields', () => {
  it('Range maximum alone writes nothing: no invented minimum of 0', async () => {
    const prior = await mount()
    expandModelDetail()
    type(screen.getByLabelText('Range maximum'), '0.8')
    expect(prior()).toBeUndefined()
  })

  it('Range minimum alone writes nothing: no invented maximum of 1', async () => {
    const prior = await mount()
    expandModelDetail()
    type(screen.getByLabelText('Range minimum'), '0.2')
    expect(prior()).toBeUndefined()
  })

  it('the second field completes the pair with exactly the typed ends', async () => {
    const prior = await mount()
    expandModelDetail()
    type(screen.getByLabelText('Range minimum'), '0.2')
    type(screen.getByLabelText('Range maximum'), '0.8')
    expect(prior()).toEqual({ range_min: 0.2, range_max: 0.8 })
  })

  it('CONTROL: with a stored range, one field edits against the STORED other end (unchanged)', async () => {
    const prior = await mount({ distribution: 'uniform', range_min: 0.2, range_max: 0.6 })
    expandModelDetail()
    type(screen.getByLabelText('Range minimum'), '0.3')
    expect(prior()).toEqual({ distribution: 'uniform', range_min: 0.3, range_max: 0.6 })
  })
})
