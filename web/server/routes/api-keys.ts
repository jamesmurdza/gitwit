import {
  decrypt,
  encrypt,
  validateApiKeyFormat,
} from "@/../../lib/utils/crypto"
import { createRouter } from "@/lib/api/create-app"
import jsonContent from "@/lib/api/utils"
import { db } from "@gitwit/db"
import { env } from "@gitwit/db/env"
import { user } from "@gitwit/db/schema"
import { eq } from "drizzle-orm"
import { describeRoute } from "hono-openapi"
import { validator as zValidator } from "hono-openapi/zod"
import z from "zod"

const apiKeyProviderSchema = z.enum(["anthropic", "openai"])

export const apiKeysRouter = createRouter()
  // #region GET /
  .get(
    "/",
    describeRoute({
      tags: ["API Keys"],
      description: "Get user's API keys (decrypted)",
      responses: {
        200: jsonContent(
          z.object({
            success: z.boolean(),
            data: z
              .object({
                anthropic: z.string().nullable(),
                openai: z.string().nullable(),
              })
              .optional(),
            message: z.string().optional(),
          }),
          "API keys response"
        ),
      },
    }),
    async (c) => {
      const userId = c.get("user").id

      const dbUser = await db.query.user.findFirst({
        where: (user, { eq }) => eq(user.id, userId),
      })

      if (!dbUser) {
        return c.json({ success: false, message: "User not found" }, 404)
      }

      // Decrypt API keys if they exist
      let anthropicKey = null
      let openaiKey = null

      try {
        if (dbUser.encryptedAnthropicKey && env.ENCRYPTION_KEY) {
          anthropicKey = decrypt(
            dbUser.encryptedAnthropicKey,
            env.ENCRYPTION_KEY
          )
        }
        if (dbUser.encryptedOpenAIKey && env.ENCRYPTION_KEY) {
          openaiKey = decrypt(dbUser.encryptedOpenAIKey, env.ENCRYPTION_KEY)
        }
      } catch (error) {
        console.error("Error decrypting API keys:", error)
        return c.json(
          { success: false, message: "Failed to decrypt API keys" },
          500
        )
      }

      return c.json(
        {
          success: true,
          data: {
            anthropic: anthropicKey,
            openai: openaiKey,
          },
        },
        200
      )
    }
  )
  // #endregion
  // #region PUT /
  .put(
    "/",
    describeRoute({
      tags: ["API Keys"],
      description: "Update user's API keys",
      responses: {
        200: jsonContent(
          z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          "Update response"
        ),
      },
    }),
    zValidator(
      "json",
      z.object({
        provider: apiKeyProviderSchema.openapi({
          description: "The API provider",
          example: "anthropic",
        }),
        apiKey: z.string().nullable().openapi({
          description: "The API key to store (null to remove)",
          example: "sk-ant-...",
        }),
      })
    ),
    async (c) => {
      const userId = c.get("user").id
      const { provider, apiKey } = c.req.valid("json")

      if (!env.ENCRYPTION_KEY) {
        return c.json(
          { success: false, message: "Encryption not configured" },
          500
        )
      }

      // Validate API key format if provided
      if (apiKey && !validateApiKeyFormat(apiKey, provider)) {
        return c.json(
          { success: false, message: "Invalid API key format" },
          400
        )
      }

      try {
        let updateData: any = {}

        if (provider === "anthropic") {
          if (apiKey) {
            const { encrypted, iv } = encrypt(apiKey, env.ENCRYPTION_KEY)
            updateData = {
              encryptedAnthropicKey: encrypted,
              apiKeyIv: iv,
            }
          } else {
            updateData = {
              encryptedAnthropicKey: null,
            }
          }
        } else if (provider === "openai") {
          if (apiKey) {
            const { encrypted, iv } = encrypt(apiKey, env.ENCRYPTION_KEY)
            updateData = {
              encryptedOpenAIKey: encrypted,
              apiKeyIv: iv,
            }
          } else {
            updateData = {
              encryptedOpenAIKey: null,
            }
          }
        }

        await db.update(user).set(updateData).where(eq(user.id, userId))

        return c.json(
          {
            success: true,
            message: apiKey
              ? `${provider} API key updated successfully`
              : `${provider} API key removed successfully`,
          },
          200
        )
      } catch (error) {
        console.error("Error updating API key:", error)
        return c.json(
          { success: false, message: "Failed to update API key" },
          500
        )
      }
    }
  )
  // #endregion
  // #region DELETE /:provider
  .delete(
    "/:provider",
    describeRoute({
      tags: ["API Keys"],
      description: "Delete a specific API key",
      responses: {
        200: jsonContent(
          z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          "Delete response"
        ),
      },
    }),
    zValidator(
      "param",
      z.object({
        provider: apiKeyProviderSchema.openapi({
          description: "The API provider",
          example: "anthropic",
        }),
      })
    ),
    async (c) => {
      const userId = c.get("user").id
      const { provider } = c.req.valid("param")

      try {
        let updateData: any = {}

        if (provider === "anthropic") {
          updateData = { encryptedAnthropicKey: null }
        } else if (provider === "openai") {
          updateData = { encryptedOpenAIKey: null }
        }

        await db.update(user).set(updateData).where(eq(user.id, userId))

        return c.json(
          {
            success: true,
            message: `${provider} API key deleted successfully`,
          },
          200
        )
      } catch (error) {
        console.error("Error deleting API key:", error)
        return c.json(
          { success: false, message: "Failed to delete API key" },
          500
        )
      }
    }
  )
  // #endregion
  // #region GET /status
  .get(
    "/status",
    describeRoute({
      tags: ["API Keys"],
      description: "Check which API keys are configured",
      responses: {
        200: jsonContent(
          z.object({
            success: z.boolean(),
            data: z.object({
              hasAnthropicKey: z.boolean(),
              hasOpenAIKey: z.boolean(),
              hasServiceKeys: z.boolean(),
            }),
          }),
          "API keys status response"
        ),
      },
    }),
    async (c) => {
      const userId = c.get("user").id

      const dbUser = await db.query.user.findFirst({
        where: (user, { eq }) => eq(user.id, userId),
      })

      const hasAnthropicKey = Boolean(dbUser?.encryptedAnthropicKey)
      const hasOpenAIKey = Boolean(dbUser?.encryptedOpenAIKey)
      const hasServiceKeys = Boolean(
        env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY
      )

      return c.json(
        {
          success: true,
          data: {
            hasAnthropicKey,
            hasOpenAIKey,
            hasServiceKeys,
          },
        },
        200
      )
    }
  )
// #endregion
