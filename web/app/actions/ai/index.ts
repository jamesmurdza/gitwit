"use server"

import { defaultTools } from "@/lib/ai/tools"
import { TFile, TFolder } from "@/lib/types"
import { currentUser } from "@clerk/nextjs/server"
import { AIMessage, createAIClient } from "@gitwit/ai"
import { mergeAiderDiff } from "@gitwit/ai/utils"
import { templateConfigs } from "@gitwit/templates"
import { createStreamableValue } from "ai/rsc"
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

  const providerConfig = await getUserProviderConfig(user.id)

  const aiClient = createAIClient({
    userId: user.id,
    projectId: context?.projectId,
    projectName: context?.projectName,
    fileName: context?.fileName,
    tools: defaultTools,
    providerConfig,
    templateType: context?.templateType,
    fileTree: context?.fileTree,
    templateConfigs: templateConfigs,
  })

  // Wrap AsyncIterable in RSC StreamableValue (RSC concern stays in web layer)
  const stream = createStreamableValue("")
  ;(async () => {
    try {
      for await (const chunk of aiClient.streamChat({
        messages,
        context: context?.contextContent,
        activeFileContent: context?.activeFileContent,
      })) {
        stream.update(chunk)
      }
      stream.done()
    } catch (error) {
      console.error("Stream chat failed", error)
      stream.error(error)
    }
  })()

  return { output: stream.value }
}

export async function processEdit(
  messages: AIMessage[],
  context?: BaseContext
) {
  const user = await currentUser()
  if (!user) {
    throw new Error("Unauthorized")
  }

  const providerConfig = await getUserProviderConfig(user.id)

  const aiClient = createAIClient({
    userId: user.id,
    projectId: context?.projectId,
    projectName: context?.projectName,
    fileName: context?.fileName,
    tools: defaultTools,
    disableTools: true,
    providerConfig,
  })

  return aiClient.processEdit({
    messages,
    activeFileContent: context?.activeFileContent,
  })
}

export async function logFileDetected(filePath: string) {
  console.log(
    "📄 [SERVER] File detected from AI response and added to preview:",
    filePath
  )
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

  console.log("🔀 Code Merge - Starting merge for file:", fileName)
  console.log("🔀 Code Merge - Partial Code:", partialCode)
  console.log("🔀 Code Merge - Original Code Length:", originalCode.length)

  try {
    const mergedCode = mergeAiderDiff(originalCode, partialCode, fileName)
    return mergedCode
  } catch (error) {
    console.error("🔀 Code Merge - Failed:", error)
    return originalCode
  }
}
