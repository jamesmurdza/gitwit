import { LineRange } from "@/lib/types"
import * as monaco from "monaco-editor"

/**
 * Manages decorations and line operations for diff blocks
 */
export class DecorationManager {
  constructor(private model: monaco.editor.ITextModel) {}

  /**
   * Removes lines from the model within the specified range
   *
   * @param range - The line range to remove
   */
  removeLines(range: LineRange): void {
    const startPos = { lineNumber: range.start, column: 1 }
    const lastLineInModel = this.model.getLineCount()
    const isEndAtLastLine = range.end >= lastLineInModel

    // If the block ends before the final line, delete up to the start of the next line
    // Otherwise, delete to the end of the last line to avoid out-of-bounds ranges
    const endLineForRange = isEndAtLastLine ? lastLineInModel : range.end + 1
    const endColumnForRange = isEndAtLastLine
      ? this.model.getLineMaxColumn(lastLineInModel)
      : 1

    this.model.applyEdits([
      {
        range: new monaco.Range(
          startPos.lineNumber,
          startPos.column,
          endLineForRange,
          endColumnForRange,
        ),
        text: "",
      },
    ])
  }

  /**
   * Clears decorations for a specific block range
   *
   * @param range - The line range to clear decorations for
   */
  clearBlockDecorations(range: LineRange): void {
    const decorationIds: string[] = []

    for (let lineNumber = range.start; lineNumber <= range.end; lineNumber++) {
      const decorations = this.model.getLineDecorations(lineNumber) || []
      decorations.forEach((decoration) => {
        const className = decoration.options.className
        if (
          className === "added-line-decoration" ||
          className === "removed-line-decoration"
        ) {
          decorationIds.push(decoration.id)
        }
      })
    }

    if (decorationIds.length > 0) {
      this.model.deltaDecorations(decorationIds, [])
    }
  }

  /**
   * Gets the live range of a diff block based on decoration classes
   *
   * @param type - The type of diff block (added or removed)
   * @param seedLine - The starting line to search from
   * @returns The live range of the diff block
   */
  getLiveRange(type: "added" | "removed", seedLine: number): LineRange {
    const className =
      type === "added" ? "added-line-decoration" : "removed-line-decoration"

    const hasClass = (lineNumber: number) => {
      const decorations = this.model.getLineDecorations(lineNumber) || []
      return decorations.some((d) => d.options.className === className)
    }

    if (!hasClass(seedLine)) {
      return { start: seedLine, end: seedLine }
    }

    let start = seedLine
    let end = seedLine

    // Expand range backwards
    while (start > 1 && hasClass(start - 1)) {
      start--
    }

    // Expand range forwards
    const maxLines = this.model.getLineCount()
    while (end < maxLines && hasClass(end + 1)) {
      end++
    }

    return { start, end }
  }

  /**
   * Checks if a line has a specific decoration class
   *
   * @param lineNumber - The line number to check
   * @param className - The decoration class to look for
   * @returns True if the line has the decoration class
   */
  lineHasClass(lineNumber: number, className: string): boolean {
    const decorations = this.model.getLineDecorations(lineNumber) || []
    return decorations.some((d) => d.options.className === className)
  }

  /**
   * Finds the modification partner for a diff block
   * For removed blocks, looks for added blocks after
   * For added blocks, looks for removed blocks before
   *
   * @param range - The current block range
   * @param type - The type of the current block
   * @returns The partner range if found, null otherwise
   */
  getModificationPartner(
    range: LineRange,
    type: "added" | "removed",
  ): LineRange | null {
    if (type === "removed") {
      // Look for added block after removed block
      const probeLine = range.end + 1
      if (this.lineHasClass(probeLine, "added-line-decoration")) {
        return this.getLiveRange("added", probeLine)
      }
    } else {
      // Look for removed block before added block
      const probeLine = range.start - 1
      if (
        probeLine >= 1 &&
        this.lineHasClass(probeLine, "removed-line-decoration")
      ) {
        return this.getLiveRange("removed", probeLine)
      }
    }

    return null
  }

  /**
   * Creates an invisible anchor decoration for widget positioning
   *
   * @param lineNumber - The line number for the anchor
   * @returns The decoration ID
   */
  createAnchorDecoration(lineNumber: number): string {
    const [decorationId] = this.model.deltaDecorations(
      [],
      [
        {
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            className: "",
            isWholeLine: false,
            stickiness:
              monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        },
      ],
    )

    return decorationId
  }

  /**
   * Removes an anchor decoration
   *
   * @param decorationId - The decoration ID to remove
   */
  removeAnchorDecoration(decorationId: string): void {
    try {
      this.model.deltaDecorations([decorationId], [])
    } catch (error) {
      // Ignore errors if decoration doesn't exist
    }
  }
}
