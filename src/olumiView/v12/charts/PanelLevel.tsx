import { typography } from '../../../styles/typography'
import { useViewStore, type PanelViewLevel } from '../../store'

export function PanelLevel({ panel }: { panel: 'reasoning' }) {
  const level = useViewStore((s) => s.panelLevels[panel])
  const setLevel = (next: PanelViewLevel) => useViewStore.setState((s) => ({ panelLevels: { ...s.panelLevels, [panel]: next } }))
  return (
    <div className="ok-loop-level" role="group" aria-label="Reasoning level">
      {(['glance', 'detail'] as const).map((choice) => (
        <button key={choice} type="button" className={`ok-loop-control ${typography.viewPanelMeta}`}
          aria-pressed={level === choice} onClick={() => setLevel(choice)}>
          {choice === 'glance' ? 'Glance' : 'Detail'}
        </button>
      ))}
    </div>
  )
}
