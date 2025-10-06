"use server"

import { defaultTools } from "@/lib/ai/tools"
import { TFile, TFolder } from "@/lib/types"
import { currentUser } from "@clerk/nextjs/server"
import { AIMessage, createAIClient } from "@gitwit/ai"
import { templateConfigs } from "@gitwit/templates"

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

  const aiClient = await createAIClient({
    userId: user.id,
    projectId: context?.projectId,
    projectName: context?.projectName,
    fileName: context?.fileName,
    tools: defaultTools,
    disableTools: false,
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

  const aiClient = await createAIClient({
    userId: user.id,
    projectId: context?.projectId,
    projectName: context?.projectName,
    fileName: context?.fileName,
    tools: defaultTools,
    disableTools: true, // Tools disabled for edit mode
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
