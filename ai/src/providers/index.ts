import { bedrock } from "@ai-sdk/amazon-bedrock"
import { anthropic, createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI, openai } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"
import { AIProviderConfig, AIProviderType } from "../types"

const DEFAULT_MODELS: Record<AIProviderType, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-5.2-2025-12-11",
  openrouter: "anthropic/claude-sonnet-4-6",
  bedrock: "anthropic.claude-sonnet-4-6",
}

const ENV_KEYS: Record<AIProviderType, string | undefined> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  bedrock: undefined,
}

/**
 * Auto-detect provider from environment variables.
 * Priority: OpenRouter > Anthropic > OpenAI > Bedrock
 */
function detectFromEnv(): AIProviderConfig | null {
  if (process.env.OPENROUTER_API_KEY) {
    return {
      provider: "openrouter",
      apiKey: process.env.OPENROUTER_API_KEY,
      modelId: process.env.OPENROUTER_MODEL_ID || DEFAULT_MODELS.openrouter,
    }
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      modelId: DEFAULT_MODELS.anthropic,
    }
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      modelId: DEFAULT_MODELS.openai,
    }
  }
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return {
      provider: "bedrock",
      region: process.env.AWS_REGION || "us-east-1",
      modelId: process.env.AWS_MODEL_ID || DEFAULT_MODELS.bedrock,
    }
  }
  return null
}

/**
 * Fill missing API key / region from environment for a known provider.
 */
function fillFromEnv(config: AIProviderConfig): AIProviderConfig {
  if (config.provider === "bedrock") {
    return {
      ...config,
      region: config.region || process.env.AWS_REGION || "us-east-1",
      modelId:
        config.modelId || process.env.AWS_MODEL_ID || DEFAULT_MODELS.bedrock,
    }
  }

  if (config.apiKey) return config

  const envKey = ENV_KEYS[config.provider]
  const envValue = envKey ? process.env[envKey] : undefined
  return envValue ? { ...config, apiKey: envValue } : config
}

/**
 * Resolve provider config from overrides + environment variables.
 * No provider → auto-detect from env, fall back to anthropic.
 * Provider specified → fill missing apiKey/region from env.
 */
export function resolveProviderConfig(
  overrides?: Partial<AIProviderConfig>,
): AIProviderConfig {
  if (!overrides?.provider) {
    const detected = detectFromEnv()
    const base = detected || {
      provider: "anthropic" as const,
      modelId: DEFAULT_MODELS.anthropic,
    }
    return { ...base, ...overrides }
  }

  const base: AIProviderConfig = {
    provider: overrides.provider,
    modelId: overrides.modelId || DEFAULT_MODELS[overrides.provider],
    apiKey: overrides.apiKey,
    region: overrides.region,
    baseURL: overrides.baseURL,
  }

  return fillFromEnv(base)
}

/**
 * Create an AI SDK LanguageModel from provider config.
 * Pass the result directly to `streamText()` or `generateText()` from the AI SDK.
 */
export function createModel(config?: Partial<AIProviderConfig>): LanguageModel {
  const resolved = resolveProviderConfig(config)
  const modelId = resolved.modelId || DEFAULT_MODELS[resolved.provider]

  switch (resolved.provider) {
    case "anthropic":
      return resolved.apiKey
        ? createAnthropic({ apiKey: resolved.apiKey })(modelId)
        : anthropic(modelId)

    case "openai":
      return resolved.apiKey
        ? createOpenAI({ apiKey: resolved.apiKey })(modelId)
        : openai(modelId)

    case "openrouter":
      return createOpenAI({
        apiKey: resolved.apiKey,
        baseURL: "https://openrouter.ai/api/v1",
      })(modelId)

    case "bedrock":
      if (!resolved.region) throw new Error("AWS region required for Bedrock")
      return bedrock(modelId)

    default:
      throw new Error(
        `Unsupported provider: ${resolved.provider satisfies never}`,
      )
  }
}
