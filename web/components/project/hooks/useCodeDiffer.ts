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

      // Single hover-driven widget that recomputes live ranges from decorations
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

      const getLiveRange = (
        type: "added" | "removed",
        seed: number
      ): { start: number; end: number } => {
        const className =
          type === "added" ? "added-line-decoration" : "removed-line-decoration"
        const hasClass = (ln: number) => {
          const decs = model.getLineDecorations(ln) || []
          return decs.some((d) => (d.options as any)?.className === className)
        }
        if (!hasClass(seed)) return { start: seed, end: seed }
        let s = seed
        let e = seed
        while (s > 1 && hasClass(s - 1)) s--
        const max = model.getLineCount()
        while (e < max && hasClass(e + 1)) e++
        return { start: s, end: e }
      }

      const lineHasClass = (ln: number, cls: string) => {
        const decs = model.getLineDecorations(ln) || []
        return decs.some((d) => (d.options as any)?.className === cls)
      }

      const getModifyPartnerIfAny = (
        range: { start: number; end: number },
        type: "added" | "removed"
      ): { start: number; end: number } | null => {
        // If current is removed, partner is added right after; if current is added, partner is removed right before
        if (type === "removed") {
          const probeNext = range.end + 1
          if (lineHasClass(probeNext, "added-line-decoration")) {
            return getLiveRange("added", probeNext)
          }
        } else {
          const probePrev = range.start - 1
          if (
            probePrev >= 1 &&
            lineHasClass(probePrev, "removed-line-decoration")
          ) {
            return getLiveRange("removed", probePrev)
          }
        }
        return null
      }

      type HoverState = {
        type: "added" | "removed"
        range: { start: number; end: number }
        partner: { start: number; end: number } | null
        anchorLine: number
      } | null
      let currentHover: HoverState = null

      const accept = mkBtn("✓", "#22c55e", "Accept change", () => {
        if (!currentHover) return
        const { type, range, partner } = currentHover
        console.log("ACCEPT_CHUNK", { type, range, partner })
        if (type === "removed") {
          removeLines(range.start, range.end)
          clearBlockDecorations(range.start, range.end)
          if (partner) clearBlockDecorations(partner.start, partner.end)
        } else {
          clearBlockDecorations(range.start, range.end)
        }
        dom.style.display = "none"
      })
      const reject = mkBtn("✕", "#ef4444", "Reject change", () => {
        if (!currentHover) return
        const { type, range, partner } = currentHover
        console.log("REJECT_CHUNK", { type, range, partner })
        if (type === "added") {
          removeLines(range.start, range.end)
          clearBlockDecorations(range.start, range.end)
        } else {
          clearBlockDecorations(range.start, range.end)
          if (partner) clearBlockDecorations(partner.start, partner.end)
        }
        dom.style.display = "none"
      })
      dom.appendChild(accept)
      dom.appendChild(reject)

      const widget: monaco.editor.IContentWidget = {
        getId: () => `diff-inline-actions-hover`,
        getDomNode: () => dom,
        getPosition: () => ({
          position: currentHover
            ? {
                lineNumber: Math.min(
                  currentHover.anchorLine,
                  model.getLineCount()
                ),
                column: model.getLineMaxColumn(
                  Math.min(currentHover.anchorLine, model.getLineCount())
                ),
              }
            : { lineNumber: 1, column: 1 },
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

      const updateHoverFromLine = (ln: number) => {
        const isAdded = lineHasClass(ln, "added-line-decoration")
        const isRemoved = lineHasClass(ln, "removed-line-decoration")
        if (!isAdded && !isRemoved) {
          currentHover = null
          dom.style.display = "none"
          return
        }
        const type: "added" | "removed" = isAdded ? "added" : "removed"
        const range = getLiveRange(type, ln)
        const partner = getModifyPartnerIfAny(range, type)
        // Modification pair: only show when hovering the red portion
        if (type === "added" && partner) {
          currentHover = null
          dom.style.display = "none"
          return
        }
        // For modifications (red+green pair), always anchor the widget to the red block
        const anchorLine =
          type === "added" && partner ? partner.start : range.start
        currentHover = { type, range, partner, anchorLine }
        dom.style.display = "flex"
        editorRef.layoutContentWidget(widget)
      }

      editorRef.onMouseMove((e) => {
        const el = (e.target.element as HTMLElement) || null
        if (hovering || (el && dom.contains(el))) {
          dom.style.display = "flex"
          return
        }
        const pos = e.target.position
        if (!pos) {
          currentHover = null
          dom.style.display = "none"
          return
        }
        updateHoverFromLine(pos.lineNumber)
      })
      editorRef.onMouseLeave(() => {
        currentHover = null
        dom.style.display = "none"
      })

      return newDecorations
    },
    [editorRef]
  )

  return {
    handleApplyCode,
  }
}
