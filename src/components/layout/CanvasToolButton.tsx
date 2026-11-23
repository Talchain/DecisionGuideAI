import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { HoverButton } from '../../olumiView/look/Hover'
import { OkIcon, type IconId } from '../../olumiView/look/icons'
import { TOOLBAR_RAIL_ICON } from '../../olumiView/look/toolbar'
import Tooltip from '../Tooltip'
import styles from './CanvasFloatingToolbar.module.css'

type Props = ComponentPropsWithoutRef<'button'> & {
  lane: boolean
  words: string
  icon: IconId
  variant?: 'alt'
  'data-testid'?: string
}

export const CanvasToolButton = forwardRef<HTMLButtonElement, Props>(function CanvasToolButton({ lane, words, icon, variant, ...props }, ref) {
  const glyph = <OkIcon id={icon} variant={variant} size={lane ? 14 : undefined} decorative inherit />
  if (lane) {
    return <HoverButton ref={ref} type="button" {...props} words={words} className={TOOLBAR_RAIL_ICON}>{glyph}</HoverButton>
  }
  const active = props['aria-pressed'] || props['aria-expanded']
  return (
    <Tooltip content={words}>
      <button ref={ref} type="button" {...props} className={active ? styles.iconButtonActive : styles.iconButton}>{glyph}</button>
    </Tooltip>
  )
})
