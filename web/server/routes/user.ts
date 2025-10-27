import { createRouter } from "@/lib/api/create-app"
import jsonContent from "@/lib/api/utils"
import { db } from "@gitwit/db"
import {
  type Sandbox,
  user,
  userInsertSchema,
  type UsersToSandboxes,
  userUpdateSchema,
} from "@gitwit/db/schema"
import { eq, sql } from "drizzle-orm"
import { describeRoute } from "hono-openapi"
import { validator as zValidator } from "hono-openapi/zod"
import z from "zod"

interface SandboxWithLiked extends Sandbox {
  liked: boolean
}

// Transform apiKeys from encrypted storage format to "has" boolean format for client
function transformApiKeys(apiKeys: any) {
  if (!apiKeys || typeof apiKeys !== "object") {
    return undefined
  }
  return {
    hasAnthropic: !!apiKeys.anthropic,
    hasOpenai: !!apiKeys.openai,
    hasOpenrouter: !!apiKeys.openrouter,
    hasAws: !!(apiKeys.awsAccessKeyId && apiKeys.awsSecretAccessKey),
  }
}
export const openUserRouter = createRouter().get(
  "/profile",
  describeRoute({
    tags: ["User"],
    description: "Get user profile",
    responses: {
      200: jsonContent(z.object({}), "User profile response"),
    },
  }),
  zValidator(
    "query",
    z.object({
      username: z.string().optional(),
    })
  ),
  async (c) => {
    const { username } = c.req.valid("query")
    if (!username) {
      return c.json({ success: false, message: "Username is required" }, 400)
    }
    const res = await db.query.user.findFirst({
      where: (user, { eq }) => eq(user.username, username),
      with: {
        sandbox: {
          orderBy: (sandbox: any, { desc }) => [desc(sandbox.createdAt)],
          with: {
            likes: true,
          },
        },
        usersToSandboxes: true,
      },
    })
    if (!res) {
      return c.json({ success: false, message: "User not found" }, 404)
    }
    const transformedUser = {
      ...res,
      apiKeys: transformApiKeys(res.apiKeys),
      usersToSandboxes: res.usersToSandboxes as UsersToSandboxes[],
      sandbox: (res.sandbox as Sandbox[]).map(
        (sb: any): SandboxWithLiked => ({
          ...sb,
          liked: sb.likes.some((like: any) => like.userId === res.id),
        })
      ),
    }
    return c.json(
      { success: true, message: "User found", data: transformedUser },
      200
    )
  }
)
export const userRouter = createRouter()
  // #region GET /
  .get(
    "/",
    describeRoute({
      tags: ["User"],
      description: "Get user data",
      responses: {
        200: jsonContent(z.object({}), "User data response"),
      },
    }),
    zValidator(
      "query",
      z.object({
        username: z.string().optional(),
        id: z.string().optional().openapi({
          description: "Unique identifier for the user",
          example: "user_12345",
        }),
      })
    ),
    async (c) => {
      const userId = c.get("user").id
      const { username, id } = c.req.valid("query")
      if (username) {
        const userId = c.get("user")?.id
        const res = await db.query.user.findFirst({
          where: (user, { eq }) => eq(user.username, username),
          with: {
            sandbox: {
              orderBy: (sandbox: any, { desc }) => [desc(sandbox.createdAt)],
              with: {
                likes: true,
              },
            },
            usersToSandboxes: true,
          },
        })
        if (!res) {
          return c.json({ success: false, message: "User not found" }, 404)
        }
        const transformedUser = {
          ...res,
          apiKeys: transformApiKeys(res.apiKeys),
          usersToSandboxes: res.usersToSandboxes as UsersToSandboxes[],
          sandbox: (res.sandbox as Sandbox[]).map(
            (sb: any): SandboxWithLiked => ({
              ...sb,
              liked: sb.likes.some((like: any) => like.userId === userId),
            })
          ),
        }
        return c.json(
          { success: true, message: "User found ", data: transformedUser },
          200
        )
      }
      const res = await db.query.user.findFirst({
        where: (user, { eq }) => eq(user.id, id ?? userId),
        with: {
          sandbox: {
            orderBy: (sandbox: any, { desc }) => [desc(sandbox.createdAt)],
            with: {
              likes: true,
            },
          },
          usersToSandboxes: true,
        },
      })
      if (!res) {
        return c.json({ success: false, message: "User not found" }, 404)
      }
      const transformedUser = {
        ...res,
        apiKeys: transformApiKeys(res.apiKeys),
        usersToSandboxes: res.usersToSandboxes as UsersToSandboxes[],
        sandbox: (res.sandbox as Sandbox[]).map(
          (sb: any): SandboxWithLiked => ({
            ...sb,
            liked: sb.likes.some((like: any) => like.userId === (id ?? userId)),
          })
        ),
      }
      return c.json(
        { success: true, message: "User found ", data: transformedUser },
        200
      )
    }
  )
  // #endregion
  // #region POST /
  .post(
    "/",
    describeRoute({
      tags: ["User"],
      description: "Persist clerk user data",
      responses: {
        200: jsonContent(z.object({}), "User data response"),
      },
    }),
    zValidator("json", userInsertSchema),
    async (c) => {
      const data = c.req.valid("json")
      const res = (
        await db
          .insert(user)
          .values({
            ...data,
            createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
            tierExpiresAt: data.tierExpiresAt
              ? new Date(data.tierExpiresAt)
              : new Date(),
            lastResetDate: data.lastResetDate
              ? new Date(data.lastResetDate)
              : new Date(),
          })
          .returning()
      )[0]
      return c.json({ res }, 200)
    }
  )
  // #endregion
  // #region DELETE /
  .delete(
    "/",
    describeRoute({
      tags: ["User"],
      description: "Get user data",
      responses: {
        200: jsonContent(z.object({}), "User data response"),
      },
    }),
    zValidator(
      "query",
      z.object({
        id: z.string().openapi({
          description: "Unique identifier for the user to be deleted",
          example: "user_12345",
        }),
      })
    ),
    async (c) => {
      const { id } = c.req.valid("query")
      await db.delete(user).where(eq(user.id, id))
      return c.json(
        {
          success: true,
          message: "User deleted successfully",
        },
        200
      )
    }
  )
  // #endregion
  // #region PATCH /
  .patch(
    "/",
    describeRoute({
      tags: ["User"],
      description: "Update user data",
      responses: {
        200: jsonContent(z.object({}), "User data response"),
      },
    }),
    zValidator(
      "json",
      userUpdateSchema.extend({
        id: z.string().openapi({
          description: "Unique identifier for the user to be updated",
          example: "user_12345",
        }),
      })
    ),
    async (c) => {
      const { id, username, ...updateData } = c.req.valid("json")

      // If username is being updated, check for existing username
      if (username) {
        const existingUser = (
          await db.select().from(user).where(eq(user.username, username))
        )[0]
        if (existingUser && existingUser.id !== id) {
          return c.json({ error: "Username already exists" }, 409)
        }
      }

      const cleanUpdateData = {
        ...updateData,
        ...(username ? { username } : {}),
      }

      const res = (
        await db
          .update(user)
          .set(cleanUpdateData)
          .where(eq(user.id, id))
          .returning()
      )[0]

      if (!res) {
        return c.json({ success: false, message: "User not found" }, 404)
      }

      return c.json({ res })
    }
  )
  // #endregion
  // #region GET /api-keys
  .get(
    "/api-keys",
    describeRoute({
      tags: ["User"],
      description:
        "Get user's API key configuration (returns which providers are configured, not the keys themselves)",
      responses: {
        200: jsonContent(
          z.object({
            hasAnthropic: z.boolean(),
            anthropicModel: z.string().optional(),
            hasOpenai: z.boolean(),
            openaiModel: z.string().optional(),
            hasOpenrouter: z.boolean(),
            openrouterModel: z.string().optional(),
            hasAws: z.boolean(),
            awsModel: z.string().optional(),
          }),
          "API keys configuration response"
        ),
      },
    }),
    async (c) => {
      const userId = c.get("user").id

      const userRecord = await db.query.user.findFirst({
        where: (user, { eq }) => eq(user.id, userId),
      })

      if (!userRecord) {
        return c.json({ error: "User not found" }, 404)
      }

      const apiKeys = (userRecord.apiKeys || {}) as Record<string, string>

      return c.json({
        hasAnthropic: !!apiKeys.anthropic,
        anthropicModel: apiKeys.anthropicModel,
        hasOpenai: !!apiKeys.openai,
        openaiModel: apiKeys.openaiModel,
        hasOpenrouter: !!apiKeys.openrouter,
        openrouterModel: apiKeys.openrouterModel,
        hasAws: !!(apiKeys.awsAccessKeyId && apiKeys.awsSecretAccessKey),
        awsModel: apiKeys.awsModel,
      })
    }
  )
  // #endregion
  // #region PUT /api-keys
  .put(
    "/api-keys",
    describeRoute({
      tags: ["User"],
      description: "Update user's API keys (keys are encrypted before storage)",
      responses: {
        200: jsonContent(
          z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          "API keys update response"
        ),
      },
    }),
    zValidator(
      "json",
      z.object({
        provider: z.enum(["anthropic", "openai", "openrouter", "aws"]),
        apiKey: z.string().optional(),
        modelId: z.string().optional(),
        awsAccessKeyId: z.string().optional(),
        awsSecretAccessKey: z.string().optional(),
        awsRegion: z.string().optional(),
      })
    ),
    async (c) => {
      const userId = c.get("user").id
      const {
        provider,
        apiKey,
        modelId,
        awsAccessKeyId,
        awsSecretAccessKey,
        awsRegion,
      } = c.req.valid("json")

      const userRecord = await db.query.user.findFirst({
        where: (user, { eq }) => eq(user.id, userId),
      })

      if (!userRecord) {
        return c.json({ error: "User not found" }, 404)
      }

      const currentApiKeys = (userRecord.apiKeys || {}) as Record<
        string,
        string
      >
      const { encrypt } = await import("@gitwit/lib/utils/encryption")

      // Update the appropriate keys based on provider
      if (provider === "aws") {
        if (awsAccessKeyId)
          currentApiKeys.awsAccessKeyId = encrypt(awsAccessKeyId)
        if (awsSecretAccessKey)
          currentApiKeys.awsSecretAccessKey = encrypt(awsSecretAccessKey)
        if (awsRegion) currentApiKeys.awsRegion = awsRegion // Region doesn't need encryption
        if (modelId) currentApiKeys.awsModel = modelId // Store model ID
      } else {
        if (apiKey) {
          currentApiKeys[provider] = encrypt(apiKey)
        }
        if (modelId) {
          currentApiKeys[`${provider}Model`] = modelId // Store model ID for provider
        }
      }

      await db
        .update(user)
        .set({ apiKeys: currentApiKeys })
        .where(eq(user.id, userId))

      return c.json({
        success: true,
        message: "API keys updated successfully",
      })
    }
  )
  // #endregion
  // #region DELETE /api-keys/:provider
  .delete(
    "/api-keys/:provider",
    describeRoute({
      tags: ["User"],
      description: "Delete a specific provider's API key",
      responses: {
        200: jsonContent(
          z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          "API key deletion response"
        ),
      },
    }),
    zValidator(
      "param",
      z.object({
        provider: z.enum(["anthropic", "openai", "openrouter", "aws"]),
      })
    ),
    async (c) => {
      const userId = c.get("user").id
      const { provider } = c.req.valid("param")

      const userRecord = await db.query.user.findFirst({
        where: (user, { eq }) => eq(user.id, userId),
      })

      if (!userRecord) {
        return c.json({ error: "User not found" }, 404)
      }

      const currentApiKeys = (userRecord.apiKeys || {}) as Record<
        string,
        string
      >

      // Remove the appropriate keys based on provider
      if (provider === "aws") {
        delete currentApiKeys.awsAccessKeyId
        delete currentApiKeys.awsSecretAccessKey
        delete currentApiKeys.awsRegion
        delete currentApiKeys.awsModel
      } else {
        delete currentApiKeys[provider]
        delete currentApiKeys[`${provider}Model`]
      }

      await db
        .update(user)
        .set({ apiKeys: currentApiKeys })
        .where(eq(user.id, userId))

      return c.json({
        success: true,
        message: `${provider} API key deleted successfully`,
      })
    }
  )
  // #endregion
  // #region GET /check-username
  .get(
    "/check-username",
    describeRoute({
      tags: ["User"],
      description: "Check if a username exists",
      responses: {
        200: jsonContent(
          z.object({
            exists: z.boolean(),
          }),
          "Username check response"
        ),
      },
    }),
    zValidator(
      "query",
      z.object({
        username: z.string().openapi({
          description: "Username to check for existence",
          example: "john_doe",
        }),
      })
    ),
    async (c) => {
      const { username } = c.req.valid("query")
      const exists = await db.query.user.findFirst({
        where: (user, { eq }) => eq(user.username, username),
      })
      return c.json({ exists: !!exists }, 200)
    }
  )
  // #endregion
  // #region POST /increment-generations
  .post(
    "/increment-generations",
    describeRoute({
      tags: ["User"],
      description: "Increment user generations count",
      responses: {
        200: jsonContent(z.object({}), "Increment response"),
      },
    }),
    zValidator(
      "json",
      z.object({
        userId: z.string().openapi({
          description:
            "ID of the user whose generations count will be incremented",
          example: "user_12345",
        }),
      })
    ),
    async (c) => {
      const { userId } = c.req.valid("json")
      await db
        .update(user)
        .set({ generations: sql`${user.generations} + 1` })
        .where(eq(user.id, userId))
      return c.json({ success: true, message: "AI generations increased" }, 200)
    }
  )
  // #endregion
  // #region POST /update-tier
  .post(
    "/update-tier",
    describeRoute({
      tags: ["User"],
      description: "Update user tier and reset generations",
      responses: {
        200: jsonContent(z.object({}), "Tier update response"),
      },
    }),
    zValidator(
      "json",
      z.object({
        userId: z.string().openapi({
          description: "ID of the user whose tier will be updated",
          example: "user_12345",
        }),
        tier: z.enum(["FREE", "PRO", "ENTERPRISE"]).openapi({
          description: "New tier for the user",
        }),
        tierExpiresAt: z.coerce.date().openapi({
          description: "Expiration date for the new tier",
        }),
      })
    ),
    async (c) => {
      const { userId, tier, tierExpiresAt } = c.req.valid("json")
      await db
        .update(user)
        .set({
          tier,
          tierExpiresAt,
          generations: 0, // Reset generations when upgrading tier
        })
        .where(eq(user.id, userId))
      return c.json({ success: true, message: "User tier updated" }, 200)
    }
  )
  // #endregion
  // #region POST /check-reset
  .post(
    "/check-reset",
    describeRoute({
      tags: ["User"],
      description: "Check if user can reset generations",
      responses: {
        200: jsonContent(z.object({}), "Reset check response"),
      },
    }),
    zValidator(
      "json",
      z.object({
        userId: z.string().openapi({
          description: "ID of the user to check for reset eligibility",
          example: "user_12345",
        }),
      })
    ),
    async (c) => {
      const { userId } = c.req.valid("json")
      const dbUser = await db.query.user.findFirst({
        where: (user, { eq }) => eq(user.id, userId),
      })

      if (!dbUser) {
        return c.json({ error: "User not found" }, 404)
      }

      const now = new Date()
      const lastReset = dbUser.lastResetDate
        ? new Date(dbUser.lastResetDate)
        : new Date(0)

      if (
        now.getMonth() !== lastReset.getMonth() ||
        now.getFullYear() !== lastReset.getFullYear()
      ) {
        await db
          .update(user)
          .set({
            generations: 0,
            lastResetDate: now,
          })
          .where(eq(user.id, userId))
        return c.json({ success: true, message: "Reset successful" }, 200)
      }

      return c.json(
        { success: false, message: "Already reset this month" },
        400
      )
    }
  )
  // #endregion
  // #region GET /available-models
  .get(
    "/available-models",
    describeRoute({
      tags: ["User"],
      description:
        "Get available AI models based on user's configured API keys",
      responses: {
        200: jsonContent(
          z.object({
            models: z.array(
              z.object({
                id: z.string(),
                name: z.string(),
                provider: z.string(),
              })
            ),
            defaultModel: z.string().optional(),
            selectedProvider: z.string().optional(),
          }),
          "Available models response"
        ),
      },
    }),
    async (c) => {
      const userId = c.get("user").id

      const userRecord = await db.query.user.findFirst({
        where: (user, { eq }) => eq(user.id, userId),
      })

      if (!userRecord) {
        return c.json({ error: "User not found" }, 404)
      }

      const apiKeys = (userRecord.apiKeys || {}) as Record<string, string>
      const models: Array<{ id: string; name: string; provider: string }> = []
      let defaultModel: string | undefined

      // Import available models list
      const { AVAILABLE_MODELS, DEFAULT_MODELS } = await import(
        "@/lib/available-models"
      )

      // Helper function to check if a model ID already exists in the models array
      const modelExists = (modelId: string) =>
        models.some((m) => m.id === modelId)

      // Priority order: OpenRouter > Anthropic > OpenAI > AWS > Default

      // Add models for OpenAI and Anthropic (dropdown list)
      if (apiKeys.openai) {
        // Add predefined models
        AVAILABLE_MODELS.openai.forEach((model) => {
          models.push({ ...model, provider: "openai" })
        })

        // Add custom model if user specified one in settings and it's not already in the list
        const customModel = apiKeys.openaiModel
        if (customModel && !modelExists(customModel)) {
          models.push({
            id: customModel,
            name: customModel,
            provider: "openai",
          })
        }
      }

      if (apiKeys.anthropic) {
        // Add predefined models
        AVAILABLE_MODELS.anthropic.forEach((model) => {
          models.push({ ...model, provider: "anthropic" })
        })

        // Add custom model if user specified one in settings and it's not already in the list
        const customModel = apiKeys.anthropicModel
        if (customModel && !modelExists(customModel)) {
          models.push({
            id: customModel,
            name: customModel,
            provider: "anthropic",
          })
        }
      }

      // For OpenRouter and AWS, show custom model or default
      if (apiKeys.openrouter) {
        const customModel = apiKeys.openrouterModel
        if (customModel) {
          models.push({
            id: customModel,
            name: customModel,
            provider: "openrouter",
          })
        } else {
          // Provide a default OpenRouter model if none specified
          models.push({
            id: DEFAULT_MODELS.openrouter.id,
            name: DEFAULT_MODELS.openrouter.name,
            provider: "openrouter",
          })
        }
      }

      if (apiKeys.awsAccessKeyId && apiKeys.awsSecretAccessKey) {
        const customModel = apiKeys.awsModel
        if (customModel) {
          models.push({
            id: customModel,
            name: customModel,
            provider: "aws",
          })
        } else {
          // Provide a default AWS Bedrock model if none specified
          models.push({
            id: DEFAULT_MODELS.aws.id,
            name: DEFAULT_MODELS.aws.name,
            provider: "aws",
          })
        }
      }

      // Determine default model based on last selected model
      // This ensures the user's last selection is preserved
      let selectedProvider: string | undefined

      if (apiKeys.lastSelectedModel && apiKeys.lastSelectedProvider) {
        defaultModel = apiKeys.lastSelectedModel
        selectedProvider = apiKeys.lastSelectedProvider
      } else {
        // Fallback to priority order if no last selection
        // Priority: OpenRouter > Anthropic > OpenAI > AWS
        if (apiKeys.openrouter) {
          defaultModel = apiKeys.openrouterModel || DEFAULT_MODELS.openrouter.id
          selectedProvider = "openrouter"
        } else if (apiKeys.anthropic) {
          defaultModel =
            apiKeys.anthropicModel ||
            models.find((m) => m.provider === "anthropic")?.id
          selectedProvider = "anthropic"
        } else if (apiKeys.openai) {
          defaultModel =
            apiKeys.openaiModel ||
            models.find((m) => m.provider === "openai")?.id
          selectedProvider = "openai"
        } else if (apiKeys.awsAccessKeyId && apiKeys.awsSecretAccessKey) {
          defaultModel = apiKeys.awsModel || DEFAULT_MODELS.aws.id
          selectedProvider = "aws"
        } else if (models.length > 0) {
          // If models exist but no specific model selected, use first available
          defaultModel = models[0].id
          selectedProvider = models[0].provider
        }
      }

      // If no API keys configured at all, show "Default"
      if (models.length === 0) {
        defaultModel = "Default"
      }

      return c.json({
        models,
        defaultModel,
        selectedProvider,
      })
    }
  )
  // #endregion
  // #region PUT /selected-model
  .put(
    "/selected-model",
    describeRoute({
      tags: ["User"],
      description: "Update user's selected AI model",
      responses: {
        200: jsonContent(
          z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          "Selected model update response"
        ),
      },
    }),
    zValidator(
      "json",
      z.object({
        provider: z.enum(["anthropic", "openai", "openrouter", "aws"]),
        modelId: z.string(),
      })
    ),
    async (c) => {
      const userId = c.get("user").id
      const { provider, modelId } = c.req.valid("json")

      const userRecord = await db.query.user.findFirst({
        where: (user, { eq }) => eq(user.id, userId),
      })

      if (!userRecord) {
        return c.json({ error: "User not found" }, 404)
      }

      const currentApiKeys = (userRecord.apiKeys || {}) as Record<
        string,
        string
      >

      // Update the model for the specific provider
      if (provider === "aws") {
        currentApiKeys.awsModel = modelId
      } else {
        currentApiKeys[`${provider}Model`] = modelId
      }

      // Track the last selected provider and model to prioritize it
      currentApiKeys.lastSelectedProvider = provider
      currentApiKeys.lastSelectedModel = modelId

      await db
        .update(user)
        .set({ apiKeys: currentApiKeys })
        .where(eq(user.id, userId))

      return c.json({
        success: true,
        message: "Selected model updated successfully",
      })
    }
  )
// #endregion
