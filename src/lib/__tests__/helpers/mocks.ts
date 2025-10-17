// src/lib/__tests__/helpers/mocks.ts
// Test helpers for mocking streaming responses

export function streamModule(code: string, bytesPerChunk = 1024): Response {
  const encoder = new TextEncoder()
  const data = encoder.encode(code)
  let offset = 0

  const stream = new ReadableStream({
    pull(controller) {
      if (offset >= data.length) {
        controller.close()
        return
      }
      const end = Math.min(offset + bytesPerChunk, data.length)
      controller.enqueue(data.slice(offset, end))
      offset = end
    },
  })

  const contentLength = String(data.length)
  return new Response(stream as any, {
    status: 200,
    statusText: 'OK',
    headers: { 
      'Content-Type': 'application/javascript', 
      'Content-Length': contentLength 
    },
  })
}
