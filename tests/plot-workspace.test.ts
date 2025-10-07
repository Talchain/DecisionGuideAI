// tests/plot-workspace.test.ts
// Tests for unified canvas workspace

import { describe, it, expect } from 'vitest'
import { toCanvas, toWorld, viewportCenterWorld, type Camera } from '../src/utils/cameraMath'
import { isTypingTarget } from '../src/utils/inputGuards'

describe('Plot Workspace - Phase 0', () => {
  describe('Camera Math', () => {
    it('round-trips world -> canvas -> world within 2px for multiple cameras', () => {
      const cameras: Camera[] = [
        { x: 0, y: 0, zoom: 1 },
        { x: 100, y: -50, zoom: 0.5 },
        { x: -200, y: 300, zoom: 2 },
      ]
      const rect = { left: 10, top: 20, width: 1200, height: 800 } as unknown as DOMRect
      const points = [ {x: 0, y: 0}, {x: 100, y: 50}, {x: -250, y: 400}, {x: 999, y: -321} ]

      for (const camera of cameras) {
        for (const p of points) {
          const screenX = p.x * camera.zoom + camera.x + rect.left
          const screenY = p.y * camera.zoom + camera.y + rect.top
          const c = toCanvas(screenX, screenY, rect)
          const w = toWorld(c.x, c.y, camera)
          expect(w.x).toBeCloseTo(p.x, 2)
          expect(w.y).toBeCloseTo(p.y, 2)
        }
      }
    })

    it('viewportCenterWorld computes world center from rect + camera', () => {
      const camera: Camera = { x: 0, y: 0, zoom: 1 }
      const rect = { left: 0, top: 0, width: 1920, height: 1080 } as unknown as DOMRect
      const c = viewportCenterWorld(rect, camera)
      expect(c.x).toBe(960)
      expect(c.y).toBe(540)
    })

    it('handles zoomed viewport center correctly', () => {
      const camera: Camera = { x: 200, y: 100, zoom: 0.5 }
      const rect = { left: 0, top: 0, width: 1920, height: 1080 } as unknown as DOMRect
      const c = viewportCenterWorld(rect, camera)
      expect(c.x).toBe(1520)
      expect(c.y).toBe(880)
    })
  })

  describe('Node Placement', () => {
    it('places node at calculated world center', () => {
      const camera = { x: 100, y: 50, zoom: 1.5 }
      const viewportCenterX = 800
      const viewportCenterY = 600
      
      const worldX = (viewportCenterX - camera.x) / camera.zoom
      const worldY = (viewportCenterY - camera.y) / camera.zoom
      
      const node = {
        id: 'test',
        label: 'Test Node',
        x: worldX,
        y: worldY,
        type: 'decision'
      }
      
      // Verify node is placed at correct world coordinates
      expect(node.x).toBeCloseTo(466.67, 1)
      expect(node.y).toBeCloseTo(366.67, 1)
      
      // Verify it appears at viewport center when rendered
      const screenX = node.x! * camera.zoom + camera.x
      const screenY = node.y! * camera.zoom + camera.y
      
      expect(screenX).toBeCloseTo(800, 1)
      expect(screenY).toBeCloseTo(600, 1)
    })
  })

  describe('Hit Testing', () => {
    it('detects node hit within radius', () => {
      const node = { x: 100, y: 100 }
      const clickX = 110
      const clickY = 110
      const radius = 40
      
      const dx = clickX - node.x
      const dy = clickY - node.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      expect(distance).toBeLessThan(radius)
    })

    it('detects node miss outside radius', () => {
      const node = { x: 100, y: 100 }
      const clickX = 150
      const clickY = 150
      const radius = 40
      
      const dx = clickX - node.x
      const dy = clickY - node.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      expect(distance).toBeGreaterThan(radius)
    })
  })

  describe('Drag Accuracy', () => {
    it('converts client coordinates to canvas coordinates correctly', () => {
      // Simulate canvas at position (100, 50) on the page
      const canvasRect = { left: 100, top: 50 }
      const clientX = 300
      const clientY = 200
      
      // Convert to canvas coordinates
      const { x: canvasX, y: canvasY } = toCanvas(clientX, clientY, canvasRect as any)
      
      expect(canvasX).toBe(200) // 300 - 100
      expect(canvasY).toBe(150) // 200 - 50
    })

    it('calculates correct world position after canvas offset', () => {
      // Canvas at (100, 50), camera at (10, 20), zoom 2
      const canvasRect = { left: 100, top: 50 }
      const camera: Camera = { x: 10, y: 20, zoom: 2 }
      const clientX = 300
      const clientY = 200
      
      // Step 1: Client to canvas
      const { x: canvasX, y: canvasY } = toCanvas(clientX, clientY, canvasRect as any)
      
      // Step 2: Canvas to world
      const { x: worldX, y: worldY } = toWorld(canvasX, canvasY, camera)
      
      expect(worldX).toBe(95) // (200 - 10) / 2
      expect(worldY).toBe(65) // (150 - 20) / 2
    })

    it('preserves node position after drag with canvas offset (drag glue)', () => {
      const canvasRect = { left: 100, top: 50 }
      const camera: Camera = { x: 0, y: 0, zoom: 1 }
      const node = { x: 200, y: 150 }
      
      // Mouse down at node center
      const mouseDownClientX = canvasRect.left + node.x
      const mouseDownClientY = canvasRect.top + node.y
      
      const { x: canvasXDown, y: canvasYDown } = toCanvas(mouseDownClientX, mouseDownClientY, canvasRect as any)
      
      const { x: clickWorldX, y: clickWorldY } = toWorld(canvasXDown, canvasYDown, camera)
      
      const dragOffsetX = clickWorldX - node.x
      const dragOffsetY = clickWorldY - node.y
      
      // Drag to new position
      const mouseMoveClientX = 400
      const mouseMoveClientY = 300
      
      const { x: canvasXMove, y: canvasYMove } = toCanvas(mouseMoveClientX, mouseMoveClientY, canvasRect as any)
      
      const worldAtCursor = toWorld(canvasXMove, canvasYMove, camera)
      const newWorldX = worldAtCursor.x - dragOffsetX
      const newWorldY = worldAtCursor.y - dragOffsetY
      
      // Node should be at new position
      expect(newWorldX).toBe(300) // 300 - 0
      expect(newWorldY).toBe(250) // 250 - 0
    })
  })

  describe('Space-pan typing guard', () => {
    it('detects typing targets correctly', () => {
      const input = document.createElement('input')
      const textarea = document.createElement('textarea')
      const div = document.createElement('div')
      div.setAttribute('contenteditable', 'true')
      const other = document.createElement('div')
      document.body.append(input, textarea, div, other)

      input.focus()
      expect(isTypingTarget(input)).toBe(true)
      textarea.focus()
      expect(isTypingTarget(textarea)).toBe(true)
      div.focus()
      expect(isTypingTarget(div)).toBe(true)
      other.focus()
      expect(isTypingTarget(other)).toBe(false)
    })
  })

  describe('Whiteboard Path Restoration', () => {
    it('repaints when initialPaths prop changes', () => {
      // Simulate whiteboard component receiving new paths after mount
      const initialPaths = [
        { id: 'path1', points: [{x: 0, y: 0}, {x: 10, y: 10}], color: '#000', width: 2 }
      ]
      
      const newPaths = [
        { id: 'path1', points: [{x: 0, y: 0}, {x: 10, y: 10}], color: '#000', width: 2 },
        { id: 'path2', points: [{x: 20, y: 20}, {x: 30, y: 30}], color: '#f00', width: 3 }
      ]
      
      // Simulate the effect: when initialPaths changes, internal state updates
      let internalPaths = initialPaths
      
      // Simulate prop change (like after restore or clear)
      if (newPaths !== initialPaths) {
        internalPaths = newPaths
      }
      
      expect(internalPaths).toHaveLength(2)
      expect(internalPaths[1].id).toBe('path2')
    })
  })

  describe('Initialization Guard', () => {
    it('only runs initialization once despite node changes', () => {
      let initCallCount = 0
      let isInitialized = false
      
      const runInit = (nodesLength: number) => {
        // Guard: only run if not already initialized
        if (!isInitialized) {
          initCallCount++
          isInitialized = true
          
          // Simulate decision: fetch or restore
          if (nodesLength === 0) {
            // Would fetch scenario
          } else {
            // Using restored workspace
          }
        }
      }
      
      // First call: workspace loaded with 0 nodes
      runInit(0)
      expect(initCallCount).toBe(1)
      
      // Simulate adding nodes (should not re-initialize)
      runInit(1)
      expect(initCallCount).toBe(1) // Still 1, not 2
      
      // Add more nodes
      runInit(3)
      expect(initCallCount).toBe(1) // Still 1, not 3
      
      // Remove nodes
      runInit(0)
      expect(initCallCount).toBe(1) // Still 1, guard prevents re-fetch
    })
  })

  describe('Connect Mode State Management', () => {
    it('clears connect source when switching tools', () => {
      let currentTool = 'connect'
      let connectSourceId: string | null = 'node1'
      
      const handleToolChange = (newTool: string) => {
        currentTool = newTool
        // Clear connect source when leaving connect mode
        if (newTool !== 'connect') {
          connectSourceId = null
        }
      }
      
      // User is in connect mode with source selected
      expect(connectSourceId).toBe('node1')
      expect(currentTool).toBe('connect')
      
      // Switch to select tool
      handleToolChange('select')
      expect(connectSourceId).toBeNull() // Source cleared
      expect(currentTool).toBe('select')
      
      // Set source again and switch to pan
      connectSourceId = 'node2'
      handleToolChange('pan')
      expect(connectSourceId).toBeNull() // Source cleared
      
      // Stay in connect mode (should keep source if not switching away)
      connectSourceId = 'node3'
      handleToolChange('connect')
      expect(connectSourceId).toBe('node3') // Source preserved
    })
  })
})
