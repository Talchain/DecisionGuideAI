/**
 * CoachingList — list mechanics, view-state ONLY (F.6).
 *
 * Owns two pieces of ephemeral view state, neither of which is computation:
 *  - `openId`: which row is expanded — one row open at a time (toggle-to-null).
 *  - `revealed`: show all / show fewer — a POSITIONAL slice of the received
 *    array (`slice(0, N)`), never a filter or sort by meaning.
 *
 * Signals are rendered in the exact order received. The list never ranks,
 * prioritises, or selects which signals matter — that is CEE's job.
 */
import { useState } from 'react'
import { typo } from '@/styles/typography'
import { CoachingActionCard } from './CoachingActionCard'
import { COACHING_COPY, COACHING_DEFAULT_VISIBLE } from './constants'
import type { CoachingSignal } from './types'

export function CoachingList({ signals }: { signals: CoachingSignal[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  const visible = revealed ? signals : signals.slice(0, COACHING_DEFAULT_VISIBLE)
  const hiddenCount = signals.length - COACHING_DEFAULT_VISIBLE

  return (
    <div data-testid="coaching-list">
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {visible.map((signal) => (
          <li key={signal.signal_id}>
            <CoachingActionCard
              signal={signal}
              isOpen={openId === signal.signal_id}
              onToggle={() =>
                setOpenId((prev) => (prev === signal.signal_id ? null : signal.signal_id))
              }
            />
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && (
        <button
          type="button"
          aria-expanded={revealed}
          onClick={() => setRevealed((v) => !v)}
          data-testid="coaching-reveal"
          className={typo(
            'panelMeta',
            'mt-2 rounded text-text-light outline-none transition-colors hover:text-text-header focus-visible:text-text-header focus-visible:ring-2 focus-visible:ring-info/40',
          )}
        >
          {revealed ? COACHING_COPY.showFewer : COACHING_COPY.showAll(signals.length)}
        </button>
      )}
    </div>
  )
}

export default CoachingList
