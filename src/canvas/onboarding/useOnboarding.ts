import { useEffect, useState } from 'react'

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

  useEffect(() => {
    try {
      const seenVersion = localStorage.getItem(ONBOARDING_STORAGE_KEY)
      if (seenVersion !== ONBOARDING_STORAGE_VERSION) {
        setShouldShow(true)
        setIsOpen(true)
      }
    } catch (error) {
      console.warn('Failed to check onboarding status:', error)
    }
  }, [])

  const open = () => {
    setIsOpen(true)
    setShouldShow(true)
  }

  const close = () => {
    setIsOpen(false)
    setShouldShow(false)
  }

  const reset = () => {
    resetOnboardingProgress()
    setShouldShow(true)
    setIsOpen(true)
  }

  return { shouldShow, isOpen, open, close, reset }
}
