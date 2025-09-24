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
      const granularBlocks: Array<{
        type: "added" | "removed"
        start: number
        end: number
      }> = []

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
          const blockStart = lineNumber
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
          const blockEnd = lineNumber - 1
          if (blockEnd >= blockStart)
            granularBlocks.push({
              type: "removed",
              start: blockStart,
              end: blockEnd,
            })
        } else if (part.added) {
          // Add added lines with green decoration
          const addedLines = part.value
            .split("\n")
            .filter((line: string) => line !== "")
          const blockStart = lineNumber
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
          const blockEnd = lineNumber - 1
          if (blockEnd >= blockStart)
            granularBlocks.push({
              type: "added",
              start: blockStart,
              end: blockEnd,
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

      // Store granular blocks on the model (for later if needed)
      ;(model as any).granularBlocks = granularBlocks

      // Add simple inline action widgets that show on hover for each block
      granularBlocks.forEach((block, i) => {
        const dom = document.createElement("div")
        dom.style.display = "none"
        dom.style.gap = "6px"
        dom.style.alignItems = "center"
        dom.style.position = "absolute"
        dom.style.right = "8px"
        dom.style.top = "-6px"
        dom.style.padding = "2px 4px"
        dom.style.borderRadius = "6px"
        dom.style.background = "rgba(0,0,0,0.4)"
        dom.style.backdropFilter = "blur(2px)"
        dom.style.zIndex = "50"

        const mkBtn = (
          label: string,
          color: string,
          title: string,
          onClick: () => void
        ) => {
          const b = document.createElement("button")
          b.textContent = label
          b.title = title
          b.style.cursor = "pointer"
          b.style.background = "transparent"
          b.style.border = "1px solid " + color
          b.style.color = color
          b.style.borderRadius = "4px"
          b.style.width = "22px"
          b.style.height = "22px"
          b.style.lineHeight = "20px"
          b.style.fontSize = "13px"
          b.style.pointerEvents = "auto"
          b.onclick = onClick
          return b
        }

        const removeLines = (start: number, end: number) => {
          const startPos = { lineNumber: start, column: 1 }
          const endPos = { lineNumber: end + 1, column: 1 }
          model.applyEdits([
            {
              range: new monaco.Range(
                startPos.lineNumber,
                startPos.column,
                endPos.lineNumber,
                endPos.column
              ),
              text: "",
            },
          ])
        }

        const clearBlockDecorations = (start: number, end: number) => {
          const ids: string[] = []
          for (let ln = start; ln <= end; ln++) {
            const decs = model.getLineDecorations(ln) || []
            decs.forEach((d) => {
              const cls = (d.options as any)?.className
              if (
                cls === "added-line-decoration" ||
                cls === "removed-line-decoration"
              ) {
                ids.push(d.id)
              }
            })
          }
          if (ids.length > 0) {
            model.deltaDecorations(ids, [])
          }
        }

        const accept = mkBtn(
          "✓",
          block.type === "added" ? "#22c55e" : "#ef4444",
          "Accept change",
          () => {
            // Diagnostic log for user
            console.log("ACCEPT_BLOCK", {
              type: block.type,
              start: block.start,
              end: block.end,
            })
            if (block.type === "removed") {
              // Accept removal: delete shown removed lines
              removeLines(block.start, block.end)
            }
            // Hide decorations for this block either way
            clearBlockDecorations(block.start, block.end)
            dom.remove()
          }
        )
        const reject = mkBtn(
          "✕",
          block.type === "added" ? "#ef4444" : "#22c55e",
          "Reject change",
          () => {
            // Diagnostic log for user
            console.log("REJECT_BLOCK", {
              type: block.type,
              start: block.start,
              end: block.end,
            })
            if (block.type === "added") {
              // Reject addition: delete shown added lines
              removeLines(block.start, block.end)
            }
            // Hide decorations for this block either way
            clearBlockDecorations(block.start, block.end)
            dom.remove()
          }
        )
        dom.appendChild(accept)
        dom.appendChild(reject)

        const widget: monaco.editor.IContentWidget = {
          getId: () => `diff-inline-actions-${i}-${block.start}-${block.end}`,
          getDomNode: () => dom,
          getPosition: () => ({
            position: {
              lineNumber: Math.min(block.start, model.getLineCount()),
              column: model.getLineMaxColumn(
                Math.min(block.start, model.getLineCount())
              ),
            },
            preference: [monaco.editor.ContentWidgetPositionPreference.EXACT],
          }),
        }
        editorRef.addContentWidget(widget)
        let hovering = false
        dom.addEventListener("mouseenter", () => {
          hovering = true
          dom.style.display = "flex"
        })
        dom.addEventListener("mouseleave", () => {
          hovering = false
          dom.style.display = "none"
        })

        editorRef.onMouseMove((e) => {
          const el = (e.target.element as HTMLElement) || null
          // Only this widget stays visible if pointer is over it
          if (hovering || (el && dom.contains(el))) {
            dom.style.display = "flex"
            return
          }

          // If pointer is over other widget areas, hide this one
          const overOtherWidget =
            (e.target.type === monaco.editor.MouseTargetType.CONTENT_WIDGET ||
              e.target.type === monaco.editor.MouseTargetType.OVERLAY_WIDGET) &&
            !(el && dom.contains(el))
          if (overOtherWidget) {
            dom.style.display = "none"
            return
          }

          const pos = e.target.position
          if (!pos) {
            dom.style.display = "none"
            return
          }
          const ln = pos.lineNumber
          dom.style.display =
            ln >= block.start && ln <= block.end ? "flex" : "none"
        })
        editorRef.onMouseLeave(() => (dom.style.display = "none"))
      })

      return newDecorations
    },
    [editorRef]
  )

  return {
    handleApplyCode,
  }
}
