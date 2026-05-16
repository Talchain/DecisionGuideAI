import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'

import { useCanvasStore } from '../../store'
import { SelectionPill } from '../SelectionPill'
import { StaleAnalysisBadge } from '../StaleAnalysisBadge'
import { borderColourClassFor, nodeKindFromType } from '../utils/entityColour'

// Spy on useV2Run so the stale-badge Rerun click can be verified without
// actually firing analysis network calls.
const runV2AnalysisMock = vi.fn()
vi.mock('../../hooks/useV2Run', () => ({
  useV2Run: () => ({ runV2Analysis: runV2AnalysisMock, isRunning: false }),
}))

// Stale guard is a simple selector; stub directly so we can flip isStale.
let isStaleStub = false
vi.mock('../../ui/inspector-v2/useStaleGuard', () => ({
  useStaleGuard: () => ({ isStale: isStaleStub, analysisState: isStaleStub ? 'stale' : 'current' }),
}))

beforeEach(() => {
  isStaleStub = false
  runV2AnalysisMock.mockReset()
  useCanvasStore.getState().resetCanvas?.()
})

afterEach(() => cleanup())

describe('SelectionPill — primary selection cue (brief §6.1)', () => {
  it('renders nothing when no canvas element is selected', () => {
    useCanvasStore.setState({ selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null } })
    render(<SelectionPill />)
    expect(screen.queryByTestId('ai-panel-v2-selection-pill')).toBeNull()
  })

  it('renders "Selected: [label]" when a node is selected', () => {
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Revenue goal' } } as any],
      edges: [],
      selection: { nodeIds: new Set(['n1']), edgeIds: new Set(), anchorPosition: null },
    })
    render(<SelectionPill />)
    expect(screen.getByTestId('ai-panel-v2-selection-pill')).toHaveTextContent(/selected: revenue goal/i)
  })
})

describe('StaleAnalysisBadge — brief §5.4 / §6.2', () => {
  it('renders nothing when analysis is current', () => {
    isStaleStub = false
    render(<StaleAnalysisBadge />)
    expect(screen.queryByTestId('ai-panel-v2-stale-badge')).toBeNull()
  })

  it('renders the badge when stale and exposes a Rerun action', () => {
    isStaleStub = true
    render(<StaleAnalysisBadge />)
    const badge = screen.getByTestId('ai-panel-v2-stale-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent(/analysis stale/i)
    const rerun = screen.getByTestId('ai-panel-v2-stale-rerun')
    expect(rerun).toBeInTheDocument()
  })

  it('Rerun click invokes the existing run pathway (useV2Run.runV2Analysis)', () => {
    isStaleStub = true
    render(<StaleAnalysisBadge />)
    screen.getByTestId('ai-panel-v2-stale-rerun').click()
    expect(runV2AnalysisMock).toHaveBeenCalledTimes(1)
  })
})

describe('entityColour — kind → token mapping (brief §6.1)', () => {
  it('maps each entity kind to its DS v5 border token', () => {
    expect(borderColourClassFor('goal')).toBe('border-goal')
    expect(borderColourClassFor('factor')).toBe('border-factor')
    expect(borderColourClassFor('option')).toBe('border-option')
    expect(borderColourClassFor('risk')).toBe('border-danger')
    expect(borderColourClassFor('outcome')).toBe('border-success')
    expect(borderColourClassFor('edge')).toBe('border-panel-border')
    expect(borderColourClassFor('unknown')).toBe('border-panel-border')
  })

  it('node-type → kind handles legacy synonyms', () => {
    expect(nodeKindFromType('goal')).toBe('goal')
    expect(nodeKindFromType('decision')).toBe('goal')
    expect(nodeKindFromType('factor')).toBe('factor')
    expect(nodeKindFromType('variable')).toBe('factor')
    expect(nodeKindFromType('option')).toBe('option')
    expect(nodeKindFromType('intervention')).toBe('option')
    expect(nodeKindFromType(undefined)).toBe('unknown')
  })
})
