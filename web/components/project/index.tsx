"use client"

import { useEditorShortcuts } from "@/components/project/hooks/useEditorShortcuts"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Sandbox, User } from "@/lib/types"
import ChangesAlert from "./alerts/changes-alert"
import ProjectLayout from "./project-layout"
import Sidebar from "./sidebar"

export default function Project({
  userData,
  sandboxData,
}: {
  userData: User
  sandboxData: Sandbox
}) {
  const isOwner = sandboxData.userId === userData.id

  // Keyboard shortcuts and browser events
  useEditorShortcuts()

  return (
    <div className="max-h-full overflow-hidden w-full h-full">
      <ChangesAlert />
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel minSize={15} defaultSize={17} className="h-full">
          <Sidebar userId={sandboxData.userId} />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={80} minSize={40} className="h-full">
          <ProjectLayout
            isOwner={isOwner}
            projectName={sandboxData.name}
            projectType={sandboxData.type}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
