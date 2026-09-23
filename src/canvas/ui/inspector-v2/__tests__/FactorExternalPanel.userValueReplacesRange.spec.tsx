/**
 * FactorExternalPanel — once the user has stated a value, the panel must stop
 * describing the range as what the analysis uses.
 *
 * Two sentences on this panel describe the range as LIVE, and both are false
 * while a user-owned value stands (PLoT `buildParameterUncertaintiesV3` skips
 * the prior for any factor with `observed_state.value`, read at PLoT staging
 * 5039cca4; ISL never reads `node.prior`):
 *
 *   · the role note — "…it is what the model treats as the factor's plausible
 *     level." The model treats the USER'S VALUE as the level.
 *   · the technical disclosure — "ISL samples Uniform(a, b)…". It does not.
 *
 * ⚠ THE RANGE ITSELF STAYS VISIBLE, and so do its controls: the standing
 * "caveat, never hide" ruling governs this surface, and removing the state is
 * not what is asked. Only the two claims about what the analysis DOES with it
 * change, and each twin below pins that nothing changes without a user value.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.setConfig({ testTimeout: 30_000 })

vi.mock('@xyflow/react', () => ({
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

vi.mock('../../../hooks/useNodeDisplayMetadata', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useNodeDisplayMetadata: () => ({
      influence: null,
      influenceProvenance: null,
      sensitivityRank: null,
      valueOfInformation: null,
    }),
  }
})

vi.mock('../useAnalysisResults', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useRobustness: () => ({ flip_thresholds: [] }) }
})

const NODE_ID = 'fac_market_demand'
const REPLACED_HERE = 'Your value replaces this range in the analysis.'
const ISL_CLAIM = /ISL samples Uniform\(/

async function renderPanel(observedState: Record<string, unknown> | undefined) {
  const { useCanvasStore } = await import('../../../store')
  const { FactorExternalPanel } = await import('../panels/FactorExternalPanel')
  useCanvasStore.setState({
    nodes: [{
      id: NODE_ID,
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Market demand',
        kind: 'factor',
        category: 'external',
        prior: { distribution: 'uniform', range_min: 0.3, range_max: 0.8 },
        ...(observedState === undefined ? {} : { observedState }),
      },
    }] as never,
    edges: [],
    results: undefined,
  } as never)
  return render(
    <FactorExternalPanel nodeId={NODE_ID} techMode onClose={() => {}} onNavigate={() => {}} />,
  )
}

function expandModelDetail(): void {
  fireEvent.click(screen.getByRole('button', { name: /show model detail/i }))
  expect(
    screen.getByRole('button', { name: /hide model detail/i }).getAttribute('aria-expanded'),
    'the disclosure did not open; the ISL assertions below would be vacuous',
  ).toBe('true')
  // Positive control on the expanded surface: the editor's own group rendered.
  expect(screen.getByText('Prior distribution')).toBeDefined()
}

beforeEach(() => { cleanup() })

describe('FactorExternalPanel — a user-stated value replaces the range', () => {
  it('user_override value: the role note says the value replaces the range', async () => {
    await renderPanel({ value: 0.55, source: 'user_override' })
    const role = screen.getByTestId('factor-external-range-role')
    expect(role.textContent).toBe(REPLACED_HERE)
    expect(role.textContent).not.toMatch(/plausible level/i)
  })

  it('user_override value: the technical disclosure no longer claims ISL samples the range', async () => {
    const { container } = await renderPanel({ value: 0.55, source: 'user_override' })
    expandModelDetail()
    expect(container.textContent ?? '').not.toMatch(ISL_CLAIM)
    // The range is still SHOWN (caveat, never hide): both inputs keep their values.
    const inputs = Array.from(container.querySelectorAll('input[type="number"]')) as HTMLInputElement[]
    expect(inputs.map(i => i.value)).toEqual(expect.arrayContaining(['0.30', '0.80']))
  })

  it('TWIN — no user value: the role note and the ISL line are exactly as before', async () => {
    const { container } = await renderPanel(undefined)
    const role = screen.getByTestId('factor-external-range-role')
    expect(role.textContent).toMatch(/analysis input/i)
    expect(role.textContent).not.toContain('replaces')
    expandModelDetail()
    expect(container.textContent ?? '').toMatch(ISL_CLAIM)
  })

  it('TWIN — a model-authored value (cee_inference) is not the user\'s: unchanged', async () => {
    const { container } = await renderPanel({ value: 0.55, source: 'cee_inference' })
    expect(screen.getByTestId('factor-external-range-role').textContent).toMatch(/analysis input/i)
    expandModelDetail()
    expect(container.textContent ?? '').toMatch(ISL_CLAIM)
  })
})
