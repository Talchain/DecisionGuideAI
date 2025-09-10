import * as React from 'react'
import { isCooldownActive } from '@/sandbox/bridge/triggers'

export function TriggerCooldownIndicator({ decisionId, compact = false, title }: { decisionId: string; compact?: boolean; title?: string }) {
  const [active, setActive] = React.useState<boolean>(() => isCooldownActive(decisionId))

  React.useEffect(() => {
    let mounted = true
    const tick = () => { if (!mounted) return; setActive(isCooldownActive(decisionId)) }
    // initial check
    tick()
    const id = window.setInterval(tick, 1000)
    return () => { mounted = false; clearInterval(id) }
  }, [decisionId])

  if (!active) return null

  const cls = compact ? 'ml-1 text-[9px]' : 'ml-2 text-[10px]'
  const tip = title ?? 'Triggers are in cooldown'

  return (
    <span aria-label="Trigger cooldown active" title={tip} className={`inline-flex items-center text-amber-700 ${cls}`}>
      • Cooldown
    </span>
  )
}
