import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { typography } from '../../../styles/typography'
import { OkIcon, type IconId } from '../../look/icons'
import { useViewStore } from '../../store'

export function ExplainButton({ label, passage, onExplain }: {
  label: string
  passage: string
  onExplain: () => void
}) {
  const button = useRef<HTMLButtonElement>(null)
  const returning = useViewStore((s) => s.explanationReturn === passage)
  useLayoutEffect(() => {
    if (!returning || button.current === null) return
    button.current.focus()
    useViewStore.setState({ explanationReturn: null })
  }, [returning])
  return (
    <button ref={button} type="button" className="ok-loop-control ok-loop-explain"
      aria-label={label} onClick={onExplain} data-explain-trigger={passage}>
      <OkIcon id="info-more" size={14} decorative />
    </button>
  )
}

export function StatusRow({ icon, label, value, explain }: {
  icon: IconId
  label: string
  value: ReactNode
  explain: ReactNode
}) {
  return (
    <div className="ok-loop-status" data-loop-status={label}>
      <dt className={typography.viewPanelHeading}><OkIcon id={icon} size={14} decorative /><span>{label}</span></dt>
      <dd className={typography.viewPanelBody}><span>{value}</span>{explain}</dd>
    </div>
  )
}
