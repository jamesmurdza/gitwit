"use client"

import { Sandbox, User } from "@/lib/types"
import * as React from "react"

interface ProjectContextType {
  user: User
  project: Sandbox
}

const ProjectContext = React.createContext<ProjectContextType | null>(null)

export const ProjectProvider = ({
  children,
  value,
}: {
  children: React.ReactNode
  value: ProjectContextType
}) => {
  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  )
}

export const useProjectContext = () => {
  const context = React.useContext(ProjectContext)
  if (!context) {
    throw new Error("useProjectContext must be used within a ProjectProvider")
  }
  return context
}
