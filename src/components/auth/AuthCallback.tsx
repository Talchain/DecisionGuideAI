/**
 * Auth callback handler — processes magic link / OAuth redirect tokens.
 *
 * Route: /auth/callback
 * The Supabase client's detectSessionInUrl: true handles token parsing.
 * This component shows a spinner while the session is established,
 * then redirects to the hub (/) on success or to /login on error.
 */

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { typography } from '../../styles/typography'

export default function AuthCallback() {
  const navigate = useNavigate()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        subscription.unsubscribe()
        navigate('/', { replace: true })
      }
    })

    // Fallback: if no auth event fires within 10 seconds, redirect to login with error
    const timeout = setTimeout(() => {
      subscription.unsubscribe()
      navigate('/login?error=expired', { replace: true })
    }, 10_000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [navigate])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas">
      <Loader2 className="h-8 w-8 animate-spin text-info" />
      <p className={`${typography.body} text-text-light`}>Signing you in…</p>
    </div>
  )
}
