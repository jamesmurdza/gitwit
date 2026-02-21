import { createContext, useContext } from "react"

export type DiffLineType = "context" | "added" | "removed"

interface CodeBlockContextType {
  code: string
}

export const CodeBlockContext = createContext<CodeBlockContextType>({
  code: "",
})

export const useCodeBlockContext = () => useContext(CodeBlockContext)
