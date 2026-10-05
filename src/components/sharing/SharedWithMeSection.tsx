/**
 * "Shared with me" — decisions a colleague has shared with the signed-in user's
 * confirmed email (`list_shared_scenarios`). View access only.
 *
 * Renders NOTHING when there is nothing shared (or the list cannot be read):
 * an empty heading on every hub would be noise for the many users with no
 * shares. Re-reads on tab focus, like the hub's own list, so a new share
 * appears without a reload.
 */

import { useCallback, useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { typography } from '../../styles/typography'
import { listSharedScenarios, type SharedScenario } from '../../services/scenarioSharingService'
import { formatRelativeTime } from '../../utils/formatRelativeTime'

export function SharedWithMeSection({ onOpen }: { onOpen: (scenarioId: string) => void }) {
  const [items, setItems] = useState<SharedScenario[]>([])

  const refresh = useCallback(async () => {
    const result = await listSharedScenarios()
    if (result.ok) setItems(result.items)
  }, [])

  useEffect(() => {
    void refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  if (items.length === 0) return null

  return (
    <section className="mt-10" aria-labelledby="shared-with-me-heading" data-testid="shared-with-me">
      <h3 id="shared-with-me-heading" className={`${typography.h4} text-text-header flex items-center gap-2`}>
        <Users className="w-4 h-4 text-text-light" aria-hidden="true" />
        Shared with me
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 mt-4">
        {items.map((item) => (
          <button
            key={item.scenarioId}
            type="button"
            onClick={() => onOpen(item.scenarioId)}
            className="text-left p-6 rounded-[20px] bg-panel shadow-1 hover:shadow-2 hover:-translate-y-0.5 transition-all duration-fast"
            data-testid="shared-scenario-card"
            data-scenario-id={item.scenarioId}
          >
            <span className={`${typography.h4} text-text-header block truncate`}>{item.title}</span>
            <span className={`${typography.bodySmall} text-text-light mt-2 block truncate`}>
              {item.ownerName ? `Shared by ${item.ownerName}` : 'Shared with you'}
              {item.sharedAt ? ` · ${formatRelativeTime(item.sharedAt)}` : ''}
            </span>
            <span className={`${typography.panelMeta} text-text-light mt-1 block`}>View only</span>
          </button>
        ))}
      </div>
    </section>
  )
}
