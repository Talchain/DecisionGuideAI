// src/components/PlotCamera.tsx
// Unified camera system for whiteboard + decision graph

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export interface Camera {
  x: number
  y: number
  zoom: number
}

interface CameraContextValue {
  camera: Camera
  setCamera: (camera: Camera) => void
  pan: (dx: number, dy: number) => void
  zoomAt: (delta: number, centerX: number, centerY: number) => void
  resetCamera: () => void
}

const CameraContext = createContext<CameraContextValue | null>(null)

export function CameraProvider({ children }: { children: ReactNode }) {
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 })

  const pan = useCallback((dx: number, dy: number) => {
    setCamera(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
  }, [])

  const zoomAt = useCallback((delta: number, centerX: number, centerY: number) => {
    setCamera(prev => {
      const newZoom = Math.max(0.25, Math.min(3, prev.zoom + delta))
      const zoomRatio = newZoom / prev.zoom
      
      // Zoom towards cursor position
      const newX = centerX - (centerX - prev.x) * zoomRatio
      const newY = centerY - (centerY - prev.y) * zoomRatio
      
      return { x: newX, y: newY, zoom: newZoom }
    })
  }, [])

  const resetCamera = useCallback(() => {
    setCamera({ x: 0, y: 0, zoom: 1 })
  }, [])

  return (
    <CameraContext.Provider value={{ camera, setCamera, pan, zoomAt, resetCamera }}>
      {children}
    </CameraContext.Provider>
  )
}

export function useCamera() {
  const context = useContext(CameraContext)
  if (!context) {
    throw new Error('useCamera must be used within CameraProvider')
  }
  return context
}
