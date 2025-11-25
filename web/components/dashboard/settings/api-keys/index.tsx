"use client"

import ProviderCard from "@/components/dashboard/settings/api-keys/provider-card"
import { Accordion } from "@/components/ui/accordion"
import { PROVIDERS, Provider, ProviderConfig } from "@/lib/types"
import { apiClient } from "@/server/client"
import { useEffect, useState } from "react"
import { toast } from "sonner"

type ConfiguredKeys = {
  hasAnthropic: boolean
  anthropicModel?: string
  hasOpenai: boolean
  openaiModel?: string
  hasOpenrouter: boolean
  openrouterModel?: string
  hasAws: boolean
  awsModel?: string
  encryptionAvailable?: boolean
}

export default function ApiKeysSettings() {
  const [configuredKeys, setConfiguredKeys] = useState<ConfiguredKeys>({
    hasAnthropic: false,
    hasOpenai: false,
    hasOpenrouter: false,
    hasAws: false,
    encryptionAvailable: true,
  })

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
    }
  }

  // Show message if encryption is not available
  if (configuredKeys.encryptionAvailable === false) {
    return (
      <div className="max-w-4xl">
        <div className="border rounded-lg p-6 bg-muted/30">
          <h3 className="font-semibold mb-2">Custom API Keys Not Available</h3>
          <p className="text-sm text-muted-foreground mb-4">
            The custom API key feature requires the{" "}
            <code className="px-1.5 py-0.5 bg-muted rounded text-xs">
              ENCRYPTION_KEY
            </code>{" "}
            environment variable to be configured on the server.
          </p>
          <p className="text-sm text-muted-foreground">
            To enable this feature, set the{" "}
            <code className="px-1.5 py-0.5 bg-muted rounded text-xs">
              ENCRYPTION_KEY
            </code>{" "}
            in your server&apos;s environment variables and restart the
            application.
          </p>
          <details className="mt-4">
            <summary className="text-sm font-medium cursor-pointer">
              How to generate an encryption key
            </summary>
            <div className="mt-2 space-y-2">
              <p className="text-sm text-muted-foreground">
                Run one of these commands to generate a secure key:
              </p>
              <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                node -e
                &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;hex&apos;))&quot;
              </pre>
              <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                openssl rand -base64 32
              </pre>
            </div>
          </details>
        </div>
      </div>
    )
  }

  return (
    <Accordion type="multiple" className="space-y-3 max-w-4xl">
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
    </Accordion>
  )
}
