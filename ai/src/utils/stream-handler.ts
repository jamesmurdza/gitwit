/**
 * Parse a ReadableStream into an async generator of string chunks.
 */
export async function* parseStream(
  stream: ReadableStream
): AsyncGenerator<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      yield decoder.decode(value, { stream: true })
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * @deprecated Use parseStream() instead. Kept for backward compat.
 */
export class StreamHandler {
  static async *parseStream(stream: ReadableStream): AsyncGenerator<string> {
    yield* parseStream(stream)
  }

  static createStreamResponse(stream: ReadableStream): Response {
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  }
}
