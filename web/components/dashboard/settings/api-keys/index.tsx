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
}

export default function ApiKeysSettings() {
  const [configuredKeys, setConfiguredKeys] = useState<ConfiguredKeys>({
    hasAnthropic: false,
    hasOpenai: false,
    hasOpenrouter: false,
    hasAws: false,
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
