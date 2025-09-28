import { AIProvider, createAIProvider } from "../providers"
import { AIProviderConfig, AIRequest, AIRequestSchema, AITool } from "../types"
import { logger, PromptBuilder } from "../utils"

/**
 * Configuration options for creating an AI client instance
 */
export interface AIClientConfig {
  userId: string
  projectId?: string
  projectName?: string
  fileName?: string
  providerConfig?: Partial<AIProviderConfig>
  tools?: Record<string, AITool>
  disableTools?: boolean
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

    // Create provider with tools
    this.provider = createAIProvider({ 
      ...config.providerConfig,
    })

    if (this.toolsEnabled && Object.keys(this.tools).length > 0) {
      this.provider.setTools(this.tools)
    }

    this.promptBuilder = new PromptBuilder()

    // Create logger with context
    this.logger = logger.child({
      userId: config.userId,
      projectId: config.projectId,
      projectName: config.projectName,
      fileName: config.fileName,
    })

    this.logger.info("AI Client initialized", {
      provider: this.provider.constructor.name,
      toolCount: Object.keys(this.tools).length,
      toolsEnabled: this.toolsEnabled,
    })
  }

  /**
   * Factory method to create an AI client with user tier configuration
   *
   * @param config - Configuration options for the AI client
   * @returns Promise that resolves to a configured AI client instance
   * @throws {Error} When user is not found in the database
   */
  static async create(config: AIClientConfig): Promise<AIClient> {
    return new AIClient({
      ...config,
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
          projectName: this.config.projectName,
          fileName: this.config.fileName,
          ...request.context,
        },
      })

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
   * Toggle tools on or off for this client instance
   *
   * @param enabled - Whether to enable or disable tools
   */
  setToolsEnabled(enabled: boolean): void {
    this.toolsEnabled = enabled
    this.tools = enabled ? this.config.tools || {} : {}

    // Recreate provider with new tools configuration
    this.provider = createAIProvider({ 
      ...this.config.providerConfig,
    })

    if (this.toolsEnabled && Object.keys(this.tools).length > 0) {
      this.provider.setTools(this.tools)
    }

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
  projectName?: string
  fileName?: string
  providerConfig?: Partial<AIProviderConfig>
  tools?: Record<string, AITool>
  disableTools?: boolean
}): Promise<AIClient> {
  return AIClient.create(options)
}
