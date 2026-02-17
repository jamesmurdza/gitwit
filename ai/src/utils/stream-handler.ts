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
