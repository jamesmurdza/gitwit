"use server"

import { defaultTools } from "@/lib/ai/tools"
import { TFile, TFolder } from "@/lib/types"
import { currentUser } from "@clerk/nextjs/server"
import { StreamHandler, createAIClient } from "@gitwit/ai"
import { createStreamableValue } from "ai/rsc"
import { templateConfigs } from "@gitwit/templates"

export async function streamChat(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  context?: {
    templateType?: string
    activeFileContent?: string
    fileTree?: (TFile | TFolder)[]
    contextContent?: string
    projectId?: string
    projectName?: string
    fileName?: string
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
        projectId: context?.projectId,
        projectName: context?.projectName,
        fileName: context?.fileName,
        tools: defaultTools,
        disableTools: context?.isEditMode,
        providerConfig: {
          provider: "anthropic",
          modelId: "claude-sonnet-4-20250514",
        },
      })

      const response = await aiClient.chat({
        messages,
        mode: context?.isEditMode ? "edit" : "chat",
        maxSteps: 3,
        context: {
          userId: user.id,
          projectId: context?.projectId,
          projectName: context?.projectName,
          fileName: context?.fileName,
          templateType: context?.templateType,
          activeFile: context?.activeFileContent,
          fileTree: context?.fileTree,
          contextContent: context?.contextContent,
          templateConfigs: templateConfigs,
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
