// src/lib/importWithProgress.ts
// Dynamic import with streaming progress

export interface ImportProgress {
  loaded: number
  total: number
  percentage: number
}

export type ProgressCallback = (progress: ImportProgress) => void

/**
 * Import a module with progress tracking using fetch + ReadableStream
 * Falls back to simple import if streaming not supported
 */
export async function importWithProgress<T>(
  path: string,
  onProgress?: ProgressCallback
): Promise<T> {
  // Check for fetch + ReadableStream support
  if (typeof fetch === 'undefined' || !('ReadableStream' in window)) {
    // Fallback: simple dynamic import without progress
    if (onProgress) {
      onProgress({ loaded: 0, total: 100, percentage: 0 })
    }
    const module = await import(/* @vite-ignore */ path)
    if (onProgress) {
      onProgress({ loaded: 100, total: 100, percentage: 100 })
    }
    return module
  }
  
  try {
    // Fetch the module to get progress
    const response = await fetch(path)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}: ${response.statusText}`)
    }
    
    const contentLength = response.headers.get('content-length')
    const total = contentLength ? parseInt(contentLength, 10) : 0
    
    let loaded = 0
    
    const reader = response.body?.getReader()
    if (!reader) {
      // Fallback if no reader available
      const module = await import(/* @vite-ignore */ path)
      if (onProgress) {
        onProgress({ loaded: 100, total: 100, percentage: 100 })
      }
      return module
    }
    
    // Read chunks and track progress
    const chunks: Uint8Array[] = []
    
    while (true) {
      const { done, value } = await reader.read()
      
      if (done) break
      
      chunks.push(value)
      loaded += value.length
      
      if (onProgress && total > 0) {
        onProgress({
          loaded,
          total,
          percentage: Math.round((loaded / total) * 100)
        })
      }
    }
    
    // Create blob URL for the fetched content (enables proper cleanup)
    const blob = new Blob(chunks)
    const blobUrl = URL.createObjectURL(blob)
    
    // Import with cleanup in finally block
    let module: any
    try {
      module = await import(/* @vite-ignore */ blobUrl)
    } finally {
      URL.revokeObjectURL(blobUrl)
    }
    
    if (onProgress) {
      onProgress({ loaded: total || loaded, total: total || loaded, percentage: 100 })
    }
    
    return module
  } catch (error) {
    console.error('[importWithProgress] Failed:', error)
    throw error
  }
}

/**
 * Cancel token for aborting imports
 */
export class ImportCancelToken {
  private _aborted = false
  private _abortController?: AbortController
  
  constructor() {
    if (typeof AbortController !== 'undefined') {
      this._abortController = new AbortController()
    }
  }
  
  get aborted(): boolean {
    return this._aborted
  }
  
  get signal(): AbortSignal | undefined {
    return this._abortController?.signal
  }
  
  abort(): void {
    this._aborted = true
    this._abortController?.abort()
  }
}

/**
 * Import with cancellation support
 */
export async function importWithProgressCancellable<T>(
  path: string,
  onProgress?: ProgressCallback,
  cancelToken?: ImportCancelToken
): Promise<T> {
  if (cancelToken?.aborted) {
    throw new Error('Import aborted before start')
  }
  
  // Set up abort handling
  const checkAbort = () => {
    if (cancelToken?.aborted) {
      throw new Error('Import aborted')
    }
  }
  
  // Wrap progress callback to check for abort
  const wrappedProgress: ProgressCallback | undefined = onProgress ? (progress) => {
    checkAbort()
    onProgress(progress)
  } : undefined
  
  return importWithProgress<T>(path, wrappedProgress)
}
