import { create } from 'zustand'

const usePending = create<Readonly<Record<string, true>>>(() => ({}))

export const usePopupWriting = (key: string): boolean => usePending((pending) => pending[key] === true)

/** A dialog can close while its existing request finishes. Reopening it cannot send another request for the same write. */
export async function writeFromPopup(key: string, write: () => Promise<unknown>): Promise<void> {
  if (usePending.getState()[key]) return
  usePending.setState({ [key]: true })
  try {
    await write()
  } finally {
    const { [key]: _done, ...pending } = usePending.getState()
    usePending.setState(pending, true)
  }
}
