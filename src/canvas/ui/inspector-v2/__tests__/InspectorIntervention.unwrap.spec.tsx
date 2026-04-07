/**
 * Inspector intervention unwrap regression tests.
 *
 * Locks the contract that intervention values stored as
 * UIInterventionValue / CEEInterventionV3 objects ({ value, source, ... })
 * never reach the rendered DOM as "[object Object]" or as a stringified
 * object via .toLocaleString().
 *
 * Covers two display surfaces:
 *   1. FactorControllablePanel — "Set by options" connections list
 *   2. OptionPanel — "What this option changes" intervention rows
 *
 * Both surfaces previously cast `node.data.interventions` as
 * Record<string, number>` and rendered the value directly. The fix
 * routes every read through `unwrapInterventionValue` in labelUtils.ts.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { FactorControllablePanel } from '../panels/FactorControllablePanel'
import { OptionPanel } from '../panels/OptionPanel'
import { useCanvasStore } from '../../../store'
import type { Node, Edge } from '@xyflow/react'

const noop = () => {}

function resetStore() {
  // Reset to a known empty state without disturbing unrelated keys.
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    results: { status: 'idle', report: null },
  } as any, false)
}

function seedStore(nodes: Node[], edges: Edge[] = []) {
  useCanvasStore.setState({
    nodes,
    edges,
    results: { status: 'idle', report: null },
  } as any, false)
}

describe('FactorControllablePanel — intervention unwrap regression', () => {
  beforeEach(() => {
    cleanup()
    resetStore()
  })

  it('renders a numeric badge when option interventions are stored as CEEInterventionV3 objects', () => {
    const factor: Node = {
      id: 'factor-1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Marketing budget',
        category: 'controllable',
        observedState: { value: 0.1, raw_value: 5000, unit: '\u00A3', cap: 10000 },
      },
    }
    const option: Node = {
      id: 'option-1',
      type: 'option',
      position: { x: 200, y: 0 },
      data: {
        label: 'Hire a Tech Lead',
        // V3 object form — the production shape after normaliseOptionFromCEE.
        interventions: {
          'factor-1': {
            value: 0.5,
            source: 'brief_extraction',
            target_match: { node_id: 'factor-1', match_type: 'exact_id', confidence: 'high' },
            value_confidence: 'high',
          },
        },
      },
    }
    const edge: Edge = { id: 'e1', source: 'option-1', target: 'factor-1' }

    seedStore([factor, option], [edge])

    const { container } = render(
      <FactorControllablePanel
        nodeId="factor-1"
        techMode={false}
        onClose={noop}
        onNavigate={noop}
      />
    )

    // The bug: prior to the fix, the badge contained "[object Object]" because
    // the intervention object was passed directly to .toLocaleString().
    expect(container.textContent).not.toContain('[object Object]')
    expect(container.textContent).not.toContain('NaN')

    // The connections section renders the source option label.
    expect(container.textContent).toContain('Hire a Tech Lead')
    // And renders the unit-prefixed value (£0.5 — the existing template
    // is `${unit}${value.toLocaleString()}`).
    expect(container.textContent).toContain('\u00A30.5')
  })

  it('still renders the badge when interventions are stored as plain numbers (legacy)', () => {
    const factor: Node = {
      id: 'factor-1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Marketing budget',
        category: 'controllable',
        observedState: { value: 0.1, unit: '\u00A3' },
      },
    }
    const option: Node = {
      id: 'option-1',
      type: 'option',
      position: { x: 200, y: 0 },
      data: {
        label: 'Hire No One (Status Quo)',
        interventions: { 'factor-1': 0.5 },
      },
    }
    const edge: Edge = { id: 'e1', source: 'option-1', target: 'factor-1' }

    seedStore([factor, option], [edge])

    const { container } = render(
      <FactorControllablePanel
        nodeId="factor-1"
        techMode={false}
        onClose={noop}
        onNavigate={noop}
      />
    )

    expect(container.textContent).toContain('Hire No One (Status Quo)')
    expect(container.textContent).toContain('\u00A30.5')
  })

  it('omits the badge when an intervention object lacks a numeric .value', () => {
    const factor: Node = {
      id: 'factor-1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Marketing budget',
        category: 'controllable',
        observedState: { value: 0.1, unit: '\u00A3' },
      },
    }
    const option: Node = {
      id: 'option-1',
      type: 'option',
      position: { x: 200, y: 0 },
      data: {
        label: 'Hire Two Developers',
        // Malformed: object with metadata but no value field.
        interventions: { 'factor-1': { source: 'brief_extraction' } },
      },
    }
    const edge: Edge = { id: 'e1', source: 'option-1', target: 'factor-1' }

    seedStore([factor, option], [edge])

    const { container } = render(
      <FactorControllablePanel
        nodeId="factor-1"
        techMode={false}
        onClose={noop}
        onNavigate={noop}
      />
    )

    // The connection row still appears (the option is still linked) but
    // without a badge — and definitely without "[object Object]".
    expect(container.textContent).toContain('Hire Two Developers')
    expect(container.textContent).not.toContain('[object Object]')
    expect(container.textContent).not.toContain('NaN')
  })
})

describe('OptionPanel — intervention unwrap regression', () => {
  beforeEach(() => {
    cleanup()
    resetStore()
  })

  it('renders intervention rows when interventions are stored as CEEInterventionV3 objects', () => {
    const factor: Node = {
      id: 'factor-1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Marketing budget',
        category: 'controllable',
        observedState: { value: 0.1, unit: '\u00A3' },
      },
    }
    const option: Node = {
      id: 'option-1',
      type: 'option',
      position: { x: 200, y: 0 },
      data: {
        label: 'Hire a Tech Lead',
        interventions: {
          'factor-1': {
            value: 0.5,
            source: 'brief_extraction',
            value_confidence: 'high',
          },
        },
      },
    }

    seedStore([factor, option])

    const { container } = render(
      <OptionPanel
        nodeId="option-1"
        techMode={false}
        onClose={noop}
        onNavigate={noop}
      />
    )

    expect(container.textContent).not.toContain('[object Object]')
    expect(container.textContent).not.toContain('NaN')
    // Factor label appears in the intervention row
    expect(container.textContent).toContain('Marketing budget')
  })

  it('drops malformed intervention entries instead of rendering [object Object]', () => {
    const factor1: Node = {
      id: 'factor-1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Marketing budget',
        category: 'controllable',
        observedState: { value: 0.1, unit: '\u00A3' },
      },
    }
    const factor2: Node = {
      id: 'factor-2',
      type: 'factor',
      position: { x: 0, y: 100 },
      data: {
        label: 'Headcount',
        category: 'controllable',
        observedState: { value: 0.5 },
      },
    }
    const option: Node = {
      id: 'option-1',
      type: 'option',
      position: { x: 200, y: 0 },
      data: {
        label: 'Mixed-validity option',
        interventions: {
          'factor-1': { value: 0.5, source: 'brief_extraction' }, // valid V3
          'factor-2': { source: 'brief_extraction' },             // malformed: no .value
        },
      },
    }

    seedStore([factor1, factor2, option])

    const { container } = render(
      <OptionPanel
        nodeId="option-1"
        techMode={false}
        onClose={noop}
        onNavigate={noop}
      />
    )

    expect(container.textContent).not.toContain('[object Object]')
    // The valid factor renders as a row
    expect(container.textContent).toContain('Marketing budget')
    // The malformed factor's row is dropped (no Headcount row)
    expect(container.textContent).not.toContain('Headcount')
  })
})
