"use client"

import { createContext, ReactNode, useContext } from "react"

export interface CodeApplyContextType {
  onApplyCode: (code: string, language?: string) => void
  onRejectCode: () => void
}

const CodeApplyContext = createContext<CodeApplyContextType | undefined>(
  undefined
)

export function CodeApplyProvider({
  children,
  onApplyCode,
  onRejectCode,
}: {
  children: ReactNode
  onApplyCode: (code: string, language?: string) => void
  onRejectCode: () => void
}) {
  return (
    <CodeApplyContext.Provider value={{ onApplyCode, onRejectCode }}>
      {children}
    </CodeApplyContext.Provider>
  )
}

export function useCodeApply() {
  const context = useContext(CodeApplyContext)
  if (!context) {
    throw new Error("useCodeApply must be used within a CodeApplyProvider")
  }
  return context
}
