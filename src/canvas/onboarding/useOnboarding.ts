import { useEffect, useState, useCallback } from 'react'

export const ONBOARDING_STORAGE_KEY = 'olumi_seen_onboarding'
export const ONBOARDING_STORAGE_VERSION = 'v1'

export function markOnboardingSeen() {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, ONBOARDING_STORAGE_VERSION)
  } catch (error) {
    console.warn('Failed to save onboarding status:', error)
  }
}

export function resetOnboardingProgress() {
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to reset onboarding:', error)
  }
}

export function useOnboarding() {
  const [shouldShow, setShouldShow] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Note: We no longer auto-show onboarding on first load.
  // Users go straight to the canvas and can access onboarding via Help menu.
  useEffect(() => {
    try {
      const seenVersion = localStorage.getItem(ONBOARDING_STORAGE_KEY)
      if (seenVersion !== ONBOARDING_STORAGE_VERSION) {
        setShouldShow(true)
        // Don't auto-open - let users explore the canvas first
        // setIsOpen(true)
      }
    } catch (error) {
      console.warn('Failed to check onboarding status:', error)
    }
  }, [])

  // React #185 FIX: Memoize callbacks to prevent unnecessary re-renders.
  // Without useCallback, new function references are created on every render,
  // causing consumers to re-render even when state hasn't changed.
  const open = useCallback(() => {
    setIsOpen(true)
    setShouldShow(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setShouldShow(false)
  }, [])

  const reset = useCallback(() => {
    resetOnboardingProgress()
    setShouldShow(true)
    setIsOpen(true)
  }, [])

  return { shouldShow, isOpen, open, close, reset }
}
