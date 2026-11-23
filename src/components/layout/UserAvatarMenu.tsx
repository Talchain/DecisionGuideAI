/**
 * User avatar with dropdown menu — used in TopBar and scenario hub header.
 *
 * Shows a circular avatar with the user's display_name initial (or email initial).
 * Click opens dropdown: display name, email, "My decisions", "Profile settings", divider, "Sign out". On the olumi-core lane:
 * who is signed in (private link or account), My scenarios, Organisation and Account (PoC accounts), the terms and the privacy notice, Sign out, and Delete my data.
 */

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { OkIcon } from '../../olumiView/look/icons'
import { Menu, MenuItem, MenuSeparator } from '../../olumiView/look/Menu'
import { canvasChromeMenuBoundary } from '../../olumiView/look/menu'
import { dismissMenuFromOpener, registerMenu } from '../../olumiView/look/menuArbiter'
import { HoverButton } from '../../olumiView/look/Hover'
import { TOOLBAR_ICON } from '../../olumiView/look/toolbar'
import { useAuth } from '../../contexts/AuthContext'
import { typography } from '../../styles/typography'
import { controls } from '../../styles/controls'
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
  { label: 'My scenarios', to: '/', icon: 'layout-grid' },
  { label: 'Organisation', to: '/organisation', icon: 'team' },
  { label: 'Account', to: '/account', icon: 'profile-settings' },
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
  const mark = useRef<HTMLButtonElement>(null)
  const refocus = useRef(false)
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
    <div className="relative">
      <HoverButton
        ref={mark}
        type="button"
        onClick={(event) => { if (!dismissMenuFromOpener(event.currentTarget)) { setError(null); setOpen(true) } }}
        words={words ?? 'Account menu'}
        data-testid="olumi-core-person-mark"
        className={size === 'compact' ? TOOLBAR_ICON : `flex h-8 w-8 items-center justify-center rounded-full ${controls.actColours} transition-transform duration-fast hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-header`}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className={size === 'compact' ? `inline-grid h-[26px] w-[26px] place-items-center rounded-full ${controls.actColours} ${typography.viewPanelMeta} font-medium` : typography.button}>{initial}</span>
      </HoverButton>

      {open && mark.current && (
        <Menu anchor={mark.current} label="Account menu" placement="bottom-end" gap={8}
          boundary={size === 'compact' ? canvasChromeMenuBoundary : undefined} onClose={() => setOpen(false)}>
          {(person?.name || words) && (
            <>
              <div className="space-y-2 px-3 py-2">
                {person?.name && <p className={`${typography.viewPanelHeadline} text-text-header`}>{person.name}</p>}
                {words && <p className={`${typography.viewPanelMeta} text-text-light`}>{words}</p>}
              </div>
              <MenuSeparator />
            </>
          )}
          <div className="divide-y divide-panel-border">
            {LANE_PAGES.map(({ label, to, icon }) => (
              <MenuItem key={to} id={to} label={label} icon={<OkIcon id={icon} size={14} decorative inherit />}
                meta={{ 'data-testid': `olumi-core-go-${to === '/' ? 'home' : to.slice(1)}` }} onSelect={() => navigate(to)} />
            ))}
          </div>
          <MenuSeparator />
          <div className="divide-y divide-panel-border">
            {NOTICES.map(({ label, href }) => (
              <MenuItem key={href} id={href} label={label} href={href} tip="Opens in a new tab"
                icon={<OkIcon id={href === '/privacy' ? 'privacy' : 'brief'} size={14} decorative inherit />}
                meta={{ 'data-testid': `olumi-core-notice-${href.slice(1)}` }} />
            ))}
          </div>
          <MenuSeparator />
          <div className="divide-y divide-panel-border">
            <MenuItem id="sign-out" label="Sign out" danger disabled={busy} disabledReason="Signing out"
              icon={<OkIcon id="sign-out" size={14} decorative inherit />} meta={{ 'data-testid': 'olumi-core-sign-out' }}
              onSelect={() => void handleSignOut()} closeOnSelect={false} />
            {error && <p role="alert" data-testid="olumi-core-sign-out-error" className={`${typography.viewPanelMeta} px-3 py-2 text-warning-ink`}>{error}</p>}
            <MenuItem id="delete-data" label="Delete my data" danger icon={<OkIcon id="delete" size={14} decorative inherit />}
              meta={{ 'data-testid': 'olumi-core-delete-my-data', 'aria-haspopup': 'dialog' }}
              onSelect={() => { setError(null); setDeleting(true) }} />
          </div>
        </Menu>
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

  useLayoutEffect(() => {
    const wrapper = ref.current
    if (!open || !wrapper) return
    const close = () => setOpen(false)
    return registerMenu({
      opener: null,
      lane: false,
      contains: (target) => wrapper.contains(target),
      dismiss: close,
      escape: close,
    })
  }, [open])

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
        onClick={() => setOpen((current) => !current)}
        className={`flex ${size === 'compact' ? 'h-[26px] w-[26px]' : 'h-8 w-8'} items-center justify-center rounded-full ${controls.actColours} transition-transform duration-fast hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info`}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className={size === 'compact' ? 'text-xs font-medium font-sans leading-none' : typography.button}>{initial}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-56 space-y-4 rounded-md border border-panel-border bg-panel p-3 shadow-2 z-[100]"
          role="menu"
        >
          {/* Header */}
          <div className="space-y-3">
            <p className={`${typography.label} text-text-header truncate`}>{displayName}</p>
            <p className={`${typography.bodySmall} text-text-light truncate`}>{email}</p>
          </div>

          {/* Menu items */}
          <div className="divide-y divide-panel-border">
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); navigate('/') }}
              className="flex w-full items-center gap-2 py-2.5 text-left text-text-body hover:bg-panel-hover transition-colors duration-fast"
            >
              <OkIcon id="layout-grid" className="text-text-light [&_svg]:stroke-2" decorative inherit />
              <span className={typography.bodySmall}>My scenarios</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); navigate('/profile') }}
              className="flex w-full items-center gap-2 py-2.5 text-left text-text-body hover:bg-panel-hover transition-colors duration-fast"
            >
              <OkIcon id="profile-settings" className="text-text-light [&_svg]:stroke-2" decorative inherit />
              <span className={typography.bodySmall}>Profile settings</span>
            </button>
          </div>

          <div className="divide-y divide-panel-border">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 py-2.5 text-left text-danger hover:bg-panel-hover transition-colors duration-fast"
            >
              <OkIcon id="sign-out" className="[&_svg]:stroke-2" decorative inherit />
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
