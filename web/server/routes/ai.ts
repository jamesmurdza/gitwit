import { createRouter } from "@/lib/api/create-app"
import { getUserProviderConfig } from "@/lib/ai/helpers"
import { defaultTools } from "@/lib/ai/tools"
import { createModel, buildPrompt, mergeAiderDiff } from "@gitwit/ai"
import type { FileTree } from "@gitwit/ai"
import { templateConfigs } from "@gitwit/templates"
import { streamText as honoStream } from "hono/streaming"
import { streamText, generateText } from "ai"
import { zValidator } from "@hono/zod-validator"
import z from "zod"

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
})

const contextSchema = z
  .object({
    templateType: z.string().optional(),
    activeFileContent: z.string().optional(),
    fileTree: z.array(z.unknown()).optional(),
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
      const model = createModel(providerConfig)

      const system = buildPrompt({
        mode: "chat",
        templateType: context?.templateType,
        templateConfigs,
        fileTree: context?.fileTree as FileTree[],
        activeFileContent: context?.activeFileContent,
        contextContent: context?.contextContent,
      })

      const result = streamText({
        model,
        system,
        messages,
        tools: defaultTools,
        maxSteps: 1,
      })

      return honoStream(c, async (stream) => {
        try {
          for await (const chunk of result.textStream) {
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
      const model = createModel(providerConfig)

      const system = buildPrompt({
        mode: "edit",
        fileName: context?.fileName,
        activeFileContent: context?.activeFileContent,
      })

      const result = await generateText({
        model,
        system,
        messages,
        maxSteps: 1,
      })

      return c.json({ content: result.text })
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
