import { AVAILABLE_MODELS, DEFAULT_MODELS } from "@/lib/available-models"
import { AIProviderConfig } from "@gitwit/ai"
import { db } from "@gitwit/db"
import { user as userTable } from "@gitwit/db/schema"
import { decrypt } from "@gitwit/lib/utils/encryption"
import { eq } from "drizzle-orm"

/**
 * Fetch and decrypt user's custom API keys, returning provider configuration
 * Falls back to system environment variables if user hasn't configured custom keys
 */
export async function getUserProviderConfig(
    userId: string
  ): Promise<Partial<AIProviderConfig> | undefined> {
    try {
      const userRecord = await db.query.user.findFirst({
        where: eq(userTable.id, userId),
      })

      if (!userRecord || !userRecord.apiKeys) {
        return undefined // Will use system defaults
      }

      const encryptedKeys = userRecord.apiKeys as Record<string, string>

      // Decrypt keys if they exist
      let anthropicKey: string | undefined
      let openaiKey: string | undefined
      let openrouterKey: string | undefined
      let awsAccessKey: string | undefined
      let awsSecretKey: string | undefined
      let awsRegion: string | undefined

      if (encryptedKeys.anthropic) {
        anthropicKey = decrypt(encryptedKeys.anthropic)
      }
      if (encryptedKeys.openai) {
        openaiKey = decrypt(encryptedKeys.openai)
      }
      if (encryptedKeys.openrouter) {
        openrouterKey = decrypt(encryptedKeys.openrouter)
      }
      if (encryptedKeys.awsAccessKeyId && encryptedKeys.awsSecretAccessKey) {
        awsAccessKey = decrypt(encryptedKeys.awsAccessKeyId)
        awsSecretKey = decrypt(encryptedKeys.awsSecretAccessKey)
        awsRegion = encryptedKeys.awsRegion // Region is not encrypted
      }

      // Determine provider based on which model was LAST selected by the user
      // This ensures the user's choice is respected when multiple providers are configured

      // Check for last selected provider/model first
      if (encryptedKeys.lastSelectedProvider && encryptedKeys.lastSelectedModel) {
        const provider = encryptedKeys.lastSelectedProvider
        const modelId = encryptedKeys.lastSelectedModel

        if (provider === "openai" && openaiKey) {
          return {
            provider: "openai",
            apiKey: openaiKey,
            modelId: modelId,
          }
        } else if (provider === "anthropic" && anthropicKey) {
          return {
            provider: "anthropic",
            apiKey: anthropicKey,
            modelId: modelId,
          }
        } else if (provider === "openrouter" && openrouterKey) {
          return {
            provider: "openrouter",
            apiKey: openrouterKey,
            modelId: modelId,
          }
        } else if (provider === "aws" && awsAccessKey && awsSecretKey) {
          return {
            provider: "bedrock",
            region: awsRegion || "us-east-1",
            modelId: modelId,
          }
        }
      }

      // Fallback: Check if any provider has a model selected (for backward compatibility)
      if (encryptedKeys.openaiModel && openaiKey) {
        return {
          provider: "openai",
          apiKey: openaiKey,
          modelId: encryptedKeys.openaiModel,
        }
      }

      if (encryptedKeys.anthropicModel && anthropicKey) {
        return {
          provider: "anthropic",
          apiKey: anthropicKey,
          modelId: encryptedKeys.anthropicModel,
        }
      }

      if (encryptedKeys.openrouterModel && openrouterKey) {
        return {
          provider: "openrouter",
          apiKey: openrouterKey,
          modelId: encryptedKeys.openrouterModel,
        }
      }

      if (encryptedKeys.awsModel && awsAccessKey && awsSecretKey) {
        return {
          provider: "bedrock",
          region: awsRegion || "us-east-1",
          modelId: encryptedKeys.awsModel,
        }
      }

      // Fallback: If no specific model selected, use priority order
      // Priority: OpenRouter > Anthropic > OpenAI > AWS
      if (openrouterKey) {
        return {
          provider: "openrouter",
          apiKey: openrouterKey,
          modelId: DEFAULT_MODELS.openrouter.id,
        }
      } else if (anthropicKey) {
        return {
          provider: "anthropic",
          apiKey: anthropicKey,
          modelId: AVAILABLE_MODELS.anthropic[0].id,
        }
      } else if (openaiKey) {
        return {
          provider: "openai",
          apiKey: openaiKey,
          modelId: AVAILABLE_MODELS.openai[0].id,
        }
      } else if (awsAccessKey && awsSecretKey) {
        return {
          provider: "bedrock",
          region: awsRegion || "us-east-1",
          modelId: DEFAULT_MODELS.aws.id,
        }
      }

      return undefined // No custom keys configured, use system defaults
    } catch (error) {
      console.error("Failed to fetch user API keys:", error)
      return undefined // Fall back to system defaults on error
    }
  }
