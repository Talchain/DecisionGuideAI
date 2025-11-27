/**
 * LayerProvider - Single source of truth for popup/modal/panel z-index management
 * Ensures only one high-order overlay is open at a time
 * Esc key closes topmost layer, focus returns to invoker
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from 'react'

// Z-Index hierarchy (from implementation plan)
export const Z_INDEX = {
  FATAL_ERROR: 9999,
  TOAST: 9000,
  DIALOG: 5000,  // Confirm dialogs, Probability modal
  PANEL: 2000,   // Templates panel, inspectors
  TOOLBAR: 1000, // Canvas toolbar
  BADGE: 50,     // Build badge, Templates button
} as const

export type LayerType = 'panel' | 'modal' | 'dialog' | 'toast'

export interface Layer {
  id: string
  type: LayerType
  zIndex: number
  onClose?: () => void
  invokerElement?: HTMLElement | null  // For focus return
}

interface LayerContextValue {
  layers: Layer[]
  pushLayer: (layer: Omit<Layer, 'zIndex'>) => string
  popLayer: (id: string) => void
  closeTopmost: () => void
  getZIndex: (type: LayerType) => number
}

const LayerContext = createContext<LayerContextValue | null>(null)

export function useLayer() {
  const context = useContext(LayerContext)
  if (!context) {
    throw new Error('useLayer must be used within LayerProvider')
  }
  return context
}

interface LayerProviderProps {
  children: ReactNode
}

export function LayerProvider({ children }: LayerProviderProps) {
  const [layers, setLayers] = useState<Layer[]>([])
  const layerIdCounter = useRef(0)

  // Map layer type to base z-index
  const getZIndex = useCallback((type: LayerType): number => {
    switch (type) {
      case 'toast':
        return Z_INDEX.TOAST
      case 'dialog':
        return Z_INDEX.DIALOG
      case 'panel':
        return Z_INDEX.PANEL
      default:
        return Z_INDEX.PANEL
    }
  }, [])

  // Push a new layer onto the stack
  const pushLayer = useCallback((layer: Omit<Layer, 'zIndex'>): string => {
    const id = layer.id || `layer-${layerIdCounter.current++}`
    const zIndex = getZIndex(layer.type)

    // Store current focused element as invoker
    const invokerElement = document.activeElement as HTMLElement

    setLayers(prev => {
      // For non-toast layers, close any existing layers of the same or lower priority
      if (layer.type !== 'toast') {
        const existingNonToasts = prev.filter(l => l.type !== 'toast')
        if (existingNonToasts.length > 0) {
          // Close existing non-toast layers
          existingNonToasts.forEach(l => l.onClose?.())
          return [
            ...prev.filter(l => l.type === 'toast'),
            { ...layer, id, zIndex, invokerElement }
          ]
        }
      }

      return [...prev, { ...layer, id, zIndex, invokerElement }]
    })

    return id
  }, [getZIndex])

  // Remove a layer from the stack
  const popLayer = useCallback((id: string) => {
    setLayers(prev => {
      const layer = prev.find(l => l.id === id)

      // Return focus to invoker when layer is closed
      if (layer?.invokerElement && document.body.contains(layer.invokerElement)) {
        setTimeout(() => {
          layer.invokerElement?.focus()
        }, 0)
      }

      return prev.filter(l => l.id !== id)
    })
  }, [])

  // Close the topmost non-toast layer
  const closeTopmost = useCallback(() => {
    const nonToastLayers = layers.filter(l => l.type !== 'toast')
    if (nonToastLayers.length > 0) {
      const topmost = nonToastLayers[nonToastLayers.length - 1]
      topmost.onClose?.()
      popLayer(topmost.id)
    }
  }, [layers, popLayer])

  // Global Esc key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeTopmost()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [closeTopmost])

  // React #185 FIX: Memoize context value to prevent infinite re-render loops.
  // Without useMemo, a new object reference is created on every render,
  // causing all context consumers to re-render even when values haven't changed.
  const contextValue = useMemo(
    () => ({
      layers,
      pushLayer,
      popLayer,
      closeTopmost,
      getZIndex
    }),
    [layers, pushLayer, popLayer, closeTopmost, getZIndex]
  )

  return (
    <LayerContext.Provider value={contextValue}>
      {children}
    </LayerContext.Provider>
  )
}

/**
 * Hook to register a layer when a component mounts
 * Automatically removes layer on unmount
 */
export function useLayerRegistration(
  id: string,
  type: LayerType,
  isOpen: boolean,
  onClose?: () => void
) {
  const { pushLayer, popLayer } = useLayer()
  const layerIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      layerIdRef.current = pushLayer({ id, type, onClose })
    } else if (layerIdRef.current) {
      popLayer(layerIdRef.current)
      layerIdRef.current = null
    }

    return () => {
      if (layerIdRef.current) {
        popLayer(layerIdRef.current)
      }
    }
  }, [id, type, isOpen, onClose, pushLayer, popLayer])

  return layerIdRef.current
}
