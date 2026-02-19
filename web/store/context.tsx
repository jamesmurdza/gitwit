"use client"

import { type ReactNode, createContext, useContext, useRef } from "react"
import { useStore } from "zustand"

import { type Slices, createAppStore } from "@/store"

export type AppStoreApi = ReturnType<typeof createAppStore>

const AppStoreContext = createContext<AppStoreApi | undefined>(undefined)

export interface AppStoreProviderProps {
  children: ReactNode
}

export const AppStoreProvider = ({ children }: AppStoreProviderProps) => {
  const storeRef = useRef<AppStoreApi | null>(null)
  if (storeRef.current === null) {
    storeRef.current = createAppStore()
  }

  return (
    <AppStoreContext.Provider value={storeRef.current}>
      {children}
    </AppStoreContext.Provider>
  )
}

export const useAppStore = <T,>(selector: (store: Slices) => T): T => {
  const storeContext = useContext(AppStoreContext)

  if (!storeContext) {
    throw new Error(`useAppStore must be used within AppStoreProvider`)
  }

  return useStore(storeContext, selector)
}
