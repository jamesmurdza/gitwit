import { DiffBlock, DiffConfig, DiffResult } from "@/lib/types"
import * as diff from "diff"
import * as monaco from "monaco-editor"

/**
 * Calculates the diff between original and merged code and creates the combined view
 * with appropriate decorations for added/removed lines
 *
 * @param originalCode - The original code content
 * @param mergedCode - The merged code content
 * @param config - Configuration for diff calculation
 * @returns DiffResult containing combined lines, decorations, and granular blocks
 */
export function calculateDiff(
  originalCode: string,
  mergedCode: string,
  config: DiffConfig = { ignoreWhitespace: false }
): DiffResult {
  const combinedLines: string[] = []
  const decorations: monaco.editor.IModelDeltaDecoration[] = []
  const granularBlocks: DiffBlock[] = []
  let lineNumber = 1

  // Normalize line endings for consistent diff calculation
  const normalizedOriginal = originalCode
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
  const normalizedMerged = mergedCode
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")

  // Calculate diff using the diff library
  const diffResult = diff.diffLines(
    normalizedOriginal,
    normalizedMerged,
    config
  )

  diffResult.forEach((part: any) => {
    if (part.removed) {
      const {
        lines,
        decorations: partDecorations,
        block,
      } = processRemovedLines(part.value, lineNumber)
      combinedLines.push(...lines)
      decorations.push(...partDecorations)
      if (block) granularBlocks.push(block)
      lineNumber += lines.length
    } else if (part.added) {
      const {
        lines,
        decorations: partDecorations,
        block,
      } = processAddedLines(part.value, lineNumber)
      combinedLines.push(...lines)
      decorations.push(...partDecorations)
      if (block) granularBlocks.push(block)
      lineNumber += lines.length
    } else {
      const lines = processUnchangedLines(part.value)
      combinedLines.push(...lines)
      lineNumber += lines.length
    }
  })

  return {
    combinedLines,
    decorations,
    granularBlocks,
  }
}

/**
 * Processes removed lines and creates appropriate decorations
 *
 * @param value - The text content to process
 * @param startLineNumber - The starting line number for decorations
 * @returns Object containing lines, decorations, and block information
 */
function processRemovedLines(
  value: string,
  startLineNumber: number
): {
  lines: string[]
  decorations: monaco.editor.IModelDeltaDecoration[]
  block: DiffBlock | null
} {
  const lines = value.split("\n").filter((line: string) => line !== "")
  const decorations: monaco.editor.IModelDeltaDecoration[] = []
  const blockStart = startLineNumber

  lines.forEach((_: string, index: number) => {
    const lineNumber = startLineNumber + index
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
  })

  const blockEnd = startLineNumber + lines.length - 1
  const block: DiffBlock | null =
    blockEnd >= blockStart
      ? { type: "removed", start: blockStart, end: blockEnd }
      : null

  return { lines, decorations, block }
}

/**
 * Processes added lines and creates appropriate decorations
 *
 * @param value - The text content to process
 * @param startLineNumber - The starting line number for decorations
 * @returns Object containing lines, decorations, and block information
 */
function processAddedLines(
  value: string,
  startLineNumber: number
): {
  lines: string[]
  decorations: monaco.editor.IModelDeltaDecoration[]
  block: DiffBlock | null
} {
  const lines = value.split("\n").filter((line: string) => line !== "")
  const decorations: monaco.editor.IModelDeltaDecoration[] = []
  const blockStart = startLineNumber

  lines.forEach((_: string, index: number) => {
    const lineNumber = startLineNumber + index
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
  })

  const blockEnd = startLineNumber + lines.length - 1
  const block: DiffBlock | null =
    blockEnd >= blockStart
      ? { type: "added", start: blockStart, end: blockEnd }
      : null

  return { lines, decorations, block }
}

/**
 * Processes unchanged lines (no decorations needed)
 *
 * @param value - The text content to process
 * @returns Array of unchanged lines
 */
function processUnchangedLines(value: string): string[] {
  return value.split("\n").filter((line: string) => line !== "")
}
