/**
 * Canvas test harness - DOM-driven testing utilities
 */
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ReactNode } from 'react'
import { useCanvasStore } from '../../store'
import type { Blueprint } from '../../../templates/blueprints/types'
import type { StoredRun } from '../../store/runHistory'

/**
 * Render Canvas with all required providers and setup
 */
export interface RenderCanvasOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial route */
  initialRoute?: string
  /** Pre-seed localStorage with runs */
  savedRuns?: StoredRun[]
  /** Initial store state overrides */
  storeState?: Partial<ReturnType<typeof useCanvasStore.getState>>
}

export function renderCanvas(
  ui: ReactNode,
  {
    initialRoute = '/canvas',
    savedRuns = [],
    storeState = {},
    ...renderOptions
  }: RenderCanvasOptions = {}
) {
  // Reset store to clean state
  useCanvasStore.getState().resetCanvas()

  // Apply store state overrides
  if (Object.keys(storeState).length > 0) {
    useCanvasStore.setState(storeState)
  }

  // Seed localStorage with runs
  if (savedRuns.length > 0) {
    localStorage.setItem('canvas-run-history', JSON.stringify(savedRuns))
  }

  // Stub matchMedia for stable testing
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }),
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialRoute]}>
        {children}
      </MemoryRouter>
    )
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

/**
 * Seed a minimal blueprint for testing
 */
export function createTestBlueprint(overrides: Partial<Blueprint> = {}): Blueprint {
  return {
    id: 'test-bp',
    name: 'Test Blueprint',
    description: 'Test template',
    nodes: [
      { id: 'goal', kind: 'goal', label: 'Goal', position: { x: 0, y: 0 } },
      { id: 'opt1', kind: 'option', label: 'Option 1', position: { x: 0, y: 100 } },
      { id: 'out1', kind: 'outcome', label: 'Outcome 1', position: { x: 0, y: 200 } }
    ],
    edges: [
      {
        from: 'goal',
        to: 'opt1',
        probability: 0.75,
        weight: 0.6,
        belief: 0.8,
        provenance: 'template'
      },
      {
        from: 'opt1',
        to: 'out1',
        probability: 1.0,
        weight: 0.9,
        belief: 0.95,
        provenance: 'template'
      }
    ],
    ...overrides
  }
}

/**
 * Create a stored run for localStorage seeding
 */
export function createStoredRun(overrides: Partial<StoredRun> = {}): StoredRun {
  const timestamp = Date.now()
  const hash = 'abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
  return {
    id: `run-${timestamp}`,
    ts: timestamp,
    seed: 1337,
    hash,
    adapter: 'mock',
    summary: 'Test run summary',
    graphHash: hash,
    report: {
      version: 'v1',
      outcomes: [],
      summary: 'Test summary',
      insights: []
    },
    ...overrides
  }
}

/**
 * Wait for RAF-buffered updates to flush
 */
export function flushRAF() {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve(undefined)
      })
    })
  })
}

/**
 * Clean up after Canvas tests
 */
export function cleanupCanvas() {
  localStorage.clear()
  useCanvasStore.getState().resetCanvas()
}
