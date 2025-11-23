import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import type { ReportV1 } from '../../../adapters/plot/types'
import type { FlagFns } from '../../../tests/__helpers__/mockFlags'

vi.mock('../../hooks/useValidationFeedback', () => ({
  useValidationFeedback: () => ({
    focusError: () => {},
    formatError: (error: any) => error,
    formatErrors: (errors: any[]) => errors,
  }),
}))

const mockReport: ReportV1 = {
  schema: 'report.v1',
  meta: {
    seed: 1,
    response_id: 'cee-123',
    elapsed_ms: 1000,
  },
  model_card: {
    response_hash: 'cee-hash',
    response_hash_algo: 'sha256',
    normalized: true,
  },
  results: {
    conservative: 10,
    likely: 20,
    optimistic: 30,
  },
  confidence: {
    level: 'high',
    why: 'test',
  },
  drivers: [],
}

type Runtime = {
  useCanvasStore: any
  ToastProvider: any
  LayerProvider: any
  ResultsPanel: any
}

async function getRuntime(flagOverrides: Partial<FlagFns>): Promise<Runtime> {
  const { mockFlags } = await import('../../../tests/__helpers__/mockFlags')
  mockFlags(flagOverrides)

  const [storeModule, toastModule, layerModule, panelModule] = await Promise.all([
    import('../../store'),
    import('../../ToastContext'),
    import('../LayerProvider'),
    import('../../panels/ResultsPanel'),
  ])

  const useCanvasStore = (storeModule as any).useCanvasStore
  const state = useCanvasStore.getState()
  if ((state as any).resultsReset) {
    state.resultsReset()
  }
  if (state.setRunMeta) {
    state.setRunMeta({
      ceeReview: undefined,
      ceeTrace: undefined,
      ceeError: undefined,
    } as any)
  }

  return {
    useCanvasStore,
    ToastProvider: (toastModule as any).ToastProvider,
    LayerProvider: (layerModule as any).LayerProvider,
    ResultsPanel: (panelModule as any).ResultsPanel,
  }
}

function renderWithRuntime(runtime: Runtime) {
  const { ToastProvider, LayerProvider, ResultsPanel } = runtime

  return render(
    <ToastProvider>
      <LayerProvider>
        <ResultsPanel isOpen={true} onClose={vi.fn()} />
      </LayerProvider>
    </ToastProvider>,
  )
}

describe('ResultsPanel Decision Review integration', () => {
  beforeEach(() => {
    // Fresh module graph + stubbed fetch for each test
    vi.resetModules()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as any))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not render Decision Review when flag is OFF', async () => {
    const runtime = await getRuntime({
      isDecisionReviewEnabled: () => false,
    })

    const { useCanvasStore } = runtime
    const state = useCanvasStore.getState()

    state.resultsComplete({
      report: mockReport,
      hash: mockReport.model_card.response_hash,
    })

    state.setRunMeta({
      ceeReview: {
        story: {
          headline: 'Flag off headline',
          key_drivers: [],
          next_actions: [],
        },
        journey: { is_complete: true, missing_envelopes: [] },
      },
    } as any)

    renderWithRuntime(runtime)

    expect(screen.queryByText('Decision Review')).not.toBeInTheDocument()
    expect(screen.queryByTestId('decision-review-ready')).not.toBeInTheDocument()
    expect(screen.queryByTestId('decision-review-error')).not.toBeInTheDocument()
    expect(screen.queryByTestId('decision-review-empty')).not.toBeInTheDocument()
  })

  it('renders Decision Review ready state when flag is ON and ceeReview is present', async () => {
    const runtime = await getRuntime({
      isDecisionReviewEnabled: () => true,
    })

    const { useCanvasStore } = runtime
    const state = useCanvasStore.getState()

    state.resultsComplete({
      report: mockReport,
      hash: mockReport.model_card.response_hash,
    })

    state.setRunMeta({
      ceeReview: {
        story: {
          headline: 'Mock Decision Review headline',
          key_drivers: [],
          next_actions: [],
        },
        journey: { is_complete: true, missing_envelopes: [] },
      },
    } as any)

    renderWithRuntime(runtime)

    const ready = await screen.findByTestId('decision-review-ready')
    expect(ready).toBeInTheDocument()

    const headline = screen.getByTestId('decision-review-headline')
    expect(headline).toHaveTextContent('Mock Decision Review headline')

    expect(screen.queryByTestId('decision-review-error')).not.toBeInTheDocument()
  })

  it('renders Decision Review error state with trace ID when ceeError is present', async () => {
    const runtime = await getRuntime({
      isDecisionReviewEnabled: () => true,
    })

    const { useCanvasStore } = runtime
    const state = useCanvasStore.getState()

    state.resultsComplete({
      report: mockReport,
      hash: mockReport.model_card.response_hash,
    })

    state.setRunMeta({
      ceeError: {
        code: 'CEE_TEMPORARY',
        retryable: true,
        traceId: 'trace-123',
        suggestedAction: 'retry',
      },
      ceeTrace: {
        requestId: 'req-abc',
        degraded: false,
        timestamp: '2025-11-20T18:30:00Z',
      },
    } as any)

    renderWithRuntime(runtime)

    const errorPanel = await screen.findByTestId('decision-review-error')
    expect(errorPanel).toBeInTheDocument()

    const trace = screen.getByTestId('decision-review-trace-id')
    expect(trace).toHaveTextContent('Reference ID:')
    expect(trace).toHaveTextContent('req-abc')

    expect(screen.queryByTestId('decision-review-ready')).not.toBeInTheDocument()
  })
})
