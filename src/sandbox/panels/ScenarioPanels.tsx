import React from 'react'
import { IntelligencePanel } from '@/sandbox/panels/IntelligencePanel'
import { GoalsOkrsPanel } from '@/sandbox/panels/GoalsOkrsPanel'
import { SnapshotTray } from '@/sandbox/components/SnapshotTray'

export const ScenarioPanels: React.FC<{ decisionId?: string; className?: string }> = ({ decisionId = 'demo', className = '' }) => {
  return (
    <div className={`h-full flex flex-col ${className}`}>
      <div className="flex-1 overflow-y-auto">
        {/* Keep panel sections internally scrollable */}
        <IntelligencePanel decisionId={decisionId} />
        <GoalsOkrsPanel />
        {/* Additional panels can be appended here if needed */}
      </div>
      {/* Snapshot tray inline (no fixed overlay within combined layout) */}
      <SnapshotTray boardId={decisionId} fixed={false} />
    </div>
  )
}
