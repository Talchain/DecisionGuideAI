import { createContext, useContext, useLayoutEffect } from 'react'
import { createStore, useStore } from 'zustand'
import type { EdgeLook } from './edgeLook'

const drawnLookSignature = ({ tone, lineClass, dash, end, halos, mark, styled }: EdgeLook) =>
  JSON.stringify([tone, lineClass, dash, end, halos, mark, styled])

type DrawnLook = { signature: string; look: EdgeLook; labelId: string | null }

const drawnLooks = createStore<ReadonlyMap<string, DrawnLook>>(() => new Map())
export const useDrawnLooks = () => useStore(drawnLooks)
export const DrawnLooksVisible = createContext(true)

/** React Flow mounts the edge only once both handles have positions. The canvas can still hide its viewport while framing. */
export function useDrawnLook(id: string, look: EdgeLook, labelId: string | null = null) {
  const visible = useContext(DrawnLooksVisible)
  const signature = drawnLookSignature(look)

  useLayoutEffect(() => {
    if (!visible) return
    return () => {
      const entries = new Map(drawnLooks.getState())
      entries.delete(id)
      drawnLooks.setState(entries, true)
    }
  }, [id, visible])

  useLayoutEffect(() => {
    if (!visible) return
    const entries = drawnLooks.getState()
    const previous = entries.get(id)
    if (previous?.signature === signature && previous.labelId === labelId) return
    drawnLooks.setState(new Map(entries).set(id, { signature, look, labelId }), true)
  })

  return signature
}
