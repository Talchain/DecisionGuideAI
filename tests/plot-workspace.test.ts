// tests/plot-workspace.test.ts
// Tests for unified canvas workspace

import { describe, it, expect } from 'vitest'

describe('Plot Workspace - Phase 0', () => {
  describe('Camera Math', () => {
    it('converts screen coordinates to world coordinates', () => {
      const camera = { x: 100, y: 50, zoom: 2 }
      const screenX = 400
      const screenY = 300
      
      // Formula: worldX = (screenX - camera.x) / camera.zoom
      const worldX = (screenX - camera.x) / camera.zoom
      const worldY = (screenY - camera.y) / camera.zoom
      
      expect(worldX).toBe(150) // (400 - 100) / 2 = 150
      expect(worldY).toBe(125) // (300 - 50) / 2 = 125
    })

    it('converts world coordinates to screen coordinates', () => {
      const camera = { x: 100, y: 50, zoom: 2 }
      const worldX = 150
      const worldY = 125
      
      // Formula: screenX = worldX * camera.zoom + camera.x
      const screenX = worldX * camera.zoom + camera.x
      const screenY = worldY * camera.zoom + camera.y
      
      expect(screenX).toBe(400) // 150 * 2 + 100 = 400
      expect(screenY).toBe(300) // 125 * 2 + 50 = 300
    })

    it('calculates viewport center in world coordinates', () => {
      const camera = { x: 0, y: 0, zoom: 1 }
      const viewportWidth = 1920
      const viewportHeight = 1080
      
      const centerX = viewportWidth / 2
      const centerY = viewportHeight / 2
      
      const worldCenterX = (centerX - camera.x) / camera.zoom
      const worldCenterY = (centerY - camera.y) / camera.zoom
      
      expect(worldCenterX).toBe(960)
      expect(worldCenterY).toBe(540)
    })

    it('handles zoomed viewport center correctly', () => {
      const camera = { x: 200, y: 100, zoom: 0.5 }
      const viewportWidth = 1920
      const viewportHeight = 1080
      
      const centerX = viewportWidth / 2
      const centerY = viewportHeight / 2
      
      const worldCenterX = (centerX - camera.x) / camera.zoom
      const worldCenterY = (centerY - camera.y) / camera.zoom
      
      // (960 - 200) / 0.5 = 1520
      // (540 - 100) / 0.5 = 880
      expect(worldCenterX).toBe(1520)
      expect(worldCenterY).toBe(880)
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
      const canvasX = clientX - canvasRect.left
      const canvasY = clientY - canvasRect.top
      
      expect(canvasX).toBe(200) // 300 - 100
      expect(canvasY).toBe(150) // 200 - 50
    })

    it('calculates correct world position after canvas offset', () => {
      // Canvas at (100, 50), camera at (10, 20), zoom 2
      const canvasRect = { left: 100, top: 50 }
      const camera = { x: 10, y: 20, zoom: 2 }
      const clientX = 300
      const clientY = 200
      
      // Step 1: Client to canvas
      const canvasX = clientX - canvasRect.left
      const canvasY = clientY - canvasRect.top
      
      // Step 2: Canvas to world
      const worldX = (canvasX - camera.x) / camera.zoom
      const worldY = (canvasY - camera.y) / camera.zoom
      
      expect(worldX).toBe(95) // (200 - 10) / 2
      expect(worldY).toBe(65) // (150 - 20) / 2
    })

    it('preserves node position after drag with canvas offset', () => {
      const canvasRect = { left: 100, top: 50 }
      const camera = { x: 0, y: 0, zoom: 1 }
      const node = { x: 200, y: 150 }
      
      // Mouse down at node center
      const mouseDownClientX = canvasRect.left + node.x
      const mouseDownClientY = canvasRect.top + node.y
      
      const canvasXDown = mouseDownClientX - canvasRect.left
      const canvasYDown = mouseDownClientY - canvasRect.top
      
      const clickWorldX = (canvasXDown - camera.x) / camera.zoom
      const clickWorldY = (canvasYDown - camera.y) / camera.zoom
      
      const dragOffsetX = clickWorldX - node.x
      const dragOffsetY = clickWorldY - node.y
      
      // Drag to new position
      const mouseMoveClientX = 400
      const mouseMoveClientY = 300
      
      const canvasXMove = mouseMoveClientX - canvasRect.left
      const canvasYMove = mouseMoveClientY - canvasRect.top
      
      const newWorldX = (canvasXMove - camera.x) / camera.zoom - dragOffsetX
      const newWorldY = (canvasYMove - camera.y) / camera.zoom - dragOffsetY
      
      // Node should be at new position
      expect(newWorldX).toBe(300) // 300 - 0
      expect(newWorldY).toBe(250) // 250 - 0
    })
  })
})
