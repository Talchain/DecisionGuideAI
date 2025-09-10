import React from 'react'
import { StrategyContextPanel } from '@/sandbox/panels/StrategyContextPanel'
import { GoalsOkrsPanel } from '@/sandbox/panels/GoalsOkrsPanel'
import { IntelligencePanel } from '@/sandbox/panels/IntelligencePanel'
import { SandboxCanvas } from '@/sandbox/components/SandboxCanvas'
import { ReviewPanel } from '@/sandbox/panels/ReviewPanel'
import { useTelemetry } from '@/lib/useTelemetry'
import { useFlags } from '@/lib/flags'
import { RealtimeProvider } from '@/realtime/provider'

export type StrategyBridgeShellProps = {
  decisionId?: string
}

export const StrategyBridgeShell: React.FC<StrategyBridgeShellProps> = ({ decisionId = 'debug-test-board' }) => {
  const flags = useFlags()
  const { track: t } = useTelemetry()
  const [tab, setTab] = React.useState<'goals' | 'intelligence' | 'review'>(() => {
    // Restore from query (?panel=...)
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    const q = hash.includes('?') ? hash.split('?')[1] : ''
    const sp = new URLSearchParams(q)
    const p = sp.get('panel')
    return p === 'intelligence' ? 'intelligence' : p === 'review' ? 'review' : 'goals'
  })
  const goalsTabRef = React.useRef<HTMLButtonElement | null>(null)
  const intelTabRef = React.useRef<HTMLButtonElement | null>(null)
  const reviewTabRef = React.useRef<HTMLButtonElement | null>(null)

  React.useEffect(() => {
    t('sandbox_bridge', { op: 'open', decisionId, ts: Date.now() })
    return () => t('sandbox_bridge', { op: 'close', decisionId, ts: Date.now() })
  }, [decisionId, t])

  const onSelectTab = (nextTab: 'goals' | 'intelligence' | 'review') => {
    setTab(nextTab)
    t('sandbox_panel', { op: 'tab_select', tab: nextTab, decisionId })
    // Mirror to query param (?panel=...)
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '#/'
      const [path, query] = hash.split('?')
      const sp = new URLSearchParams(query || '')
      sp.set('panel', nextTab)
      const newHash = `${path}?${sp.toString()}`
      history.replaceState(null, '', newHash)
    }
  }

  const onRightPanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      // Return focus to the active tab
      const target = tab === 'goals' ? goalsTabRef.current : tab === 'intelligence' ? intelTabRef.current : reviewTabRef.current
      target?.focus()
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const order: Array<'goals' | 'intelligence' | 'review'> = ['goals', 'intelligence', 'review']
      const idx = order.indexOf(tab)
      const nextTab = e.key === 'ArrowRight' ? order[(idx + 1) % order.length] : order[(idx - 1 + order.length) % order.length]
      const target = nextTab === 'goals' ? goalsTabRef.current : nextTab === 'intelligence' ? intelTabRef.current : reviewTabRef.current
      target?.focus()
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const focused = document.activeElement
      if (focused === goalsTabRef.current) onSelectTab('goals')
      if (focused === intelTabRef.current) onSelectTab('intelligence')
      if (focused === reviewTabRef.current) onSelectTab('review')
    }
  }

  // Focus the active tab on mount
  React.useEffect(() => {
    const t = tab === 'goals' ? goalsTabRef.current : tab === 'intelligence' ? intelTabRef.current : reviewTabRef.current
    t?.focus()
  }, [])

  const Shell = (
    <div className="w-full h-full grid grid-cols-[280px,1fr,360px]">
      {/* Left Strategy Context */}
      <section role="region" aria-label="Strategy context" className="border-r overflow-auto">
        <StrategyContextPanel decisionId={decisionId} />
      </section>

      {/* Center Canvas */}
      <section role="region" aria-label="Scenario canvas" className="overflow-hidden">
        <SandboxCanvas boardId={decisionId} />
      </section>

      {/* Right: Goals & OKRs / Intelligence */}
      <section role="region" aria-label="Right panel" className="border-l overflow-auto" onKeyDown={onRightPanelKeyDown}>
        <div role="tablist" aria-label="Right panel tabs" className="flex border-b">
          <button
            ref={goalsTabRef}
            role="tab"
            aria-selected={tab === 'goals'}
            tabIndex={tab === 'goals' ? 0 : -1}
            className={`px-3 py-2 text-sm ${tab === 'goals' ? 'border-b-2 border-indigo-600' : ''}`}
            onClick={() => onSelectTab('goals')}
          >Goals & OKRs</button>
          <button
            ref={intelTabRef}
            role="tab"
            aria-selected={tab === 'intelligence'}
            tabIndex={tab === 'intelligence' ? 0 : -1}
            className={`px-3 py-2 text-sm ${tab === 'intelligence' ? 'border-b-2 border-indigo-600' : ''}`}
            onClick={() => onSelectTab('intelligence')}
          >Intelligence</button>
          <button
            ref={reviewTabRef}
            role="tab"
            aria-selected={tab === 'review'}
            tabIndex={tab === 'review' ? 0 : -1}
            className={`px-3 py-2 text-sm ${tab === 'review' ? 'border-b-2 border-indigo-600' : ''}`}
            onClick={() => onSelectTab('review')}
          >Review</button>
        </div>
        {tab === 'goals' ? <GoalsOkrsPanel decisionId={decisionId} /> : tab === 'intelligence' ? <IntelligencePanel decisionId={decisionId} /> : <ReviewPanel decisionId={decisionId} />}
      </section>
    </div>
  )

  if (flags.realtime) {
    return (
      <RealtimeProvider decisionId={decisionId}>
        {Shell}
      </RealtimeProvider>
    )
  }
  return Shell
}
