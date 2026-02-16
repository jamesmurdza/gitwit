import { describe, it, expect, vi } from "vitest"
import { createAIClient } from "./index"

// Mock the providers module so we don't need real API keys
vi.mock("../providers", () => ({
  resolveProviderConfig: vi.fn((overrides) => ({
    provider: "anthropic",
    modelId: "claude-sonnet-4-20250514",
    ...overrides,
  })),
  createLLMProvider: vi.fn(() => ({
    async *streamText() {
      yield "Hello"
      yield " world"
    },
    async generateText() {
      return {
        content: "test response",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      }
    },
  })),
}))

describe("createAIClient", () => {
  it("returns an AIClient with streamChat, chat, and processEdit", () => {
    const client = createAIClient({
      userId: "test-user",
      projectId: "test-project",
    })

    expect(client).toBeDefined()
    expect(typeof client.streamChat).toBe("function")
    expect(typeof client.chat).toBe("function")
    expect(typeof client.processEdit).toBe("function")
  })

  it("is synchronous (no await needed)", () => {
    const result = createAIClient({ userId: "test-user" })
    // Result should be an object directly, not a Promise
    expect(result).not.toBeInstanceOf(Promise)
  })

  it("streamChat yields string chunks", async () => {
    const client = createAIClient({ userId: "test-user" })
    const chunks: string[] = []

    for await (const chunk of client.streamChat({
      messages: [{ role: "user", content: "Hello" }],
    })) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual(["Hello", " world"])
  })

  it("chat returns AIResponse", async () => {
    const client = createAIClient({ userId: "test-user" })
    const response = await client.chat({
      messages: [{ role: "user", content: "Hello" }],
    })

    expect(response.content).toBe("test response")
    expect(response.usage).toBeDefined()
  })

  it("processEdit returns { content: string }", async () => {
    const client = createAIClient({ userId: "test-user" })
    const result = await client.processEdit({
      messages: [{ role: "user", content: "Fix this" }],
    })

    expect(result).toHaveProperty("content")
    expect(typeof result.content).toBe("string")
  })
})
