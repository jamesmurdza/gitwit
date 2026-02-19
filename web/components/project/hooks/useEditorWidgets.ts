import * as monaco from "monaco-editor"
import { useEffect } from "react"
import type { GenerateState } from "./useEditor"

/**
 * Manages the AI generate widget lifecycle (show/hide view zones and content widgets)
 */
export function useGenerateWidgetEffect(
  editorRef: monaco.editor.IStandaloneCodeEditor | undefined,
  generate: GenerateState,
  setGenerate: React.Dispatch<React.SetStateAction<GenerateState>>,
  cursorLine: number,
  generateRef: React.RefObject<HTMLDivElement>,
  generateWidgetRef: React.RefObject<HTMLDivElement>,
  setShowSuggestion: (v: boolean) => void,
) {
  useEffect(() => {
    if (generate.show) {
      setShowSuggestion(false)

      // Only create view zone if it doesn't already exist
      if (!generate.id) {
        editorRef?.changeViewZones(function (changeAccessor) {
          if (!generateRef.current) return
          const id = changeAccessor.addZone({
            afterLineNumber: cursorLine,
            heightInLines: 3,
            domNode: generateRef.current,
          })
          setGenerate((prev) => ({ ...prev, id, line: cursorLine }))
        })
      }

      if (!generateWidgetRef.current) return
      const widgetElement = generateWidgetRef.current

      const contentWidget = {
        getDomNode: () => widgetElement,
        getId: () => "generate.widget",
        getPosition: () => ({
          position: {
            lineNumber: generate.line || cursorLine,
            column: 1,
          },
          preference: generate.pref,
        }),
      }

      const editorDomNode = editorRef?.getDomNode()
      const width = editorDomNode?.clientWidth ?? 400

      setGenerate((prev) => ({ ...prev, widget: contentWidget, width }))
      editorRef?.addContentWidget(contentWidget)

      if (generateRef.current && generateWidgetRef.current) {
        editorRef?.applyFontInfo(generateRef.current)
        editorRef?.applyFontInfo(generateWidgetRef.current)
      }
    } else {
      editorRef?.changeViewZones(function (changeAccessor) {
        changeAccessor.removeZone(generate.id)
        setGenerate((prev) => ({ ...prev, id: "" }))
      })

      if (!generate.widget) return
      editorRef?.removeContentWidget(generate.widget)
      setGenerate((prev) => ({ ...prev, widget: undefined }))
    }
  }, [
    generate.show,
    generate.id,
    generate.line,
    generate.pref,
    cursorLine,
    editorRef,
  ])
}

/**
 * Manages the suggestion widget lifecycle (add/remove based on selection)
 */
export function useSuggestionWidgetEffect(
  editorRef: monaco.editor.IStandaloneCodeEditor | undefined,
  isSelected: boolean,
  suggestionRef: React.RefObject<HTMLDivElement>,
) {
  useEffect(() => {
    if (!suggestionRef.current || !editorRef) return
    const widgetElement = suggestionRef.current
    const suggestionWidget: monaco.editor.IContentWidget = {
      getDomNode: () => widgetElement,
      getId: () => "suggestion.widget",
      getPosition: () => {
        const selection = editorRef?.getSelection()
        const column = Math.max(3, selection?.positionColumn ?? 1)
        const lineNumber = selection?.positionLineNumber ?? 1
        const pref =
          lineNumber <= 3
            ? monaco.editor.ContentWidgetPositionPreference.BELOW
            : monaco.editor.ContentWidgetPositionPreference.ABOVE
        return {
          preference: [pref],
          position: { lineNumber, column },
        }
      },
    }
    if (isSelected) {
      editorRef?.addContentWidget(suggestionWidget)
      editorRef?.applyFontInfo(suggestionRef.current)
    } else {
      editorRef?.removeContentWidget(suggestionWidget)
    }
  }, [isSelected, editorRef])
}
