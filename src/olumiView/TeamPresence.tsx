/**
 * Team presence (V11, Paul 6 Nov): the scenario's other members as overlapping initial discs in the header. Names are core's
 * (`view.members`); its hover and name are core's (`team_presence`, N3), the viewer marked "(you)" there. Meaningful activity lives on the model, not here.
 * Clicking opens the Team tab. Nothing while there is no View, or when the scenario has one member.
 */
import { useUIStore } from '../stores/uiStore'
import { typography } from '../styles/typography'
import { useViewStore } from './store'
import { othersOf } from './layout'

export function TeamPresence() {
  const view = useViewStore((s) => s.view)
  if (!view || view.members.length < 2) return null
  const others = othersOf(view)
  return (
    <button
      type="button"
      data-testid="team-presence"
      aria-label={view.team_presence.label}
      title={view.team_presence.title}
      onClick={() => useUIStore.getState().forceActivateOutputTab('team')}
      className="inline-flex min-h-[24px] min-w-[24px] items-center rounded-full pl-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-header"
    >
      {others.map((m) => (
        <span
          key={m.id}
          aria-hidden="true"
          data-testid={`team-presence-${m.id}`}
          className={`-ml-1.5 inline-grid h-6 w-6 flex-none place-items-center rounded-full border border-panel-border bg-canvas ${typography.viewPanelMeta} text-text-header shadow-1`}
        >
          {m.name.slice(0, 1).toUpperCase()}
        </span>
      ))}
    </button>
  )
}
