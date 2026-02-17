/**
 * Supported AI providers.
 */
export type AIProviderType = "anthropic" | "openai" | "bedrock" | "openrouter"

/**
 * Configuration for selecting an AI provider and model.
 */
export interface AIProviderConfig {
  provider: AIProviderType
  apiKey?: string
  region?: string
  modelId?: string
  baseURL?: string
}

/**
 * A node in a file tree structure.
 */
export interface FileTreeNode {
  name: string
  children?: FileTreeNode[]
}

/**
 * Context passed to buildPrompt for constructing system prompts.
 */
export interface PromptContext {
  mode: "chat" | "edit"
  templateType?: string
  templateConfigs?: Record<string, unknown>
  fileTree?: FileTreeNode[]
  activeFileContent?: string
  contextContent?: string
  fileName?: string
}
