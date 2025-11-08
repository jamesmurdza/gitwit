"use server"

import { defaultTools } from "@/lib/ai/tools"
import { TFile, TFolder } from "@/lib/types"
import { currentUser } from "@clerk/nextjs/server"
import { AIMessage, createAIClient } from "@gitwit/ai"
import { mergeAiderDiff } from "@gitwit/ai/utils"
import { templateConfigs } from "@gitwit/templates"
import { getUserProviderConfig } from "./helpers"

interface BaseContext {
  templateType?: string
  activeFileContent?: string
  fileTree?: (TFile | TFolder)[]
  contextContent?: string
  projectId?: string
  projectName?: string
  fileName?: string
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

  try {
    // Use aider diff merger to apply search/replace blocks
    // mergeAiderDiff(originalCode, diffSnippet, filePath)
    const mergedCode = mergeAiderDiff(originalCode, partialCode, fileName)

    // Log the merge result

    return mergedCode
  } catch (error) {
    console.error("🔀 Code Merge - Failed:", error)
    // Fallback: return original code if merge fails
    return originalCode
  }
}
