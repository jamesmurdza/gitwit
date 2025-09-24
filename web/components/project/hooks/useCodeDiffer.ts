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
      // Preserve original model EOL style to avoid phantom last-line changes
      const originalModelEOL = model.getEOL()
      const eolSequence =
        originalModelEOL === "\r\n"
          ? monaco.editor.EndOfLineSequence.CRLF
          : monaco.editor.EndOfLineSequence.LF
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
      // Reapply original EOL style so the last line does not appear changed on CRLF files
      model.setEOL(eolSequence)

      // Create and return decorations collection
      const newDecorations = editorRef.createDecorationsCollection(decorations)

      // Store granular blocks on the model (for later if needed)
      ;(model as any).granularBlocks = granularBlocks

      // Helpers to create consistent floating widget buttons
      const mkBtn = (
        kind: "accept" | "reject",
        color: string,
        title: string,
        onClick: () => void
      ) => {
        const b = document.createElement("button")
        b.title = title
        b.setAttribute("aria-label", title)
        b.style.cursor = "pointer"
        b.style.background = "#ffffff"
        b.style.border = "1px solid hsl(var(--border))"
        b.style.color = color
        b.style.borderRadius = "6px"
        b.style.width = "24px"
        b.style.height = "24px"
        b.style.display = "inline-flex"
        b.style.alignItems = "center"
        b.style.justifyContent = "center"
        b.style.boxShadow = "0 1px 2px rgba(0,0,0,0.08)"
        b.style.padding = "0"
        b.style.lineHeight = "0"
        b.style.pointerEvents = "auto"
        b.style.transition =
          "background-color 120ms ease, box-shadow 120ms ease, transform 60ms ease"

        const svg = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg"
        )
        svg.setAttribute("viewBox", "0 0 24 24")
        svg.setAttribute("fill", "none")
        svg.setAttribute("stroke", "currentColor")
        svg.style.width = "14px"
        svg.style.height = "14px"
        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        )
        path.setAttribute("stroke-linecap", "round")
        path.setAttribute("stroke-linejoin", "round")
        path.setAttribute("stroke-width", "2")
        if (kind === "accept") {
          path.setAttribute("d", "M5 13l4 4L19 7")
        } else {
          path.setAttribute("d", "M6 18L18 6M6 6l12 12")
        }
        svg.appendChild(path)
        b.appendChild(svg)

        b.onmouseenter = () => {
          b.style.background =
            kind === "accept" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)"
          b.style.boxShadow = "0 2px 6px rgba(0,0,0,0.12)"
        }
        b.onmouseleave = () => {
          b.style.background = "#ffffff"
          b.style.boxShadow = "0 1px 2px rgba(0,0,0,0.08)"
        }
        b.onmousedown = () => {
          b.style.transform = "translateY(0.5px)"
        }
        b.onmouseup = () => {
          b.style.transform = "translateY(0)"
        }

        // focus ring for keyboard users
        b.onfocus = () => {
          b.style.boxShadow = `0 0 0 2px rgba(99,102,241,0.35), 0 1px 2px rgba(0,0,0,0.08)`
        }
        b.onblur = () => {
          b.style.boxShadow = "0 1px 2px rgba(0,0,0,0.08)"
        }

        b.onclick = onClick
        return b
      }

      const removeLines = (start: number, end: number) => {
        const startPos = { lineNumber: start, column: 1 }
        const lastLineInModel = model.getLineCount()
        const isEndAtLastLine = end >= lastLineInModel
        // If the block ends before the final line, delete up to the start of the next line
        // Otherwise, delete to the end of the last line to avoid out-of-bounds ranges
        const endLineForRange = isEndAtLastLine ? lastLineInModel : end + 1
        const endColumnForRange = isEndAtLastLine
          ? model.getLineMaxColumn(lastLineInModel)
          : 1

        model.applyEdits([
          {
            range: new monaco.Range(
              startPos.lineNumber,
              startPos.column,
              endLineForRange,
              endColumnForRange
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

      // Create persistent floating widgets per block (block-level controls)
      const widgets: monaco.editor.IContentWidget[] = []

      // Helper to build a widget DOM
      const createWidgetDom = () => {
        const dom = document.createElement("div")
        dom.style.display = "inline-flex"
        dom.style.gap = "6px"
        dom.style.alignItems = "center"
        dom.style.border = "none"
        dom.style.background = "transparent"
        dom.style.borderRadius = "0"
        dom.style.padding = "0"
        dom.style.boxShadow = "none"
        dom.style.zIndex = "1000"
        dom.style.userSelect = "none"
        dom.style.pointerEvents = "auto"
        dom.style.fontSize = "12px"
        return dom
      }

      // Helper: remove all existing diff-block widgets
      const cleanupAllWidgets = () => {
        const store = (editorRef as any).diffBlockWidgets as
          | monaco.editor.IContentWidget[]
          | undefined
        const anchorStore = (editorRef as any).diffBlockWidgetAnchors as
          | string[]
          | undefined
        if (store && Array.isArray(store)) {
          for (const w of [...store]) {
            try {
              editorRef.removeContentWidget(w)
            } catch {}
          }
        }
        if (
          anchorStore &&
          Array.isArray(anchorStore) &&
          anchorStore.length > 0
        ) {
          try {
            model.deltaDecorations(anchorStore, [])
          } catch {}
        }
        ;(editorRef as any).diffBlockWidgets = []
        ;(editorRef as any).diffBlockWidgetAnchors = []
      }

      // Build widgets from live decoration ranges so they survive edits
      const buildAllWidgetsFromDecorations = () => {
        cleanupAllWidgets()
        const processedAnchors = new Set<number>()
        const maxLines = model.getLineCount()
        // reset local stores
        widgets.length = 0
        const anchorIds: string[] = []
        for (let ln = 1; ln <= maxLines; ln++) {
          const isRemoved = lineHasClass(ln, "removed-line-decoration")
          const isAdded = lineHasClass(ln, "added-line-decoration")
          if (!isRemoved && !isAdded) continue

          // Compute this block range and modification partner
          const type: "added" | "removed" = isRemoved ? "removed" : "added"
          const range = getLiveRange(type, ln)
          const partner = getModifyPartnerIfAny(range, type)

          // For modification pairs, only show one widget on the red block
          if (type === "added" && partner) {
            // skip green side
            ln = range.end
            continue
          }

          // Prevent duplicate widgets for the same contiguous block
          const anchorLine = range.end // place after last red line (or end of block)
          if (processedAnchors.has(anchorLine)) {
            ln = range.end
            continue
          }
          processedAnchors.add(anchorLine)

          const dom = createWidgetDom()
          let widget: monaco.editor.IContentWidget
          // Create an invisible, resilient anchor decoration that tracks text edits
          const [anchorDecoId] = model.deltaDecorations(
            [],
            [
              {
                range: new monaco.Range(anchorLine, 1, anchorLine, 1),
                options: {
                  className: "",
                  isWholeLine: false,
                  stickiness:
                    monaco.editor.TrackedRangeStickiness
                      .NeverGrowsWhenTypingAtEdges,
                },
              },
            ]
          )
          anchorIds.push(anchorDecoId)
          const removeWidget = () => {
            try {
              if (widget) editorRef.removeContentWidget(widget)
            } catch {}
            try {
              if (anchorDecoId) model.deltaDecorations([anchorDecoId], [])
            } catch {}
            const store = (editorRef as any).diffBlockWidgets as
              | monaco.editor.IContentWidget[]
              | undefined
            if (store) {
              const idx = store.indexOf(widget)
              if (idx >= 0) store.splice(idx, 1)
            }
          }

          const doAccept = () => {
            // Recalculate live range and partner at click time to handle line shifts
            const safeAnchor = Math.min(anchorLine, model.getLineCount())
            const liveRange = getLiveRange(type, safeAnchor)
            const livePartner = getModifyPartnerIfAny(liveRange, type)
            console.log("ACCEPT_BLOCK", {
              type,
              range: liveRange,
              partner: livePartner,
            })
            if (type === "removed") {
              // Clear decorations first to avoid stale ids after text mutation
              clearBlockDecorations(liveRange.start, liveRange.end)
              if (livePartner)
                clearBlockDecorations(livePartner.start, livePartner.end)
              removeLines(liveRange.start, liveRange.end)
            } else {
              // type === 'added'
              clearBlockDecorations(liveRange.start, liveRange.end)
            }
            // Remove this widget immediately after action
            removeWidget()
            // Rebuild all widgets so positions are recalculated against fresh decorations/content
            requestAnimationFrame(() => {
              try {
                buildAllWidgetsFromDecorations()
              } catch {}
            })
          }
          const doReject = () => {
            const safeAnchor = Math.min(anchorLine, model.getLineCount())
            const liveRange = getLiveRange(type, safeAnchor)
            const livePartner = getModifyPartnerIfAny(liveRange, type)
            console.log("REJECT_BLOCK", {
              type,
              range: liveRange,
              partner: livePartner,
            })
            // Remove this widget first to avoid layout jitter for neighbors
            removeWidget()
            if (type === "added") {
              // Clear decorations first, then remove text to ensure full cleanup
              clearBlockDecorations(liveRange.start, liveRange.end)
              removeLines(liveRange.start, liveRange.end)
            } else {
              // type === 'removed'
              clearBlockDecorations(liveRange.start, liveRange.end)
              if (livePartner) {
                // For modification pairs, also remove the green partner when rejecting
                clearBlockDecorations(livePartner.start, livePartner.end)
                removeLines(livePartner.start, livePartner.end)
              }
            }
            // Rebuild all widgets so positions are recalculated against fresh decorations/content
            requestAnimationFrame(() => {
              try {
                buildAllWidgetsFromDecorations()
              } catch {}
            })
          }

          const acceptBtn = mkBtn("accept", "#22c55e", "Accept block", doAccept)
          const rejectBtn = mkBtn("reject", "#ef4444", "Reject block", doReject)
          dom.appendChild(acceptBtn)
          dom.appendChild(rejectBtn)

          const seedLine = anchorLine
          widget = {
            getId: () => `diff-block-actions-${anchorLine}-${type}`,
            getDomNode: () => dom,
            getPosition: () => {
              // Resolve anchor via decoration to survive upstream edits
              const anchorRange = model.getDecorationRange(anchorDecoId)
              const anchorLn = anchorRange
                ? anchorRange.startLineNumber
                : Math.min(seedLine, model.getLineCount())
              const live = getLiveRange(type, anchorLn)
              const ln = Math.min(live.end, model.getLineCount())
              return {
                position: {
                  lineNumber: ln,
                  column: model.getLineMaxColumn(ln) + 2,
                },
                preference: [
                  monaco.editor.ContentWidgetPositionPreference.BELOW,
                  monaco.editor.ContentWidgetPositionPreference.ABOVE,
                  monaco.editor.ContentWidgetPositionPreference.EXACT,
                ],
              }
            },
            allowEditorOverflow: true,
          }
          editorRef.addContentWidget(widget)
          widgets.push(widget)

          // Skip to end of this contiguous block for loop efficiency
          ln = range.end
        }
        // persist stores
        ;(editorRef as any).diffBlockWidgets = widgets
        ;(editorRef as any).diffBlockWidgetAnchors = anchorIds
      }

      // Initial build
      buildAllWidgetsFromDecorations()

      // Store widgets for potential external cleanup
      ;(editorRef as any).diffBlockWidgets = widgets

      return newDecorations
    },
    [editorRef]
  )

  return {
    handleApplyCode,
  }
}
