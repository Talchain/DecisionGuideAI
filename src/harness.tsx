/**
 * DEV-ONLY HARNESS — NOT FOR MERGE.
 *
 * Mounts the real `AnalysisNewTabBody` across every post-run state at the real
 * 390px dock width, in a real browser, so layout and interaction can be judged.
 * jsdom cannot do this: it has no layout engine, so the 63 existing specs can
 * assert presence and never legibility.
 *
 * ⚠ SCOPE, STATED SO IT CANNOT BE OVERREAD: this exercises the COMPONENT and
 * its layout against the repo's own scenario fixtures. It is NOT a witness
 * about the producer, the wire, or an integration. A fixture is not evidence
 * about CEE.
 */
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AnalysisNewTabBody } from './components/results/analysisNew/AnalysisNewTabBody'
import { useCanvasStore } from './canvas/store'
import {
  openStrategicChallenge,
  genuineDecision,
  highUncertainty,
  decisionWithLeaderWithheld,
  evidenceGapWithNullConfidence,
  manyFragileEdges,
} from './components/results/analysisNew/__tests__/analysisNewFixtures'

const NODES = [
  { id: 'g1', type: 'goal', data: { label: 'Restore gross renewal to at least 88%', goal_threshold_raw: 88, goal_threshold_unit: '%' } },
  { id: 'd1', type: 'decision', data: { label: 'How do we stop the churn?' } },
  { id: 'o1', type: 'option', data: { label: 'Rebuild onboarding and hire two CSMs' } },
  { id: 'o2', type: 'option', data: { label: 'Reprice from per-seat to usage-based' } },
  { id: 'o3', type: 'option', data: { label: 'Build an enterprise tier with SSO and audit logs' } },
  { id: 'f1', type: 'factor', data: { label: 'Mid-market churn pressure' } },
  { id: 'f2', type: 'factor', data: { label: 'Customer success headcount' } },
  { id: 'r1', type: 'risk', data: { label: 'Repricing backlash from the existing base' } },
  { id: 'x1', type: 'outcome', data: { label: 'Gross renewal rate' } },
]

const SCENARIOS = [
  { id: 'openStrategicChallenge', label: 'Open strategic challenge', data: openStrategicChallenge },
  { id: 'genuineDecision', label: 'Genuine decision', data: genuineDecision },
  { id: 'highUncertainty', label: 'High uncertainty', data: highUncertainty },
  { id: 'leaderWithheld', label: 'Leader withheld', data: decisionWithLeaderWithheld },
  { id: 'evidenceGap', label: 'Evidence gap / null confidence', data: evidenceGapWithNullConfidence },
  { id: 'fragileEdges', label: 'Many fragile edges', data: manyFragileEdges },
] as const

const STATES = [
  { id: 'post-run',    label: 'Completed run',        props: { isPreRun: false, isRunning: false, isStale: false } },
  { id: 'pre-run',     label: 'Before any run',       props: { isPreRun: true,  isRunning: false, isStale: false } },
  { id: 'running',     label: 'Running',              props: { isPreRun: false, isRunning: true,  isStale: false } },
  { id: 'stale-changed',   label: 'Stale — model changed', props: { isPreRun: false, isRunning: false, isStale: true, staleReason: 'changed' as const } },
  { id: 'stale-unconfirmed', label: 'Stale — unconfirmed',  props: { isPreRun: false, isRunning: false, isStale: true, staleReason: 'unconfirmed' as const } },
] as const

function Harness() {
  const [scenario, setScenario] = useState<number>(0)
  const [width, setWidth] = useState<number>(390)
  const S = SCENARIOS[scenario]

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 16, background: '#f4f5f7', minHeight: '100vh' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13 }}>Reasoning states harness</strong>
        <select data-testid="harness-scenario" value={scenario} onChange={e => setScenario(Number(e.target.value))}>
          {SCENARIOS.map((s, i) => <option key={s.id} value={i}>{s.label}</option>)}
        </select>
        <span style={{ fontSize: 12 }}>
          width{' '}
          {[280, 390, 480].map(w => (
            <button key={w} data-testid={`harness-w-${w}`} onClick={() => setWidth(w)}
              style={{ marginLeft: 4, padding: '2px 8px', fontWeight: width === w ? 700 : 400 }}>{w}</button>
          ))}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', overflowX: 'auto' }}>
        {STATES.map(st => (
          <div key={st.id} data-testid={`harness-state-${st.id}`} style={{ flex: '0 0 auto' }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#444' }}>{st.label}</div>
            <div
              data-testid={`harness-panel-${st.id}`}
              style={{ width, background: '#fff', border: '1px solid #d8dbe2', borderRadius: 4, padding: 8, overflow: 'hidden' }}
            >
              <AnalysisNewTabBody
                resultsSectionData={S.data()}
                responseHash="run_harness"
                {...st.props}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

useCanvasStore.setState({ nodes: NODES, goalThreshold: null } as never)
createRoot(document.getElementById('harness-root')!).render(<StrictMode><Harness /></StrictMode>)
