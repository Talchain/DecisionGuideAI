// src/components/WhiteboardCanvas.tsx
// Whiteboard base layer with pan/zoom and simple drawing

import { useRef, useEffect, useState, useCallback } from 'react'
import { isTypingTarget } from '../utils/inputGuards'
import { useCamera } from './PlotCamera'

export interface DrawPath {
  id: string
  points: { x: number; y: number }[]
  color: string
  width: number
}

interface StickyNote {
  id: string
  x: number
  y: number
  text: string
  color: string
}

interface WhiteboardCanvasProps {
  initialPaths?: DrawPath[]
  onPathsChange?: (paths: DrawPath[]) => void
}

export default function WhiteboardCanvas({ initialPaths, onPathsChange }: WhiteboardCanvasProps) {
  const { camera, pan, zoomAt } = useCamera()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [paths, setPaths] = useState<DrawPath[]>(initialPaths || [])
  const [notes] = useState<StickyNote[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([])
  const [isPanning, setIsPanning] = useState(false)
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 })
  const [spacePressed, setSpacePressed] = useState(false)

  // Sync paths when initialPaths changes (e.g., after restore or clear)
  useEffect(() => {
    if (initialPaths) {
      setPaths(initialPaths)
    }
  }, [initialPaths])

  // Notify parent when paths change
  useEffect(() => {
    if (onPathsChange) {
      onPathsChange(paths)
    }
  }, [paths, onPathsChange])

  // Screen to world coordinates
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    return {
      x: (screenX - camera.x) / camera.zoom,
      y: (screenY - camera.y) / camera.zoom
    }
  }, [camera])

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (e.button === 1 || e.shiftKey || e.metaKey || spacePressed) {
      // Pan mode
      setIsPanning(true)
      setLastPos({ x: e.clientX, y: e.clientY })
    } else {
      // Draw mode
      const worldPos = screenToWorld(x, y)
      setIsDrawing(true)
      setCurrentPath([worldPos])
    }
  }, [screenToWorld, spacePressed])

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    if (isPanning) {
      const dx = e.clientX - lastPos.x
      const dy = e.clientY - lastPos.y
      pan(dx, dy)
      setLastPos({ x: e.clientX, y: e.clientY })
    } else if (isDrawing) {
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const worldPos = screenToWorld(x, y)
      setCurrentPath(prev => [...prev, worldPos])
    }
  }, [isPanning, isDrawing, lastPos, pan, screenToWorld])

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isDrawing && currentPath.length > 1) {
      setPaths(prev => [...prev, {
        id: Date.now().toString(),
        points: currentPath,
        color: '#6366f1', // indigo
        width: 2
      }])
    }
    setIsDrawing(false)
    setIsPanning(false)
    setCurrentPath([])
  }, [isDrawing, currentPath])

  // Handle wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const delta = -e.deltaY * 0.001
    zoomAt(delta, x, y)
  }, [zoomAt])

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    // Clear
    ctx.fillStyle = '#fafafa'
    ctx.fillRect(0, 0, rect.width, rect.height)

    // Apply camera transform
    ctx.save()
    ctx.translate(camera.x, camera.y)
    ctx.scale(camera.zoom, camera.zoom)

    // Draw grid
    const gridSize = 50
    const startX = Math.floor((-camera.x / camera.zoom) / gridSize) * gridSize
    const startY = Math.floor((-camera.y / camera.zoom) / gridSize) * gridSize
    const endX = startX + (rect.width / camera.zoom) + gridSize
    const endY = startY + (rect.height / camera.zoom) + gridSize

    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 0.5
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, startY)
      ctx.lineTo(x, endY)
      ctx.stroke()
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(startX, y)
      ctx.lineTo(endX, y)
      ctx.stroke()
    }

    // Draw saved paths
    paths.forEach(path => {
      if (path.points.length < 2) return
      ctx.strokeStyle = path.color
      ctx.lineWidth = path.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(path.points[0].x, path.points[0].y)
      path.points.forEach(p => ctx.lineTo(p.x, p.y))
      ctx.stroke()
    })

    // Draw current path
    if (currentPath.length > 1) {
      ctx.strokeStyle = '#6366f1'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(currentPath[0].x, currentPath[0].y)
      currentPath.forEach(p => ctx.lineTo(p.x, p.y))
      ctx.stroke()
    }

    // Draw sticky notes
    notes.forEach(note => {
      ctx.fillStyle = note.color
      ctx.fillRect(note.x - 50, note.y - 50, 100, 100)
      ctx.strokeStyle = '#94a3b8'
      ctx.strokeRect(note.x - 50, note.y - 50, 100, 100)
      ctx.fillStyle = '#1f2937'
      ctx.font = '12px sans-serif'
      ctx.fillText(note.text, note.x - 45, note.y - 30)
    })

    ctx.restore()
  }, [camera, paths, currentPath, notes])

  // Handle Space key for pan (but NOT while typing in inputs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept Space if user is typing in an input/textarea/contenteditable
      const typing = isTypingTarget(e.target as HTMLElement)
      
      if (e.code === 'Space' && !e.repeat && !typing) {
        e.preventDefault()
        setSpacePressed(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Prevent context menu on canvas
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  const cursorClass = isPanning || spacePressed ? 'cursor-grab' : isDrawing ? 'cursor-crosshair' : 'cursor-crosshair'

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 0 }} data-testid="whiteboard-container">
      <canvas
        ref={canvasRef}
        className={`w-full h-full ${cursorClass}`}
        data-testid="whiteboard-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      />
      
      {/* Fallback message if canvas fails */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-xs text-gray-400 pointer-events-none">
        Whiteboard ready • Drag to draw • Space/Shift+drag to pan • Scroll to zoom
      </div>
    </div>
  )
}
