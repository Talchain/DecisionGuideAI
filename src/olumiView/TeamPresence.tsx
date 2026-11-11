/**
 * Team presence (V11, Paul 6 Nov): the scenario's other members as overlapping initial discs in the header. Names are core's
 * (`view.members`); its hover and name are core's (`team_presence`, N3), the viewer marked "(you)" there. Meaningful activity lives on the model, not here.
 * Clicking opens the Team tab. Beside it, the people the brief names whom no member matches (`team_presence.unjoined`), in core's words.
 * Nothing while there is no View, or when the scenario has one member and core names no one else.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { measureDockInset } from '../canvas/components/FloatingOlumiPanel'
import { useUIStore } from '../stores/uiStore'
import { typography } from '../styles/typography'
import { useViewStore } from './store'
import { othersOf } from './layout'
import type { View } from './client'
import { putDraft } from '../olumiCore/team/drafts'
import { inviteNameKey } from '../olumiCore/team/InvitePanel'

/** Open Team with the invite form holding `name`, and bring the form into view. */
export function inviteUnjoined(sid: string, name: string): void {
  if (name !== '') putDraft<string>(inviteNameKey(sid), () => name)
  useUIStore.getState().forceActivateOutputTab('team')
  requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector('[data-testid="team-invite"]')?.scrollIntoView({ block: 'nearest' })))
}

export function TeamPresence() {
  const view = useViewStore((s) => s.view), sid = useViewStore((s) => s.sid)
  // V11 J1 #6 (core f44bd1c): the people the brief names whom no member matches, in core's words. It shows on a team of one too (the
  // first look), where there are no discs. Core never says "not yet invited": the View is not given invitations.
  const unjoined = view?.team_presence.unjoined ?? null
  if (!view || (view.members.length < 2 && unjoined === null)) return null
  const others = othersOf(view)
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {view.members.length < 2 ? null : <Discs view={view} others={others} />}
      {unjoined === null ? null : (
        // V11 pixel pass (9 Nov): two short lines with room before Share (one 360 px line crowded it at 1232), never cut.
        // An action (DL 9 Nov: the person must be able to do something about it): pressing core's sentence opens Team with the invite form
        // holding the first name core lists, ready to make that person's link. The words stay core's; the press is the page's.
        <button type="button" onClick={() => inviteUnjoined(sid ?? view.id, unjoined.names[0] ?? '')} aria-label={`${unjoined.text}. Invite ${unjoined.names[0] ?? ''}`}
          // UI restore stage 1, row 1 (DL ruling 10 Nov: no stray header notice): in the pill the sentence is the control's name and hover,
          // not a line of text beside Share (it widened the pill under the dock at 1232); the press is unchanged.
          className={`${typography.viewPanelMeta} inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-full border border-dashed border-panel-border text-text-body hover:border-text-header hover:text-text-header focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}
          title={unjoined.text} data-testid="team-presence-unjoined"><UserPlus size={14} aria-hidden="true" /><span className="sr-only" data-view="team_presence.unjoined.text">{unjoined.text}</span></button>
      )}
    </span>
  )
}

/**
 * How much room each overlapping disc takes (24 px wide, 6 px overlapped), the most the "+N" chip takes and the least (one digit: a disc's
 * own room), and the gap kept between the bar and the dock (px).
 */
export const DISC_STEP = 18, CHIP_STEP = 30, CHIP_LEAST = 18, DOCK_GAP = 12

/**
 * How many of `total` discs to draw, given `shown` are drawn now and `free` px are left between the bar's right edge and the dock (negative
 * when the bar runs under it). The most that fit; the rest become one "+N" chip.
 * It settles (state-machine inventory U12b, 11 Nov: the count ping-ponged inside the layout effect, a render loop on a shared scenario):
 * a layout that does not fit only ever loses discs, and a layout that fits only gains discs it has measured room for, with the chip
 * costed at its widest when it arrives and credited at its narrowest when it goes. So no answer can undo the one before it.
 */
export function discsThatFit(total: number, shown: number, free: number): number {
  const chip = (n: number) => ((n < total) === (shown < total) ? 0 : n < total ? CHIP_STEP : -CHIP_LEAST)
  for (let n = free < 0 ? Math.min(shown, total) : total; n >= 0; n--) if ((n - shown) * DISC_STEP + chip(n) <= free) return n
  return 0
}

function Discs({ view, others }: { view: View; others: ReturnType<typeof othersOf> }) {
  // The top bar never reaches the dock (DL 10 Nov, 7 people: an avatar covered the dock's title): when there is no room the discs that do not
  // fit collapse into one "+N" chip. Measured against the bar's own right edge, again on resize and while the dock opens or closes.
  const button = useRef<HTMLButtonElement>(null)
  const [drawn, setDrawn] = useState(others.length), [tick, setTick] = useState(0)
  useEffect(() => {
    const again = () => setTick((t) => t + 1)
    window.addEventListener('resize', again); window.addEventListener('outputs-dock-opened', again)
    const t = setInterval(again, 500)
    return () => { clearInterval(t); window.removeEventListener('resize', again); window.removeEventListener('outputs-dock-opened', again) }
  }, [])
  const total = others.length, now = Math.min(drawn, total)
  useLayoutEffect(() => {
    const bar = button.current?.closest('[role="banner"]') ?? null, inset = measureDockInset()
    const free = bar === null || inset === 0 ? Infinity : window.innerWidth - inset - DOCK_GAP - bar.getBoundingClientRect().right
    const next = discsThatFit(total, now, free)
    if (next !== drawn) setDrawn(next)
  }, [total, now, drawn, tick])
  return (
    <button
      ref={button}
      type="button"
      data-testid="team-presence"
      aria-label={view.team_presence.label}
      title={view.team_presence.title}
      onClick={() => useUIStore.getState().forceActivateOutputTab('team')}
      className="inline-flex min-h-[24px] min-w-[24px] items-center rounded-full pl-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-header"
    >
      {others.slice(0, now).map((m) => (
        <span
          key={m.id}
          aria-hidden="true"
          data-presence-disc=""
          data-testid={`team-presence-${m.id}`}
          className={`-ml-1.5 inline-grid h-6 w-6 flex-none place-items-center rounded-full border border-panel-border bg-canvas ${typography.viewPanelMeta} text-text-header shadow-1`}
        >
          {m.name.slice(0, 1).toUpperCase()}
        </span>
      ))}
      {now < total ? (
        <span aria-hidden="true" data-testid="team-presence-more" className={`-ml-1.5 inline-grid h-6 min-w-6 flex-none place-items-center rounded-full border border-panel-border bg-canvas px-1 ${typography.viewPanelMeta} text-text-header shadow-1`}>+{total - now}</span>
      ) : null}
    </button>
  )
}
