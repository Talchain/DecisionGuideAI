/**
 * User avatar with dropdown menu — used in TopBar and scenario hub header.
 *
 * Shows a circular avatar with the user's display_name initial (or email initial).
 * Click opens dropdown: display name, email, "My decisions", "Profile settings", divider, "Sign out".
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, LogOut, LayoutGrid } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { typography } from '../../styles/typography'
import { MENU_EXCLUSIVE_EVENT } from './LeftSidebar'

function getInitial(profile: { display_name?: string | null; email?: string | null } | null, user: { email?: string } | null): string {
  const name = profile?.display_name || user?.email || ''
  return name.charAt(0).toUpperCase() || '?'
}

export function UserAvatarMenu() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  // Close when another menu claims exclusivity
  useEffect(() => {
    const handler = (e: Event) => {
      const source = (e as CustomEvent).detail?.source
      if (source !== 'avatar') setOpen(false)
    }
    window.addEventListener(MENU_EXCLUSIVE_EVENT, handler)
    return () => window.removeEventListener(MENU_EXCLUSIVE_EVENT, handler)
  }, [])

  const handleSignOut = useCallback(async () => {
    setOpen(false)
    await signOut()
  }, [signOut])

  const initial = getInitial(profile, user)
  const displayName = profile?.display_name || user?.email?.split('@')[0] || ''
  const email = user?.email || ''

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) {
            window.dispatchEvent(new CustomEvent(MENU_EXCLUSIVE_EVENT, { detail: { source: 'avatar' } }))
          }
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-text-on-color transition-transform duration-fast hover:scale-105"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className={typography.button}>{initial}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-56 rounded-md bg-panel shadow-2 border border-[rgba(38,38,38,0.08)] z-[100]"
          role="menu"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-[rgba(38,38,38,0.08)]">
            <p className={`${typography.label} text-text-header truncate`}>{displayName}</p>
            <p className={`${typography.bodySmall} text-text-light truncate`}>{email}</p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); navigate('/') }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-text-body hover:bg-panel-hover transition-colors duration-fast"
            >
              <LayoutGrid className="h-4 w-4 text-text-light" />
              <span className={typography.bodySmall}>My decisions</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); navigate('/profile') }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-text-body hover:bg-panel-hover transition-colors duration-fast"
            >
              <Settings className="h-4 w-4 text-text-light" />
              <span className={typography.bodySmall}>Profile settings</span>
            </button>
          </div>

          <div className="border-t border-[rgba(38,38,38,0.08)] py-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-danger hover:bg-panel-hover transition-colors duration-fast"
            >
              <LogOut className="h-4 w-4" />
              <span className={typography.bodySmall}>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
