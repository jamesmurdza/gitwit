"use client"

import { File, Github } from "@/components/ui/icons"
import {
  Sidebar,
  SidebarButton,
  SidebarContent,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useProjectContext } from "@/context/project-context"
import { IGridviewPanelProps } from "dockview"
import { FileExplorer } from "../../sidebar/file-explorer"
import { GitHubSync } from "../../sidebar/github-sync"
export interface FilesPanelParams {}

const sidebarItems = [
  {
    id: "file",
    name: "File Explorer",
    icon: File,
  },
  {
    id: "github",
    name: "Sync to GitHub",
    icon: Github,
  },
]
export function SideBarPanel(props: IGridviewPanelProps<FilesPanelParams>) {
  const {
    user: { id: userId },
  } = useProjectContext()

  return (
    <Sidebar className="bg-background" defaultActiveItem="file">
      <SidebarRail>
        {sidebarItems.map(({ id, name, icon: Icon }) => (
          <SidebarButton key={id} id={id} tooltip={name}>
            <Icon className="size-5" />
          </SidebarButton>
        ))}
      </SidebarRail>

      <SidebarContent id="file">
        <FileExplorer />
      </SidebarContent>

      <SidebarContent id="github">
        <GitHubSync userId={userId} />
      </SidebarContent>
    </Sidebar>
  )
}
