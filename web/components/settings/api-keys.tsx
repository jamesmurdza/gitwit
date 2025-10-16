"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient } from "@/server/client"
import { Check, ExternalLink, Eye, EyeOff, Key, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

type Provider = "anthropic" | "openai" | "openrouter" | "aws"

interface ProviderConfig {
  name: string
  description: string
  placeholder: string
  modelPlaceholder: string
  docsUrl: string
  dashboardUrl: string
}

const PROVIDERS: Record<Provider, ProviderConfig> = {
  anthropic: {
    name: "Anthropic (Claude)",
    description: "Use Claude models from Anthropic",
    placeholder: "sk-ant-...",
    modelPlaceholder: "claude-sonnet-4-20250514",
    docsUrl: "https://docs.anthropic.com/",
    dashboardUrl: "https://console.anthropic.com/settings/keys",
  },
  openai: {
    name: "OpenAI",
    description: "Use GPT models from OpenAI",
    placeholder: "sk-...",
    modelPlaceholder: "gpt-4o",
    docsUrl: "https://platform.openai.com/docs",
    dashboardUrl: "https://platform.openai.com/api-keys",
  },
  openrouter: {
    name: "OpenRouter",
    description: "Access multiple AI models through OpenRouter",
    placeholder: "sk-or-v1-...",
    modelPlaceholder: "anthropic/claude-sonnet-4-20250514",
    docsUrl: "https://openrouter.ai/docs",
    dashboardUrl: "https://openrouter.ai/keys",
  },
  aws: {
    name: "AWS Bedrock",
    description: "Use AWS Bedrock for AI models",
    placeholder: "Access Key ID",
    modelPlaceholder: "anthropic.claude-3-sonnet-20240229-v1:0",
    docsUrl: "https://docs.aws.amazon.com/bedrock/",
    dashboardUrl: "https://console.aws.amazon.com/bedrock/",
  },
}

export default function ApiKeysSettings() {
  const [configuredKeys, setConfiguredKeys] = useState({
    hasAnthropic: false,
    anthropicModel: undefined as string | undefined,
    hasOpenai: false,
    openaiModel: undefined as string | undefined,
    hasOpenrouter: false,
    openrouterModel: undefined as string | undefined,
    hasAws: false,
    awsModel: undefined as string | undefined,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadApiKeysStatus()
  }, [])

  const loadApiKeysStatus = async () => {
    try {
      const response = await apiClient.user["api-keys"].$get()
      if (response.ok) {
        const data = await response.json()
        setConfiguredKeys(data)
      }
    } catch (error) {
      console.error("Failed to load API keys status:", error)
      toast.error("Failed to load API keys configuration")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">API Keys</h2>
        <p className="text-muted-foreground">
          Configure your own API keys for AI providers. Your keys are encrypted
          and stored securely. If no custom keys are provided, system defaults
          will be used.
        </p>
      </div>

      <div className="grid gap-6">
        {(Object.entries(PROVIDERS) as [Provider, ProviderConfig][]).map(
          ([provider, config]) => {
            const isConfigured = (
              provider === "aws"
                ? configuredKeys.hasAws
                : configuredKeys[
                    `has${
                      provider.charAt(0).toLocaleUpperCase() + provider.slice(1)
                    }` as keyof typeof configuredKeys
                  ]
            ) as boolean

            const configuredModel =
              provider === "aws"
                ? configuredKeys.awsModel
                : configuredKeys[
                    `${provider}Model` as keyof typeof configuredKeys
                  ]

            return (
              <ProviderCard
                key={provider}
                provider={provider}
                config={config}
                isConfigured={isConfigured}
                configuredModel={configuredModel as string | undefined}
                onUpdate={loadApiKeysStatus}
              />
            )
          }
        )}
      </div>
    </div>
  )
}

interface ProviderCardProps {
  provider: Provider
  config: ProviderConfig
  isConfigured: boolean
  configuredModel?: string
  onUpdate: () => void
}

function ProviderCard({
  provider,
  config,
  isConfigured,
  configuredModel,
  onUpdate,
}: ProviderCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [modelId, setModelId] = useState("")
  const [awsAccessKeyId, setAwsAccessKeyId] = useState("")
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState("")
  const [awsRegion, setAwsRegion] = useState("us-east-1")
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleSave = async () => {
    if (provider === "aws") {
      if (!awsAccessKeyId || !awsSecretAccessKey) {
        toast.error(
          "Please provide both AWS Access Key ID and Secret Access Key"
        )
        return
      }
    } else {
      if (!apiKey) {
        toast.error("Please provide an API key")
        return
      }
    }

    setIsSaving(true)
    try {
      const response = await apiClient.user["api-keys"].$put({
        json: {
          provider,
          ...(provider === "aws"
            ? {
                awsAccessKeyId,
                awsSecretAccessKey,
                awsRegion,
                modelId: modelId || undefined,
              }
            : { apiKey, modelId: modelId || undefined }),
        },
      })

      if (response.ok) {
        toast.success(`${config.name} API key saved successfully`)
        setIsEditing(false)
        setApiKey("")
        setModelId("")
        setAwsAccessKeyId("")
        setAwsSecretAccessKey("")
        onUpdate()
      } else {
        const error = await response.text()
        toast.error(`Failed to save API key: ${error}`)
      }
    } catch (error) {
      console.error("Failed to save API key:", error)
      toast.error("Failed to save API key")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await apiClient.user["api-keys"][":provider"].$delete({
        param: { provider },
      })

      if (response.ok) {
        toast.success(`${config.name} API key deleted successfully`)
        onUpdate()
      } else {
        const error = await response.text()
        toast.error(`Failed to delete API key: ${error}`)
      }
    } catch (error) {
      console.error("Failed to delete API key:", error)
      toast.error("Failed to delete API key")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{config.name}</CardTitle>
              {isConfigured && !isEditing && (
                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <Check className="size-3" />
                  <span>Configured</span>
                </div>
              )}
            </div>
            <CardDescription>{config.description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="smIcon"
              asChild
              className="text-muted-foreground"
            >
              <a
                href={config.dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Get API Key"
              >
                <ExternalLink className="size-4" />
              </a>
            </Button>
            {isConfigured && !isEditing && (
              <Button
                variant="ghost"
                size="smIcon"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!isConfigured || isEditing ? (
          <div className="space-y-4">
            {provider === "aws" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor={`${provider}-access-key`}>
                    AWS Access Key ID
                  </Label>
                  <Input
                    id={`${provider}-access-key`}
                    type="text"
                    placeholder="AKIA..."
                    value={awsAccessKeyId}
                    onChange={(e) => setAwsAccessKeyId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${provider}-secret-key`}>
                    AWS Secret Access Key
                  </Label>
                  <div className="relative">
                    <Input
                      id={`${provider}-secret-key`}
                      type={showKey ? "text" : "password"}
                      placeholder="..."
                      value={awsSecretAccessKey}
                      onChange={(e) => setAwsSecretAccessKey(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="smIcon"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${provider}-region`}>AWS Region</Label>
                  <Input
                    id={`${provider}-region`}
                    type="text"
                    placeholder="us-east-1"
                    value={awsRegion}
                    onChange={(e) => setAwsRegion(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${provider}-model`}>
                    Model ID (Optional)
                  </Label>
                  <Input
                    id={`${provider}-model`}
                    type="text"
                    placeholder={config.modelPlaceholder}
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use default model
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor={`${provider}-key`}>API Key</Label>
                  <div className="relative">
                    <Input
                      id={`${provider}-key`}
                      type={showKey ? "text" : "password"}
                      placeholder={config.placeholder}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="smIcon"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${provider}-model`}>
                    Model ID (Optional)
                  </Label>
                  <Input
                    id={`${provider}-model`}
                    type="text"
                    placeholder={config.modelPlaceholder}
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use default model
                  </p>
                </div>
              </>
            )}
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isSaving} size="sm">
                {isSaving ? "Saving..." : "Save API Key"}
              </Button>
              {isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false)
                    setApiKey("")
                    setModelId("")
                    setAwsAccessKeyId("")
                    setAwsSecretAccessKey("")
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Key className="size-3 mt-0.5 flex-shrink-0" />
              <span>
                Get your API key from{" "}
                <a
                  href={config.dashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  {config.name} dashboard
                </a>
                . Your key will be encrypted before storage.
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">
                  API key is configured and will be used for requests
                </div>
                {configuredModel && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Model:</span>
                    <code className="px-2 py-0.5 bg-secondary rounded text-foreground font-mono">
                      {configuredModel}
                    </code>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                Update Key
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
