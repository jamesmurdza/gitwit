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
 * Structural type for file tree entries.
 * Compatible with TFile | TFolder from @gitwit/lib without importing it.
 */
export interface FileTree {
  name: string
  type?: string
  children?: FileTree[]
}

/**
 * Context passed to buildPrompt for constructing system prompts.
 */
export interface PromptContext {
  mode: "chat" | "edit"
  templateType?: string
  templateConfigs?: Record<string, unknown>
  fileTree?: FileTree[]
  activeFileContent?: string
  contextContent?: string
  fileName?: string
}
