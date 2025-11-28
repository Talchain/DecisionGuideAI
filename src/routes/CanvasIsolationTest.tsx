// REACT #185 DEBUG: Minimal test component for structural isolation
// Layer-by-layer add-back to identify infinite loop source

import { shallow } from 'zustand/shallow'
import { useCanvasStore } from '../canvas/store'
import ReactFlowGraph from '../canvas/ReactFlowGraph'

// Event bus stub (same as CanvasMVP)
const blueprintEventBus = {
  listeners: [] as ((blueprint: any) => { error?: string })[],
  emit(blueprint: any): { error?: string } {
    const results = this.listeners.map(fn => fn(blueprint))
    return results[0] || {}
  },
  subscribe(fn: (blueprint: any) => { error?: string }) {
    this.listeners.push(fn)
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn)
    }
  }
}

// Layer 2: Store selectors + ReactFlowGraph (the main suspect)
function Layer2WithReactFlow() {
  // Same selectors as CanvasMVP
  const showTemplatesPanel = useCanvasStore(state => state.showTemplatesPanel)
  const closeTemplatesPanel = useCanvasStore(state => state.closeTemplatesPanel)
  const runMeta = useCanvasStore(state => state.runMeta, shallow)

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Badge */}
      <div
        style={{
          position: 'fixed',
          top: 8,
          left: 8,
          zIndex: 50,
          padding: '6px 8px',
          background: '#f00',
          color: '#fff',
          fontFamily: 'monospace',
          fontSize: 12,
          borderRadius: 6,
        }}
      >
        LAYER 2: ReactFlowGraph Test
      </div>

      {/* React Flow Container */}
      <div data-testid="rf-root" style={{ height: '100%', width: '100%' }}>
        <ReactFlowGraph
          blueprintEventBus={blueprintEventBus}
          onCanvasInteraction={() => {}}
        />
      </div>
    </div>
  )
}

export default Layer2WithReactFlow
