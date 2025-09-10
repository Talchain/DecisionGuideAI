import React from 'react'

interface RightPanelProps {
  decisionId: string
  assumptions?: any[]
}

export const RightPanel: React.FC<RightPanelProps> = ({ decisionId, assumptions }) => {
  return (
    <aside className="w-80 border-l border-gray-200 bg-white h-full flex flex-col">
      <div className="px-4 py-3 border-b text-sm font-semibold text-gray-700">Scenario Details</div>
      <div className="p-4 space-y-4 text-sm">
        <section>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Overview</h3>
          <div className="text-gray-700">
            <div className="text-xs text-gray-500">Decision</div>
            <div className="truncate">{decisionId}</div>
          </div>
        </section>
        <section>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Assumptions</h3>
          <ul className="list-disc pl-4 text-gray-700 space-y-1">
            {(assumptions ?? []).map((a, i) => (
              <li key={i}>{String(a)}</li>
            ))}
            {(!assumptions || assumptions.length === 0) && (
              <li className="text-gray-400">None</li>
            )}
          </ul>
        </section>
        <section>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Options & Criteria</h3>
          <div className="text-gray-500">Read-only for MVP</div>
        </section>
        <section>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Probabilities</h3>
          <div className="text-gray-500">Edit connectors on canvas (MVP)</div>
        </section>
        <section>
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Activity</h3>
          <div className="text-gray-500">Comments preview coming soon</div>
        </section>
      </div>
    </aside>
  )
}
