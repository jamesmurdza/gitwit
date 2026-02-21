import type { DiffLineType } from "./context"

// ── LCS Algorithm ──────────────────────────────────────────────────────────
// Standard Longest Common Subsequence DP table used to compute minimal diffs
// between the old (SEARCH) and new (REPLACE) lines within each hunk.

function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp
}

/**
 * Backtrack the LCS table to produce a minimal diff.
 * Matching lines → "context", only actual changes → "removed" / "added".
 */
function diffLines(
  oldLines: string[],
  newLines: string[],
  output: string[],
  lineTypes: DiffLineType[],
) {
  const dp = lcsTable(oldLines, newLines)
  const ops: Array<{ type: DiffLineType; line: string }> = []
  let i = oldLines.length
  let j = newLines.length

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.push({ type: "context", line: oldLines[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: "added", line: newLines[j - 1] })
      j--
    } else {
      ops.push({ type: "removed", line: oldLines[i - 1] })
      i--
    }
  }

  ops.reverse()
  for (const op of ops) {
    output.push(op.line)
    lineTypes.push(op.type)
  }
}

// ── Aider Diff Parser ──────────────────────────────────────────────────────
// Parses aider-style SEARCH/REPLACE markers into displayable code with
// per-line diff annotations. Uses LCS within each hunk so only lines that
// actually changed get marked — matching the editor's inline diff view.
//
// Format:
//   <<<<<<< SEARCH
//   old code lines...
//   =======
//   new code lines...
//   >>>>>>> REPLACE

export function parseAiderDiff(
  code: string,
): { displayCode: string; lineTypes: DiffLineType[] } | null {
  if (!code.includes("<<<<<<< SEARCH")) return null

  const lines = code.split("\n")
  const output: string[] = []
  const lineTypes: DiffLineType[] = []
  let section: "outside" | "search" | "replace" = "outside"
  let searchLines: string[] = []
  let replaceLines: string[] = []

  const flushHunk = () => {
    diffLines(searchLines, replaceLines, output, lineTypes)
    searchLines = []
    replaceLines = []
  }

  for (const line of lines) {
    const trimmed = line.trimEnd()
    if (trimmed === "<<<<<<< SEARCH") { section = "search"; continue }
    if (trimmed === "=======" && section === "search") { section = "replace"; continue }
    if (trimmed === ">>>>>>> REPLACE") {
      flushHunk()
      section = "outside"
      continue
    }

    if (section === "search") {
      searchLines.push(line)
    } else if (section === "replace") {
      replaceLines.push(line)
    } else {
      output.push(line)
      lineTypes.push("context")
    }
  }
  flushHunk()

  return { displayCode: output.join("\n"), lineTypes }
}
