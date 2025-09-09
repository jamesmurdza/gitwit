import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { generateText, LanguageModel, streamText, Tool, tool } from "ai"
import { z } from "zod"
import { AIProviderConfig, AIRequest, AITool } from "../types"
import { logger, StreamHandler } from "../utils"

/**
 * AI provider class that handles communication with different AI services
 * Supports Anthropic Claude and OpenAI models
 *
 * @example
 * ```typescript
 * const provider = new AIProvider({
 *   provider: "anthropic",
 *   modelId: "claude-3-5-sonnet-20241022"
 * })
 * const response = await provider.generate(request)
 * ```
 */
export class AIProvider {
  private model: LanguageModel
  private logger: typeof logger
  private tools: Record<string, Tool> = {}

  /**
   * Creates a new AI provider instance with the specified configuration
   *
   * @param config - Configuration object specifying the provider type and model settings
   */
  constructor(config: AIProviderConfig) {
    this.logger = logger.child({
      provider: config.provider,
      model: config.modelId,
    })

    this.model = this.initializeModel(config)

    // Convert AITool definitions to Vercel AI SDK tool format
    if (config.tools) {
      this.tools = this.convertTools(config.tools)
    }

    this.logger.info("AI Provider initialized", {
      toolCount: Object.keys(this.tools).length,
    })
  }

  /**
   * Converts AITool definitions to Vercel AI SDK tool format
   */
  private convertTools(aiTools: Record<string, AITool>): Record<string, Tool> {
    const convertedTools: Record<string, Tool> = {}

    for (const [name, aiTool] of Object.entries(aiTools)) {
      convertedTools[name] = tool({
        description: aiTool.description || "",
        parameters: aiTool.parameters || z.object({}),
        execute: aiTool.execute,
      })
    }

    return convertedTools
  }

  /**
   * Initializes the appropriate AI model based on the provider configuration
   *
   * @param config - Provider configuration object
   * @returns Initialized language model instance
   * @throws {Error} When an unsupported provider is specified or API key is missing
   */
  private initializeModel(config: AIProviderConfig): LanguageModel {
    this.logger.debug("Initializing model", {
      provider: config.provider,
      modelId: config.modelId,
      hasApiKey: !!config.apiKey,
    })

    // Default models for each provider
    const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022"
    const DEFAULT_OPENAI_MODEL = "gpt-4o-mini"

    switch (config.provider) {
      case "anthropic": {
        const modelId = config.modelId || DEFAULT_ANTHROPIC_MODEL
        const anthropicProvider = createAnthropic({
          apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
          ...(config.baseURL && { baseURL: config.baseURL }),
        })
        return anthropicProvider(modelId)
      }

      case "openai": {
        const modelId = config.modelId || DEFAULT_OPENAI_MODEL
        const openaiProvider = createOpenAI({
          apiKey: config.apiKey || process.env.OPENAI_API_KEY,
          ...(config.baseURL && { baseURL: config.baseURL }),
        })
        return openaiProvider(modelId)
      }

      default:
        throw new Error(`Unsupported provider: ${config.provider}`)
    }
  }

  /**
   * Generates a streaming AI response
   * Returns a ReadableStream that can be consumed chunk by chunk
   *
   * @param request - AI request object containing messages and generation parameters
   * @returns Promise that resolves to an HTTP Response with a streaming body
   * @throws {Error} When stream generation fails or produces no content
   */
  async generateStream(request: AIRequest) {
    const { messages, temperature, maxTokens, maxSteps = 1 } = request

    this.logger.debug("Generating stream", {
      messageCount: messages.length,
      temperature,
      maxTokens,
      maxSteps,
      toolCount: Object.keys(this.tools).length,
    })

    try {
      const result = await streamText({
        model: this.model,
        messages,
        temperature,
        maxTokens,
        maxSteps,
        tools: this.tools,
      })

      const encoder = new TextEncoder()
      let chunkCount = 0

      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of result.textStream) {
              chunkCount++
              controller.enqueue(encoder.encode(chunk))
            }

            if (chunkCount === 0) {
              logger.error("Stream is empty - no content generated")
              controller.error(new Error("No content generated from AI model"))
            } else {
              controller.close()
            }
          } catch (error) {
            logger.error("Stream processing error", error)
            controller.error(error)
          }
        },
      })

      return StreamHandler.createStreamResponse(stream)
    } catch (error) {
      this.logger.error("Stream generation failed", error)
      throw error
    }
  }

  /**
   * Generates a complete AI response
   * Returns the full response as a JSON object with content and usage information
   *
   * @param request - AI request object containing messages and generation parameters
   * @returns Promise that resolves to an HTTP Response with JSON body containing the complete response
   */
  async generate(request: AIRequest) {
    const { messages, temperature, maxTokens, maxSteps = 1 } = request

    const result = await generateText({
      model: this.model,
      messages,
      temperature,
      maxTokens,
      maxSteps,
      tools: this.tools,
    })

    // Return response with tool results if any
    return new Response(
      JSON.stringify({
        content: result.text,
        usage: result.usage,
        steps: result.steps, // Include steps for agent behavior
        toolCalls: result.toolCalls,
        toolResults: result.toolResults,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
  }
}

/**
 * Factory function to create an AI provider
 * Can use explicitly provided API keys or fall back to environment variables
 *
 * @param overrides - Optional configuration overrides including API keys
 * @returns Configured AI provider instance
 *
 * @example
 * ```typescript
 * // Use explicit API key
 * const provider = createAIProvider({
 *   provider: "anthropic",
 *   apiKey: "sk-ant-..."
 * })
 *
 * // Auto-detect from environment
 * const autoProvider = createAIProvider()
 *
 * // Override specific settings
 * const customProvider = createAIProvider({
 *   provider: "openai",
 *   modelId: "gpt-4",
 *   apiKey: "sk-..."
 * })
 * ```
 */
export function createAIProvider(
  overrides?: Partial<AIProviderConfig>
): AIProvider {
  const config: AIProviderConfig = {
    provider: "anthropic",
    ...overrides,
  }

  // If no API key is explicitly provided, try to get from environment
  if (!config.apiKey) {
    // Auto-detect provider and API key from environment if not specified
    if (!overrides?.provider) {
      if (process.env.ANTHROPIC_API_KEY) {
        config.provider = "anthropic"
        config.apiKey = process.env.ANTHROPIC_API_KEY
      } else if (process.env.OPENAI_API_KEY) {
        config.provider = "openai"
        config.apiKey = process.env.OPENAI_API_KEY
      }
    } else {
      // Use environment API key for the specified provider
      if (config.provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
        config.apiKey = process.env.ANTHROPIC_API_KEY
      } else if (config.provider === "openai" && process.env.OPENAI_API_KEY) {
        config.apiKey = process.env.OPENAI_API_KEY
      }
    }
  }

  return new AIProvider(config)
}
