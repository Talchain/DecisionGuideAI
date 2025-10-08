// src/poc/export/exportCanvas.ts
// PoC: PNG export of the current graph canvas view (or fit-to-content)

export interface ExportOptions {
  fit?: boolean
  scale?: number // additional scale multiplier on top of devicePixelRatio
}

// Zero-pad integer to length n
function z(n: number, len: number) {
  return n.toString().padStart(len, '0')
}

export function formatSandboxPngName(now: Date = new Date()): string {
  const yyyy = now.getFullYear()
  const mm = z(now.getMonth() + 1, 2)
  const dd = z(now.getDate(), 2)
  const hh = z(now.getHours(), 2)
  const mi = z(now.getMinutes(), 2)
  const ss = z(now.getSeconds(), 2)
  return `sandbox_export_${yyyy}${mm}${dd}_${hh}${mi}${ss}.png`
}

export function computePixelSize(contentW: number, contentH: number, padding = 12, dpr = 1, scale = 1) {
  const cssWidth = Math.max(1, Math.ceil(contentW + padding * 2))
  const cssHeight = Math.max(1, Math.ceil(contentH + padding * 2))
  const pixelWidth = Math.max(1, Math.ceil(cssWidth * Math.max(1, dpr) * Math.max(0.1, scale)))
  const pixelHeight = Math.max(1, Math.ceil(cssHeight * Math.max(1, dpr) * Math.max(0.1, scale)))
  return { cssWidth, cssHeight, pixelWidth, pixelHeight }
}

function getContentBounds(svg: SVGSVGElement) {
  const nodes = Array.from(svg.querySelectorAll<SVGGraphicsElement>('rect,line,polyline,polygon,path,circle,ellipse,text'))
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const el of nodes) {
    try {
      const b = el.getBBox()
      if (!isFinite(b.x) || !isFinite(b.y) || !isFinite(b.width) || !isFinite(b.height)) continue
      minX = Math.min(minX, b.x)
      minY = Math.min(minY, b.y)
      maxX = Math.max(maxX, b.x + b.width)
      maxY = Math.max(maxY, b.y + b.height)
    } catch {}
  }
  if (minX === Number.POSITIVE_INFINITY) {
    // Fallback to viewBox or client size
    const vb = svg.viewBox && svg.viewBox.baseVal
    if (vb && vb.width > 0 && vb.height > 0) {
      return { x: vb.x, y: vb.y, width: vb.width, height: vb.height }
    }
    const w = svg.clientWidth || Number(svg.getAttribute('width')) || 600
    const h = svg.clientHeight || Number(svg.getAttribute('height')) || 400
    return { x: 0, y: 0, width: w, height: h }
  }
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }
}

export async function exportCanvas(opts: ExportOptions = {}): Promise<Blob> {
  const { fit = true, scale = 1 } = opts
  if (typeof window === 'undefined' || typeof document === 'undefined') throw new Error('exportCanvas requires a browser environment')
  const svg = document.querySelector('[data-testid="whiteboard-canvas"]') as SVGSVGElement | null
  if (!svg) throw new Error('SVG canvas not found')

  const dpr = Math.max(1, window.devicePixelRatio || 1)

  let x = 0, y = 0, contentW = Number(svg.getAttribute('width')) || svg.clientWidth || 600, contentH = Number(svg.getAttribute('height')) || svg.clientHeight || 400
  const pad = 12
  if (fit) {
    const b = getContentBounds(svg)
    x = b.x
    y = b.y
    contentW = b.width
    contentH = b.height
  }

  const { cssWidth, cssHeight, pixelWidth, pixelHeight } = computePixelSize(contentW, contentH, pad, dpr, scale)

  // Clone the SVG and set viewBox to the fitted rect
  const clone = svg.cloneNode(true) as SVGSVGElement
  const vbX = Math.floor(x - pad)
  const vbY = Math.floor(y - pad)
  const vbW = Math.ceil(contentW + pad * 2)
  const vbH = Math.ceil(contentH + pad * 2)
  clone.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`)
  clone.setAttribute('width', String(cssWidth))
  clone.setAttribute('height', String(cssHeight))

  // Serialize SVG
  const xml = new XMLSerializer().serializeToString(clone)
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Failed to load serialized SVG'))
      image.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = pixelWidth
    canvas.height = pixelHeight
    const ctx = canvas.getContext('2d')!
    // Fill white background for predictable PNG size and appearance
    ctx.save()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    // Draw image scaled by DPR*scale
    ctx.drawImage(img, 0, 0, cssWidth, cssHeight, 0, 0, pixelWidth, pixelHeight)

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG blob generation failed'))), 'image/png')
    })
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}
