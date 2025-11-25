"use client"

import AboutModal from "@/components/dashboard/about"
import NewProjectModal from "@/components/dashboard/new-project"
import DashboardProjects from "@/components/dashboard/projects"
import DashboardSettings from "@/components/dashboard/settings"
import { Button } from "@/components/ui/button"
import CustomButton from "@/components/ui/customButton"
import { Sandbox, User } from "@/lib/types"
import { useRouter } from "@bprogress/next/app"
import { Code2, FolderDot, HelpCircle, Plus, Settings } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

type TScreen = "projects" | "shared" | "settings" | "search"

export default function Dashboard({
  sandboxes,
  shared,
  userData,
}: {
  sandboxes: Sandbox[]
  shared: {
    id: string
    name: string
    type: string
    author: string
    sharedOn: string
    authorAvatarUrl: string | null
  }[]
  userData: User
}) {
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false)
  const [aboutModalOpen, setAboutModalOpen] = useState(false)

  const searchParams = useSearchParams()
  const q = searchParams.get("q")
  const tab = searchParams.get("tab")
  const router = useRouter()

  // Derive screen from URL parameter
  const screen: TScreen =
    tab === "settings"
      ? "settings"
      : // : tab === "shared" ? "shared" // TODO: Uncomment when shared functionality is ready
        "projects"

  const activeScreen = (s: TScreen) => {
    if (screen === s) return "justify-start"
    else return "justify-start font-normal text-muted-foreground"
  }

  const navigateToScreen = (screen: TScreen) => {
    if (screen === "settings") {
      router.push("/dashboard?tab=settings")
    }
    // else if (screen === "shared") {
    //   router.push("/dashboard?tab=shared")
    // } // TODO: Uncomment when shared functionality is ready
    else {
      router.push("/dashboard")
    }
  }

  useEffect(() => {
    // update the dashboard to show a new project
    router.refresh()
  }, [])

  return (
    <>
      <NewProjectModal
        open={newProjectModalOpen}
        setOpen={setNewProjectModalOpen}
      />
      <AboutModal open={aboutModalOpen} setOpen={setAboutModalOpen} />
      <div className="flex grow w-full overflow-hidden">
        <div className="w-56 shrink-0 border-r border-border p-4 justify-between flex flex-col">
          <div className="flex flex-col">
            <CustomButton
              onClick={() => {
                if (sandboxes.length >= 8) {
                  toast.error("You reached the maximum # of sandboxes.")
                  return
                }
                setNewProjectModalOpen(true)
              }}
              className="mb-4"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </CustomButton>
            <Button
              variant="ghost"
              onClick={() => navigateToScreen("projects")}
              className={activeScreen("projects")}
            >
              <FolderDot className="w-4 h-4 mr-2" />
              My Projects
            </Button>
            {/* TODO: Uncomment when shared functionality is ready
            <Button
              variant="ghost"
              onClick={() => navigateToScreen("shared")}
              className={activeScreen("shared")}
            >
              <Users className="w-4 h-4 mr-2" />
              Shared with Me
            </Button>
            */}
            <Button
              variant="ghost"
              onClick={() => navigateToScreen("settings")}
              className={activeScreen("settings")}
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
          <div className="flex flex-col">
            <a target="_blank" href="https://github.com/jamesmurdza/gitwit">
              <Button
                variant="ghost"
                className="justify-start w-full font-normal text-muted-foreground"
              >
                <Code2 className="w-4 h-4 mr-2" />
                GitHub Repository
              </Button>
            </a>
            <Button
              onClick={() => setAboutModalOpen(true)}
              variant="ghost"
              className="justify-start font-normal text-muted-foreground"
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              Help
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          {(() => {
            switch (screen) {
              case "projects":
                return sandboxes ? (
                  <DashboardProjects sandboxes={sandboxes} q={q} />
                ) : null
              // TODO: Uncomment when shared functionality is ready
              // case "shared":
              //   return (
              //     <DashboardSharedWithMe
              //       shared={shared.map((item) => ({
              //         ...item,
              //         authorAvatarUrl: item.authorAvatarUrl || "",
              //       }))}
              //     />
              //   )
              case "settings":
                return <DashboardSettings userData={userData} />
              default:
                return null
            }
          })()}
        </div>
      </div>
    </>
  )
}
