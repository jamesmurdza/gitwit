import ApiKeysSettings from "@/components/settings/api-keys"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiClient } from "@/server/client"
import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export default async function SettingsPage() {
  const user = await currentUser()

  if (!user) {
    redirect("/")
  }

  const dbUser = await apiClient.user.$get({
    query: {},
  })

  if (!dbUser.ok) {
    redirect("/")
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <Tabs defaultValue="api-keys" className="w-full">
        <TabsList className="mb-8">
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="profile" disabled>
            Profile
          </TabsTrigger>
          <TabsTrigger value="billing" disabled>
            Billing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys">
          <ApiKeysSettings />
        </TabsContent>

        <TabsContent value="profile">
          <div className="text-center py-12 text-muted-foreground">
            Profile settings coming soon. For now, edit your profile from{" "}
            <a href={`/@${user.username}`} className="underline">
              your profile page
            </a>
            .
          </div>
        </TabsContent>

        <TabsContent value="billing">
          <div className="text-center py-12 text-muted-foreground">
            Billing settings coming soon.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
