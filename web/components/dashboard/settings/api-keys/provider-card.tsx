import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { userRouter } from "@/lib/api"
import { Provider, ProviderConfig } from "@/lib/types"
import { apiClient } from "@/server/client"
import { useQueryClient } from "@tanstack/react-query"
import { Check, ExternalLink, Eye, EyeOff, Key, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export interface ProviderCardProps {
  provider: Provider
  config: ProviderConfig
  isConfigured: boolean
  configuredModel?: string
  onUpdate: () => void
}

export default function ProviderCard({
  provider,
  config,
  isConfigured,
  configuredModel,
  onUpdate,
}: ProviderCardProps) {
  const queryClient = useQueryClient()
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
        // Invalidate the available models query so it refreshes in the chat input
        queryClient.invalidateQueries(userRouter.availableModels.getOptions())
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
        // Invalidate the available models query so it refreshes in the chat input
        queryClient.invalidateQueries(userRouter.availableModels.getOptions())
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
    <AccordionItem value={provider} className="border rounded-lg">
      <div className="flex items-center justify-between px-4">
        <AccordionTrigger className="hover:no-underline py-4 flex-1 pr-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-medium">{config.name}</span>
              {isConfigured && (
                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded-full">
                  <Check className="size-3" />
                  <span>Configured</span>
                </div>
              )}
            </div>
            {configuredModel && (
              <code className="text-xs px-2 py-0.5 bg-muted rounded font-mono text-muted-foreground">
                {configuredModel}
              </code>
            )}
          </div>
        </AccordionTrigger>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="smIcon"
            asChild
            className="text-muted-foreground hover:text-foreground"
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
          {isConfigured && (
            <Button
              variant="ghost"
              size="smIcon"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>
      <AccordionContent className="pb-4 pt-2 px-4">
        {!isConfigured || isEditing ? (
          <div className="space-y-3">
            {provider === "aws" ? (
              <>
                <div className="space-y-1.5">
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
                <div className="space-y-1.5">
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
                <div className="space-y-1.5">
                  <Label htmlFor={`${provider}-region`}>AWS Region</Label>
                  <Input
                    id={`${provider}-region`}
                    type="text"
                    placeholder="us-east-1"
                    value={awsRegion}
                    onChange={(e) => setAwsRegion(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${provider}-model`} className="text-sm">
                    Model ID{" "}
                    <span className="text-muted-foreground">(Optional)</span>
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
                <div className="space-y-1.5">
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
                <div className="space-y-1.5">
                  <Label htmlFor={`${provider}-model`} className="text-sm">
                    Model ID{" "}
                    <span className="text-muted-foreground">(Optional)</span>
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
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} disabled={isSaving} size="sm">
                {isSaving ? "Saving..." : "Save"}
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
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
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
          <div className="space-y-2">
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
      </AccordionContent>
    </AccordionItem>
  )
}
