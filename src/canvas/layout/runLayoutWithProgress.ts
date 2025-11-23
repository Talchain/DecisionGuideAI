import { useCanvasStore } from '../store'
import { useLayoutProgressStore } from '../layoutProgressStore'

// Shared helper to run ELK layout with a non-blocking progress banner.
// Returns true on success, false on failure. Never throws.
export async function runLayoutWithProgress(): Promise<boolean> {
  const applyLayout = useCanvasStore.getState().applyLayout
  const { start, succeed, fail } = useLayoutProgressStore.getState()

  const retry = () => {
    // Fire and forget; state updates are handled inside this helper.
    void runLayoutWithProgress()
  }

  start('Loading layout engine and applying layout...', retry)

  try {
    await applyLayout()
    succeed()
    return true
  } catch (err) {
    // Surface failure via banner and console; callers can still show local toasts.
    // eslint-disable-next-line no-console
    console.error('[CANVAS] Layout failed:', err)
    fail('Layout failed. Please try again.', retry)
    return false
  }
}
