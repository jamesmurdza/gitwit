import { describe, it, expect, vi, beforeEach } from "vitest"
import { resolveProviderConfig, createModel } from "./index"

// Mock the SDK providers so we don't need real API keys
vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn((modelId: string) => ({ provider: "anthropic", modelId })),
  createAnthropic: vi.fn(() => (modelId: string) => ({ provider: "anthropic", modelId, custom: true })),
}))
vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn((modelId: string) => ({ provider: "openai", modelId })),
  createOpenAI: vi.fn(() => (modelId: string) => ({ provider: "openai-compat", modelId })),
}))
vi.mock("@ai-sdk/amazon-bedrock", () => ({
  bedrock: vi.fn((modelId: string) => ({ provider: "bedrock", modelId })),
}))

describe("resolveProviderConfig", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it("defaults to anthropic when no overrides and no env vars", () => {
    const config = resolveProviderConfig()
    expect(config.provider).toBe("anthropic")
    expect(config.modelId).toBe("claude-sonnet-4-20250514")
  })

  it("detects anthropic from env", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test")
    const config = resolveProviderConfig()
    expect(config.provider).toBe("anthropic")
    expect(config.apiKey).toBe("sk-test")
  })

  it("respects explicit provider override", () => {
    const config = resolveProviderConfig({ provider: "openai", apiKey: "sk-openai" })
    expect(config.provider).toBe("openai")
    expect(config.apiKey).toBe("sk-openai")
  })

  it("fills API key from env when provider is specified without key", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-from-env")
    const config = resolveProviderConfig({ provider: "openai" })
    expect(config.apiKey).toBe("sk-from-env")
  })
})

describe("createModel", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns a LanguageModel for anthropic", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test")
    const model = createModel({ provider: "anthropic", apiKey: "sk-test" })
    expect(model).toBeDefined()
  })

  it("uses default model when none specified", () => {
    const model = createModel({ provider: "anthropic", apiKey: "sk-test" })
    expect(model).toBeDefined()
  })
})
