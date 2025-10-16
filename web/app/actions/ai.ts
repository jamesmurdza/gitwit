"use server"

import { defaultTools } from "@/lib/ai/tools"
import { TFile, TFolder } from "@/lib/types"
import { currentUser } from "@clerk/nextjs/server"
import { AIMessage, AIProviderConfig, createAIClient } from "@gitwit/ai"
import { db } from "@gitwit/db"
import { user as userTable } from "@gitwit/db/schema"
import { decrypt } from "@gitwit/lib/utils/encryption"
import { templateConfigs } from "@gitwit/templates"
import { eq } from "drizzle-orm"

interface BaseContext {
  templateType?: string
  activeFileContent?: string
  fileTree?: (TFile | TFolder)[]
  contextContent?: string
  projectId?: string
  projectName?: string
  fileName?: string
}

/**
 * Fetch and decrypt user's custom API keys, returning provider configuration
 * Falls back to system environment variables if user hasn't configured custom keys
 */
async function getUserProviderConfig(
  userId: string
): Promise<Partial<AIProviderConfig> | undefined> {
  try {
    const userRecord = await db.query.user.findFirst({
      where: eq(userTable.id, userId),
    })

    if (!userRecord || !userRecord.apiKeys) {
      return undefined // Will use system defaults
    }

    const encryptedKeys = userRecord.apiKeys as Record<string, string>

    // Decrypt keys if they exist
    let anthropicKey: string | undefined
    let openaiKey: string | undefined
    let openrouterKey: string | undefined
    let awsAccessKey: string | undefined
    let awsSecretKey: string | undefined
    let awsRegion: string | undefined

    if (encryptedKeys.anthropic) {
      anthropicKey = decrypt(encryptedKeys.anthropic)
    }
    if (encryptedKeys.openai) {
      openaiKey = decrypt(encryptedKeys.openai)
    }
    if (encryptedKeys.openrouter) {
      openrouterKey = decrypt(encryptedKeys.openrouter)
    }
    if (encryptedKeys.awsAccessKeyId && encryptedKeys.awsSecretAccessKey) {
      awsAccessKey = decrypt(encryptedKeys.awsAccessKeyId)
      awsSecretKey = decrypt(encryptedKeys.awsSecretAccessKey)
      awsRegion = encryptedKeys.awsRegion // Region is not encrypted
    }

    // Priority: OpenRouter > Anthropic > OpenAI > AWS
    if (openrouterKey) {
      return {
        provider: "openrouter",
        apiKey: openrouterKey,
        modelId:
          encryptedKeys.openrouterModel || "anthropic/claude-sonnet-4-20250514",
      }
    } else if (anthropicKey) {
      return {
        provider: "anthropic",
        apiKey: anthropicKey,
        modelId: encryptedKeys.anthropicModel || "claude-sonnet-4-20250514",
      }
    } else if (openaiKey) {
      return {
        provider: "openai",
        apiKey: openaiKey,
        modelId: encryptedKeys.openaiModel || "gpt-4o",
      }
    } else if (awsAccessKey && awsSecretKey) {
      return {
        provider: "bedrock",
        region: awsRegion || "us-east-1",
        modelId:
          encryptedKeys.awsModel || "anthropic.claude-3-sonnet-20240229-v1:0",
      }
    }

    return undefined // No custom keys configured, use system defaults
  } catch (error) {
    console.error("Failed to fetch user API keys:", error)
    return undefined // Fall back to system defaults on error
  }
}

export async function streamChat(messages: AIMessage[], context?: BaseContext) {
  const user = await currentUser()
  if (!user) {
    throw new Error("Unauthorized")
  }

  // Fetch user's custom API keys and determine provider configuration
  const providerConfig = await getUserProviderConfig(user.id)

  const aiClient = await createAIClient({
    userId: user.id,
    projectId: context?.projectId,
    projectName: context?.projectName,
    fileName: context?.fileName,
    tools: defaultTools,
    disableTools: false,
    providerConfig,
  })

  return aiClient.streamChat({
    messages,
    mode: "chat",
    maxSteps: 3,
    context: {
      userId: user.id,
      projectId: context?.projectId,
      projectName: context?.projectName,
      fileName: context?.fileName,
      templateType: context?.templateType,
      activeFileContent: context?.activeFileContent,
      fileTree: context?.fileTree,
      contextContent: context?.contextContent,
      templateConfigs: templateConfigs,
    },
  })
}

export async function processEdit(
  messages: AIMessage[],
  context?: BaseContext
) {
  const user = await currentUser()
  if (!user) {
    throw new Error("Unauthorized")
  }

  // Fetch user's custom API keys and determine provider configuration
  const providerConfig = await getUserProviderConfig(user.id)

  const aiClient = await createAIClient({
    userId: user.id,
    projectId: context?.projectId,
    projectName: context?.projectName,
    fileName: context?.fileName,
    tools: defaultTools,
    disableTools: true, // Tools disabled for edit mode
    providerConfig,
  })

  return aiClient.processEdit({
    messages,
    mode: "edit",
    maxSteps: 3,
    context: {
      userId: user.id,
      projectId: context?.projectId,
      projectName: context?.projectName,
      fileName: context?.fileName,
      activeFileContent: context?.activeFileContent,
    },
  })
}

export async function mergeCode(
  partialCode: string,
  originalCode: string,
  fileName: string,
  projectId?: string
) {
  const user = await currentUser()
  if (!user) {
    throw new Error("Unauthorized")
  }

  // Log the merge request
  console.log("🔀 Code Merge - Starting merge for file:", fileName)
  console.log("🔀 Code Merge - Partial Code:", partialCode)
  console.log("🔀 Code Merge - Original Code Length:", originalCode.length)

  // Fetch user's custom API keys and determine provider configuration
  const providerConfig = await getUserProviderConfig(user.id)

  const aiClient = await createAIClient({
    userId: user.id,
    projectId: projectId,
    tools: {},
    disableTools: true,
    providerConfig,
  })

  try {
    const result = await aiClient.processEdit({
      messages: [
        {
          role: "user",
          content: `You are a code merging assistant. Your task is to merge the new code snippet with the original file content while following these strict rules:

1. Code Integration Rules:
   - ONLY use code from the provided new code snippet
   - DO NOT add any new code that isn't in the snippet
   - DO NOT modify existing code unless directly replaced by the snippet
   - Preserve all existing imports, exports, and component structure
   - IGNORE all "// NEW:" and "// REMOVED:" comments from the snippet - these are just markers

2. Structure Preservation:
   - Keep the original file's organization intact
   - Maintain existing code patterns and style
   - Preserve all comments and documentation
   - Keep type definitions and interfaces unchanged

3. Merge Guidelines:
   - Replace the exact portions of code that match the snippet's context
   - If the snippet contains new code, place it in the most logical location
   - Maintain consistent indentation and formatting
   - Keep existing error handling and type safety
   - Strip out "// ... existing code ..." comments and replace with actual existing code

4. Output Requirements:
   - Return ONLY the final merged code
   - Do not include:
     • Code fence markers (\`\`\`)
     • Language identifiers
     • Explanations or comments about changes
     • Markdown formatting
     • Line numbers
     • Any text before or after the code
     • "// NEW:" or "// REMOVED:" comments
     • "// ... existing code ..." comments

The output must be the exact code that will replace the existing file content, nothing more and nothing less.

IMPORTANT: Never add any code that isn't explicitly provided in the new code snippet. Ignore all comment markers.

Original file:
${originalCode}

New code snippet to merge:
${partialCode}`,
        },
      ],
      mode: "edit",
      context: {
        userId: user.id,
        fileName: fileName,
        activeFileContent: originalCode,
      },
    })

    // Log the merge result
    console.log("🔀 Code Merge - Merged Code Length:", result.content.length)
    console.log(
      "🔀 Code Merge - Merged Code Preview:",
      result.content.substring(0, 200) + "..."
    )

    return result.content
  } catch (error) {
    console.error("🔀 Code Merge - Failed:", error)
    // Fallback: return original code if merge fails
    return originalCode
  }
}
