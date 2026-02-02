"use client"

import { DockviewApi, GridviewApi } from "dockview"
import * as React from "react"

interface ContainerContextType {
  gridRef: React.MutableRefObject<GridviewApi | undefined>
  dockRef: React.MutableRefObject<DockviewApi | undefined>
  terminalRef: React.MutableRefObject<DockviewApi | undefined>
}

const ContainerContext = React.createContext<ContainerContextType | null>(null)

export const ContainerProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const gridRef = React.useRef<GridviewApi>()
  const dockRef = React.useRef<DockviewApi>()
  const terminalRef = React.useRef<DockviewApi>()

  return (
    <ContainerContext.Provider value={{ gridRef, dockRef, terminalRef }}>
      {children}
    </ContainerContext.Provider>
  )
}

export const useContainer = () => {
  const context = React.useContext(ContainerContext)
  if (!context) {
    throw new Error("useContainer must be used within a ContainerProvider")
  }
  return context
}
