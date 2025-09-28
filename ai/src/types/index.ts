import { z } from "zod"

/**
 * Tool definition interface for AI function calling
 */
export interface AITool {
  description: string
  parameters: z.ZodSchema<any>
  execute: (args: any) => Promise<any> | any
}

/**
 * Zod schema for validating AI request objects
 * Ensures all required fields are present and properly typed
 */
export const AIRequestSchema = z.object({
  /** Array of conversation messages between user, assistant, and system */
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })
  ),
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
    activeFile: z.string().optional(),
    fileTree: z.array(z.any()).optional(),
    templateConfigs: z.record(z.any()).optional(),
    /**
     * Combined content from selected files (code, files, images)
     */
    contextContent: z.string().optional(),
  }),
  mode: z.enum(["chat", "edit"]).default("chat"),
})

export type AIRequest = z.infer<typeof AIRequestSchema>

/**
 * Configuration interface for AI provider setup
 */
export interface AIProviderConfig {
  provider: "anthropic" | "openai"
  apiKey?: string
  region?: string
  modelId?: string
  baseURL?: string
  tools?: Record<string, AITool>
}
