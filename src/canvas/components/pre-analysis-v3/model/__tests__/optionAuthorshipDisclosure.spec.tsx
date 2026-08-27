/**
 * Option authorship disclosure — an option Olumi invented must not render
 * identically to one the user named.
 *
 * MEASURED DEFECT. Across 18 drafts on 7 frozen briefs, 12 (67%) contained at
 * least one option the brief never mentions. CEE's stamp is perfectly
 * discriminating (15/15 invented options `provenance: 'ai_inferred'` with no
 * `source_quote`; 36/36 user-stated options `provenance: 'from_brief'` WITH
 * one) — the panel was simply silent about it for options while disclosing it
 * for risks in the group directly below.
 *
 * The product tells the user, verbatim: "Olumi doesn't invent options on its
 * own… You stay in control of the set." Control that is uninformed is not
 * control, so this is a truthfulness contract, not a styling one.
 *
 * ⚠ WHAT THIS SPEC IS BUILT TO SURVIVE:
 *  - It binds by IDENTITY (the row's own `nodeId` test id), never "some element
 *    has a pill" — a value predicate a different row could satisfy.
 *  - It PINS ITS OWN PRECONDITION: the fixture is asserted to contain BOTH an
 *    `ai_inferred` option AND a `from_brief` option, read back off the store.
 *    An all-invented fixture would make the disclosure assertion pass for the
 *    wrong reason, and a fixture that silently lost a class would too.
 *  - It asserts the two render DIFFERENTLY, which is the actual user-visible
 *    claim; a fix that marks every option is as wrong as one that marks none.
 *  - It carries the RISKS path as a contrast object, so a mutation aimed at
 *    the risks slice leaves it green while one aimed at options REDs it.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { PreAnalysisPanelV3 } from '../../PreAnalysisPanelV3'
import { ATTRIBUTION_COPY } from '../../constants'
import { ToastProvider } from '../../../../ToastContext'
import { useCanvasStore } from '../../../../store'
import { useReadinessStore } from '../../../../stores/readinessStore'

function node(id: string, kind: string, label: string, data: Record<string, unknown> = {}): Node {
  return { id, type: kind, position: { x: 0, y: 0 }, data: { kind, label, ...data } } as Node
}

/** The user named this one — CEE stamps it `from_brief` and quotes the brief. */
const USER_OPTION = node('o_user', 'option', 'Hire a tech lead', {
  provenance: 'from_brief',
  source_quote: 'should we hire a tech lead',
})
/** Olumi invented this one — a synthesis of the stated poles, the largest class. */
const OLUMI_OPTION = node('o_olumi', 'option', 'Hire one senior contractor and one junior', {
  provenance: 'ai_inferred',
})
const USER_RISK = node('r_user', 'risk', 'Budget overrun', { provenance: 'from_brief' })
const OLUMI_RISK = node('r_olumi', 'risk', 'Onboarding drag', { provenance: 'ai_inferred' })

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })))
  useReadinessStore.setState({
    readiness: {
      readiness_score: 60,
      readiness_level: 'fair',
      can_run_analysis: true,
      confidence_explanation: '',
      improvements: [],
    },
    loading: false,
    error: null,
  })
  useCanvasStore.setState({
    nodes: [
      node('d1', 'decision', 'Hire a tech lead or two developers?'),
      node('g1', 'goal', 'Increase delivery output', { goal_threshold: 0.8 }),
      USER_OPTION,
      OLUMI_OPTION,
      USER_RISK,
      OLUMI_RISK,
      node('f1', 'factor', 'Tech lead impact', {
        provenance: 'ai_inferred',
        observedState: { raw_value: 30, value: 0.3, unit: '%', source: 'cee_inference' },
      }),
    ],
    edges: [],
    preAnalysisSensitivity: null,
    draftCoaching: null,
    currentBriefText: null,
    goalThreshold: 0.8,
  })
})

/** Render the panel and reveal the model view + every group. */
function renderModelView() {
  render(
    <ToastProvider>
      <PreAnalysisPanelV3 onAnalyse={vi.fn()} isAnalysing={false} canRun blockedReason={undefined} />
    </ToastProvider>,
  )
  fireEvent.click(screen.getByTestId('pre-analysis-v3-your-decision').querySelector('button')!)
  fireEvent.click(screen.getByTestId('pre-analysis-v3-groups-toggle-all'))
}

/** The authorship marker inside ONE named row, or null. Identity-bound. */
function markerIn(nodeId: string): HTMLElement | null {
  const row = screen.getByTestId(`pre-analysis-v3-entity-${nodeId}`)
  return within(row).queryByText(ATTRIBUTION_COPY.olumiAuthored)
}

describe('precondition — the fixture can actually discriminate', () => {
  it('holds BOTH an ai_inferred option AND a from_brief option', () => {
    const options = useCanvasStore
      .getState()
      .nodes.filter(n => (n.data as Record<string, unknown>).kind === 'option')
    const provenances = options.map(n => (n.data as Record<string, unknown>).provenance)
    // Not "at least one of each somewhere" — exactly this pair, or the
    // disclosure assertions below could pass without discriminating anything.
    expect(provenances).toEqual(['from_brief', 'ai_inferred'])
    expect(options.map(n => n.id)).toEqual(['o_user', 'o_olumi'])
  })

  it('pins the deployed marker copy (derived from the shipped risks pill)', () => {
    expect(ATTRIBUTION_COPY.olumiAuthored).toBe('Olumi')
  })
})

describe('an option Olumi invented is disclosed as Olumi authored', () => {
  it('marks the ai_inferred option and leaves the user-named one unmarked', () => {
    renderModelView()

    // Both rows exist and carry their own labels — the rows really are the
    // objects named, not two lookups that happened to resolve to one element.
    expect(screen.getByTestId('pre-analysis-v3-entity-o_olumi')).toHaveTextContent(
      'Hire one senior contractor and one junior',
    )
    expect(screen.getByTestId('pre-analysis-v3-entity-o_user')).toHaveTextContent(
      'Hire a tech lead',
    )

    // THE CLAIM: they render differently, and in the right direction.
    expect(markerIn('o_olumi')).not.toBeNull()
    expect(markerIn('o_user')).toBeNull()
  })

  it('marks exactly one of the two option rows (disclosure, not a blanket pill)', () => {
    renderModelView()
    const marked = ['o_user', 'o_olumi'].filter(id => markerIn(id) !== null)
    expect(marked).toEqual(['o_olumi'])
  })
})

describe('the same claim, probed with PRISTINE affordances only', () => {
  it('the invented option row carries the marker; the user-named one does not', () => {
    renderModelView()
    // ⭐ This test deliberately uses NOTHING this fix introduces: no row test
    // id, no new copy constant — only the option's own label text and the
    // literal marker string the risks pill has rendered on the deployed build
    // all along. So its RED at pristine is about the missing DISCLOSURE, not
    // about an affordance that simply did not exist yet.
    const rowOf = (label: string) => screen.getByText(label).closest('div') as HTMLElement
    expect(
      within(rowOf('Hire one senior contractor and one junior')).queryByText('Olumi'),
    ).not.toBeNull()
    expect(within(rowOf('Hire a tech lead')).queryByText('Olumi')).toBeNull()
  })
})

describe('contrast object — the risks slice keeps its existing disclosure', () => {
  it('marks the ai_inferred risk and leaves the from_brief risk unmarked', () => {
    renderModelView()
    expect(markerIn('r_olumi')).not.toBeNull()
    expect(markerIn('r_user')).toBeNull()
  })
})
