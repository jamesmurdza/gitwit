# @gitwit/ai

Thin utility layer over the [Vercel AI SDK](https://sdk.vercel.ai/) for GitWit. Handles provider resolution, prompt building, and diff merging — everything else uses the AI SDK directly.

## Exports

```typescript
import {
  createModel,          // (config?) => LanguageModel
  resolveProviderConfig,// (overrides?) => AIProviderConfig
  buildPrompt,          // (ctx: PromptContext) => string
  formatFileTree,       // (files: FileTree[]) => string
  mergeAiderDiff,       // (original, partial, fileName) => string
} from "@gitwit/ai"
```

## Usage

```typescript
import { createModel, buildPrompt } from "@gitwit/ai"
import { streamText } from "ai"

const model = createModel({ provider: "anthropic" })

const system = buildPrompt({
  mode: "chat",
  templateType: "nextjs",
  fileTree: [...],
})

const result = streamText({ model, system, messages })
```

`createModel` returns a standard AI SDK `LanguageModel`. Use it with `streamText`, `generateText`, or any AI SDK function.

## Provider Resolution

`createModel` auto-detects providers from environment variables when no config is passed.

Priority: OpenRouter > Anthropic > OpenAI > Bedrock (falls back to Anthropic).

```typescript
// Auto-detect from env
const model = createModel()

// Explicit provider
const model = createModel({ provider: "openai", modelId: "gpt-4o" })

// Custom API key
const model = createModel({ provider: "anthropic", apiKey: "sk-..." })
```

## Environment Variables

| Provider | Variables |
|----------|-----------|
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL_ID` |
| Bedrock | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_MODEL_ID` |

## Types

```typescript
type AIProviderType = "anthropic" | "openai" | "bedrock" | "openrouter"

interface AIProviderConfig {
  provider: AIProviderType
  apiKey?: string
  region?: string
  modelId?: string
  baseURL?: string
}

interface FileTree {
  name: string
  type?: string
  children?: FileTree[]
}

interface PromptContext {
  mode: "chat" | "edit"
  templateType?: string
  templateConfigs?: Record<string, unknown>
  fileTree?: FileTree[]
  activeFileContent?: string
  contextContent?: string
  fileName?: string
}
```

## Development

```bash
npm run build    # Build
npm run dev      # Watch mode
npm test         # Run tests
```
