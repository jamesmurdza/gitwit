export * from "./client"
export * from "./providers"
export {
  // Existing types — re-exported from barrel
  type AIMessage,
  type AIRequest,
  AIRequestSchema,
  type AITool,
  type AIProviderType,
  type AIProviderConfig,
  // New types — re-exported from barrel (no name collisions)
  type AIClientConfig,
  type AIClientRequest,
  type AIResponse,
  type LLMProvider,
  // AIClient interface intentionally NOT re-exported here —
  // it collides with the AIClient class from ./client.
  // Import from "@gitwit/ai/types" if needed.
  // Will be added here once the class is replaced in Phase 2.3.
} from "./types"
export * from "./utils"
