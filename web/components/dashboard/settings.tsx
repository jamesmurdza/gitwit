"use client"

import ApiKeysSettings from "@/components/dashboard/settings/api-keys/index"
import EditProfileForm from "@/components/dashboard/settings/profile/edit-profile-form"
import ProfileCard from "@/components/dashboard/settings/profile/profile-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { User } from "@/lib/types"
import { useSearchParams } from "next/navigation"
import { useMemo } from "react"

export default function DashboardSettings({ userData }: { userData: User }) {
  const searchParams = useSearchParams()
  const subtab = searchParams.get("subtab")

  // Derive active tab from URL parameter
  const activeTab =
    subtab === "api-keys"
      ? "api-keys"
      : subtab === "billing"
      ? "billing"
      : "profile"

  const handleTabChange = (value: string) => {
    const url =
      value === "profile"
        ? "/dashboard?tab=settings"
        : `/dashboard?tab=settings&subtab=${value}`

    window.history.replaceState(null, "", url)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full py-8 px-6 pb-20">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="mb-8">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="api-keys">API Keys</TabsTrigger>
            <TabsTrigger value="billing" disabled>
              Billing
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="profile"
            forceMount
            className={activeTab !== "profile" ? "hidden" : ""}
          >
            <ProfileSettings userData={userData} />
          </TabsContent>

          <TabsContent
            value="api-keys"
            forceMount
            className={activeTab !== "api-keys" ? "hidden" : ""}
          >
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold mb-2">API Keys</h2>
                <p className="text-muted-foreground text-sm">
                  Configure your own API keys for AI providers. Your keys are
                  encrypted and stored securely. If no custom keys are provided,
                  system defaults will be used.
                </p>
              </div>
              <ApiKeysSettings />
            </div>
          </TabsContent>

          <TabsContent
            value="billing"
            forceMount
            className={activeTab !== "billing" ? "hidden" : ""}
          >
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold mb-2">Billing</h2>
                <p className="text-muted-foreground">
                  Manage your subscription and billing information
                </p>
              </div>
              <div className="text-center py-12 text-muted-foreground">
                Billing settings coming soon.
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function ProfileSettings({ userData }: { userData: User }) {
  const sandboxes = useMemo(() => {
    return (userData.sandbox || []).map((sandbox) => ({
      ...sandbox,
      likeCount: sandbox.likeCount || 0,
      liked: false,
    }))
  }, [userData.sandbox])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1">
        <ProfileCard
          name={userData.name}
          username={userData.username}
          avatarUrl={userData.avatarUrl}
          sandboxes={sandboxes}
          joinedDate={new Date(userData.createdAt)}
          generations={userData.generations}
          tier={userData.tier}
          bio={userData.bio}
          personalWebsite={userData.personalWebsite}
          socialLinks={userData.links}
        />
      </div>
      <div className="md:col-span-2">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Edit Profile</h2>
            <p className="text-muted-foreground">
              Update your profile information and social links
            </p>
          </div>
          <EditProfileForm
            name={userData.name}
            username={userData.username}
            avatarUrl={userData.avatarUrl}
            bio={userData.bio}
            personalWebsite={userData.personalWebsite}
            socialLinks={userData.links}
            toggleEdit={() => {}}
          />
        </div>
      </div>
    </div>
  )
}
