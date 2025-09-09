import { db } from "@gitwit/db"
import { env } from "@gitwit/db/env"
import { decrypt } from "@gitwit/lib/utils/crypto"
import { RateLimiter } from "../middleware/rate-limiter"
import { UsageTracker } from "../middleware/usage-tracker"
import { AIProvider, createAIProvider } from "../providers"
import {
  AIProviderConfig,
  AIRequest,
  AIRequestSchema,
  AITierConfig,
  AITool,
} from "../types"
import { logger, PromptBuilder } from "../utils"

/**
 * Configuration options for creating an AI client instance
 */
export interface AIClientConfig {
  userId: string
  projectId?: string
  provider?: AIProvider
  providerConfig?: Partial<AIProviderConfig>
  tierConfig?: AITierConfig
  tools?: Record<string, AITool>
  disableTools?: boolean
  userApiKeys?: {
    anthropic?: string | null
    openai?: string | null
  }
}

/**
 * Main AI client class that handles AI requests with rate limiting, usage tracking, and provider management
 *
 * @example
 * ```typescript
 * const client = await AIClient.create({ userId: "user123", projectId: "proj456" })
 * const response = await client.chat({
 *   messages: [{ role: "user", content: "Hello, AI!" }],
 *   stream: true
 *   tools: {
 *     weather: weatherTool,
 *     filesystem: fileSystemTool,
 *     project: projectTool,
 *   }
 * })
 * ```
 */
export class AIClient {
  private provider: AIProvider
  private rateLimiter: RateLimiter
  private usageTracker: UsageTracker
  private promptBuilder: PromptBuilder
  private config: AIClientConfig
  private logger: typeof logger
  private tools: Record<string, AITool> = {}
  private toolsEnabled: boolean

  /**
   * Creates a new AI client instance
   *
   * @param config - Configuration options for the AI client
   */
  constructor(config: AIClientConfig) {
    this.config = config
    this.toolsEnabled = !config.disableTools // Tools enabled by default, disabled if flag is set
    this.tools = this.toolsEnabled ? config.tools || {} : {}

    // Create provider with user API keys if available, otherwise fall back to service keys
    if (config.provider) {
      this.provider = config.provider
    } else {
      const providerConfig: Partial<AIProviderConfig> = {
        tools: this.tools,
        ...config.providerConfig,
      }

      // Use user's API key if available
      if (config.userApiKeys) {
        if (config.userApiKeys.anthropic) {
          providerConfig.provider = "anthropic"
          providerConfig.apiKey = config.userApiKeys.anthropic
        } else if (config.userApiKeys.openai) {
          providerConfig.provider = "openai"
          providerConfig.apiKey = config.userApiKeys.openai
        }
      }

      this.provider = createAIProvider(providerConfig)
    }

    this.rateLimiter = new RateLimiter(config.userId)
    this.usageTracker = new UsageTracker(config.userId)
    this.promptBuilder = new PromptBuilder()

    // Create logger with context
    this.logger = logger.child({
      userId: config.userId,
      projectId: config.projectId,
    })

    this.logger.info("AI Client initialized", {
      provider: this.provider.constructor.name,
      tierConfig: config.tierConfig,
      toolCount: Object.keys(this.tools).length,
      toolsEnabled: this.toolsEnabled,
      hasUserApiKeys: !!(
        config.userApiKeys?.anthropic || config.userApiKeys?.openai
      ),
    })
  }

  /**
   * Factory method to create an AI client with user tier configuration and API keys
   *
   * @param config - Configuration options for the AI client
   * @returns Promise that resolves to a configured AI client instance
   * @throws {Error} When user is not found in the database
   */
  static async create(config: AIClientConfig): Promise<AIClient> {
    // Fetch user including their encrypted API keys
    const user = await db.query.user.findFirst({
      where: (users, { eq }) => eq(users.id, config.userId),
    })

    if (!user) {
      throw new Error("User not found")
    }

    // Get tier config with fallback to FREE tier
    const DEFAULT_TIER_CONFIG: AITierConfig = {
      generations: 10,
      maxTokens: 4096,
      model: "claude-3-5-sonnet-20241022",
      anthropicModel: "claude-3-5-sonnet-20241022",
      rateLimit: {
        requests: 10,
        window: 60,
      },
    }

    const tierConfig = DEFAULT_TIER_CONFIG

    // Decrypt user API keys if they exist
    let userApiKeys: AIClientConfig["userApiKeys"] = undefined

    if (env.ENCRYPTION_KEY) {
      try {
        userApiKeys = {
          anthropic: user.encryptedAnthropicKey
            ? decrypt(user.encryptedAnthropicKey, env.ENCRYPTION_KEY)
            : null,
          openai: user.encryptedOpenAIKey
            ? decrypt(user.encryptedOpenAIKey, env.ENCRYPTION_KEY)
            : null,
        }
      } catch (error) {
        logger.error("Failed to decrypt user API keys", error)
        // Continue without user API keys, will fall back to service keys
      }
    }

    return new AIClient({
      ...config,
      tierConfig,
      userApiKeys,
    })
  }

  /**
   * Processes a chat request with rate limiting, usage tracking, and AI generation
   *
   * @param request - Partial AI request object containing messages and options
   * @returns Promise that resolves to an HTTP Response containing the AI's response
   * @throws {Error} When rate limits are exceeded, usage limits are reached, or AI generation fails
   */
  async chat(request: Partial<AIRequest>): Promise<Response> {
    const startTime = Date.now()

    this.logger.debug("Chat request received", {
      mode: request.mode || "chat",
      messageCount: request.messages?.length,
      toolCount: Object.keys(this.tools).length,
      toolsEnabled: this.toolsEnabled,
    })

    try {
      // Validate request
      const validatedRequest = AIRequestSchema.parse({
        ...request,
        context: {
          userId: this.config.userId,
          projectId: this.config.projectId,
          ...request.context,
        },
      })

      // Check rate limits
      await this.rateLimiter.checkLimit()
      this.logger.debug("Rate limit check passed")

      // Check usage limits
      await this.usageTracker.checkUsage()
      this.logger.debug("Usage limit check passed")

      // Build system prompt based on mode
      const systemPrompt = this.promptBuilder.build(validatedRequest)

      // Add system message if not present
      if (!validatedRequest.messages.find((m) => m.role === "system")) {
        validatedRequest.messages.unshift({
          role: "system",
          content: systemPrompt,
        })
      }

      // Generate response
      const response = validatedRequest.stream
        ? await this.provider.generateStream(validatedRequest)
        : await this.provider.generate(validatedRequest)

      // Track usage
      await this.usageTracker.increment()

      const duration = Date.now() - startTime
      this.logger.info("Chat request completed", {
        mode: validatedRequest.mode,
        duration,
        streaming: validatedRequest.stream,
        toolsUsed: this.toolsEnabled,
      })

      return response
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error("Chat request failed", error, {
        mode: request.mode,
        duration,
        toolsEnabled: this.toolsEnabled,
      })
      throw new Error("Failed to generate AI response")
    }
  }

  /**
   * Processes an edit request by setting the mode to "edit" and calling the chat method
   *
   * @param request - Partial AI request object for code editing
   * @returns Promise that resolves to an HTTP Response containing the AI's edit suggestions
   */
  async edit(request: Partial<AIRequest>): Promise<Response> {
    return this.chat({
      ...request,
      mode: "edit",
    })
  }

  /**
   * Processes a merge request by setting the mode to "merge" and calling the chat method
   *
   * @param request - Partial AI request object for code merging
   * @returns Promise that resolves to an HTTP Response containing the AI's merge suggestions
   */
  async merge(request: Partial<AIRequest>): Promise<Response> {
    return this.chat({
      ...request,
      mode: "merge",
    })
  }

  /**
   * Toggle tools on or off for this client instance
   *
   * @param enabled - Whether to enable or disable tools
   */
  setToolsEnabled(enabled: boolean): void {
    this.toolsEnabled = enabled
    this.tools = enabled ? this.config.tools || {} : {}

    // Recreate provider with new tools configuration and user API keys
    const providerConfig: Partial<AIProviderConfig> = {
      tools: this.tools,
      ...this.config.providerConfig,
    }

    // Use user's API key if available
    if (this.config.userApiKeys) {
      if (this.config.userApiKeys.anthropic) {
        providerConfig.provider = "anthropic"
        providerConfig.apiKey = this.config.userApiKeys.anthropic
      } else if (this.config.userApiKeys.openai) {
        providerConfig.provider = "openai"
        providerConfig.apiKey = this.config.userApiKeys.openai
      }
    }

    this.provider = createAIProvider(providerConfig)

    this.logger.info("Tools toggled", {
      toolsEnabled: this.toolsEnabled,
      toolCount: Object.keys(this.tools).length,
    })
  }

  /**
   * Get the current tools enabled state
   *
   * @returns Whether tools are currently enabled
   */
  areToolsEnabled(): boolean {
    return this.toolsEnabled
  }
}

/**
 * Factory function for creating an AI client instance per request
 *
 * @param options - Configuration options for creating the AI client
 * @returns Promise that resolves to a configured AI client instance
 */
export async function createAIClient(options: {
  userId: string
  projectId?: string
  provider?: AIProvider
  providerConfig?: Partial<AIProviderConfig>
  tools?: Record<string, AITool>
  disableTools?: boolean
}): Promise<AIClient> {
  return AIClient.create(options)
}
