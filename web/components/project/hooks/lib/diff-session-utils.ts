interface DiffSessionBlocks {
  combinedText: string
  unresolvedBlocks: {
    type: "added" | "removed"
    start: number
    end: number
  }[]
}

/**
 * Applies "Keep All" logic to a diff session — removes "removed" blocks
 * (accepting the new code) and keeps "added" blocks.
 */
export function applyKeepToSession(session: DiffSessionBlocks): string {
  const lines = session.combinedText.split("\n")
  const rangesToRemove: { start: number; end: number }[] = []

  session.unresolvedBlocks.forEach((block) => {
    if (block.type === "removed") {
      rangesToRemove.push({ start: block.start, end: block.end })
    }
  })

  rangesToRemove.sort((a, b) => b.start - a.start)

  rangesToRemove.forEach((range) => {
    // 1-based index to 0-based
    lines.splice(range.start - 1, range.end - range.start + 1)
  })

  return lines.join("\n")
}

/**
 * Applies "Reject" logic to a diff session — removes "added" blocks
 * (rejecting additions) and keeps "removed" blocks (preserving original).
 */
export function applyRejectToSession(session: DiffSessionBlocks): string {
  const lines = session.combinedText.split("\n")
  const rangesToRemove: { start: number; end: number }[] = []

  session.unresolvedBlocks.forEach((block) => {
    if (block.type === "added") {
      rangesToRemove.push({ start: block.start, end: block.end })
    }
  })

  rangesToRemove.sort((a, b) => b.start - a.start)

  rangesToRemove.forEach((range) => {
    // 1-based index to 0-based
    lines.splice(range.start - 1, range.end - range.start + 1)
  })

  return lines.join("\n")
}
