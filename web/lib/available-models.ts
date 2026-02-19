// Available models for each provider
// Users can input custom model IDs for OpenRouter and AWS
export const AVAILABLE_MODELS = {
  openai: [
    // GPT-5 Series (Latest)
    // Not supported by the @gitwit/ai package yet, so we're not including them here
    // { id: "gpt-5-2025-08-07", name: "gpt-5" },
    // { id: "gpt-5-pro-2025-10-06", name: "gpt-5-pro" },
    // { id: "gpt-5-mini-2025-08-07", name: "gpt-5-mini" },
    // { id: "gpt-5-nano-2025-08-07", name: "gpt-5-nano" },
    // { id: "gpt-5-codex", name: "gpt-5-codex" },
    // GPT-4.1 Series
    { id: "gpt-4.1-2025-04-14", name: "gpt-4.1" },
    { id: "gpt-4.1-nano-2025-04-14", name: "gpt-4.1-nano" },
    { id: "gpt-4.1-mini-2025-04-14", name: "gpt-4.1-mini" },
  ],
  anthropic: [
    // Claude 4.5 Series (Latest)
    { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5" },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
    // Claude 4.1 Series
    { id: "claude-opus-4-1-20250805", name: "Claude Opus 4.1" },
    // Claude 4 Series
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
    { id: "claude-opus-4-20250514", name: "Claude Opus 4" },
    // Claude 3.7 Series
    { id: "claude-3-7-sonnet-20250219", name: "Claude Sonnet 3.7" },
    // Claude 3.5 Series
    { id: "claude-3-5-haiku-20241022", name: "Claude Haiku 3.5" },
  ],
} as const

// Default models when user doesn't specify one
export const DEFAULT_MODELS = {
  openrouter: {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
  },
  aws: {
    id: "anthropic.claude-3-sonnet-20240229-v1:0",
    name: "Claude 3 Sonnet",
  },
} as const
