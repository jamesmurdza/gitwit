import { bedrock } from "@ai-sdk/amazon-bedrock"
import { anthropic, createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI, openai } from "@ai-sdk/openai"
import {
  CoreMessage,
  generateText as generateTextSDK,
  LanguageModel,
  streamText as streamTextSDK,
  Tool,
  tool,
} from "ai"
import { z } from "zod"
import {
  AIProviderConfig,
  AIRequest,
  AIResponse,
  AITool,
  LLMProvider,
} from "../types"
import { logger } from "../utils"

/**
 * Create an LLM provider from a fully resolved configuration.
 * Tools are immutable after creation.
 */
export function createLLMProvider(
  config: AIProviderConfig,
  tools?: Record<string, AITool>
): LLMProvider {
  const model = initializeModel(config)
  const sdkTools = tools ? convertTools(tools) : undefined
  const hasTools = sdkTools && Object.keys(sdkTools).length > 0

  return {
    async *streamText(request: AIRequest) {
      const { messages, temperature, maxTokens, maxSteps = 1 } = request

      const result = streamTextSDK({
        model,
        messages: messages as CoreMessage[],
        temperature,
        maxTokens,
        maxSteps,
        ...(hasTools ? { tools: sdkTools } : {}),
      })

      yield* result.textStream
    },

    async generateText(request: AIRequest): Promise<AIResponse> {
      const { messages, temperature, maxTokens, maxSteps = 1 } = request

      const result = await generateTextSDK({
        model,
        messages: messages as CoreMessage[],
        temperature,
        maxTokens,
        maxSteps,
        ...(hasTools ? { tools: sdkTools } : {}),
      })

      // Map SDK tool shapes to AIResponse shapes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawToolCalls = result.toolCalls as any[]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawToolResults = result.toolResults as any[]

      return {
        content: result.text,
        usage: result.usage,
        toolCalls: rawToolCalls?.map((tc) => ({
          name: tc.toolName,
          args: tc.args as Record<string, unknown>,
        })),
        toolResults: rawToolResults?.map((tr) => ({
          name: tr.toolName,
          result: tr.result,
        })),
      }
    },
  }
}

/**
 * Resolve provider configuration from overrides + environment variables.
 * Call this before createLLMProvider to get a fully resolved config.
 */
export function resolveProviderConfig(
  overrides?: Partial<AIProviderConfig>
): AIProviderConfig {
  const config: AIProviderConfig = {
    provider: "anthropic",
    modelId: "claude-sonnet-4-20250514",
    ...overrides,
  }

  if (!overrides?.provider) {
    // Auto-detect provider from env vars
    if (process.env.OPENROUTER_API_KEY) {
      config.provider = "openrouter"
      config.apiKey = process.env.OPENROUTER_API_KEY
      config.modelId = process.env.OPENROUTER_MODEL_ID
    } else if (process.env.ANTHROPIC_API_KEY) {
      config.provider = "anthropic"
      config.apiKey = process.env.ANTHROPIC_API_KEY
    } else if (process.env.OPENAI_API_KEY) {
      config.provider = "openai"
      config.apiKey = process.env.OPENAI_API_KEY
    } else if (
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
    ) {
      config.provider = "bedrock"
      config.region = process.env.AWS_REGION || "us-east-1"
      config.modelId =
        process.env.AWS_MODEL_ID ||
        "anthropic.claude-3-sonnet-20240229-v1:0"
    }
  } else if (!overrides.apiKey) {
    // Provider explicitly specified but no API key — check env vars
    if (overrides.provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
      config.apiKey = process.env.ANTHROPIC_API_KEY
    } else if (
      overrides.provider === "openai" &&
      process.env.OPENAI_API_KEY
    ) {
      config.apiKey = process.env.OPENAI_API_KEY
    } else if (
      overrides.provider === "openrouter" &&
      process.env.OPENROUTER_API_KEY
    ) {
      config.apiKey = process.env.OPENROUTER_API_KEY
      if (!config.modelId) {
        config.modelId = process.env.OPENROUTER_MODEL_ID
      }
    } else if (overrides.provider === "bedrock") {
      config.region =
        overrides.region || process.env.AWS_REGION || "us-east-1"
      if (!config.modelId) {
        config.modelId =
          process.env.AWS_MODEL_ID ||
          "anthropic.claude-3-sonnet-20240229-v1:0"
      }
    }
  }

  return config
}

// --- Pure helper functions ---

function initializeModel(config: AIProviderConfig): LanguageModel {
  switch (config.provider) {
    case "anthropic":
      if (config.apiKey) {
        return createAnthropic({ apiKey: config.apiKey })(config.modelId!)
      }
      return anthropic(config.modelId!)

    case "openai":
      if (config.apiKey) {
        return createOpenAI({ apiKey: config.apiKey })(config.modelId!)
      }
      return openai(config.modelId!)

    case "openrouter": {
      const openrouter = createOpenAI({
        apiKey: config.apiKey,
        baseURL: "https://openrouter.ai/api/v1",
      })
      return openrouter(config.modelId!)
    }

    case "bedrock": {
      if (!config.region) throw new Error("AWS region required for Bedrock")
      if (!config.modelId) throw new Error("Bedrock model ID required")
      return bedrock(config.modelId)
    }

    default:
      throw new Error(`Unsupported provider: ${config.provider}`)
  }
}

function convertTools(aiTools: Record<string, AITool>): Record<string, Tool> {
  const converted: Record<string, Tool> = {}
  for (const [name, aiTool] of Object.entries(aiTools)) {
    converted[name] = tool({
      description: aiTool.description || "",
      parameters: aiTool.parameters || z.object({}),
      execute: aiTool.execute,
    })
  }
  return converted
}

// --- Backward-compat exports (used by current client until Phase 2.3) ---

export class AIProvider {
  private model: LanguageModel
  private tools: Record<string, Tool> = {}

  constructor(config: AIProviderConfig) {
    this.model = initializeModel(config)
    logger.info("AI Provider initialized")
  }

  setTools(aiTools: Record<string, AITool>): void {
    this.tools = convertTools(aiTools)
  }

  async generateStream(request: AIRequest) {
    const { messages, temperature, maxTokens, maxSteps = 1 } = request

    const result = streamTextSDK({
      model: this.model,
      messages: messages as CoreMessage[],
      temperature,
      maxTokens,
      maxSteps,
      tools: this.tools,
    })

    const encoder = new TextEncoder()
    const textStream = result.textStream

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let chunkCount = 0
          for await (const chunk of textStream) {
            chunkCount++
            controller.enqueue(encoder.encode(chunk))
          }
          if (chunkCount === 0) {
            controller.error(new Error("No content generated from AI model"))
          } else {
            controller.close()
          }
        } catch (error) {
          controller.error(error)
        }
      },
    })

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream" },
    })
  }

  async generate(request: AIRequest) {
    const { messages, temperature, maxTokens, maxSteps = 1 } = request

    const result = await generateTextSDK({
      model: this.model,
      messages: messages as CoreMessage[],
      temperature,
      maxTokens,
      maxSteps,
      tools: this.tools,
    })

    return new Response(
      JSON.stringify({
        content: result.text,
        usage: result.usage,
        steps: result.steps,
        toolCalls: result.toolCalls,
        toolResults: result.toolResults,
      }),
      { headers: { "Content-Type": "application/json" } }
    )
  }
}

export function createAIProvider(
  overrides?: Partial<AIProviderConfig>
): AIProvider {
  const config = resolveProviderConfig(overrides)
  return new AIProvider(config)
}
