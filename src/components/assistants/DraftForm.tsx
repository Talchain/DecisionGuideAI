/**
 * M2.2: Draft Form
 * Entry point for "Draft my model" feature
 */

import { useState } from 'react'
import { FileText, Upload, X } from 'lucide-react'
import type { DraftRequest } from '../../adapters/assistants/types'

interface DraftFormProps {
  onSubmit: (request: DraftRequest) => void
  isSubmitting: boolean
}

interface AttachedFile {
  name: string
  content: string
  type: string
  size: number
}

export function DraftForm({ onSubmit, isSubmitting }: DraftFormProps) {
  const [prompt, setPrompt] = useState('')
  const [context, setContext] = useState('')
  const [files, setFiles] = useState<AttachedFile[]>([])
  const [error, setError] = useState<string | null>(null) // AUDIT FIX 5: Form-level error state

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(e.target.files || [])

    // M2.2: Limit to 5 files max (AUDIT FIX 5: Use inline error instead of alert)
    if (files.length + uploadedFiles.length > 5) {
      setError('Maximum 5 files allowed. Please remove some files before uploading more.')
      return
    }
    setError(null) // Clear error on successful action

    const readFiles = await Promise.all(
      uploadedFiles.map(
        (file) =>
          new Promise<AttachedFile>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              resolve({
                name: file.name,
                content: reader.result as string,
                type: file.type,
                size: file.size,
              })
            }
            reader.onerror = reject
            reader.readAsText(file)
          })
      )
    )

    setFiles([...files, ...readFiles])
  }

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // AUDIT FIX 5: Use inline error instead of alert
    if (!prompt.trim()) {
      setError('Please enter a description of your decision problem.')
      return
    }
    setError(null) // Clear error on valid submission

    const request: DraftRequest = {
      prompt: prompt.trim(),
      context: context.trim() || undefined,
      files: files.length > 0 ? files : undefined,
    }

    onSubmit(request)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded-lg border border-gray-200">
      <div>
        <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-1">
          Describe your decision problem
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value)
            if (error && e.target.value.trim()) {
              setError(null) // AUDIT FIX 5: Clear error when user starts typing
            }
          }}
          placeholder="e.g., Should we launch product X or Y? What factors matter?"
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isSubmitting}
          required
        />
      </div>

      <div>
        <label htmlFor="context" className="block text-sm font-medium text-gray-700 mb-1">
          Additional context (optional)
        </label>
        <textarea
          id="context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Any background information, constraints, or requirements..."
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isSubmitting}
        />
      </div>

      {/* File attachments */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Attach documents (optional, max 5)
        </label>
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200"
            >
              <FileText className="w-4 h-4 text-gray-400" />
              <span className="text-sm flex-1 truncate">{file.name}</span>
              <span className="text-xs text-gray-500">
                {(file.size / 1024).toFixed(1)} KB
              </span>
              <button
                type="button"
                onClick={() => handleRemoveFile(index)}
                className="p-1 hover:bg-gray-200 rounded"
                disabled={isSubmitting}
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          ))}

          {files.length < 5 && (
            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
              <Upload className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">Upload file (.txt, .md, .csv)</span>
              <input
                type="file"
                multiple
                accept=".txt,.md,.csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isSubmitting}
              />
            </label>
          )}
        </div>
      </div>

      {/* AUDIT FIX 5: Inline error message for accessibility */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !prompt.trim()}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
      >
        {isSubmitting ? 'Generating draft...' : 'Draft my model'}
      </button>
    </form>
  )
}
