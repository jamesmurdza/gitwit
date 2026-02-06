/**
 * Aider Diff Format Merge Algorithm
 *
 * Parses and applies search/replace blocks from aider diff format
 * to merge AI-generated changes into original code.
 *
 * Format:
 * file/path
 * <<<<<<< SEARCH
 * original code block
 * =======
 * new code block
 * >>>>>>> REPLACE
 */

export interface AiderDiffBlock {
  filePath: string
  searchLines: string[]
  replaceLines: string[]
}

/**
 * Parses aider diff format from LLM output
 *
 * @param snippet - The LLM output containing aider diff blocks
 * @param defaultFilePath - Default file path if not specified in the snippet
 * @returns Array of parsed diff blocks
 */
export function parseAiderDiff(
  snippet: string,
  defaultFilePath?: string
): AiderDiffBlock[] {
  const blocks: AiderDiffBlock[] = []
  // Remove leading/trailing whitespace
  const trimmed = snippet.trim()

  // Try to detect if we have a file path followed by code blocks
  let lines = trimmed.split("\n")
  let currentFilePath: string | null = null
  let currentBlock: string[] = []
  let inCodeBlock = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check if line looks like a file path
    const isFilePath =
      (line.trim() !== "" &&
        !line.trim().startsWith("```") &&
        !line.trim().startsWith("<<<<<<<") &&
        !line.trim().startsWith("=======") &&
        !line.trim().startsWith(">>>>>>>") &&
        !line.trim().startsWith("<<<") &&
        !line.trim().startsWith(">>>") &&
        !line.trim().startsWith("File:") &&
        (line.trim().indexOf("/") !== -1 ||
          line.trim().indexOf("\\") !== -1)) ||
      line.trim().endsWith(".ts") ||
      line.trim().endsWith(".tsx") ||
      line.trim().endsWith(".js") ||
      line.trim().endsWith(".jsx") ||
      line.trim().endsWith(".html") ||
      line.trim().endsWith(".css") ||
      line.trim().endsWith(".json") ||
      line.trim().endsWith(".py") ||
      line.trim().endsWith(".md")

    if (isFilePath && !inCodeBlock) {
      // Save previous blocks if exists
      if (currentBlock.length > 0 && currentFilePath) {
        const parsedBlocks = parseBlocks(currentBlock.join("\n"))
        for (const parsed of parsedBlocks) {
          blocks.push({
            filePath: currentFilePath,
            ...parsed,
          })
        }
        currentBlock = []
      }
      // Clean file path (remove "File:" prefix, leading slashes)
      currentFilePath = line
        .trim()
        .replace(/^File:\s*/, "")
        .replace(/^\/+/, "")
      continue
    }

    // Check for code block start
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        // End of code block - parse all blocks
        if (currentBlock.length > 0 && currentFilePath) {
          const parsedBlocks = parseBlocks(currentBlock.join("\n"))
          for (const parsed of parsedBlocks) {
            blocks.push({
              filePath: currentFilePath,
              ...parsed,
            })
          }
        }
        currentBlock = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
        currentBlock = []
      }
      continue
    }

    // If we're in a code block or if we find SEARCH markers without code block markers
    if (
      inCodeBlock ||
      line.trim().startsWith("<<<<<<< SEARCH") ||
      line.trim().startsWith("<<< SEARCH")
    ) {
      if (
        !inCodeBlock &&
        (line.trim().startsWith("<<<<<<< SEARCH") ||
          line.trim().startsWith("<<< SEARCH"))
      ) {
        // Raw diff block without code fence - set default file path if not set
        if (!currentFilePath && defaultFilePath) {
          currentFilePath = defaultFilePath
        }
        inCodeBlock = true
      }
      currentBlock.push(line)
    }
  }

  // Handle last blocks if file path was not followed by code block markers
  if (currentBlock.length > 0) {
    const parsedBlocks = parseBlocks(currentBlock.join("\n"))
    if (parsedBlocks.length > 0) {
      if (!currentFilePath && defaultFilePath) {
        currentFilePath = defaultFilePath
      }
      if (currentFilePath) {
        for (const parsed of parsedBlocks) {
          blocks.push({
            filePath: currentFilePath,
            ...parsed,
          })
        }
      }
    }
  }

  // If no blocks found but we have search/replace markers, try parsing the whole thing
  if (
    blocks.length === 0 &&
    (trimmed.includes("<<<<<<< SEARCH") || trimmed.includes("<<< SEARCH"))
  ) {
    const parsedBlocks = parseBlocks(trimmed)
    for (const parsed of parsedBlocks) {
      blocks.push({
        filePath: defaultFilePath || "unknown",
        ...parsed,
      })
    }
  }

  return blocks
}

/**
 * Parses all SEARCH/REPLACE blocks from content
 * Returns array of blocks for multiple blocks in same file
 * Supports both formats: <<<<<<< SEARCH / >>>>>>> REPLACE and <<< SEARCH / >>> REPLACE
 */
function parseBlocks(blockContent: string): Omit<AiderDiffBlock, "filePath">[] {
  const blocks: Omit<AiderDiffBlock, "filePath">[] = []

  // Support both formats: 7 signs and 3 signs
  const searchMarker7 = "<<<<<<< SEARCH"
  const searchMarker3 = "<<< SEARCH"
  const separator = "======="
  const replaceMarker7 = ">>>>>>> REPLACE"
  const replaceMarker3 = ">>> REPLACE"

  let currentIndex = 0

  while (currentIndex < blockContent.length) {
    // Try 7-sign format first, then 3-sign format
    let searchStart = blockContent.indexOf(searchMarker7, currentIndex)
    let searchMarker = searchMarker7
    let replaceMarker = replaceMarker7

    if (searchStart === -1) {
      searchStart = blockContent.indexOf(searchMarker3, currentIndex)
      searchMarker = searchMarker3
      replaceMarker = replaceMarker3
    }

    if (searchStart === -1) {
      break
    }

    const separatorPos = blockContent.indexOf(separator, searchStart)
    if (separatorPos === -1) {
      break
    }

    const replaceEnd = blockContent.indexOf(replaceMarker, separatorPos)
    if (replaceEnd === -1) {
      break
    }

    // Extract search lines (between SEARCH and =======)
    // Don't trim the entire block - preserve exact structure and indentation
    let searchText = blockContent.substring(
      searchStart + searchMarker.length,
      separatorPos
    )
    // Only remove leading/trailing newlines, preserve everything else
    searchText = searchText.replace(/^\n+|\n+$/g, "")

    // Extract replace lines (between ======= and REPLACE)
    // Don't trim the entire block - preserve exact structure and indentation
    let replaceText = blockContent.substring(
      separatorPos + separator.length,
      replaceEnd
    )
    // Only remove leading/trailing newlines, preserve everything else
    replaceText = replaceText.replace(/^\n+|\n+$/g, "")

    const searchLines = searchText ? searchText.split("\n") : []
    const replaceLines = replaceText ? replaceText.split("\n") : []

    // Preserve all lines including empty ones - they're part of the structure
    // Only remove completely empty lines at the very start/end if they exist
    // But preserve internal empty lines and all indentation

    // Allow:
    // - Empty search blocks for new files (searchLines.length === 0, replace has content)
    // - Non-empty search with empty replace for deletions (delete matched region)
    // Skip only when BOTH sides are completely empty.
    if (searchLines.length > 0 || replaceLines.length > 0) {
      blocks.push({
        searchLines,
        replaceLines,
      })
    }

    currentIndex = replaceEnd + replaceMarker.length
  }

  return blocks
}

/**
 * Finds the starting index of a block in the code
 * Tries exact match first (including whitespace), then normalized match (ignoring leading whitespace)
 * Returns -1 for empty search blocks (new files) instead of null
 */
function findBlockInCode(code: string, searchLines: string[]): number | null {
  // Empty search block means it's a new file - return -1 as a special marker
  if (searchLines.length === 0) {
    return -1
  }

  const codeLines = code.split("\n")

  // Try to find exact match first (including whitespace)
  for (let i = 0; i <= codeLines.length - searchLines.length; i++) {
    let match = true
    for (let j = 0; j < searchLines.length; j++) {
      if (codeLines[i + j] !== searchLines[j]) {
        match = false
        break
      }
    }
    if (match) {
      return i
    }
  }

  // If exact match fails, try normalized match (ignoring leading whitespace)
  // This handles cases where indentation might differ slightly
  for (let i = 0; i <= codeLines.length - searchLines.length; i++) {
    let match = true
    for (let j = 0; j < searchLines.length; j++) {
      const codeLine = codeLines[i + j].trim()
      const searchLine = searchLines[j].trim()
      if (codeLine !== searchLine) {
        match = false
        break
      }
    }
    if (match) {
      return i
    }
  }

  return null
}

/**
 * Preserves indentation from original code when replacing
 * Matches lines by content (not position) to handle structural changes
 */
function preserveIndentation(
  originalLines: string[],
  replaceLines: string[],
  searchLines: string[]
): string[] {
  const result: string[] = []

  // Create a map of search line content (trimmed) to original indentation
  // This allows us to match lines even when structure changes (parent tags removed/added)
  const contentToIndentation = new Map<string, string>()
  for (let i = 0; i < searchLines.length && i < originalLines.length; i++) {
    const trimmed = searchLines[i].trim()
    if (trimmed) {
      const originalLine = originalLines[i]
      const originalIndent = originalLine.match(/^(\s*)/)?.[1] || ""
      // Store the indentation for this content
      // If multiple lines have same content, use the first one's indentation
      if (!contentToIndentation.has(trimmed)) {
        contentToIndentation.set(trimmed, originalIndent)
      }
    }
  }

  // Process each line in the replace block
  for (let i = 0; i < replaceLines.length; i++) {
    const replaceLine = replaceLines[i]
    const replaceTrimmed = replaceLine.trim()

    // Always preserve the replace block's indentation as-is
    // The replace block explicitly sets the indentation, so we should respect it
    if (replaceTrimmed) {
      // Line has content - use replace block's indentation exactly as provided
      result.push(replaceLine)
    } else {
      // Empty line - preserve as-is
      result.push(replaceLine)
    }
  }

  return result
}

/**
 * Merges aider diff blocks into original code
 *
 * @param originalCode - The original file content
 * @param diffSnippet - The LLM output containing aider diff format
 * @param filePath - Optional file path for the file being edited
 * @returns The merged code with changes applied
 */
export function mergeAiderDiff(
  originalCode: string,
  diffSnippet: string,
  filePath?: string
): string {
  const blocks = parseAiderDiff(diffSnippet, filePath)

  if (blocks.length === 0) {
    return originalCode
  }

  let result = originalCode

  // Apply blocks in reverse order to maintain correct line indices
  for (let blockIdx = blocks.length - 1; blockIdx >= 0; blockIdx--) {
    const block = blocks[blockIdx]

    const searchStart = findBlockInCode(result, block.searchLines)

    // Handle new files: empty SEARCH block means entire file is new
    if (searchStart === -1) {
      // For new files, just return the replace content
      // If originalCode is empty, this is a new file
      if (result.trim().length === 0) {
        result = block.replaceLines.join("\n")
        continue
      }
      // If originalCode exists but search is empty, skip (shouldn't happen for new files)
      continue
    }

    if (searchStart === null) {
      continue
    }

    const searchEnd = searchStart + block.searchLines.length

    // Replace the block
    const codeLines = result.split("\n")
    const matchedOriginalLines = codeLines.slice(searchStart, searchEnd)

    // Preserve indentation from original code for unchanged lines
    const replacementLines = preserveIndentation(
      matchedOriginalLines,
      block.replaceLines,
      block.searchLines
    )
    const replacement = replacementLines.join("\n")

    const before = codeLines.slice(0, searchStart).join("\n")
    const after = codeLines.slice(searchEnd).join("\n")

    result = [before, replacement, after]
      .filter((part) => part.length > 0)
      .join("\n")
  }

  return result
}
