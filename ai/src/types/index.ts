import { z } from "zod"

/**
 * Message interface for AI conversations
 */
export interface AIMessage {
  role: "user" | "assistant" | "system"
  content: string
}

/**
 * Tool definition interface for AI function calling.
 * Matches Vercel AI SDK's CoreTool signature for seamless interop.
 */
export interface AITool {
  description: string
  parameters: z.ZodTypeAny
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (args: any) => Promise<any> | any
}

/**
 * Zod schema for validating AI request objects
 * Ensures all required fields are present and properly typed
 */
export const AIRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })
  ) satisfies z.ZodType<AIMessage[]>,
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().positive().optional(),
  maxSteps: z.number().positive().optional().default(1),
  stream: z.boolean().optional().default(true),
  context: z.object({
    userId: z.string(),
    projectId: z.string().optional(),
    projectName: z.string().optional(),
    fileName: z.string().optional(),
    templateType: z.string().optional(),
    activeFileContent: z.string().optional(),
    fileTree: z.array(z.any()).optional(),
    templateConfigs: z.record(z.string(), z.any()).optional(),
    contextContent: z.string().optional(),
  }),
  mode: z.enum(["chat", "edit"]).default("chat"),
})

export type AIRequest = z.infer<typeof AIRequestSchema>

/**
 * Supported AI providers
 */
export type AIProviderType = "anthropic" | "openai" | "bedrock" | "openrouter"

/**
 * Configuration interface for AI provider setup
 */
export interface AIProviderConfig {
  provider: AIProviderType
  apiKey?: string
  region?: string
  modelId?: string
  baseURL?: string
}

// --- New interfaces for the refactored API ---

/**
 * Configuration for creating an AI client instance.
 */
export interface AIClientConfig {
  userId: string
  projectId?: string
  projectName?: string
  fileName?: string
  providerConfig?: Partial<AIProviderConfig>
  tools?: Record<string, AITool>
  disableTools?: boolean
  templateType?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fileTree?: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  templateConfigs?: Record<string, any>
}

/**
 * Purpose-built request type for client methods.
 * Replaces Partial<AIRequest> with explicit, required fields.
 */
export interface AIClientRequest {
  messages: AIMessage[]
  context?: string
  activeFileContent?: string
  isEdit?: boolean
  model?: string
}

/**
 * Structured response from AI generation
 */
export interface AIResponse {
  content: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>
  toolResults?: Array<{ name: string; result: unknown }>
}

/**
 * Core client interface — consumers program against this.
 * Returns framework-agnostic types (AsyncIterable, not StreamableValue).
 */
export interface AIClient {
  streamChat(request: AIClientRequest): AsyncIterable<string>
  chat(request: AIClientRequest): Promise<AIResponse>
  processEdit(request: AIClientRequest): Promise<{ content: string }>
}

/**
 * Provider interface — abstracts over Vercel AI SDK models.
 * Internal to the ai package; not exported from the public API.
 */
export interface LLMProvider {
  streamText(request: AIRequest): AsyncIterable<string>
  generateText(request: AIRequest): Promise<AIResponse>
}
