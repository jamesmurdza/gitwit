"use client"

import * as monaco from "monaco-editor"
import * as React from "react"

interface EditorHandlers {
  handleApplyCode: (
    mergedCode: string,
    originalCode: string,
  ) => monaco.editor.IEditorDecorationsCollection | null
  editorRef: monaco.editor.IStandaloneCodeEditor | null
  hasActiveWidgets: () => boolean
  acceptAll: () => void
  rejectAll: () => void
  forceClearAllDecorations: () => void
}

interface EditorHandlersContextType {
  registerHandlers: (fileId: string, handlers: EditorHandlers) => void
  unregisterHandlers: (fileId: string) => void
  getHandlers: (fileId: string) => EditorHandlers | undefined
}

const EditorHandlersContext =
  React.createContext<EditorHandlersContextType | null>(null)

export const EditorHandlersProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const handlersMap = React.useRef<Map<string, EditorHandlers>>(new Map())

  const registerHandlers = React.useCallback(
    (fileId: string, handlers: EditorHandlers) => {
      handlersMap.current.set(fileId, handlers)
    },
    [],
  )

  const unregisterHandlers = React.useCallback((fileId: string) => {
    handlersMap.current.delete(fileId)
  }, [])

  const getHandlers = React.useCallback((fileId: string) => {
    return handlersMap.current.get(fileId)
  }, [])

  return (
    <EditorHandlersContext.Provider
      value={{ registerHandlers, unregisterHandlers, getHandlers }}
    >
      {children}
    </EditorHandlersContext.Provider>
  )
}

export const useEditorHandlers = () => {
  const context = React.useContext(EditorHandlersContext)
  if (!context) {
    throw new Error(
      "useEditorHandlers must be used within EditorHandlersProvider",
    )
  }
  return context
}
