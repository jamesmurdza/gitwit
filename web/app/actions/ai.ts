"use server"

import { TFile, TFolder } from "@/lib/types"
import { currentUser } from "@clerk/nextjs/server"
import { AIClient, createAIClient, createAIProvider } from "@gitwit/ai"
import { StreamHandler, defaultTools } from "@gitwit/ai/utils"
import { createStreamableValue } from "ai/rsc"

export async function streamChat(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  context?: {
    templateType?: string
    activeFileContent?: string
    fileTree?: (TFile | TFolder)[]
    contextContent?: string
    projectName?: string
    isEditMode?: boolean
  }
) {
  const user = await currentUser()
  if (!user) {
    throw new Error("Unauthorized")
  }

  const stream = createStreamableValue("")

  ;(async () => {
    try {
      const aiClient = await createAIClient({
        userId: user.id,
        projectId: context?.projectName,
        tools: defaultTools,
        disableTools: context?.isEditMode,
      })

      const response = await aiClient.chat({
        messages,
        mode: context?.isEditMode ? "edit" : "chat",
        maxSteps: 3,
        context: {
          userId: user.id,
          projectId: context?.projectName,
          templateType: context?.templateType,
          activeFile: context?.activeFileContent,
          fileTree: context?.fileTree,
          contextContent: context?.contextContent,
        },
        stream: true,
      })

      if (response.body) {
        for await (const chunk of StreamHandler.parseStream(response.body)) {
          stream.update(chunk)
        }
      }

      stream.done()
    } catch (error) {
      stream.error(error)
    }
  })()

  return { output: stream.value }
}

export async function merge(
  originalCode: string,
  newCode: string,
  fileName?: string,
  context?: {
    templateType?: string
    projectName?: string
  }
): Promise<string> {
  const user = await currentUser()
  if (!user) {
    throw new Error("Unauthorized")
  }

  try {
    const openaiProvider = createAIProvider({
      provider: "openai",
      modelId: "gpt-4o-mini",
    })

    // Create AI client with OpenAI provider
    const aiClient = await AIClient.create({
      userId: user.id,
      projectId: context?.projectName,
      provider: openaiProvider,
    })

    const mergedCode = `Original file (${
      fileName || "unknown"
    }):\n${originalCode}\n\nNew code to merge:\n${newCode}`

    const response = await aiClient.merge({
      messages: [
        {
          role: "user",
          content: mergedCode,
        },
      ],
      context: {
        userId: user.id,
        projectId: context?.projectName,
        templateType: context?.templateType,
        activeFile: fileName,
      },
      stream: false,
    })

    const responseData = await response.json()
    return responseData.content || ""
  } catch (error) {
    throw error
  }
}
