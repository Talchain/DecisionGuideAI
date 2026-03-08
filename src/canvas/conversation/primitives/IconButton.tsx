/**
 * IconButton — 18px visual icon inside a 40×40px hit area.
 *
 * Design System v4 §6.3: icon buttons with tooltip (300ms delay).
 * Stroke: text-light at rest, text-body on hover.
 * Disabled: 35% opacity.
 */

import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Tooltip } from '../../components/Tooltip'

interface IconButtonProps {
  icon: LucideIcon
  label: string
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ icon: Icon, label, onClick, disabled = false, className = '' }, ref) {
    const button = (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`
          w-10 h-10 flex items-center justify-center rounded-lg
          bg-transparent border-none
          transition-colors duration-100
          ${disabled
            ? 'opacity-35 cursor-not-allowed'
            : 'hover:bg-panel-hover cursor-pointer'}
          focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-info
          focus-visible:outline-none
          ${className}
        `}
      >
        <Icon
          className={`w-[18px] h-[18px] flex-shrink-0 ${disabled ? 'text-text-light' : 'text-text-light group-hover:text-text-body'}`}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </button>
    )

    return (
      <Tooltip content={label}>
        <span className="group inline-flex flex-shrink-0">
          {button}
        </span>
      </Tooltip>
    )
  },
)
