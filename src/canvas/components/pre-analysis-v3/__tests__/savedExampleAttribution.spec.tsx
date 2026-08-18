/**
 * THE MOUNTED PANEL MUST NOT ATTRIBUTE A BUNDLED EXAMPLE TO THE USER'S BRIEF.
 *
 * The pure-copy pin lives in `signals/__tests__/estimatesAttribution.spec.ts`.
 * This file exists because that pin is not evidence that the PRODUCT asks the
 * question: a mutation making `usePreAnalysisModel` compute `isSavedExample`
 * as a constant `false` — i.e. the whole W-1 fabrication, restored — survived
 * the copy spec, the registry spec and the guard, 212/212 green. The same
 * lesson `reactFlowGraph.restoreFreshnessOnBoot.spec.ts` records: a perfect
 * unit kit is not evidence that anything calls the unit.
 *
 * So this renders the real panel over a real store and reads the sentence off
 * the screen, in both directions.
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { PreAnalysisPanelV3 } from '../PreAnalysisPanelV3'
import { ToastProvider } from '../../../ToastContext'
import { useCanvasStore } from '../../../store'
import { useReadinessStore } from '../../../stores/readinessStore'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { useSignalSessionStore } from '../signals/signalSessionStore'
import type { PreAnalysisSensitivity } from '../../../../adapters/cee/types'

const SENSITIVITY: PreAnalysisSensitivity = {
  factor_influence: { f1: 0.9, f2: 0.5, f3: 0.2 },
  edge_influence: {},
  method: 'linear',
}

function node(id: string, kind: string, label: string, data: Record<string, unknown> = {}): Node {
  return { id, type: kind, position: { x: 0, y: 0 }, data: { kind, label, ...data } } as Node
}

type StoreEdge = Parameters<typeof useCanvasStore.setState>[0] extends infer S
  ? S extends { edges?: Array<infer E> | undefined }
    ? E
    : never
  : never

function edge(source: string, target: string): StoreEdge {
  return { id: `${source}->${target}`, source, target, data: {} } as StoreEdge
}

/**
 * One graph, two provenances. `starterStamp` is the ONLY difference between
 * the two arms, so any behavioural difference below is attributable to it and
 * to nothing else.
 */
function seedGraph(starterStamp: Record<string, unknown>) {
  const factor = (id: string, label: string, raw: number) =>
    node(id, 'factor', label, {
      provenance: 'ai_inferred',
      observedState: { raw_value: raw, value: raw / 100, unit: '%', source: 'cee_inference' },
      ...starterStamp,
    })
  useCanvasStore.setState({
    nodes: [
      node('d1', 'decision', 'Customer Data Platform Selection', starterStamp),
      node('g1', 'goal', 'Replace CDP within budget', starterStamp),
      node('o1', 'option', 'Segment', starterStamp),
      node('o2', 'option', 'Snowflake-native build', starterStamp),
      factor('f1', 'Snowflake-Native Build Adoption', 30),
      factor('f2', 'Ramp-up time', 60),
      factor('f3', 'Coordination overhead', 10),
    ],
    edges: [edge('f1', 'g1'), edge('f2', 'g1'), edge('f3', 'g1')],
    preAnalysisSensitivity: SENSITIVITY,
    ceeAnalysisReady: null,
    draftCoaching: null,
    currentBriefText: null,
    goalThreshold: null,
    goalConstraints: null,
  })
}

const STARTER_STAMP = {
  starterId: 'vendor-selection',
  starterTitle: 'Customer Data Platform Selection',
}

function renderPanel() {
  return render(
    <ToastProvider>
      <PreAnalysisPanelV3 onAnalyse={vi.fn()} isAnalysing={false} canRun />
    </ToastProvider>,
  )
}

/** The estimates signal sits behind the reveal; open it and return the section. */
function sharpenSection(): HTMLElement {
  fireEvent.click(screen.getByTestId('pre-analysis-v3-sharpen-reveal'))
  return screen.getByTestId('pre-analysis-v3-sharpen')
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })))
})

beforeEach(() => {
  useSignalSessionStore.getState().reset()
  useGuidanceStore.setState({ _sendChip: null, _prefillChat: null })
  useReadinessStore.setState({
    readiness: {
      readiness_score: 72,
      readiness_level: 'ready',
      can_run_analysis: true,
      confidence_explanation: 'Looks consistent.',
      improvements: [],
    },
    loading: false,
    error: null,
  })
})

describe('pre-analysis panel — whose brief was it', () => {
  it('does NOT tell a visitor a bundled example came from their brief', () => {
    seedGraph(STARTER_STAMP)
    renderPanel()
    const sharpen = sharpenSection()

    // Precondition pinned in-test: the estimates signal must actually be on
    // screen, bound to its own factor by name — otherwise the absence of the
    // false sentence would prove nothing (trap 13).
    expect(sharpen).toHaveTextContent('Check Snowflake-Native Build Adoption first, it may matter most.')

    expect(sharpen).not.toHaveTextContent('from your brief')
    expect(sharpen).toHaveTextContent('Olumi estimated 3 values in this saved example.')
  })

  it('STILL says "from your brief" when the model really came from the user', () => {
    // Byte-identical graph minus the starter stamp — the discriminating pair.
    seedGraph({})
    renderPanel()
    const sharpen = sharpenSection()

    expect(sharpen).toHaveTextContent('Check Snowflake-Native Build Adoption first, it may matter most.')
    expect(sharpen).toHaveTextContent('Olumi estimated 3 values from your brief.')
    expect(sharpen).not.toHaveTextContent('saved example')
  })
})
