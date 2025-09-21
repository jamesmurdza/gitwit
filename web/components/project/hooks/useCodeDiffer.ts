import * as diff from "diff"
import * as monaco from "monaco-editor"
import { useCallback } from "react"

export interface UseCodeDifferProps {
  editorRef: monaco.editor.IStandaloneCodeEditor | null
}

export interface UseCodeDifferReturn {
  handleApplyCode: (
    mergedCode: string,
    originalCode: string
  ) => monaco.editor.IEditorDecorationsCollection | null
}

/**
 * Hook for handling code diff visualization using Monaco Editor's built-in diff algorithm
 * This provides the same sophisticated diff functionality as VS Code/Cursor IDE
 */
export function useCodeDiffer({
  editorRef,
}: UseCodeDifferProps): UseCodeDifferReturn {
  const handleApplyCode = useCallback(
    (
      mergedCode: string,
      originalCode: string
    ): monaco.editor.IEditorDecorationsCollection | null => {
      if (!editorRef) return null
      const model = editorRef.getModel()
      if (!model)
        return null

        // Store original content on model for potential restoration
      ;(model as any).originalContent = originalCode
      console.log(
        "Stored original content on model:",
        originalCode.substring(0, 50) + "..."
      )

      // Build combined lines for diff view
      const combinedLines: string[] = []
      const decorations: monaco.editor.IModelDeltaDecoration[] = []

      let lineNumber = 1

      console.log("originalCode", originalCode)
      console.log("mergedCode", mergedCode)
      // Process each diff part to create combined view
      const diffResult = diff.diffLines(
        originalCode.replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
        mergedCode.replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
        { ignoreWhitespace: false }
      )
      console.log("diffResult", diffResult)

      diffResult.forEach((part: any) => {
        if (part.removed) {
          // Add removed lines with red decoration
          const removedLines = part.value
            .split("\n")
            .filter((line: string) => line !== "")
          removedLines.forEach((line: string) => {
            combinedLines.push(line)
            decorations.push({
              range: new monaco.Range(lineNumber, 1, lineNumber, 1),
              options: {
                isWholeLine: true,
                className: "removed-line-decoration",
                glyphMarginClassName: "removed-line-glyph",
                linesDecorationsClassName: "removed-line-number",
                minimap: { color: "rgb(255, 0, 0, 0.2)", position: 2 },
              },
            })
            lineNumber++
          })
        } else if (part.added) {
          // Add added lines with green decoration
          const addedLines = part.value
            .split("\n")
            .filter((line: string) => line !== "")
          addedLines.forEach((line: string) => {
            combinedLines.push(line)
            decorations.push({
              range: new monaco.Range(lineNumber, 1, lineNumber, 1),
              options: {
                isWholeLine: true,
                className: "added-line-decoration",
                glyphMarginClassName: "added-line-glyph",
                linesDecorationsClassName: "added-line-number",
                minimap: { color: "rgb(0, 255, 0, 0.2)", position: 2 },
              },
            })
            lineNumber++
          })
        } else {
          // Add unchanged lines
          const unchangedLines = part.value
            .split("\n")
            .filter((line: string) => line !== "")
          unchangedLines.forEach((line: string) => {
            combinedLines.push(line)
            lineNumber++
          })
        }
      })

      // Apply the combined diff view to the editor
      model.setValue(combinedLines.join("\n"))

      // Create and return decorations collection
      const newDecorations = editorRef.createDecorationsCollection(decorations)
      return newDecorations
    },
    [editorRef]
  )

  return {
    handleApplyCode,
  }
}
