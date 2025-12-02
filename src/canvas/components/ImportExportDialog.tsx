import { useState, useRef } from 'react'
import { useCanvasStore } from '../store'
import { exportCanvas as exportCanvasData, sanitizeLabel } from '../persist'
import { useToast } from '../ToastContext'
import { BottomSheet } from './BottomSheet'
import { typography } from '../../styles/typography'

interface ImportExportDialogProps {
  isOpen: boolean
  onClose: () => void
  mode: 'import' | 'export'
}

interface ValidationIssue {
  type: 'error' | 'warning'
  message: string
  fixable: boolean
}

export function ImportExportDialog({ isOpen, onClose, mode }: ImportExportDialogProps) {
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<string>('')
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([])
  const [canAutoFix, setCanAutoFix] = useState(false)
  const [exportFormat, setExportFormat] = useState<'json' | 'png' | 'svg'>('json')
  const fileInputRef = useRef<HTMLInputElement>(null)
  // React 18 + Zustand v5: use individual selectors instead of object+shallow
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const { showToast } = useToast()

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImportFile(file)
    const text = await file.text()
    setImportPreview(text)

    // Validate
    const issues = validateImportData(text)
    setValidationIssues(issues)
    setCanAutoFix(issues.some(i => i.fixable))
  }

  const validateImportData = (jsonText: string): ValidationIssue[] => {
    const issues: ValidationIssue[] = []

    try {
      const data = JSON.parse(jsonText)

      // Check required fields
      if (!data.version) {
        issues.push({ type: 'warning', message: 'Missing version field', fixable: true })
      }
      if (!data.timestamp) {
        issues.push({ type: 'warning', message: 'Missing timestamp field', fixable: true })
      }
      if (!Array.isArray(data.nodes)) {
        issues.push({ type: 'error', message: 'Missing or invalid nodes array', fixable: false })
      }
      if (!Array.isArray(data.edges)) {
        issues.push({ type: 'error', message: 'Missing or invalid edges array', fixable: false })
      }

      // Validate nodes
      if (Array.isArray(data.nodes)) {
        data.nodes.forEach((node: any, i: number) => {
          if (!node.id) {
            issues.push({ type: 'error', message: `Node ${i}: missing id`, fixable: true })
          }
          if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
            issues.push({ type: 'error', message: `Node ${i}: invalid position`, fixable: true })
          }
          if (!node.data || typeof node.data !== 'object') {
            issues.push({ type: 'warning', message: `Node ${i}: missing data`, fixable: true })
          }
        })
      }

      // Validate edges
      if (Array.isArray(data.edges)) {
        data.edges.forEach((edge: any, i: number) => {
          if (!edge.id) {
            issues.push({ type: 'error', message: `Edge ${i}: missing id`, fixable: true })
          }
          if (!edge.source) {
            issues.push({ type: 'error', message: `Edge ${i}: missing source`, fixable: false })
          }
          if (!edge.target) {
            issues.push({ type: 'error', message: `Edge ${i}: missing target`, fixable: false })
          }
        })
      }
    } catch (e) {
      issues.push({ type: 'error', message: 'Invalid JSON format', fixable: false })
    }

    return issues
  }

  const handleImport = (autoFix: boolean) => {
    if (!importPreview) return

    let jsonToImport = importPreview

    if (autoFix) {
      try {
        const data = JSON.parse(importPreview)
        
        // Auto-fix: add version and timestamp if missing
        if (!data.version) data.version = 1
        if (!data.timestamp) data.timestamp = Date.now()

        // Auto-fix: generate missing IDs and sanitize labels
        if (Array.isArray(data.nodes)) {
          data.nodes = data.nodes.map((node: any, i: number) => {
            const nodeData = node.data || {}
            const rawLabel = nodeData.label || `Node ${i + 1}`
            return {
              ...node,
              id: node.id || `node-${i + 1}`,
              position: node.position || { x: i * 100, y: i * 100 },
              type: node.type || 'decision',
              data: {
                ...nodeData,
                label: sanitizeLabel(rawLabel)
              }
            }
          })
        }

        // Auto-fix: generate missing edge IDs and sanitize labels
        if (Array.isArray(data.edges)) {
          data.edges = data.edges.filter((e: any) => e.source && e.target)
          data.edges = data.edges.map((edge: any, i: number) => ({
            ...edge,
            id: edge.id || `edge-${i + 1}`,
            label: edge.label ? sanitizeLabel(edge.label) : undefined
          }))
        }

        jsonToImport = JSON.stringify(data)
      } catch (e) {
        showToast('Failed to apply auto-fix', 'error')
        return
      }
    }

    const importCanvas = useCanvasStore.getState().importCanvas
    const result = importCanvas(jsonToImport)
    if (result) {
      onClose()
      showToast('Canvas imported successfully!', 'success')
    } else {
      showToast('Import failed. Please check the file format.', 'error')
    }
  }

  const handleExportJSON = () => {
    const json = exportCanvasData({ nodes, edges })
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `canvas-export-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportPNG = async () => {
    try {
      // Import html2canvas dynamically
      const html2canvas = (await import('html2canvas')).default
      const canvasElement = document.querySelector('[data-testid="rf-root"]') as HTMLElement
      
      if (!canvasElement) {
        showToast('Canvas not found. Please try again.', 'error')
        return
      }

      const canvas = await html2canvas(canvasElement, {
        backgroundColor: '#ffffff',
        scale: 2 // 2x resolution for clarity
      })

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `canvas-export-${Date.now()}.png`
          a.click()
          URL.revokeObjectURL(url)
        } else {
          showToast('Failed to generate PNG. Please try again.', 'error')
        }
      })
    } catch (error) {
      console.error('PNG export failed:', error)
      showToast('PNG export failed. Try JSON export instead.', 'error')
    }
  }

  const handleExportSVG = async () => {
    // For SVG export, we'll use a simplified approach
    // Generate SVG from nodes and edges data
    const svgContent = generateSVG(nodes, edges)
    const blob = new Blob([svgContent], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `canvas-export-${Date.now()}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  const generateSVG = (nodes: any[], edges: any[]): string => {
    // Estimate node dimensions based on label length
    const estimateNodeWidth = (label: string) => {
      const baseWidth = 150
      const charWidth = 8 // approximate pixels per character
      const estimatedWidth = Math.max(baseWidth, (label?.length || 0) * charWidth + 40)
      return Math.min(estimatedWidth, 400) // cap at 400px
    }

    // Calculate bounds with dynamic node sizes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const nodeHeights = 80 // fixed height
    
    nodes.forEach(node => {
      const nodeWidth = estimateNodeWidth(node.data?.label || 'Node')
      minX = Math.min(minX, node.position.x)
      minY = Math.min(minY, node.position.y)
      maxX = Math.max(maxX, node.position.x + nodeWidth)
      maxY = Math.max(maxY, node.position.y + nodeHeights)
    })

    const padding = 50
    const width = maxX - minX + padding * 2
    const height = maxY - minY + padding * 2

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    svg += `<rect width="100%" height="100%" fill="white"/>`

    // Draw edges
    edges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source)
      const targetNode = nodes.find(n => n.id === edge.target)
      if (sourceNode && targetNode) {
        const sourceWidth = estimateNodeWidth(sourceNode.data?.label || 'Node')
        const targetWidth = estimateNodeWidth(targetNode.data?.label || 'Node')
        const x1 = sourceNode.position.x - minX + padding + sourceWidth / 2
        const y1 = sourceNode.position.y - minY + padding + nodeHeights / 2
        const x2 = targetNode.position.x - minX + padding + targetWidth / 2
        const y2 = targetNode.position.y - minY + padding + nodeHeights / 2
        svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#94a3b8" stroke-width="2"/>`
      }
    })

    // Draw nodes
    nodes.forEach(node => {
      const x = node.position.x - minX + padding
      const y = node.position.y - minY + padding
      const label = (node.data?.label || 'Node').replace(/[<>&'"]/g, '') // Escape XML special chars
      const nodeWidth = estimateNodeWidth(label)
      svg += `<rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeights}" rx="16" fill="white" stroke="#EA7B4B" stroke-width="2"/>`
      svg += `<text x="${x + nodeWidth / 2}" y="${y + nodeHeights / 2 + 5}" text-anchor="middle" font-family="Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif" font-size="14" fill="#1f2937">${label}</text>`
    })

    svg += `</svg>`
    return svg
  }

  const handleExport = () => {
    if (exportFormat === 'json') {
      handleExportJSON()
    } else if (exportFormat === 'png') {
      handleExportPNG()
    } else if (exportFormat === 'svg') {
      handleExportSVG()
    }
    onClose()
  }

  const title = mode === 'import' ? 'Import Canvas' : 'Export Canvas'

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
          {mode === 'import' ? (
            <div className="space-y-4">
              {/* File Picker */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-3 bg-[#EA7B4B] text-white rounded-lg hover:bg-[#EA7B4B]/90 transition-colors font-medium"
                >
                  📁 Choose JSON File
                </button>
                {importFile && (
                  <p className={`${typography.body} text-gray-600 mt-2`}>Selected: {importFile.name}</p>
                )}
              </div>

              {/* Validation Results */}
              {validationIssues.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Validation Issues</h3>
                  <div className="space-y-1">
                    {validationIssues.map((issue, i) => (
                      <div key={i} className={`${typography.body} flex items-start gap-2 ${issue.type === 'error' ? 'text-red-600' : 'text-yellow-600'}`}>
                        <span>{issue.type === 'error' ? '❌' : '⚠️'}</span>
                        <span>{issue.message}</span>
                        {issue.fixable && <span className="text-green-600">(fixable)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {importFile && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleImport(false)}
                    disabled={validationIssues.some(i => i.type === 'error' && !i.fixable)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Import As-Is
                  </button>
                  {canAutoFix && (
                    <button
                      onClick={() => handleImport(true)}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Auto-Fix and Import
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Export Format */}
              <div>
                <label className={`block ${typography.label} text-gray-700 mb-2`}>Export Format</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:border-[#EA7B4B] cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="json"
                      checked={exportFormat === 'json'}
                      onChange={(e) => setExportFormat(e.target.value as any)}
                      className="text-[#EA7B4B] focus:ring-[#EA7B4B]"
                    />
                    <div>
                      <div className="font-medium">JSON</div>
                      <div className={`${typography.body} text-gray-500`}>Full canvas data (recommended)</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:border-[#EA7B4B] cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="png"
                      checked={exportFormat === 'png'}
                      onChange={(e) => setExportFormat(e.target.value as any)}
                      className="text-[#EA7B4B] focus:ring-[#EA7B4B]"
                    />
                    <div>
                      <div className="font-medium">PNG</div>
                      <div className={`${typography.body} text-gray-500`}>Raster image (for presentations)</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:border-[#EA7B4B] cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="svg"
                      checked={exportFormat === 'svg'}
                      onChange={(e) => setExportFormat(e.target.value as any)}
                      className="text-[#EA7B4B] focus:ring-[#EA7B4B]"
                    />
                    <div>
                      <div className="font-medium">SVG</div>
                      <div className={`${typography.body} text-gray-500`}>Vector graphic (scalable)</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Export Info */}
              <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${typography.body} text-blue-800`}>
                <p><strong>Current canvas:</strong> {nodes.length} nodes, {edges.length} edges</p>
                {exportFormat === 'json' && <p className="mt-1">File will be editable and re-importable</p>}
                {exportFormat === 'png' && <p className="mt-1">File will be 2x resolution for clarity</p>}
                {exportFormat === 'svg' && <p className="mt-1">File will be vector-based and scalable</p>}
              </div>

              {/* Export Button */}
              <button
                onClick={handleExport}
                className="w-full px-4 py-3 bg-[#EA7B4B] text-white rounded-lg hover:bg-[#EA7B4B]/90 transition-colors font-medium"
              >
                💾 Export as {exportFormat.toUpperCase()}
              </button>
            </div>
          )}
        </div>
    </BottomSheet>
  )
}
