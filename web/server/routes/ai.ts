import { createRouter } from "@/lib/api/create-app"
import { getUserProviderConfig } from "@/lib/ai/helpers"
import { defaultTools } from "@/lib/ai/tools"
import { createAIClient, AIMessage, mergeAiderDiff } from "@gitwit/ai"
import { templateConfigs } from "@gitwit/templates"
import { streamText } from "hono/streaming"
import { validator as zValidator } from "hono-openapi/zod"
import z from "zod"

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  context: z.any().optional(),
})

const contextSchema = z
  .object({
    templateType: z.string().optional(),
    activeFileContent: z.string().optional(),
    fileTree: z.array(z.any()).optional(),
    contextContent: z.string().optional(),
    projectId: z.string().optional(),
    projectName: z.string().optional(),
    fileName: z.string().optional(),
  })
  .optional()

export const aiRouter = createRouter()
  // #region POST /stream-chat
  .post(
    "/stream-chat",
    zValidator(
      "json",
      z.object({
        messages: z.array(messageSchema),
        context: contextSchema,
      })
    ),
    async (c) => {
      const { messages, context } = c.req.valid("json")
      const userId = c.get("user").id

      const providerConfig = await getUserProviderConfig(userId)

      const client = createAIClient({
        userId,
        projectId: context?.projectId,
        projectName: context?.projectName,
        fileName: context?.fileName,
        tools: defaultTools,
        providerConfig,
        templateType: context?.templateType,
        fileTree: context?.fileTree,
        templateConfigs: templateConfigs,
      })

      return streamText(c, async (stream) => {
        try {
          for await (const chunk of client.streamChat({
            messages: messages as AIMessage[],
            context: context?.contextContent,
            activeFileContent: context?.activeFileContent,
          })) {
            await stream.write(chunk)
          }
        } catch (error) {
          console.error("Stream chat failed", error)
          await stream.write(
            `\n[ERROR] ${error instanceof Error ? error.message : "Stream failed"}`
          )
        }
      })
    }
  )
  // #endregion

  // #region POST /process-edit
  .post(
    "/process-edit",
    zValidator(
      "json",
      z.object({
        messages: z.array(messageSchema),
        context: contextSchema,
      })
    ),
    async (c) => {
      const { messages, context } = c.req.valid("json")
      const userId = c.get("user").id

      const providerConfig = await getUserProviderConfig(userId)

      const client = createAIClient({
        userId,
        projectId: context?.projectId,
        projectName: context?.projectName,
        fileName: context?.fileName,
        tools: defaultTools,
        disableTools: true,
        providerConfig,
      })

      const result = await client.processEdit({
        messages: messages as AIMessage[],
        activeFileContent: context?.activeFileContent,
      })

      return c.json(result)
    }
  )
  // #endregion

  // #region POST /merge-code
  .post(
    "/merge-code",
    zValidator(
      "json",
      z.object({
        partialCode: z.string(),
        originalCode: z.string(),
        fileName: z.string(),
        projectId: z.string().optional(),
      })
    ),
    async (c) => {
      const { partialCode, originalCode, fileName } = c.req.valid("json")

      try {
        const mergedCode = mergeAiderDiff(originalCode, partialCode, fileName)
        return c.json({ mergedCode })
      } catch (error) {
        console.error("Code merge failed:", error)
        return c.json({ mergedCode: originalCode })
      }
    }
  )
// #endregion
