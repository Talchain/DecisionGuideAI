/**
 * Inspector observed-state unwrap regression tests.
 *
 * Companion to InspectorIntervention.unwrap.spec.tsx — same defensive
 * principle applied to a different field. Locks the contract that
 * `node.data.observedState.value` and `.raw_value`, when stored as a
 * compound `{ value: number, unit?: string, ... }` object instead of a
 * plain number, never reach the rendered DOM as "[object Object]".
 *
 * Bug shape:
 *   observedState = { value: { value: 0.5, unit: 'scale' }, raw_value: { value: 5000 } }
 *
 * The inspector previously cast `obs?.value as number | undefined` and
 * passed the result through `.toLocaleString()`, producing
 * "[object Object]" / "£[object Object]" in:
 *   - FactorObservablePanel value display
 *   - FactorControllablePanel editable value input + display
 *   - OptionPanel intervention rows (via InterventionRow baseline prop)
 *
 * The fix routes every read through `unwrapInterventionValue` (a generic
 * numeric defense — accepts both number and `{ value: number }`).
 *
 * Covers three input shapes per surface:
 *   - compound object: { value: 0.5, unit: 'scale' }   → unwraps to 0.5
 *   - primitive number: 0.5                            → passes through
 *   - null/undefined / { value: null }                 → renders "No value set" / drops gracefully
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { FactorObservablePanel } from '../panels/FactorObservablePanel'
import { FactorControllablePanel } from '../panels/FactorControllablePanel'
import { OptionPanel } from '../panels/OptionPanel'
import { FactorControllableEditor } from '../editors/FactorControllableEditor'
import { FactorObservableEditor } from '../editors/FactorObservableEditor'
import { useCanvasStore } from '../../../store'
import type { Node, Edge } from '@xyflow/react'

const noop = () => {}

function resetStore() {
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

// ---------------------------------------------------------------------------
// FactorObservablePanel
// ---------------------------------------------------------------------------

describe('FactorObservablePanel — observed-state unwrap regression', () => {
  beforeEach(() => {
    cleanup()
    resetStore()
  })

  it('renders a compound { value, unit } observedState.value as the inner numeric value', () => {
    const factor: Node = {
      id: 'factor-1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Customer satisfaction',
        category: 'observable',
        // Compound shape — `.value` is itself an object, not a bare number.
        observedState: { value: { value: 0.5, unit: 'scale' }, unit: '%' } as any,
      },
    }
    seedStore([factor])

    const { container } = render(
      <FactorObservablePanel
        nodeId="factor-1"
        techMode={false}
        onClose={noop}
        onNavigate={noop}
      />,
    )

    expect(container.textContent).not.toContain('[object Object]')
    expect(container.textContent).not.toContain('NaN')
  })

  it('renders a primitive observedState.value as before', () => {
    const factor: Node = {
      id: 'factor-1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Customer satisfaction',
        category: 'observable',
        observedState: { value: 0.85, unit: '%' },
      },
    }
    seedStore([factor])

    const { container } = render(
      <FactorObservablePanel
        nodeId="factor-1"
        techMode={false}
        onClose={noop}
        onNavigate={noop}
      />,
    )

    expect(container.textContent).not.toContain('[object Object]')
    // 0.85 with % unit → "85%" via formatValue
    expect(container.textContent).toContain('85')
  })

  it('renders gracefully when observedState.value is null/undefined', () => {
    const factor: Node = {
      id: 'factor-1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Customer satisfaction',
        category: 'observable',
        observedState: { unit: '%' } as any,
      },
    }
    seedStore([factor])

    const { container } = render(
      <FactorObservablePanel
        nodeId="factor-1"
        techMode={false}
        onClose={noop}
        onNavigate={noop}
      />,
    )

    expect(container.textContent).not.toContain('[object Object]')
    expect(container.textContent).not.toContain('NaN')
    expect(container.textContent).toContain('No value set')
  })

  it('renders gracefully when observedState.value is { value: null }', () => {
    // Mirrors the intervention regression: { value: null } previously
    // coerced to 0 via Number(null). The strict-typeof helper treats null
    // as missing → falls through to the "No value set" branch.
    const factor: Node = {
      id: 'factor-1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Customer satisfaction',
        category: 'observable',
        observedState: { value: { value: null }, unit: '%' } as any,
      },
    }
    seedStore([factor])

    const { container } = render(
      <FactorObservablePanel
        nodeId="factor-1"
        techMode={false}
        onClose={noop}
        onNavigate={noop}
      />,
    )

    expect(container.textContent).not.toContain('[object Object]')
    expect(container.textContent).not.toContain('NaN')
    expect(container.textContent).toContain('No value set')
  })
})

// ---------------------------------------------------------------------------
// FactorControllablePanel
// ---------------------------------------------------------------------------

describe('FactorControllablePanel — observed-state unwrap regression', () => {
  beforeEach(() => {
    cleanup()
    resetStore()
  })

  it('renders a compound { value, unit } observedState.raw_value in the editable input as the inner number', () => {
    const factor: Node = {
      id: 'factor-1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Marketing budget',
        category: 'controllable',
        // raw_value is the bug surface: it flows into String(displayValue)
        // for the editable input. Compound objects produced "[object Object]".
        observedState: {
          value: 0.5,
          raw_value: { value: 5000, unit: '\u00A3' },
          unit: '\u00A3',
          cap: 10000,
        } as any,
      },
    }
    seedStore([factor])

    const { container } = render(
      <FactorControllablePanel
        nodeId="factor-1"
        techMode={false}
        onClose={noop}
        onNavigate={noop}
      />,
    )

    expect(container.textContent).not.toContain('[object Object]')
    expect(container.textContent).not.toContain('NaN')

    // The editable number input should hold the unwrapped numeric value
    // ("5000"), not "[object Object]".
    const input = container.querySelector('input[type="number"]') as HTMLInputElement | null
    expect(input).not.toBeNull()
    expect(input?.value).toBe('5000')
  })

  it('renders a primitive observedState.raw_value as before', () => {
    const factor: Node = {
      id: 'factor-1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Marketing budget',
        category: 'controllable',
        observedState: { value: 0.5, raw_value: 5000, unit: '\u00A3', cap: 10000 },
      },
    }
    seedStore([factor])

    const { container } = render(
      <FactorControllablePanel
        nodeId="factor-1"
        techMode={false}
        onClose={noop}
        onNavigate={noop}
      />,
    )

    expect(container.textContent).not.toContain('[object Object]')
    const input = container.querySelector('input[type="number"]') as HTMLInputElement | null
    expect(input?.value).toBe('5000')
  })

  it('renders an empty input when raw_value and value are both missing/null', () => {
    const factor: Node = {
      id: 'factor-1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Marketing budget',
        category: 'controllable',
        observedState: { unit: '\u00A3', cap: 10000 } as any,
      },
    }
    seedStore([factor])

    const { container } = render(
      <FactorControllablePanel
        nodeId="factor-1"
        techMode={false}
        onClose={noop}
        onNavigate={noop}
      />,
    )

    expect(container.textContent).not.toContain('[object Object]')
    expect(container.textContent).not.toContain('NaN')
    const input = container.querySelector('input[type="number"]') as HTMLInputElement | null
    // Empty placeholder, not "[object Object]" or "NaN"
    expect(input?.value).toBe('')
  })
})

// ---------------------------------------------------------------------------
// OptionPanel — baseline prop on InterventionRow
// ---------------------------------------------------------------------------

describe('OptionPanel — observed-state baseline unwrap regression', () => {
  beforeEach(() => {
    cleanup()
    resetStore()
  })

  it('does not render [object Object] when the target factor.observedState.value is a compound object', () => {
    // OptionPanel reads obs?.value as the InterventionRow `baseline` prop.
    // InterventionRow.formatValue(baseline) calls baseline.toLocaleString(),
    // which previously produced "[object Object]" for compound shapes.
    const factor: Node = {
      id: 'factor-1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Marketing budget',
        category: 'controllable',
        observedState: { value: { value: 0.1, unit: 'scale' }, unit: '\u00A3' } as any,
      },
    }
    const option: Node = {
      id: 'option-1',
      type: 'option',
      position: { x: 200, y: 0 },
      data: {
        label: 'Option A',
        interventions: { 'factor-1': 0.5 },
      },
    }
    seedStore([factor, option])

    const { container } = render(
      <OptionPanel
        nodeId="option-1"
        techMode={false}
        onClose={noop}
        onNavigate={noop}
      />,
    )

    expect(container.textContent).not.toContain('[object Object]')
    expect(container.textContent).not.toContain('NaN')
    // The factor row still appears (intervention itself is valid).
    expect(container.textContent).toContain('Marketing budget')
  })

  it('renders the baseline as "Currently: ..." when the value is a primitive', () => {
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
        label: 'Option A',
        interventions: { 'factor-1': 0.5 },
      },
    }
    seedStore([factor, option])

    const { container } = render(
      <OptionPanel
        nodeId="option-1"
        techMode={false}
        onClose={noop}
        onNavigate={noop}
      />,
    )

    expect(container.textContent).not.toContain('[object Object]')
    expect(container.textContent).toContain('Currently:')
    expect(container.textContent).toContain('Marketing budget')
  })

  it('renders "Currently: N/A" when target factor has no observed value at all', () => {
    const factor: Node = {
      id: 'factor-1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Marketing budget',
        category: 'controllable',
        observedState: { unit: '\u00A3' } as any,
      },
    }
    const option: Node = {
      id: 'option-1',
      type: 'option',
      position: { x: 200, y: 0 },
      data: {
        label: 'Option A',
        interventions: { 'factor-1': 0.5 },
      },
    }
    seedStore([factor, option])

    const { container } = render(
      <OptionPanel
        nodeId="option-1"
        techMode={false}
        onClose={noop}
        onNavigate={noop}
      />,
    )

    expect(container.textContent).not.toContain('[object Object]')
    expect(container.textContent).toContain('Marketing budget')
    expect(container.textContent).toContain('N/A')
  })
})

// ---------------------------------------------------------------------------
// Inspector editors (rendered inside panels via TechnicalDisclosure)
// ---------------------------------------------------------------------------
//
// Editors are rendered inside `TechnicalDisclosure` (techMode opt-in, click
// to expand). The acceptance criterion "no inspector panel renders
// [object Object]" applies because the editor tree is part of the panel tree.
//
// AdvancedField does `useState(String(value ?? ''))` unconditionally — passing
// a compound `{ value: 0.5, unit: 'scale' }` would seed the input with literal
// "[object Object]" until the user typed over it. The fix unwraps in the
// editor before the value reaches AdvancedField.
//
// These tests render editors directly (rather than panel + click disclosure)
// — TechnicalDisclosure starts collapsed, so going through the panel would
// require a click() and `findBy` queries. Editors are leaf components with
// only `nodeId` as a prop, so direct rendering is the cleanest unit test.

describe('FactorControllableEditor — observed-state unwrap regression', () => {
  beforeEach(() => {
    cleanup()
    resetStore()
  })

  it('seeds Raw value input with the inner number when raw_value is a compound object', () => {
    const factor: Node = {
      id: 'factor-1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Marketing budget',
        category: 'controllable',
        observedState: {
          value: 0.5,
          raw_value: { value: 5000, unit: '\u00A3' },
          unit: '\u00A3',
          cap: 10000,
        } as any,
      },
    }
    seedStore([factor])

    const { container } = render(<FactorControllableEditor nodeId="factor-1" />)

    expect(container.textContent).not.toContain('[object Object]')
    expect(container.textContent).not.toContain('NaN')

    // AdvancedField type='number' renders `<input type="text" inputMode="decimal">`,
    // so we read all input values and assert the unwrapped 5000 is present.
    const inputs = Array.from(container.querySelectorAll('input')) as HTMLInputElement[]
    const values = inputs.map((i) => i.value)
    expect(values.some((v) => v.includes('[object Object]'))).toBe(false)
    expect(values).toContain('5000')
  })

  it('seeds Normalised value, Baseline, and Scale cap inputs with unwrapped numbers', () => {
    const factor: Node = {
      id: 'factor-1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Marketing budget',
        category: 'controllable',
        observedState: {
          value: { value: 0.5, unit: 'scale' },
          baseline: { value: 0.3 },
          cap: { value: 10000 },
        } as any,
      },
    }
    seedStore([factor])

    const { container } = render(<FactorControllableEditor nodeId="factor-1" />)

    expect(container.textContent).not.toContain('[object Object]')

    const inputs = Array.from(container.querySelectorAll('input')) as HTMLInputElement[]
    const values = inputs.map((i) => i.value)
    expect(values.some((v) => v.includes('[object Object]'))).toBe(false)
    expect(values).toContain('0.5')
    expect(values).toContain('0.3')
    expect(values).toContain('10000')
  })

  it('seeds inputs with empty string when fields are missing (no NaN, no [object Object])', () => {
    const factor: Node = {
      id: 'factor-1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Marketing budget',
        category: 'controllable',
        observedState: { unit: '\u00A3' } as any,
      },
    }
    seedStore([factor])

    const { container } = render(<FactorControllableEditor nodeId="factor-1" />)

    expect(container.textContent).not.toContain('[object Object]')
    expect(container.textContent).not.toContain('NaN')

    // The numeric inputs corresponding to missing fields should be empty,
    // not "[object Object]" or "NaN".
    const inputs = Array.from(container.querySelectorAll('input')) as HTMLInputElement[]
    const values = inputs.map((i) => i.value)
    expect(values.some((v) => v === '[object Object]')).toBe(false)
    expect(values.some((v) => v === 'NaN')).toBe(false)
  })
})

describe('FactorObservableEditor — observed-state unwrap regression', () => {
  beforeEach(() => {
    cleanup()
    resetStore()
  })

  it('seeds Raw value input with the inner number when raw_value is a compound object', () => {
    const factor: Node = {
      id: 'factor-1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Customer satisfaction',
        category: 'observable',
        observedState: {
          value: 0.85,
          raw_value: { value: 85, unit: '%' },
          unit: '%',
        } as any,
      },
    }
    seedStore([factor])

    const { container } = render(<FactorObservableEditor nodeId="factor-1" />)

    expect(container.textContent).not.toContain('[object Object]')
    expect(container.textContent).not.toContain('NaN')

    const inputs = Array.from(container.querySelectorAll('input')) as HTMLInputElement[]
    const values = inputs.map((i) => i.value)
    expect(values.some((v) => v.includes('[object Object]'))).toBe(false)
    expect(values).toContain('85')
  })

  it('still seeds primitive observedState values into the editor inputs', () => {
    const factor: Node = {
      id: 'factor-1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Customer satisfaction',
        category: 'observable',
        observedState: { value: 0.85, raw_value: 85, unit: '%' },
      },
    }
    seedStore([factor])

    const { container } = render(<FactorObservableEditor nodeId="factor-1" />)

    expect(container.textContent).not.toContain('[object Object]')
    const inputs = Array.from(container.querySelectorAll('input')) as HTMLInputElement[]
    const values = inputs.map((i) => i.value)
    expect(values).toContain('85')
    expect(values).toContain('0.85')
  })

  it('seeds inputs with empty string when value/raw_value are { value: null }', () => {
    const factor: Node = {
      id: 'factor-1',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: {
        label: 'Customer satisfaction',
        category: 'observable',
        observedState: {
          value: { value: null },
          raw_value: { value: null },
        } as any,
      },
    }
    seedStore([factor])

    const { container } = render(<FactorObservableEditor nodeId="factor-1" />)

    expect(container.textContent).not.toContain('[object Object]')
    expect(container.textContent).not.toContain('NaN')

    const inputs = Array.from(container.querySelectorAll('input')) as HTMLInputElement[]
    const values = inputs.map((i) => i.value)
    expect(values.some((v) => v === '[object Object]')).toBe(false)
    expect(values.some((v) => v === '0')).toBe(false) // not the null-coercion regression
  })
})
