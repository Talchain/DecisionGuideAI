import React from 'react'
import { subscribe, getActiveTrigger, armDecision, disarmDecision } from '@/sandbox/bridge/triggers'
import { useFlags } from '@/lib/flags'
import { TriggerCooldownIndicator } from '@/sandbox/components/TriggerCooldownIndicator'

export const IntelligencePanel: React.FC<{ decisionId?: string }> = ({ decisionId = 'debug-test-board' }) => {
  const flags = useFlags()
  const [active, setActive] = React.useState(getActiveTrigger(decisionId))
  React.useEffect(() => {
    armDecision(decisionId)
    const unsub = subscribe(decisionId, (state) => setActive(state))
    return () => { unsub(); disarmDecision(decisionId) }
  }, [decisionId])

  return (
    <section role="region" aria-label="Intelligence" className="p-4 overflow-auto">
      <h3 className="text-sm font-semibold mb-2 flex items-center">
        <span>Intelligence</span>
        <TriggerCooldownIndicator decisionId={decisionId} compact title="Triggers are in cooldown" />
      </h3>
      {active ? (
        <div aria-label="Decision needed" className="border rounded p-3 bg-amber-50 text-sm">
          <div className="font-medium mb-1">Decision needed</div>
          <div className="text-gray-700 mb-2">{active.rule} — Severity: {active.severity}</div>
          <button
            className="px-3 py-1 rounded bg-indigo-600 text-white text-sm"
            onClick={() => {
              if (flags.decisionCTA) {
                if (typeof window !== 'undefined') {
                  window.location.hash = `#/decisions/${decisionId}/frame`
                }
              }
            }}
          >Open Decision Flow</button>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div>
            <div className="font-medium">Outcomes</div>
            <ul className="list-disc ml-5">
              <li>No active triggers</li>
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
