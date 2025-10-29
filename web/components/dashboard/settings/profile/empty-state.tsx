import NewProjectModal from "@/components/dashboard/new-project"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardTitle } from "@/components/ui/card"
import { PlusCircle } from "lucide-react"
import { useCallback, useMemo, useState } from "react"

export default function EmptyState({
  type,
  isOwnProfile,
}: {
  type: "public" | "private"
  isOwnProfile: boolean
}) {
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false)

  const text = useMemo(() => {
    let title = ""
    let description = ""

    switch (type) {
      case "public":
        title = "No public sandboxes yet"
        description = isOwnProfile
          ? "Create your first public sandbox to share your work with the world!"
          : "User has no public sandboxes"
        break

      case "private":
        title = "No private sandboxes yet"
        description = isOwnProfile
          ? "Create your first private sandbox to start working on your personal projects!"
          : "User has no private sandboxes"
        break

      default:
        title = "No sandboxes"
        description = "Nothing to show here yet."
    }

    return { title, description }
  }, [type, isOwnProfile])

  const openModal = useCallback(() => setNewProjectModalOpen(true), [])
  return (
    <>
      <Card className="flex flex-col items-center justify-center p-6 text-center h-[300px]">
        <PlusCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <CardTitle className="text-xl mb-2">{text.title}</CardTitle>
        <CardDescription className="mb-4">{text.description}</CardDescription>
        {isOwnProfile && (
          <Button onClick={openModal}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Create Sandbox
          </Button>
        )}
      </Card>
      <NewProjectModal
        open={newProjectModalOpen}
        setOpen={setNewProjectModalOpen}
      />
    </>
  )
}
