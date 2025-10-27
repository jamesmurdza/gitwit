# @gitwit/ai

A unified AI client for building intelligent code editors and developer tools.

This package provides a clean interface for multiple AI providers (Anthropic, OpenAI, AWS Bedrock) with built-in streaming, tool calling, and context-aware prompt building. Perfect for applications that need code generation, intelligent chat, or AI-powered editing capabilities.

## Features

- 🤖 **Multi-Provider Support**: Seamlessly switch between Anthropic Claude, OpenAI, and AWS Bedrock models
- 🔄 **Streaming Support**: Support for both real-time streaming responses and immediate results
- 🛠️ **Tool Integration**: Built-in function calling with custom tool definitions
- 🎯 **Context-Aware**: Automatic prompt building with project and file context
- 📊 **Logging**: Comprehensive logging with structured context

## Installation

```bash
npm install @gitwit/ai
```

## Quick Start

### Basic Chat Example

Use `streamChat` for interactive AI conversations where you want explanations, context, and the ability to use tools. Responses are streamed in real-time and can include multiple tool calls.

```typescript
import { createAIClient } from "@gitwit/ai"

// Create a client instance
const client = await createAIClient({
  userId: "user123",
  projectId: "proj456",
  providerConfig: {
    provider: "anthropic",
    modelId: "claude-sonnet-4-20250514",
  },
})

// Stream a chat response
const { output } = await client.streamChat({
  messages: [
    { role: "user", content: "Explain how async/await works in JavaScript" },
  ],
})

// Consume the stream
for await (const chunk of readStreamableValue(output)) {
  console.log(chunk)
}
```

### Code Edit Example

Use `processEdit` when you need direct code modifications without explanations or commentary. This returns only the edited code immediately (non-streaming), with tools typically disabled for clean, focused output.

```typescript
import { createAIClient } from "@gitwit/ai"

const client = await createAIClient({
  userId: "user123",
  projectId: "proj456",
})

// Get immediate code edit result
const { content } = await client.processEdit({
  messages: [{ role: "user", content: "Add error handling to this function" }],
  context: {
    userId: "user123",
    fileName: "api.ts",
    activeFileContent: "function getData() { return fetch('/api/data') }",
  },
})

console.log(content) // Returns edited code
```

### Using Tools

```typescript
import { createAIClient, AITool } from "@gitwit/ai"
import { z } from "zod"

// Define a custom tool
const weatherTool: AITool = {
  description: "Get current weather for a location",
  parameters: z.object({
    location: z.string().describe("City name"),
  }),
  execute: async ({ location }) => {
    // Your tool implementation
    return { temperature: 72, condition: "sunny" }
  },
}

// Create client with tools
const client = await createAIClient({
  userId: "user123",
  tools: {
    weather: weatherTool,
  },
})

const { output } = await client.streamChat({
  messages: [{ role: "user", content: "What's the weather in San Francisco?" }],
})
```

## API Reference

### `createAIClient(options)`

Factory function for creating an AI client instance.

**Parameters:**

- `userId` (string, required): User identifier for context and logging
- `projectId` (string, optional): Project identifier for context
- `projectName` (string, optional): Project name for context
- `fileName` (string, optional): Current file name for context
- `providerConfig` ([AIProviderConfig](#aiproviderconfig), optional): AI provider configuration
- `tools` ([AITool](#aitool)[], optional): Custom tools for function calling
- `disableTools` (boolean, optional): Disable all tools

**Returns:** `Promise<AIClient>`

### `AIClient` Methods

#### `streamChat(request)`

Streams a chat response with tool support.

**Parameters:**

- `messages` ([AIMessage](#aimessage)[]): Conversation messages
- `context` ([AIContext](#aicontext), optional): Additional context for the AI request
- `temperature` (number, optional): 0-2, default 0.7
- `maxTokens` (number, optional): Maximum tokens to generate
- `maxSteps` (number, optional): Maximum tool calling steps

**Returns:** `Promise<{ output: StreamableValue }>`

#### `processEdit(request)`

Returns edited code immediately without streaming.

**Parameters:**

- `messages` ([AIMessage](#aimessage)[]): Edit instructions
- `context` ([AIContext](#aicontext), optional): File and project context

**Returns:** `Promise<{ content: string }>`

## Types

### `AIMessage`

```typescript
interface AIMessage {
  role: "user" | "assistant" | "system"
  content: string
}
```

### `AIContext`

```typescript
interface AIContext {
  userId: string // Required: User identifier
  projectId?: string // Optional: Project identifier
  projectName?: string // Optional: Project name
  fileName?: string // Optional: Current file name
  templateType?: string // Optional: Project template type (e.g., "nextjs", "reactjs")
  activeFileContent?: string // Optional: Content of the currently active file
  fileTree?: any[] // Optional: Project file tree structure
  templateConfigs?: Record<string, any> // Optional: Template-specific configurations
  contextContent?: string // Optional: Combined content from selected files
}
```

### `AITool`

```typescript
interface AITool {
  description: string
  parameters: z.ZodSchema<any>
  execute: (args: any) => Promise<any> | any
}
```

### `AIProviderConfig`

```typescript
interface AIProviderConfig {
  provider: "anthropic" | "openai" | "bedrock"
  apiKey?: string
  region?: string
  modelId?: string
  baseURL?: string
}
```

## Package Exports

The package provides multiple entry points for modular imports:

```typescript
import { createAIClient, AIClient } from "@gitwit/ai"
import { AIProvider, createAIProvider } from "@gitwit/ai/providers"
import { AIMessage, AITool, AIRequest } from "@gitwit/ai/types"
import { logger, PromptBuilder, StreamHandler } from "@gitwit/ai/utils"
```

## Environment Variables

The package uses the following environment variables:

**Anthropic**

- `ANTHROPIC_API_KEY`: Anthropic API key

**OpenAI**

- `OPENAI_API_KEY`: OpenAI API key

**AWS Bedrock**

- `AWS_ACCESS_KEY_ID`: AWS access key (for Bedrock)
- `AWS_SECRET_ACCESS_KEY`: AWS secret key (for Bedrock)
- `AWS_REGION`: AWS region (for Bedrock)
- `AWS_MODEL_ID`: AWS Bedrock model ID

## Development

```bash
# Build the package
npm run build

# Watch mode for development
npm run dev
```

## License

See the main GitWit repository for license information.
