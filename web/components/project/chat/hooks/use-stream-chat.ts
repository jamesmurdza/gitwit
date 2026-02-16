import { useCallback, useRef } from "react"

interface StreamChatRequest {
  messages: Array<{ role: string; content: string; context?: unknown }>
  context?: {
    templateType?: string
    activeFileContent?: string
    fileTree?: unknown[]
    contextContent?: string
    projectId?: string
    projectName?: string
    fileName?: string
  }
}

interface UseStreamChatReturn {
  streamChat: (
    request: StreamChatRequest,
    onChunk: (chunk: string) => void,
    onDone: () => void,
    onError: (error: Error) => void,
  ) => Promise<void>
  abort: () => void
  isStreamingRef: React.MutableRefObject<boolean>
}

/**
 * Hook for streaming chat via Hono /ai/stream-chat endpoint.
 *
 * Fixes race conditions:
 * - Concurrent send guard (isStreamingRef)
 * - AbortController per stream (abort on thread switch or user cancel)
 */
export function useStreamChat(): UseStreamChatReturn {
  const abortRef = useRef<AbortController | null>(null)
  const isStreamingRef = useRef(false)

  const streamChat = useCallback(
    async (
      request: StreamChatRequest,
      onChunk: (chunk: string) => void,
      onDone: () => void,
      onError: (error: Error) => void,
    ) => {
      // Guard against concurrent sends (race condition #2)
      if (isStreamingRef.current) return
      isStreamingRef.current = true

      // Abort previous stream if any (race condition #3)
      abortRef.current?.abort()
      abortRef.current = new AbortController()

      try {
        const response = await fetch("/api/ai/stream-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal: abortRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`Stream failed: ${response.status}`)
        }

        const reader = response.body!.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          onChunk(decoder.decode(value, { stream: true }))
        }
        onDone()
      } catch (error: any) {
        if (error.name === "AbortError") {
          // Expected — user cancelled or thread switched
        } else {
          onError(error)
        }
      } finally {
        isStreamingRef.current = false
      }
    },
    [],
  )

  const abort = useCallback(() => {
    abortRef.current?.abort()
    isStreamingRef.current = false
  }, [])

  return { streamChat, abort, isStreamingRef }
}
