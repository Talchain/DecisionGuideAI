/**
 * EdgePanel — an option→factor edge must not claim its coefficient is read.
 *
 * THE DEFECT THIS PINS (measured by execution, ISL staging `28fe0c95` /
 * PLoT `75e7f974`, 30 Aug 2026, NOT inferred):
 * PLoT deletes option and decision nodes AND every edge incident to them
 * before any arithmetic, so an option→factor edge's strength is structurally
 * inert. Taking it 1.0 → 0.3 → 0.0 → −1.0, and deleting the edges outright,
 * all returned a bit-identical win probability to 8 dp; the same edit on a
 * factor→goal edge moved it — which is the contrast that proves the probe was
 * not blind. Meanwhile the panel said "It affects analysis." and the technical
 * editor offered a β field. The user edited β, watched the staleness banner
 * fire, re-ran, and got a guaranteed-identical number with no notice anywhere.
 *
 * ⚠ INVARIANTS ARE WRITTEN AGAINST THE SPEC, NOT THE FAILURE MODE. The spec is
 * "a surface may not assert that a quantity reaches the analysis unless it
 * does". That is why the causal and organisational arms below are asserted
 * too: they are the classes the claim must NOT move for.
 *
 * ⚠ MOUNT-PATH POSITIVE CONTROL. `EdgeAdvancedEditor` renders only when
 * `techMode` is on AND the "Model detail" disclosure is expanded
 * (`TechnicalDisclosure` starts collapsed). Every case below therefore asserts
 * the β FIELD ITSELF is on screen before asserting anything about the caveat.
 * Without that, a spec that fails to open the disclosure would assert the
 * caveat's ABSENCE against a surface that never mounted, and pass for the
 * wrong reason — the exact shape that let a sibling lane claim a fix nothing
 * observed. No module is mocked in this file, so no mock posture can hide the
 * surface either.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { EDGE_COPY, EDGE_LINK_NOTICES, resolveEdgeLinkTemplate } from '../inspectorStrings'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'

const BETA_FIELD_LABEL = 'Effect coefficient (β)'
const CAVEAT_TESTID = 'edge-beta-inert-on-intervention'

type Kind = 'option' | 'factor' | 'decision' | 'outcome'

/**
 * Seed one edge whose endpoints have the given kinds, and return its id.
 * Endpoints are addressed by node ID throughout — never by label — so a case
 * cannot pass on a neighbouring node that happens to share a display string.
 */
function seedEdge(sourceKind: Kind, targetKind: Kind) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [
      { id: 'src-1', type: sourceKind, position: { x: 0, y: 0 }, data: { label: 'Run the pilot' } },
      { id: 'tgt-1', type: targetKind, position: { x: 100, y: 0 }, data: { label: 'Adoption rate' } },
    ],
    edges: [
      {
        id: 'edge-under-test',
        source: 'src-1',
        target: 'tgt-1',
        data: { weight: 0.35, direction: 'positive', beliefExists: 0.82, strengthStd: 0.15 },
      },
    ],
    results: { status: 'none', report: null },
  } as never)
  return 'edge-under-test'
}

/**
 * Render the panel in expert mode and expand "Model detail", then assert the β
 * field mounted. Returns the container so assertions bind inside this render.
 */
function renderWithModelDetailOpen(sourceKind: Kind, targetKind: Kind) {
  const edgeId = seedEdge(sourceKind, targetKind)
  const utils = render(
    <EdgePanel edgeId={edgeId} techMode onClose={vi.fn()} onNavigate={vi.fn()} />,
  )
  fireEvent.click(screen.getByRole('button', { name: /Model detail/i }))
  // MOUNT-PATH POSITIVE CONTROL — the surface the caveat lives on is present.
  expect(screen.getByText(BETA_FIELD_LABEL)).toBeTruthy()
  return utils
}

beforeEach(() => {
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
})

describe('option→factor edge — the β control carries the caveat', () => {
  it('an intervention edge shows the inert-coefficient caveat beside β', () => {
    renderWithModelDetailOpen('option', 'factor')
    const caveat = screen.getByTestId(CAVEAT_TESTID)
    // Bind by IDENTITY to the exported constant, not to a phrase another
    // string in the panel could satisfy.
    expect(caveat.textContent).toBe(EDGE_COPY.interventionStrengthInert)
  })

  it('the caveat names what the analysis reads instead of the coefficient', () => {
    renderWithModelDetailOpen('option', 'factor')
    const caveat = screen.getByTestId(CAVEAT_TESTID)
    expect(caveat.textContent).toMatch(/does not read this coefficient/i)
    expect(caveat.textContent).toMatch(/the value the option sets its target to/i)
  })

  it('the β control remains present and editable — corrected, never hidden', () => {
    const { container } = renderWithModelDetailOpen('option', 'factor')
    // The no-hiding ruling: the field is still on screen, still an input, and
    // still not `disabled` by this component. (`InspectorRouter` wraps the
    // whole panel in a read-only fieldset one level up; that is a different
    // decision, made elsewhere, and this assertion is deliberately scoped to
    // what THIS component does.)
    const inputs = Array.from(container.querySelectorAll('input'))
    const betaInput = inputs.find(i => i.getAttribute('placeholder') === '[-1, 1]')
    expect(betaInput).toBeTruthy()
    expect(betaInput!.disabled).toBe(false)
  })
})

describe('the classes the caveat must NOT move for', () => {
  it('a factor→outcome edge shows β with NO caveat — its strength is genuinely read', () => {
    renderWithModelDetailOpen('factor', 'outcome')
    expect(screen.queryByTestId(CAVEAT_TESTID)).toBeNull()
    expect(screen.queryByText(EDGE_COPY.interventionStrengthInert)).toBeNull()
  })

  it('a decision→option organisational edge shows β with NO caveat', () => {
    renderWithModelDetailOpen('decision', 'option')
    expect(screen.queryByTestId(CAVEAT_TESTID)).toBeNull()
    expect(screen.queryByText(EDGE_COPY.interventionStrengthInert)).toBeNull()
  })

  it('the organisational notice is unchanged', () => {
    seedEdge('decision', 'option')
    render(
      <EdgePanel edgeId="edge-under-test" techMode onClose={vi.fn()} onNavigate={vi.fn()} />,
    )
    expect(screen.getByText(EDGE_LINK_NOTICES.organisational.body)).toBeTruthy()
    expect(EDGE_LINK_NOTICES.organisational.body).toContain('It does not affect analysis.')
  })
})

describe('the intervention notice stops asserting unqualified effect', () => {
  it('drops the bare "It affects analysis." claim', () => {
    const rendered = resolveEdgeLinkTemplate({ sourceLabel: 'Run the pilot', targetLabel: 'Adoption rate' })
    expect(rendered).not.toMatch(/It affects analysis\./)
  })

  it('still distinguishes intervention from organisational — the LINK is read', () => {
    const rendered = resolveEdgeLinkTemplate({ sourceLabel: 'Run the pilot', targetLabel: 'Adoption rate' })
    // The opposite-direction twin of the assertion above. Removing the false
    // claim must not collapse this class into the organisational one, whose
    // notice says the connection does not affect analysis at all.
    expect(rendered).toMatch(/The analysis reads the link and the value it sets/)
    expect(rendered).not.toMatch(/does not affect analysis/)
    expect(rendered).not.toBe(EDGE_LINK_NOTICES.organisational.body)
  })

  it('names the coefficient as the part that is NOT read', () => {
    const rendered = resolveEdgeLinkTemplate({ sourceLabel: 'Run the pilot', targetLabel: 'Adoption rate' })
    expect(rendered).toMatch(/not the effect strength stored on the connection/)
  })

  it('renders that notice on the panel for an option→factor edge', () => {
    seedEdge('option', 'factor')
    render(
      <EdgePanel edgeId="edge-under-test" techMode onClose={vi.fn()} onNavigate={vi.fn()} />,
    )
    const notice = screen.getByTestId('intervention-edge-notice')
    expect(within(notice).getByText(EDGE_LINK_NOTICES.intervention.title)).toBeTruthy()
    expect(notice.textContent).not.toMatch(/It affects analysis\./)
  })
})
