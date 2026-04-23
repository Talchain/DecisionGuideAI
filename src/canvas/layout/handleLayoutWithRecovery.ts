import { useLayoutProgressStore } from '../layoutProgressStore'

export function handleLayoutWithRecovery(
  layoutFn: () => Promise<void>,
  options?: { onSuccess?: () => void; showLoading?: boolean },
): void {
  const store = useLayoutProgressStore.getState()
  if (options?.showLoading) {
    store.start('Retrying layout…')
  }
  layoutFn()
    .then(() => {
      useLayoutProgressStore.getState().succeed()
      options?.onSuccess?.()
    })
    .catch((err: unknown) => {
      if (import.meta.env.DEV) {
        console.warn('[layout] failure:', err)
      }
      useLayoutProgressStore.getState().fail('Layout failed. Try again.', () => {
        handleLayoutWithRecovery(layoutFn, { ...options, showLoading: true })
      })
    })
}
