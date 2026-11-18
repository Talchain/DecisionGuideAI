/**
 * User avatar with dropdown menu — used in TopBar and scenario hub header.
 *
 * Shows a circular avatar with the user's display_name initial (or email initial).
 * Click opens dropdown: display name, email, "My decisions", "Profile settings", divider, "Sign out". On the olumi-core lane:
 * who is signed in (private link or account), My scenarios, Organisation and Account (PoC accounts), the terms and the privacy notice, Sign out, and Delete my data.
 */

import { useState, useRef, useEffect, useCallback, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, LogOut, LayoutGrid, FileText, ShieldCheck, Trash2, Users } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { typography } from '../../styles/typography'
import { controls } from '../../styles/controls'
import { MENU_EXCLUSIVE_EVENT } from './LeftSidebar'
import { sanitiseUserId } from '../../lib/guestIdentity'
import { isOlumiCoreLane } from '../../olumiCore/lane'
import { useMe } from '../../olumiCore/me'
import { signOutOfOlumi } from '../../olumiCore/signout'
import { TeamApiError } from '../../olumiCore/team/api'
import { NOTICES } from '../../olumiCore/notices'
import { DeleteMyDataDialog } from '../../olumiCore/DeleteMyDataDialog'

function getInitial(profile: { display_name?: string | null; email?: string | null } | null, user: { email?: string } | null): string {
  const name = profile?.display_name || user?.email || ''
  return name.charAt(0).toUpperCase() || '?'
}

interface UserAvatarMenuProps {
  /**
   * `compact` is contract v3.1 `.app-top .avatar{width:26px;height:26px;
   * font-size:11px}` — the canvas top bar (DESIGN-GAP #5). `default` keeps the
   * 32px avatar the scenario list and profile headers were designed around.
   */
  size?: 'default' | 'compact'
}

/** Closes an open menu on a press outside it, on Escape, and when another menu claims the screen (MENU_EXCLUSIVE_EVENT). */
function useMenuDismiss(open: boolean, setOpen: (open: boolean) => void, ref: RefObject<HTMLDivElement>) {
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
  }, [open, setOpen, ref])

  useEffect(() => {
    const handler = (e: Event) => {
      const source = (e as CustomEvent).detail?.source
      if (source !== 'avatar') setOpen(false)
    }
    window.addEventListener(MENU_EXCLUSIVE_EVENT, handler)
    return () => window.removeEventListener(MENU_EXCLUSIVE_EVENT, handler)
  }, [setOpen])
}

/**
 * On the olumi-core lane the person is who core says (`GET /api/me`): someone with an email and password (an account), or someone with only a
 * private link. There is no Supabase profile behind this build (its address is dead on purpose, so sign in or a profile save would hang or
 * fail). Once core has answered, the menu says which kind of person this is (until then it says nothing) and offers what core serves:
 *   - My scenarios, Organisation and Account (src/olumiCore/accounts/);
 *   - the terms and the privacy notice (core's `/terms` and `/privacy`, each in a new tab);
 *   - Sign out (`POST /api/me/signout`, this browser only; any private link still opens it again and other members stay signed in);
 *   - Delete my data (`POST /api/me/delete`): a dialog shows core's own sentences for what would go before anything is deleted
 *     (src/olumiCore/DeleteMyDataDialog.tsx).
 * Sign out and a completed deletion both land on the signed-out screen.
 */
/** The PoC account pages on the lane (src/olumiCore/accounts/routes.tsx): home is My scenarios. */
const LANE_PAGES = [
  { label: 'My scenarios', to: '/', Icon: LayoutGrid },
  { label: 'Organisation', to: '/organisation', Icon: Users },
  { label: 'Account', to: '/account', Icon: Settings },
] as const

function PrivateLinkMenu({ size }: { size: 'default' | 'compact' }) {
  const person = useMe((s) => s.me)
  const hasAccount = useMe((s) => s.hasAccount)
  const known = useMe((s) => s.status === 'ready')
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The delete dialog outlives the menu: the menu closes when it opens, and a press inside the dialog must not close it.
  const [deleting, setDeleting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const mark = useRef<HTMLButtonElement>(null)
  const refocus = useRef(false)
  useMenuDismiss(open, setOpen, ref)
  // A cancelled dialog gives the focus back to the account menu's button, once the dialog (and its focus trap) has gone.
  useEffect(() => { if (!deleting && refocus.current) { refocus.current = false; mark.current?.focus() } }, [deleting])
  const initial = (person?.name ?? '').charAt(0).toUpperCase() || '?'
  // Page chrome, true for each kind of person: core's `/api/me` says whether this person has an account (an email and password) or only a private link.
  // Said only once core has answered: before that the page cannot tell an account holder from a private-link person, so it says nothing.
  const words = !known ? undefined
    : hasAccount ? 'You are signed in to your Olumi account'
    : person ? `You are using Olumi through ${person.name}’s private link` : 'You are using Olumi through your private link'

  const handleSignOut = useCallback(async () => {
    setBusy(true); setError(null)
    try {
      await signOutOfOlumi()
      setOpen(false)
      navigate('/signed-out', { replace: true })
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. You are still signed in.')
    } finally { setBusy(false) }
  }, [navigate])

  const closeDelete = useCallback(() => { refocus.current = true; setDeleting(false) }, [])
  // Core has deleted the data, ended the link and cleared this browser's cookie (src/olumiCore/erase.ts forgot the person here).
  const onDeleted = useCallback(() => {
    setDeleting(false)
    navigate('/signed-out?deleted=1', { replace: true })
  }, [navigate])

  return (
    <div ref={ref} className="relative">
      <button
        ref={mark}
        type="button"
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) window.dispatchEvent(new CustomEvent(MENU_EXCLUSIVE_EVENT, { detail: { source: 'avatar' } }))
        }}
        title={words}
        data-testid="olumi-core-person-mark"
        className={`flex ${size === 'compact' ? 'h-[26px] w-[26px]' : 'h-8 w-8'} items-center justify-center rounded-full ${controls.actColours} transition-transform duration-fast hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info`}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className={size === 'compact' ? 'text-xs font-medium font-sans leading-none' : typography.button}>{initial}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-md bg-panel shadow-2 border border-[rgba(38,38,38,0.08)] z-[100]" role="menu">
          <div className="px-4 py-3">
            <p className={`${typography.label} text-text-header truncate`}>{person?.name ?? ''}</p>
            {words && <p className={`${typography.bodySmall} text-text-light`}>{words}</p>}
          </div>
          {/* PoC accounts (src/olumiCore/accounts/): back to My scenarios, the organisation and the account page from a scenario. */}
          <div className="py-1">
            {LANE_PAGES.map(({ label, to, Icon }) => (
              <button
                key={to}
                type="button"
                role="menuitem"
                data-testid={`olumi-core-go-${to === '/' ? 'home' : to.slice(1)}`}
                onClick={() => { setOpen(false); navigate(to) }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-text-body hover:bg-panel-hover transition-colors duration-fast"
              >
                <Icon className="h-4 w-4 text-text-light" aria-hidden="true" />
                <span className={typography.bodySmall}>{label}</span>
              </button>
            ))}
          </div>
          <div className="py-1">
            {NOTICES.map(({ label, href }) => {
              const Icon = href === '/privacy' ? ShieldCheck : FileText
              return (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  title="Opens in a new tab"
                  data-testid={`olumi-core-notice-${href.slice(1)}`}
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-text-body hover:bg-panel-hover transition-colors duration-fast"
                >
                  <Icon className="h-4 w-4 text-text-light" aria-hidden="true" />
                  <span className={typography.bodySmall}>{label}</span>
                </a>
              )
            })}
          </div>
          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              data-testid="olumi-core-sign-out"
              disabled={busy}
              onClick={() => void handleSignOut()}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-danger hover:bg-panel-hover transition-colors duration-fast disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              <span className={typography.bodySmall}>Sign out</span>
            </button>
            {error && <p role="alert" data-testid="olumi-core-sign-out-error" className={`${typography.caption} px-4 pb-2 text-danger`}>{error}</p>}
            <button
              type="button"
              role="menuitem"
              data-testid="olumi-core-delete-my-data"
              onClick={() => { setOpen(false); setError(null); setDeleting(true) }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-danger hover:bg-panel-hover transition-colors duration-fast"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span className={typography.bodySmall}>Delete my data</span>
            </button>
          </div>
        </div>
      )}
      {deleting && <DeleteMyDataDialog onCancel={closeDelete} onDeleted={onDeleted} />}
    </div>
  )
}

export function UserAvatarMenu(props: UserAvatarMenuProps = {}) {
  return isOlumiCoreLane() ? <PrivateLinkMenu size={props.size ?? 'default'} /> : <AccountAvatarMenu {...props} />
}

function AccountAvatarMenu({ size = 'default' }: UserAvatarMenuProps = {}) {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useMenuDismiss(open, setOpen, ref)

  const handleSignOut = useCallback(async () => {
    setOpen(false)
    await signOut()
  }, [signOut])

  // The guest posture's user is the sentinel (`{ id: 'guest' }`), never null: the ONE predicate decides (guestIdentity.ts).
  const isGuest = sanitiseUserId(user?.id) === null
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
        className={`flex ${size === 'compact' ? 'h-[26px] w-[26px]' : 'h-8 w-8'} items-center justify-center rounded-full ${controls.actColours} transition-transform duration-fast hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info`}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className={size === 'compact' ? 'text-xs font-medium font-sans leading-none' : typography.button}>{initial}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-56 rounded-md bg-panel shadow-2 border border-[rgba(38,38,38,0.08)] z-[100]"
          role="menu"
        >
          {/* Header */}
          <div className="px-4 py-3">
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
              <span className={typography.bodySmall}>My scenarios</span>
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

          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-danger hover:bg-panel-hover transition-colors duration-fast"
            >
              <LogOut className="h-4 w-4" />
              <span className="flex flex-col">
                <span className={typography.bodySmall}>Sign out</span>
                {/* P48 E: a guest's Sign out runs the identity boundary, so Olumi stops reopening their work here.
                    Says what changes for the person, never where the work is stored (src/test/guestStorageClaims.ts). */}
                {isGuest && (
                  <span className={`${typography.caption} text-text-light`} data-testid="sign-out-guest-note">
                    Olumi won’t reopen your guest work here automatically
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
