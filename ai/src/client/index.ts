import {
  AIClient as AIClientInterface,
  AIClientConfig,
  AIClientRequest,
  AIRequest,
  AIRequestSchema,
} from "../types"
import { createLLMProvider, resolveProviderConfig } from "../providers"
import { buildPrompt } from "../utils"

/**
 * Create an AI client instance.
 * Synchronous — no async work needed for construction.
 */
export function createAIClient(config: AIClientConfig): AIClientInterface {
  const resolvedConfig = resolveProviderConfig(config.providerConfig)
  const tools =
    !config.disableTools && config.tools ? config.tools : undefined
  const provider = createLLMProvider(resolvedConfig, tools)

  return {
    async *streamChat(request: AIClientRequest) {
      const fullRequest = toAIRequest(request, config)
      prependSystemPrompt(fullRequest)
      yield* provider.streamText(fullRequest)
    },

    async chat(request: AIClientRequest) {
      const fullRequest = toAIRequest(request, config)
      prependSystemPrompt(fullRequest)
      return provider.generateText(fullRequest)
    },

    async processEdit(request: AIClientRequest) {
      const fullRequest = toAIRequest({ ...request, isEdit: true }, config)
      prependSystemPrompt(fullRequest)
      const response = await provider.generateText(fullRequest)
      return { content: response.content }
    },
  }
}

/** Convert client request + config into full AI request */
function toAIRequest(
  request: AIClientRequest,
  config: AIClientConfig
): AIRequest {
  return AIRequestSchema.parse({
    messages: request.messages,
    mode: request.isEdit ? "edit" : "chat",
    stream: true,
    model: request.model,
    context: {
      userId: config.userId,
      projectId: config.projectId,
      projectName: config.projectName,
      fileName: config.fileName,
      activeFileContent: request.activeFileContent,
      contextContent: request.context,
      templateType: config.templateType,
      fileTree: config.fileTree,
      templateConfigs: config.templateConfigs,
    },
  })
}

/** Prepend system prompt if not already present */
function prependSystemPrompt(request: AIRequest): void {
  if (!request.messages.find((m) => m.role === "system")) {
    request.messages.unshift({
      role: "system",
      content: buildPrompt(request),
    })
  }
}

// --- Backward-compat: old class-based client (used until server actions are updated) ---

export { AIClientConfig }

/** @deprecated Use createAIClient() instead */
export class OldAIClient {
  private config: AIClientConfig
  private client: AIClientInterface

  constructor(config: AIClientConfig) {
    this.config = config
    this.client = createAIClient(config)
  }

  static async create(config: AIClientConfig): Promise<OldAIClient> {
    return new OldAIClient(config)
  }

  // Old streamChat returned { output: StreamableValue } — callers must migrate
  async streamChat(request: Partial<AIRequest>) {
    // Bridge: convert old Partial<AIRequest> shape to new AIClientRequest
    const clientRequest: AIClientRequest = {
      messages: request.messages || [],
      context: request.context?.contextContent,
      activeFileContent: request.context?.activeFileContent,
      isEdit: request.mode === "edit",
      model: request.model,
    }

    // Override config fields from request context if provided
    if (request.context) {
      this.config = {
        ...this.config,
        templateType: request.context.templateType ?? this.config.templateType,
        fileTree: request.context.fileTree ?? this.config.fileTree,
        templateConfigs:
          request.context.templateConfigs ?? this.config.templateConfigs,
      }
      // Recreate client with updated config
      this.client = createAIClient(this.config)
    }

    return this.client.streamChat(clientRequest)
  }

  async processEdit(request: Partial<AIRequest>) {
    const clientRequest: AIClientRequest = {
      messages: request.messages || [],
      context: request.context?.contextContent,
      activeFileContent: request.context?.activeFileContent,
      isEdit: true,
      model: request.model,
    }

    if (request.context) {
      this.config = {
        ...this.config,
        templateType: request.context.templateType ?? this.config.templateType,
        fileTree: request.context.fileTree ?? this.config.fileTree,
        templateConfigs:
          request.context.templateConfigs ?? this.config.templateConfigs,
      }
      this.client = createAIClient(this.config)
    }

    return this.client.processEdit(clientRequest)
  }
}
