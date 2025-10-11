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

  const aiClient = await createAIClient({
    userId: user.id,
    projectId: projectId,
    tools: {},
    disableTools: true,
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
