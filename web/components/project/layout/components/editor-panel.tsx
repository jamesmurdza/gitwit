import { useProjectContext } from "@/context/project-context"
import { fileRouter } from "@/lib/api"
import { defaultEditorOptions } from "@/lib/monaco/config"
import { processFileType } from "@/lib/utils"
import { useAppStore } from "@/store/context"
import Editor from "@monaco-editor/react"
import { IDockviewPanelProps } from "dockview"
import { Loader2 } from "lucide-react"
import { useTheme } from "next-themes"
import { useCallback, useEffect } from "react"
import AIEditElements from "../../ai-edit/ai-edit-elements"
import { DiffNavigationWidget } from "../../ai-edit/diff-navigation-widget"
import { useCodeDiffer } from "../../hooks/useCodeDiffer"
import { useEditor } from "../../hooks/useEditor"

export interface EditorPanelParams {
  saved?: boolean
}

export function EditorPanel(props: IDockviewPanelProps<EditorPanelParams>) {
  const fileId = props.api.id
  const { theme: currentTheme } = useTheme()
  const {
    project: { id: projectId },
  } = useProjectContext()

  const tabs = useAppStore((state) => state.tabs)
  const draft = useAppStore((s) => s.drafts[fileId ?? ""])
  const setDraft = useAppStore((s) => s.setDraft)

  const editor = useEditor({
    fileId,
    projectId,
  })

  // Fetch content
  const { data: serverFileContent = "", isLoading } =
    fileRouter.fileContent.useQuery({
      enabled: !!fileId,
      variables: { fileId, projectId },
      select(data) {
        return data.data
      },
    })
  const activeFileContent = draft === undefined ? serverFileContent : draft
  const hasUnsavedChanges = draft !== undefined && draft !== serverFileContent

  useEffect(() => {
    props.api.updateParameters({ saved: !hasUnsavedChanges })
  }, [hasUnsavedChanges])
  // Register cleanup on panel close
  useEffect(() => {
    const disposable = props.containerApi.onDidRemovePanel((event) => {
      if (event.id === props.api.id) {
        // Cleanup if needed
      }
    })
    return () => disposable.dispose()
  }, [props.containerApi, props.api.id])

  // Diffing logic - localized to this panel

  const {
    activeWidgetsState, // hasActiveWidgets()
    acceptAll,
    rejectAll,
    scrollToNextDiff,
    scrollToPrevDiff,
  } = useCodeDiffer({
    editorRef: editor.editorRef || null,
    onDiffChange: (session) => {
      // Save session to global store if needed, or local
    },
    onDiffResolved: (fileId, status) => {
      // Mark resolved
    },
  })

  const handleEditorChange = useCallback(
    (value?: string) => {
      if (!fileId) {
        return
      }
      setDraft(fileId, value ?? "")
    },
    [fileId, setDraft],
  )
  const editorLanguage = props.api.title
    ? processFileType(props.api.title)
    : "plaintext"

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-full text-foreground/50">
        <Loader2 className="animate-spin w-4 h-4" />
      </div>
    )
  }

  return (
    <div className="relative w-full h-full group">
      <Editor
        height="100%"
        language={editorLanguage}
        beforeMount={editor.handleEditorWillMount}
        onMount={editor.handleEditorMount}
        path={fileId} // Using fileId as path ensures models are unique per file
        theme={currentTheme === "light" ? "vs" : "vs-dark"}
        options={{
          ...defaultEditorOptions,
          readOnly: false,
        }}
        value={activeFileContent ?? ""}
        onChange={handleEditorChange}
      />

      <AIEditElements
        generate={editor.generate}
        setGenerate={editor.setGenerate}
        generateRef={editor.generateRef}
        suggestionRef={editor.suggestionRef}
        generateWidgetRef={editor.generateWidgetRef}
        editorRef={editor.editorRef}
        isSelected={editor.isSelected}
        cursorLine={editor.cursorLine}
        showSuggestion={editor.showSuggestion}
        handleAiEdit={editor.handleAiEdit}
        activeFileId={fileId}
        editorLanguage={editorLanguage}
        tabs={tabs} // We pass tabs if needed by children, though moving away from it
      />

      {activeWidgetsState && (
        <DiffNavigationWidget
          onAcceptAll={acceptAll}
          onRejectAll={rejectAll}
          onNext={scrollToNextDiff}
          onPrev={scrollToPrevDiff}
        />
      )}
    </div>
  )
}
