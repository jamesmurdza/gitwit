import { createStreamableValue } from "ai/rsc"
import { AIProvider, createAIProvider } from "../providers"
import { AIProviderConfig, AIRequest, AIRequestSchema, AITool } from "../types"
import { logger, PromptBuilder, StreamHandler } from "../utils"

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
 * Main AI client class that handles AI requests with provider management and tool integration
 * Supports both streaming chat responses and immediate edit responses
 *
 * @example
 * ```typescript
 * const client = await AIClient.create({
 *   userId: "user123",
 *   projectId: "proj456",
 *   tools: {
 *     weather: weatherTool,
 *     filesystem: fileSystemTool,
 *   }
 * })
 *
 * // For streaming chat responses
 * const streamResponse = await client.streamChat({
 *   messages: [{ role: "user", content: "Hello, AI!" }],
 * })
 *
 * // For immediate edit responses
 * const editResponse = await client.processEdit({
 *   messages: [{ role: "user", content: "Fix this code" }],
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
   * Processes a chat request and returns a React Server Component streamable value
   * Designed for conversational AI interactions with explanations and context
   *
   * This method:
   * - Forces streaming mode for real-time response delivery
   * - Uses chat-oriented system prompts with project context
   * - Enables tools for enhanced functionality
   * - Returns an RSC-compatible StreamableValue
   *
   * @param request - Partial AI request object containing messages and options
   * @returns Object with streamable value for RSC consumption: `{ output: StreamableValue }`
   * @throws {Error} When AI generation fails or streaming encounters errors
   *
   * @example
   * ```typescript
   * import { AIMessage } from "@gitwit/ai"
   *
   * const messages: AIMessage[] = [
   *   { role: "user", content: "Explain this code" }
   * ]
   *
   * const { output } = await client.streamChat({
   *   messages,
   *   context: { projectId: "123", fileName: "app.js" }
   * })
   *
   * for await (const chunk of readStreamableValue(output)) {
   *   console.log(chunk) // Real-time streaming response
   * }
   * ```
   */
  async streamChat(request: Partial<AIRequest>) {
    const stream = createStreamableValue("")

    // Run async to not block the return
    ;(async () => {
      try {
        const response = await this.chat({
          ...request,
          stream: true, // Force streaming for RSC
        })

        if (response.body) {
          for await (const chunk of StreamHandler.parseStream(response.body)) {
            stream.update(chunk)
          }
        }

        stream.done()
      } catch (error) {
        this.logger.error("Stream chat failed", error)
        stream.error(error)
      }
    })()

    return { output: stream.value }
  }

  /**
   * Processes an edit request and returns the complete result immediately
   * Designed for code editing operations that return only code without explanations
   *
   * This method:
   * - Forces non-streaming mode for immediate results
   * - Uses edit-oriented system prompts focused on code generation
   * - Disables tools to prevent distractions from code output
   * - Returns the complete response as a JSON object
   *
   * @param request - Partial AI request object for code editing operations
   * @returns Object with immediate content: `{ content: string }`
   * @throws {Error} When AI generation fails or edit processing encounters errors
   *
   * @example
   * ```typescript
   * import { AIMessage } from "@gitwit/ai"
   *
   * const messages: AIMessage[] = [
   *   { role: "user", content: "Add error handling to this function" }
   * ]
   *
   * const { content } = await client.processEdit({
   *   messages,
   *   context: { activeFile: "function code here..." }
   * })
   *
   * console.log(content) // Complete code result immediately available
   * ```
   */
  async processEdit(request: Partial<AIRequest>) {
    try {
      const response = await this.edit({
        ...request,
        stream: false, // Force non-streaming for edits
      })

      const result = (await response.json()) as { content: string }
      return { content: result.content }
    } catch (error) {
      this.logger.error("Edit request failed", error)
      throw error
    }
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
 * Factory function for creating an AI client instance with tool integration
 *
 * Creates a client that supports both streaming chat and immediate edit operations.
 * Tools are managed at the client level and automatically configured for the provider.
 *
 * @param options - Configuration options for creating the AI client
 * @param options.userId - Required user identifier for context and logging
 * @param options.projectId - Optional project identifier for context
 * @param options.tools - Optional tools to enable for AI function calling
 * @param options.disableTools - Optional flag to disable all tools
 * @param options.providerConfig - Optional AI provider configuration (model, API settings)
 * @returns Promise that resolves to a configured AI client instance
 *
 * @example
 * ```typescript
 * const client = await createAIClient({
 *   userId: "user123",
 *   projectId: "proj456",
 *   tools: {
 *     fileSystem: fileSystemTool,
 *     weather: weatherTool
 *   },
 *   providerConfig: {
 *     provider: "anthropic",
 *     modelId: "claude-sonnet-4-20250514"
 *   }
 * })
 * ```
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
