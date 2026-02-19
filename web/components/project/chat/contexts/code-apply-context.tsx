"use client"

import { createContext, ReactNode, useContext } from "react"

export interface CodeApplyContextType {
  onApplyCode: (code: string, language?: string) => Promise<void>
  onRejectCode: () => void
  messageId?: string
}

const CodeApplyContext = createContext<CodeApplyContextType | undefined>(
  undefined,
)

export function CodeApplyProvider({
  children,
  onApplyCode,
  onRejectCode,
  messageId,
}: {
  children: ReactNode
  onApplyCode: (code: string, language?: string) => Promise<void>
  onRejectCode: () => void
  messageId?: string
}) {
  return (
    <CodeApplyContext.Provider value={{ onApplyCode, onRejectCode, messageId }}>
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
